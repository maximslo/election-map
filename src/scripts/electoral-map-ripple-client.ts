import {
	CUSTOM_PROPERTY,
	DATA_ATTRIBUTE,
	MAP_RIPPLE_MODE_INPUT_NAME,
	MAP_RIPPLE_REACH_INPUT_NAME,
	MAP_RIPPLE_TRIGGER,
	MAP_RIPPLE_TRIGGER_INPUT_NAME,
	type MapRippleTrigger,
} from '../config/constants';

type Vector = { column: number; row: number };

const RIPPLE_ATTRIBUTE_BY_INPUT_NAME: Record<string, string> = {
	[MAP_RIPPLE_MODE_INPUT_NAME]: DATA_ATTRIBUTE.rippleMode,
	[MAP_RIPPLE_REACH_INPUT_NAME]: DATA_ATTRIBUTE.rippleReach,
	[MAP_RIPPLE_TRIGGER_INPUT_NAME]: DATA_ATTRIBUTE.rippleTrigger,
};

const centerOf = (stateGroup: SVGGElement): Vector => ({
	column: Number(stateGroup.getAttribute(DATA_ATTRIBUTE.centerColumn)),
	row: Number(stateGroup.getAttribute(DATA_ATTRIBUTE.centerRow)),
});

/**
 * Lets a ripple selector living outside the map — the demo pages put one above the widget —
 * switch settings by writing them onto the map itself, the same way the number-animation selector
 * drives the balance-of-power widget. Pages without a selector keep whatever the map was rendered
 * with. Changing a setting first drops any pose currently being held, so a map left open by the
 * hover trigger can't stay stuck open under a trigger that would never release it.
 */
const connectRippleSelector = (map: HTMLElement, settle: () => void): void => {
	const selector = document.querySelector<HTMLElement>(`[${DATA_ATTRIBUTE.rippleSelector}]`);

	if (!selector) {
		return;
	}

	selector.addEventListener('change', (event) => {
		const input = event.target;

		if (!(input instanceof HTMLInputElement)) {
			return;
		}

		const attribute = RIPPLE_ATTRIBUTE_BY_INPUT_NAME[input.name];

		if (!attribute) {
			return;
		}

		settle();
		map.setAttribute(attribute, input.value);
	});
};

/**
 * Publishes each state's position relative to the state the wave starts from — how many grid
 * cells away it sits, and which way it points from there — and leaves every decision about what
 * that should look like to CSS. Nothing here knows which ripple mode is selected, so a new mode
 * is a new pose in the stylesheet and nothing more.
 *
 * Positions come from the server-rendered grid coordinates rather than getBBox(): the map is
 * hidden until its chamber is the active one, and a display:none element has no box to measure.
 */
export const createRipplePlayer = (map: HTMLElement, stateGroups: SVGGElement[]) => {
	const centers = new WeakMap<SVGGElement, Vector>();

	stateGroups.forEach((stateGroup) => centers.set(stateGroup, centerOf(stateGroup)));

	const publishOffsetFrom = (origin: Vector, stateGroup: SVGGElement): void => {
		const center = centers.get(stateGroup);

		if (!center) {
			return;
		}

		const columnOffset = center.column - origin.column;
		const rowOffset = center.row - origin.row;
		const distance = Math.hypot(columnOffset, rowOffset);

		if (distance === 0) {
			return;
		}

		stateGroup.style.setProperty(CUSTOM_PROPERTY.stateRippleDistance, String(distance));
		stateGroup.style.setProperty(
			CUSTOM_PROPERTY.stateRippleDirectionX,
			String(columnOffset / distance),
		);
		stateGroup.style.setProperty(
			CUSTOM_PROPERTY.stateRippleDirectionY,
			String(rowOffset / distance),
		);
		stateGroup.setAttribute(DATA_ATTRIBUTE.stateRippling, '');
	};

	/**
	 * Aims every state away from the one the wave starts at. Under the hover trigger this is the
	 * whole story: those states are transitioning, so writing new offsets straight over the old
	 * ones re-aims each one from wherever it currently sits, and the motion simply curves toward
	 * the new pose. Clearing them first would snap the map back to rest between every two states
	 * the cursor crosses, which is what made moving across the map look jumpy.
	 */
	const aimAwayFrom = (origin: Vector, originGroup: SVGGElement): void => {
		originGroup.removeAttribute(DATA_ATTRIBUTE.stateRippling);
		stateGroups
			.filter((stateGroup) => stateGroup !== originGroup)
			.forEach((stateGroup) => publishOffsetFrom(origin, stateGroup));
	};

	const settle = (): void => {
		stateGroups.forEach((stateGroup) => stateGroup.removeAttribute(DATA_ATTRIBUTE.stateRippling));
	};

	// A click replays a keyframe, and a keyframe only restarts from the top if it is taken away
	// and given back across a reflow — the same trick playClickAnimation uses, except the reflow
	// is forced once on the map rather than per state, since 51 individual reads would each flush
	// layout on their own.
	const popAwayFrom = (origin: Vector, originGroup: SVGGElement): void => {
		settle();
		void map.getBoundingClientRect();
		aimAwayFrom(origin, originGroup);
	};

	// Both a click and a hover report what happened and let the map's own setting decide whether
	// that's the cue — rather than either call site knowing which trigger is selected. Routing the
	// click through here (instead of listening for the event) also covers keyboard activation,
	// which reaches the same place a mouse click does but never fires a pointer event.
	const triggerRippleOn = (originGroup: SVGGElement, trigger: MapRippleTrigger): void => {
		const origin = centers.get(originGroup);

		if (!origin || map.getAttribute(DATA_ATTRIBUTE.rippleTrigger) !== trigger) {
			return;
		}

		const play = trigger === MAP_RIPPLE_TRIGGER.hover ? aimAwayFrom : popAwayFrom;

		play(origin, originGroup);
	};

	stateGroups.forEach((stateGroup) => {
		stateGroup.addEventListener('pointerenter', () =>
			triggerRippleOn(stateGroup, MAP_RIPPLE_TRIGGER.hover),
		);
	});

	// Only under the hover trigger: the pose is held rather than played out, so something has to
	// end it. Leaving the map is that something — crossing the gaps *between* states doesn't count,
	// which is what lets the map stay open as the cursor travels across it. Under the click trigger
	// the wave ends on its own, and clearing it here would cut a pop short.
	map.addEventListener('pointerleave', () => {
		if (map.getAttribute(DATA_ATTRIBUTE.rippleTrigger) !== MAP_RIPPLE_TRIGGER.hover) {
			return;
		}

		settle();
	});

	connectRippleSelector(map, settle);

	return triggerRippleOn;
};
