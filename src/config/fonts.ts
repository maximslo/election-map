export const FRANKLIN_WEIGHTS = [300, 500, 600, 700] as const;

export const franklinFontUrl = (weight: number): string =>
	`/fonts/franklin/franklin-normal-${weight}.woff2`;
