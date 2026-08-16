import {
	DATA_ATTRIBUTE,
	MAP_ASSIGNMENT,
	MAP_ASSIGNMENT_CYCLE,
	MAP_ASSIGNMENT_LABEL,
	MAP_ASSIGNMENT_TILE_CLASS,
	MAP_RESULT_CHANGE_EVENT,
	PARTY,
	type MapAssignment,
	type MapResultDetail,
} from '../config/constants';

const ACTIVATION_KEYS = ['Enter', ' '];

const nextAssignment = (current: MapAssignment): MapAssignment => {
	const index = MAP_ASSIGNMENT_CYCLE.indexOf(current);

	return MAP_ASSIGNMENT_CYCLE[(index + 1) % MAP_ASSIGNMENT_CYCLE.length];
};

const paintStateGroup = (stateGroup: SVGGElement, assignment: MapAssignment): void => {
	const tileClass = MAP_ASSIGNMENT_TILE_CLASS[assignment];

	// Scoped past the hit-area rect — an invisible, unscaled sibling of .map__state-bounce that
	// exists purely for stable hover hit-testing, not a tile to repaint.
	stateGroup.querySelectorAll<SVGRectElement>('.map__state-bounce rect').forEach((tile) => {
		tile.setAttribute('class', `map__tile ${tileClass}`);
	});

	// A knocked-out label only reads against a saturated party color; undecided's neutral gray
	// needs the label back in ink, but only for the labels that sit over their own tiles at all.
	const sitsOverTiles = stateGroup.getAttribute(DATA_ATTRIBUTE.labelOverTiles) === 'true';
	const shouldKnockOut = sitsOverTiles && assignment !== MAP_ASSIGNMENT.undecided;
	const label = stateGroup.querySelector<SVGTextElement>('text');

	label?.setAttribute('class', shouldKnockOut ? 'map__label map__label--knockout' : 'map__label');

	const stateName = label?.textContent?.trim() ?? '';
	stateGroup.setAttribute('aria-label', `${stateName}, ${MAP_ASSIGNMENT_LABEL[assignment]}`);
	stateGroup.setAttribute(DATA_ATTRIBUTE.currentParty, assignment);
};

// Re-adding the attribute after a reflow restarts the animation, so rapid repeat clicks each get
// their own pop instead of the first click's animation just running out mid-flight.
const playClickAnimation = (stateGroup: SVGGElement): void => {
	stateGroup.removeAttribute(DATA_ATTRIBUTE.stateActivating);
	void stateGroup.getBoundingClientRect();
	stateGroup.setAttribute(DATA_ATTRIBUTE.stateActivating, '');
};

// SVG has no z-index of its own — later siblings simply paint over earlier ones, in document
// order. A popped state can overshoot into a neighbor drawn later in that order and end up
// underneath it. CSS z-index doesn't fix this either: a plain <g> isn't a positioned element, so
// it never creates the stacking context z-index needs, even paired with position:relative.
// Moving the node itself is the only thing that reliably reorders SVG paint order.
const bringToFront = (stateGroup: SVGGElement): void => {
	stateGroup.parentElement?.append(stateGroup);
};

const tally = (stateGroups: SVGGElement[]): MapResultDetail =>
	stateGroups.reduce(
		(totals, stateGroup) => {
			const votes = Number(stateGroup.getAttribute(DATA_ATTRIBUTE.electoralVotes));
			const assignment = stateGroup.getAttribute(DATA_ATTRIBUTE.currentParty);

			if (assignment === PARTY.democrat) {
				return { ...totals, democratCount: totals.democratCount + votes };
			}

			if (assignment === PARTY.republican) {
				return { ...totals, republicanCount: totals.republicanCount + votes };
			}

			return totals;
		},
		{ democratCount: 0, republicanCount: 0 },
	);

export const initElectoralMapInteraction = (): void => {
	const map = document.querySelector<HTMLElement>(`[${DATA_ATTRIBUTE.electoralMap}]`);

	if (!map) {
		return;
	}

	const stateGroups = Array.from(map.querySelectorAll<SVGGElement>(`[${DATA_ATTRIBUTE.mapState}]`));

	const cycle = (stateGroup: SVGGElement): void => {
		const current = stateGroup.getAttribute(DATA_ATTRIBUTE.currentParty) as MapAssignment;

		paintStateGroup(stateGroup, nextAssignment(current));
		bringToFront(stateGroup);
		playClickAnimation(stateGroup);

		document.dispatchEvent(
			new CustomEvent<MapResultDetail>(MAP_RESULT_CHANGE_EVENT, { detail: tally(stateGroups) }),
		);
	};

	stateGroups.forEach((stateGroup) => {
		stateGroup.addEventListener('click', () => cycle(stateGroup));

		stateGroup.addEventListener('keydown', (event) => {
			if (!ACTIVATION_KEYS.includes(event.key)) {
				return;
			}

			event.preventDefault();
			cycle(stateGroup);
		});
	});
};
