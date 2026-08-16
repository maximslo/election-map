import { PRESIDENT_ELECTION, type ChamberId } from '../config/constants';
import { tallyElectoralVotes } from '../lib/electoral-map';
import { ELECTORAL_STATES } from './electoral-map';

const presidentTally = tallyElectoralVotes(ELECTORAL_STATES);

export type Chamber = {
	id: ChamberId;
	label: string;
	totalAtStake: number;
	majorityThreshold: number;
	democratCount: number;
	republicanCount: number;
};

// The Senate threshold is 50 rather than a computed 51: the vice president breaks ties.
export const CHAMBERS: Chamber[] = [
	{
		id: 'president',
		label: 'President',
		totalAtStake: PRESIDENT_ELECTION.totalVotes,
		majorityThreshold: PRESIDENT_ELECTION.majorityThreshold,
		democratCount: presidentTally.democratCount,
		republicanCount: presidentTally.republicanCount,
	},
	{
		id: 'senate',
		label: 'Senate',
		totalAtStake: 100,
		majorityThreshold: 50,
		democratCount: 35,
		republicanCount: 46,
	},
	{
		id: 'house',
		label: 'House',
		totalAtStake: 435,
		majorityThreshold: 218,
		democratCount: 192,
		republicanCount: 199,
	},
];
