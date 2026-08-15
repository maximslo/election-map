import type { Chamber } from '../data/chambers';

const PERCENT = 100;

export type BalanceOfPower = {
	democratShare: string;
	republicanShare: string;
	undecidedCount: number;
	thresholdPosition: string;
};

const toPercentage = (part: number, whole: number): string => `${(part / whole) * PERCENT}%`;

const assertChamberIsCoherent = ({
	id,
	totalAtStake,
	majorityThreshold,
	democratCount,
	republicanCount,
}: Chamber): void => {
	if (totalAtStake <= 0) {
		throw new Error(`Chamber "${id}" has no seats at stake.`);
	}

	if (democratCount < 0 || republicanCount < 0) {
		throw new Error(`Chamber "${id}" has a negative party count.`);
	}

	if (democratCount + republicanCount > totalAtStake) {
		throw new Error(
			`Chamber "${id}" awards ${democratCount + republicanCount} of ${totalAtStake} seats.`,
		);
	}

	if (majorityThreshold <= 0 || majorityThreshold > totalAtStake) {
		throw new Error(`Chamber "${id}" has a majority threshold outside its seat range.`);
	}
};

/** Digits the widest seat count needs, so every chamber can reserve the same room for it. */
export const widestCountDigits = (chambers: Chamber[]): number => {
	const counts = chambers.flatMap(({ democratCount, republicanCount }) => [
		democratCount,
		republicanCount,
	]);

	return String(Math.max(...counts)).length;
};

export const calculateBalanceOfPower = (chamber: Chamber): BalanceOfPower => {
	assertChamberIsCoherent(chamber);

	const { totalAtStake, majorityThreshold, democratCount, republicanCount } = chamber;

	return {
		democratShare: toPercentage(democratCount, totalAtStake),
		republicanShare: toPercentage(republicanCount, totalAtStake),
		undecidedCount: totalAtStake - democratCount - republicanCount,
		thresholdPosition: toPercentage(majorityThreshold, totalAtStake),
	};
};
