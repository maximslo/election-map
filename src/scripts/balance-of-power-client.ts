import {
	CUSTOM_PROPERTY,
	DATA_ATTRIBUTE,
	KEY,
	MILLISECONDS_PER_SECOND,
} from '../config/constants';
import { createEasing, type EasingFunction } from '../lib/cubic-bezier';

const FALLBACK_EASING = 'cubic-bezier(0, 0, 0.58, 1)';

/** What a panel is showing right now, so the next one can carry on from it. */
type PanelSnapshot = {
	counts: number[];
	segmentWidths: number[];
};

const pendingCountUps = new WeakMap<HTMLElement, number>();

const countersOf = (panel: HTMLElement): HTMLElement[] =>
	Array.from(panel.querySelectorAll(`[${DATA_ATTRIBUTE.counter}]`));

const segmentsOf = (panel: HTMLElement): HTMLElement[] =>
	Array.from(panel.querySelectorAll(`[${DATA_ATTRIBUTE.segment}]`));

const readCustomProperty = (element: HTMLElement, name: string): string =>
	getComputedStyle(element).getPropertyValue(name).trim();

// The stylesheet owns the timing, and drops the duration to zero under prefers-reduced-motion.
const readDurationMs = (element: HTMLElement): number => {
	const declared = readCustomProperty(element, CUSTOM_PROPERTY.revealDuration);
	const value = Number.parseFloat(declared);

	return declared.endsWith('ms') ? value : value * MILLISECONDS_PER_SECOND;
};

const readEasing = (element: HTMLElement): string =>
	readCustomProperty(element, CUSTOM_PROPERTY.transitionEasing) || FALLBACK_EASING;

const countTo = (
	element: HTMLElement,
	from: number,
	to: number,
	durationMs: number,
	ease: EasingFunction,
): void => {
	const pending = pendingCountUps.get(element);

	if (pending !== undefined) {
		cancelAnimationFrame(pending);
	}

	if (!(durationMs > 0)) {
		element.textContent = String(to);
		return;
	}

	// Take the starting value now: waiting for the first frame would flash the server-rendered one.
	element.textContent = String(Math.round(from));

	const startedAt = performance.now();

	const step = (now: number): void => {
		const progress = Math.min((now - startedAt) / durationMs, 1);
		element.textContent = String(Math.round(from + (to - from) * ease(progress)));

		if (progress < 1) {
			pendingCountUps.set(element, requestAnimationFrame(step));
		}
	};

	pendingCountUps.set(element, requestAnimationFrame(step));
};

const growSegment = (
	segment: HTMLElement,
	fromWidth: number,
	durationMs: number,
	easing: string,
): void => {
	// Cancel first so the measurement below reads the stylesheet's width, not an in-flight one.
	segment.getAnimations().forEach((animation) => animation.cancel());

	if (!(durationMs > 0)) {
		return;
	}

	const toWidth = segment.getBoundingClientRect().width;

	segment.animate([{ width: `${fromWidth}px` }, { width: `${toWidth}px` }], {
		duration: durationMs,
		easing,
	});
};

const snapshotPanel = (panel: HTMLElement): PanelSnapshot => ({
	counts: countersOf(panel).map((counter) => Number(counter.textContent)),
	segmentWidths: segmentsOf(panel).map((segment) => segment.getBoundingClientRect().width),
});

const revealPanel = (panel: HTMLElement, previous: PanelSnapshot | null): void => {
	const durationMs = readDurationMs(panel);
	const easing = readEasing(panel);
	const ease = createEasing(easing);

	countersOf(panel).forEach((counter, index) => {
		const target = Number(counter.getAttribute(DATA_ATTRIBUTE.counterTarget));
		countTo(counter, previous?.counts[index] ?? 0, target, durationMs, ease);
	});

	segmentsOf(panel).forEach((segment, index) => {
		growSegment(segment, previous?.segmentWidths[index] ?? 0, durationMs, easing);
	});
};

const connectSwitcher = (root: HTMLElement): void => {
	const tablist = root.querySelector<HTMLElement>('[role="tablist"]');
	const tabs = Array.from(root.querySelectorAll<HTMLElement>(`[${DATA_ATTRIBUTE.tab}]`));
	const panels = Array.from(root.querySelectorAll<HTMLElement>(`[${DATA_ATTRIBUTE.panel}]`));

	if (!tablist || tabs.length !== panels.length) {
		return;
	}

	let hasRevealed = false;

	const activate = (index: number, moveFocus: boolean): void => {
		const outgoing = panels.find((panel) => !panel.hidden);
		const previous = hasRevealed && outgoing ? snapshotPanel(outgoing) : null;

		tablist.style.setProperty(CUSTOM_PROPERTY.activeIndex, String(index));

		tabs.forEach((tab, tabIndex) => {
			const isActive = tabIndex === index;
			tab.setAttribute('aria-selected', String(isActive));
			tab.tabIndex = isActive ? 0 : -1;
		});

		panels.forEach((panel, panelIndex) => {
			panel.hidden = panelIndex !== index;
		});

		revealPanel(panels[index], previous);
		hasRevealed = true;

		if (moveFocus) {
			tabs[index].focus();
		}
	};

	const activeIndexFromDom = tabs.findIndex((tab) => tab.getAttribute('aria-selected') === 'true');
	const initialIndex = activeIndexFromDom === -1 ? 0 : activeIndexFromDom;

	tabs.forEach((tab, index) => {
		tab.addEventListener('click', () => activate(index, false));
	});

	tablist.addEventListener('keydown', (event: KeyboardEvent) => {
		const currentIndex = tabs.findIndex((tab) => tab === document.activeElement);

		if (currentIndex === -1) {
			return;
		}

		const nextIndexByKey: Record<string, number> = {
			[KEY.arrowLeft]: (currentIndex - 1 + tabs.length) % tabs.length,
			[KEY.arrowRight]: (currentIndex + 1) % tabs.length,
			[KEY.home]: 0,
			[KEY.end]: tabs.length - 1,
		};

		const nextIndex = nextIndexByKey[event.key];

		if (nextIndex === undefined) {
			return;
		}

		event.preventDefault();
		activate(nextIndex, true);
	});

	activate(initialIndex, false);
};

export const initBalanceOfPower = (): void => {
	const roots = document.querySelectorAll<HTMLElement>(`[${DATA_ATTRIBUTE.root}]`);

	roots.forEach(connectSwitcher);
};
