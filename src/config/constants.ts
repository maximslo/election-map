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
} as const;

export const PARTY_LABEL = {
	democrat: 'Dem.',
	republican: 'Rep.',
} as const;

export const KEY = {
	arrowLeft: 'ArrowLeft',
	arrowRight: 'ArrowRight',
	home: 'Home',
	end: 'End',
} as const;

export const MILLISECONDS_PER_SECOND = 1000;
