import {
	CUSTOM_PROPERTY,
	DATA_ATTRIBUTE,
	DIGIT_STAGGER,
	KEY,
	MILLISECONDS_PER_SECOND,
	NUMBER_ANIMATION_INPUT_NAME,
	NUMBER_ANIMATION_MODE,
	type NumberAnimationMode,
} from '../config/constants';
import { createEasing, type EasingFunction } from '../lib/cubic-bezier';

const FALLBACK_EASING = 'cubic-bezier(0, 0, 0.58, 1)';
const DIGIT_WHEEL_SIZE = 10;

/** What a panel is showing right now, so the next one can carry on from it. */
type PanelSnapshot = {
	counts: number[];
	segmentWidths: number[];
};

/** One digit place's wheel: ten stacked digit spans, and the place value (1, 10, 100, ...) it represents. */
type DigitSlot = {
	digitSpans: HTMLElement[];
	place: number;
};

const pendingCountUps = new WeakMap<HTMLElement, number>();
const pendingSlides = new WeakMap<HTMLElement, number>();

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

const readNumberProperty = (element: HTMLElement, name: string): number =>
	Number.parseFloat(readCustomProperty(element, name)) || 0;

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
		element.setAttribute(DATA_ATTRIBUTE.currentValue, String(to));
		return;
	}

	// Take the starting value now: waiting for the first frame would flash the server-rendered one.
	element.textContent = String(Math.round(from));
	element.setAttribute(DATA_ATTRIBUTE.currentValue, String(Math.round(from)));

	const startedAt = performance.now();

	const step = (now: number): void => {
		const progress = Math.min((now - startedAt) / durationMs, 1);
		const current = Math.round(from + (to - from) * ease(progress));
		element.textContent = String(current);
		element.setAttribute(DATA_ATTRIBUTE.currentValue, String(current));

		if (progress < 1) {
			pendingCountUps.set(element, requestAnimationFrame(step));
		}
	};

	pendingCountUps.set(element, requestAnimationFrame(step));
};

