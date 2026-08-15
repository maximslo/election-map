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
} as const;

export const NUMBER_ANIMATION_MODE = {
	countUp: 'count-up',
	popIn: 'pop-in',
	slide: 'slide',
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
