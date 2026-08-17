export const CHAMBER_IDS = ['president', 'senate', 'house'] as const;

export type ChamberId = (typeof CHAMBER_IDS)[number];

export const DEFAULT_CHAMBER_ID: ChamberId = 'senate';

export const DATA_ATTRIBUTE = {
	root: 'data-balance-of-power',
	tab: 'data-chamber-tab',
	panel: 'data-chamber-panel',
	chamberId: 'data-chamber-id',
	counter: 'data-counter',
	counterTarget: 'data-counter-target',
	segment: 'data-bar-segment',
	numberAnimationMode: 'data-number-animation-mode',
	numberAnimationSelector: 'data-number-animation-selector',
	digitAnimating: 'data-digit-animating',
	digitStagger: 'data-digit-stagger',
	currentValue: 'data-current-value',
	electoralMap: 'data-electoral-map',
	activeChamber: 'data-active-chamber',
	bar: 'data-bar',
	mapState: 'data-map-state',
	currentParty: 'data-current-party',
	electoralVotes: 'data-electoral-votes',
	labelOverTiles: 'data-label-over-tiles',
	stateActivating: 'data-state-activating',
	stateRippling: 'data-state-rippling',
	rippleMode: 'data-ripple-mode',
	rippleReach: 'data-ripple-reach',
	rippleTrigger: 'data-ripple-trigger',
	rippleSelector: 'data-ripple-selector',
	centerColumn: 'data-center-column',
	centerRow: 'data-center-row',
} as const;

/** Dispatched by the map after a click changes a state's assignment, carrying the new totals. */
export const MAP_RESULT_CHANGE_EVENT = 'balance-of-power:map-result-change';

export type MapResultDetail = {
	democratCount: number;
	republicanCount: number;
};

/**
 * How the electoral map learns which chamber is showing without the switcher knowing it exists.
 * The switcher also records the chamber on the document element, so a listener that registers
 * after the first activation can still pick up where things stand.
 */
export const CHAMBER_CHANGE_EVENT = 'balance-of-power:chamber-change';

export const PARTY = {
	democrat: 'democrat',
	republican: 'republican',
} as const;

export type Party = (typeof PARTY)[keyof typeof PARTY];

/** The characters an electoral map shape row is written in. */
export const TILE_CODE = {
	[PARTY.democrat]: 'b',
	[PARTY.republican]: 'r',
	empty: '.',
} as const;

/**
 * What a state can be assigned to on the map. A superset of `Party`: every state starts as one
 * of the two real parties, but clicking can also land it on "undecided" — a state with no data
 * equivalent, so it isn't folded into `Party` itself.
 */
export const MAP_ASSIGNMENT = {
	republican: PARTY.republican,
	democrat: PARTY.democrat,
	undecided: 'undecided',
} as const;

export type MapAssignment = (typeof MAP_ASSIGNMENT)[keyof typeof MAP_ASSIGNMENT];

/** The order a state's assignment cycles through on click, wrapping back to the start. */
export const MAP_ASSIGNMENT_CYCLE: MapAssignment[] = [
	MAP_ASSIGNMENT.republican,
	MAP_ASSIGNMENT.democrat,
	MAP_ASSIGNMENT.undecided,
];

export const MAP_ASSIGNMENT_TILE_CLASS: Record<MapAssignment, string> = {
	[MAP_ASSIGNMENT.republican]: 'map__tile--republican',
	[MAP_ASSIGNMENT.democrat]: 'map__tile--democrat',
	[MAP_ASSIGNMENT.undecided]: 'map__tile--undecided',
};

export const MAP_ASSIGNMENT_LABEL: Record<MapAssignment, string> = {
	[MAP_ASSIGNMENT.republican]: 'Republican',
	[MAP_ASSIGNMENT.democrat]: 'Democratic',
	[MAP_ASSIGNMENT.undecided]: 'Undecided',
};

/** Shared with the president Chamber entry, so the bar and the map always agree on the totals a
 *  majority is measured against. */
export const PRESIDENT_ELECTION = {
	totalVotes: 538,
	majorityThreshold: 270,
} as const;

/**
 * The map is drawn in SVG user units. One grid cell is CELL units on a side, which only decides
 * how readable the emitted coordinates are — the viewBox scales the whole thing to fit.
 */