// Same eased tween as countTo, with a motion blur that's loudest at the start and decays
// linearly to zero over its own --bop-count-blur-fraction of the duration. That's deliberately
// decoupled from the reveal curve's own (tail-heavy) deceleration: gating blur on "currently
// moving faster than this tween's average rate" sounds right but, for a curve shaped like ours,
// resolves to a near-instant cutoff, since a tail-heavy curve spends most of its own duration
// below its average rate by construction. A duration of its own is easier to reason about and
// to extend.
const countToWithBlur = (
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

	const maxBlurPx = readNumberProperty(element, CUSTOM_PROPERTY.countBlurMax);
	const blurFraction = readNumberProperty(element, CUSTOM_PROPERTY.countBlurFraction) || 1;

	if (!(durationMs > 0)) {
		element.textContent = String(to);
		element.setAttribute(DATA_ATTRIBUTE.currentValue, String(to));
		return;
	}

	element.textContent = String(Math.round(from));
	element.setAttribute(DATA_ATTRIBUTE.currentValue, String(Math.round(from)));

	const startedAt = performance.now();

	const step = (now: number): void => {
		const progress = Math.min((now - startedAt) / durationMs, 1);
		const current = Math.round(from + (to - from) * ease(progress));
		const blurProgress = Math.min(progress / blurFraction, 1);
		const blurPx = maxBlurPx * (1 - blurProgress);

		element.textContent = String(current);
		element.setAttribute(DATA_ATTRIBUTE.currentValue, String(current));
		element.style.filter = blurPx > 0.1 ? `blur(${blurPx}px)` : '';

		if (progress < 1) {
			pendingCountUps.set(element, requestAnimationFrame(step));
		} else {
			element.style.filter = '';
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

// jakubantalik/transitions.dev — 02-number-pop-in: each digit re-enters independently,
// with the last two staggered, instead of the value tweening through every step between.
const popInDigits = (element: HTMLElement, value: number): void => {
	element.removeAttribute(DATA_ATTRIBUTE.digitAnimating);

	const characters = String(value).split('');
	const fragment = document.createDocumentFragment();

	characters.forEach((character, index) => {
		const digit = document.createElement('span');
		digit.className = 'bar__digit';
		digit.textContent = character;

		if (index === characters.length - 2) {
			digit.setAttribute(DATA_ATTRIBUTE.digitStagger, DIGIT_STAGGER.first);
		} else if (index === characters.length - 1) {
			digit.setAttribute(DATA_ATTRIBUTE.digitStagger, DIGIT_STAGGER.second);
		}

		fragment.append(digit);
	});

	element.replaceChildren(fragment);
	void element.offsetWidth; // force a reflow so re-adding the trigger attribute replays the animation
	element.setAttribute(DATA_ATTRIBUTE.digitAnimating, '');
	element.setAttribute(DATA_ATTRIBUTE.currentValue, String(value));
};

// motion-primitives/sliding-number, ported off Framer's spring onto this file's own rAF tween.
// One slot per digit place; each holds all ten digits, and a single "reel position" per slot
// (fromDigit easing to toDigit) decides which one is centered — the same math the source uses
// to keep every stacked digit positioned sensibly relative to whichever one is currently showing.
const buildDigitSlots = (counter: HTMLElement, from: number, digitCount: number): DigitSlot[] => {
	const fragment = document.createDocumentFragment();
	const slots: DigitSlot[] = [];
	// A slot's place is beyond what `from` needed to be written out, so it's animating in
	// from nothing rather than rolling from a digit that was actually on screen.
	const highestExistingPlace = 10 ** String(from).length;

	for (let position = 0; position < digitCount; position += 1) {
		const place = 10 ** (digitCount - position - 1);
		const isNewSlot = place >= highestExistingPlace;
		const slot = document.createElement('span');
		slot.className = 'bar__slot';

		const spacer = document.createElement('span');
		spacer.className = 'bar__slot-spacer';
		spacer.setAttribute('aria-hidden', 'true');
		spacer.textContent = '0';
		slot.append(spacer);

		const digitSpans: HTMLElement[] = [];

		for (let digit = 0; digit < DIGIT_WHEEL_SIZE; digit += 1) {
			const digitSpan = document.createElement('span');
			digitSpan.className = 'bar__slot-digit';
			// The reel still starts at position 0 for a new slot, but that zero was never
			// really "there" — leave it blank so the slot looks like it grows in from empty.
			digitSpan.textContent = isNewSlot && digit === 0 ? '' : String(digit);
			slot.append(digitSpan);
			digitSpans.push(digitSpan);
		}

		fragment.append(slot);
		slots.push({ digitSpans, place });
	}

	counter.replaceChildren(fragment);

	return slots;
};

const positionDigitSlot = (digitSpans: HTMLElement[], reelPosition: number, slotHeight: number): void => {
	const wheelPosition = ((reelPosition % DIGIT_WHEEL_SIZE) + DIGIT_WHEEL_SIZE) % DIGIT_WHEEL_SIZE;

	digitSpans.forEach((digitSpan, digit) => {
		let offset = (DIGIT_WHEEL_SIZE + digit - wheelPosition) % DIGIT_WHEEL_SIZE;

		if (offset > DIGIT_WHEEL_SIZE / 2) {
			offset -= DIGIT_WHEEL_SIZE;
		}

		digitSpan.style.transform = `translateY(${offset * slotHeight}px)`;
	});
};

const slideDigits = (
	element: HTMLElement,
	from: number,
	to: number,
	durationMs: number,
	ease: EasingFunction,
): void => {
	const pending = pendingSlides.get(element);

	if (pending !== undefined) {
		cancelAnimationFrame(pending);
	}

	const slots = buildDigitSlots(element, from, String(to).length);
	const slotHeight = slots[0]?.digitSpans[0]?.getBoundingClientRect().height ?? 0;

	const applyProgress = (linearProgress: number): void => {
		const easedProgress = ease(linearProgress);

		element.setAttribute(
			DATA_ATTRIBUTE.currentValue,
			String(Math.round(from + (to - from) * easedProgress)),
		);

		slots.forEach(({ digitSpans, place }) => {
			const fromDigit = Math.floor(from / place) % DIGIT_WHEEL_SIZE;
			const toDigit = Math.floor(to / place) % DIGIT_WHEEL_SIZE;
			const reelPosition = fromDigit + (toDigit - fromDigit) * easedProgress;

			positionDigitSlot(digitSpans, reelPosition, slotHeight);
		});
	};

	if (!(durationMs > 0)) {
		applyProgress(1);
		return;
	}

	applyProgress(0);

	const startedAt = performance.now();

	const step = (now: number): void => {
		const progress = Math.min((now - startedAt) / durationMs, 1);
		applyProgress(progress);

		if (progress < 1) {
			pendingSlides.set(element, requestAnimationFrame(step));
		}
	};

	pendingSlides.set(element, requestAnimationFrame(step));
};

const snapshotPanel = (panel: HTMLElement): PanelSnapshot => ({
	// Slide mode stacks all ten digits per place, so textContent is garbled there — the
	// currently-shown value is tracked separately by every mode instead.
	counts: countersOf(panel).map((counter) =>
		Number(counter.getAttribute(DATA_ATTRIBUTE.currentValue) ?? counter.textContent),
	),
	segmentWidths: segmentsOf(panel).map((segment) => segment.getBoundingClientRect().width),
});

const revealPanel = (
	panel: HTMLElement,
	previous: PanelSnapshot | null,
	mode: NumberAnimationMode,
): void => {
	const durationMs = readDurationMs(panel);
	const easing = readEasing(panel);
	const ease = createEasing(easing);

	countersOf(panel).forEach((counter, index) => {
		const target = Number(counter.getAttribute(DATA_ATTRIBUTE.counterTarget));

		const from = previous?.counts[index] ?? 0;

		// Only the blur mode ever sets this; clearing it before every mode dispatch means
		// switching away from blur mid-animation can't leave a stale filter behind.
		counter.style.filter = '';

		if (mode === NUMBER_ANIMATION_MODE.popIn) {
			popInDigits(counter, target);
		} else if (mode === NUMBER_ANIMATION_MODE.slide) {
			slideDigits(counter, from, target, durationMs, ease);
		} else if (mode === NUMBER_ANIMATION_MODE.blur) {
			countToWithBlur(counter, from, target, durationMs, ease);
		} else {
			countTo(counter, from, target, durationMs, ease);
		}
	});

	segmentsOf(panel).forEach((segment, index) => {
		growSegment(segment, previous?.segmentWidths[index] ?? 0, durationMs, easing);
	});
};

const readNumberAnimationMode = (root: HTMLElement): NumberAnimationMode => {
	const value = root.getAttribute(DATA_ATTRIBUTE.numberAnimationMode);

	if (
		value === NUMBER_ANIMATION_MODE.popIn ||
		value === NUMBER_ANIMATION_MODE.slide ||
		value === NUMBER_ANIMATION_MODE.blur
	) {
		return value;
	}

	return NUMBER_ANIMATION_MODE.countUp;
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

		revealPanel(panels[index], previous, readNumberAnimationMode(root));
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

// Lets the number-animation selector, which lives outside the widget, replay the
// currently visible panel in the newly chosen mode without waiting for a tab switch.
const connectNumberAnimationSelector = (): void => {
	const selector = document.querySelector<HTMLElement>(
		`[${DATA_ATTRIBUTE.numberAnimationSelector}]`,
	);
	const root = document.querySelector<HTMLElement>(`[${DATA_ATTRIBUTE.root}]`);

	if (!selector || !root) {
		return;
	}

	selector.addEventListener('change', (event) => {
		const input = event.target;

		if (!(input instanceof HTMLInputElement) || input.name !== NUMBER_ANIMATION_INPUT_NAME) {
			return;
		}

		root.setAttribute(DATA_ATTRIBUTE.numberAnimationMode, input.value);

		const visiblePanel = root.querySelector<HTMLElement>(
			`[${DATA_ATTRIBUTE.panel}]:not([hidden])`,
		);

		if (visiblePanel) {
			revealPanel(visiblePanel, null, readNumberAnimationMode(root));
		}
	});
};

export const initBalanceOfPower = (): void => {
	const roots = document.querySelectorAll<HTMLElement>(`[${DATA_ATTRIBUTE.root}]`);

	roots.forEach(connectSwitcher);
	connectNumberAnimationSelector();
};
