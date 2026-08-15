const CUBIC_BEZIER_PATTERN =
	/^cubic-bezier\(\s*([\d.+-]+)\s*,\s*([\d.+-]+)\s*,\s*([\d.+-]+)\s*,\s*([\d.+-]+)\s*\)$/;

const NEWTON_ITERATIONS = 8;
const MINIMUM_SLOPE = 1e-6;

export type EasingFunction = (progress: number) => number;

const linear: EasingFunction = (progress) => progress;

/** One axis of a cubic bezier whose first and last control points are pinned to 0 and 1. */
const axisAt = (first: number, second: number, parameter: number): number => {
	const inverse = 1 - parameter;

	return (
		3 * inverse * inverse * parameter * first +
		3 * inverse * parameter * parameter * second +
		parameter * parameter * parameter
	);
};

const axisSlopeAt = (first: number, second: number, parameter: number): number => {
	const inverse = 1 - parameter;

	return (
		3 * first * inverse * (1 - 3 * parameter) +
		3 * second * parameter * (2 - 3 * parameter) +
		3 * parameter * parameter
	);
};

/** CSS timing functions are parameterised by curve position, not by time, so time has to be solved for. */
const solveParameterForTime = (time: number, first: number, second: number): number => {
	let parameter = time;

	for (let iteration = 0; iteration < NEWTON_ITERATIONS; iteration += 1) {
		const error = axisAt(first, second, parameter) - time;
		const slope = axisSlopeAt(first, second, parameter);

		if (Math.abs(slope) < MINIMUM_SLOPE) {
			return parameter;
		}

		parameter -= error / slope;
	}

	return parameter;
};

/** Turns a CSS `cubic-bezier(...)` declaration into the easing function it describes. */
export const createEasing = (declaration: string): EasingFunction => {
	const match = CUBIC_BEZIER_PATTERN.exec(declaration);

	if (!match) {
		return linear;
	}

	const [firstX, firstY, secondX, secondY] = match.slice(1).map(Number);

	return (progress) => {
		if (progress <= 0 || progress >= 1) {
			return progress;
		}

		return axisAt(firstY, secondY, solveParameterForTime(progress, firstX, secondX));
	};
};