export const MAP_GEOMETRY = {
	cell: 10,
	tileGap: 0.45,
	/** 0 reproduces the source map's spacing; 1 pulls states as close together as they'll go
	 *  without any two touching more than edge-to-edge. */
	stateSpacingTightness: 0,
	/** Outward padding, in grid cells, for each tile's hover hit-box. Every different-state tile
	 *  pair on the map is at least 1 cell apart, so anything under 0.5 here can never make two
	 *  states' hit-boxes touch — verified directly against the map data, not assumed. */
	hitAreaInset: 0.4,
	/**
	 * A state's bounce scale — shared by hover (sustained) and click (a momentary pop past this
	 * same value) — is 1 + bounceGrowthTarget / size, where size is the state's own bounding-box
	 * span in grid cells. Every state grows by roughly the same absolute amount instead of the
	 * same percentage, which used to make Texas visibly balloon while Rhode Island barely moved.
	 * Clamped so tiny states don't blow past the ceiling, and huge ones (California) don't shrink
	 * to nothing.
	 */
	bounceGrowthTarget: 1.1,
	bounceScaleMin: 1.09,
	bounceScaleMax: 1.4,
	/** Mirrors whether --bop-map-label-size in tokens.css renders above 0px. Kept in sync by
	 *  hand: electoralMapExtent reads this to decide whether a label's position (not just a
	 *  tile's) needs room reserved around the map's edge. */
	labelsVisible: false,
} as const;

/**
 * How the states a click *didn't* land on react to it. A click always pops its own state;
 * these decide what the wave travelling outward from it does to everyone else. "off"
 * reproduces the original behaviour, where only the clicked state moves.
 */
export const MAP_RIPPLE_MODE = {
	off: 'off',
	pop: 'pop',
	nudge: 'nudge',
	/** The one mode that isn't a travelling wave: every state shoves away from the click at once. */
	burst: 'burst',
	popNudge: 'pop-nudge',
	popFade: 'pop-fade',
} as const;

export type MapRippleMode = (typeof MAP_RIPPLE_MODE)[keyof typeof MAP_RIPPLE_MODE];

/** How far the wave carries before it dies out — the whole map, or just the click's own corner. */
export const MAP_RIPPLE_REACH = {
	map: 'map',
	nearby: 'nearby',
} as const;

export type MapRippleReach = (typeof MAP_RIPPLE_REACH)[keyof typeof MAP_RIPPLE_REACH];

/**
 * What sets the wave off. Clicking always cycles a state's assignment regardless — this only
 * decides whether the states around it react to the click or to the cursor arriving.
 */
export const MAP_RIPPLE_TRIGGER = {
	click: 'click',
	hover: 'hover',
} as const;

export type MapRippleTrigger = (typeof MAP_RIPPLE_TRIGGER)[keyof typeof MAP_RIPPLE_TRIGGER];

export const MAP_RIPPLE_MODE_INPUT_NAME = 'map-ripple-mode';
export const MAP_RIPPLE_REACH_INPUT_NAME = 'map-ripple-reach';
export const MAP_RIPPLE_TRIGGER_INPUT_NAME = 'map-ripple-trigger';

export const NUMBER_ANIMATION_MODE = {
	countUp: 'count-up',
	popIn: 'pop-in',
	slide: 'slide',
	blur: 'blur',
} as const;

export type NumberAnimationMode = (typeof NUMBER_ANIMATION_MODE)[keyof typeof NUMBER_ANIMATION_MODE];

export const NUMBER_ANIMATION_INPUT_NAME = 'number-animation-mode';

// Mirrors the [data-digit-stagger="1"|"2"] selectors in BalanceOfPowerBar.astro's stylesheet.
export const DIGIT_STAGGER = {
	first: '1',
	second: '2',
} as const;

export const CUSTOM_PROPERTY = {
	democratShare: '--bop-democrat-share',
	republicanShare: '--bop-republican-share',
	thresholdPosition: '--bop-threshold-position',
	tabCount: '--bop-tab-count',
	activeIndex: '--bop-active-index',
	revealDuration: '--bop-reveal-duration',
	transitionEasing: '--bop-transition-easing',
	countDigits: '--bop-count-digits',
	countBlurMax: '--bop-count-blur-max',
	countBlurFraction: '--bop-count-blur-fraction',
	stateHoverScale: '--bop-state-hover-scale',
	switcherGap: '--bop-switcher-gap',
	stateRippleDistance: '--bop-state-ripple-distance',
	stateRippleDirectionX: '--bop-state-ripple-direction-x',
	stateRippleDirectionY: '--bop-state-ripple-direction-y',
} as const;

export const PARTY_LABEL = {
	[PARTY.democrat]: 'Dem.',
	[PARTY.republican]: 'Rep.',
} as const;

export const CANDIDATE_NAME = {
	[PARTY.democrat]: 'Biden',
	[PARTY.republican]: 'Trump',
} as const;

export const KEY = {
	arrowLeft: 'ArrowLeft',
	arrowRight: 'ArrowRight',
	home: 'Home',
	end: 'End',
} as const;

export const MILLISECONDS_PER_SECOND = 1000;
