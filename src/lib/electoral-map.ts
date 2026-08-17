import { PARTY, TILE_CODE, type Party } from '../config/constants';
import type { ElectoralState } from '../data/electoral-map';

const ELECTORAL_COLLEGE_SIZE = 538;

/** Room left around the tiles for the labels the source map places outside their block. */
const MAP_MARGIN_CELLS = 1.5;

export type ElectoralTile = {
	column: number;
	row: number;
	party: Party;
};

export type ElectoralMapExtent = {
	left: number;
	top: number;
	width: number;
	height: number;
};

export type ElectoralTally = {
	democratCount: number;
	republicanCount: number;
};

const PARTY_BY_TILE_CODE: Record<string, Party> = {
	[TILE_CODE.democrat]: PARTY.democrat,
	[TILE_CODE.republican]: PARTY.republican,
};

/** A state's electoral votes, one tile each, in grid coordinates. */
export const expandStateTiles = ({ column, row, shape }: ElectoralState): ElectoralTile[] =>
	shape.flatMap((shapeRow, rowOffset) =>
		Array.from(shapeRow).flatMap((code, columnOffset) => {
			const party = PARTY_BY_TILE_CODE[code];

			if (!party) {
				return [];
			}

			return [{ column: column + columnOffset, row: row + rowOffset, party }];
		}),
	);

const assertStateIsCoherent = (state: ElectoralState): void => {
	const { id, electoralVotes, shape } = state;
	const tileCount = expandStateTiles(state).length;

	if (tileCount !== electoralVotes) {
		throw new Error(`State "${id}" draws ${tileCount} tiles for ${electoralVotes} votes.`);
	}

	const unknownCode = shape
		.flatMap((shapeRow) => Array.from(shapeRow))
		.find((code) => code !== TILE_CODE.empty && !PARTY_BY_TILE_CODE[code]);

	if (unknownCode) {
		throw new Error(`State "${id}" uses an unknown tile code "${unknownCode}".`);
	}
};

const assertElectoralMapIsCoherent = (states: ElectoralState[]): void => {
	const occupiedCells = new Map<string, string>();
	let total = 0;

	states.forEach((state) => {
		assertStateIsCoherent(state);
		total += state.electoralVotes;

		expandStateTiles(state).forEach(({ column, row }) => {
			const cell = `${column},${row}`;
			const occupant = occupiedCells.get(cell);

			if (occupant) {
				throw new Error(`States "${occupant}" and "${state.id}" both occupy cell ${cell}.`);
			}

			occupiedCells.set(cell, state.id);
		});
	});

	if (total !== ELECTORAL_COLLEGE_SIZE) {
		throw new Error(`The map awards ${total} of ${ELECTORAL_COLLEGE_SIZE} electoral votes.`);
	}
};

/**
 * The drawing area, wide enough for the tiles and, when labels are actually visible, the labels
 * the source map places outside their block. `includeLabelPositions` should mirror whether
 * --bop-map-label-size in tokens.css renders at 0 — reserving room for a label position nobody
 * can see just pushes the whole map away from its neighbors for nothing.
 */
export const electoralMapExtent = (
	states: ElectoralState[],
	includeLabelPositions: boolean,
): ElectoralMapExtent => {
	const columns = states.flatMap((state) => [
		...(includeLabelPositions ? [state.labelColumn] : []),
		...expandStateTiles(state).flatMap(({ column }) => [column, column + 1]),
	]);
	const rows = states.flatMap((state) => [
		...(includeLabelPositions ? [state.labelRow] : []),
		...expandStateTiles(state).flatMap(({ row }) => [row, row + 1]),
	]);

	const left = Math.min(...columns) - MAP_MARGIN_CELLS;
	const top = Math.min(...rows) - MAP_MARGIN_CELLS;

	return {
		left,
		top,
		width: Math.max(...columns) + MAP_MARGIN_CELLS - left,
		height: Math.max(...rows) + MAP_MARGIN_CELLS - top,
	};
};

export const tallyElectoralVotes = (states: ElectoralState[]): ElectoralTally => {
	assertElectoralMapIsCoherent(states);

	const parties = states.flatMap((state) => expandStateTiles(state).map(({ party }) => party));

	return {
		democratCount: parties.filter((party) => party === PARTY.democrat).length,
		republicanCount: parties.filter((party) => party === PARTY.republican).length,
	};
};

export type Vector = { column: number; row: number };

type StateBlock = {
	tiles: ElectoralTile[];
	center: Vector;
	bounds: { minColumn: number; maxColumn: number; minRow: number; maxRow: number };
};

// How many candidate pull strengths to try between "no movement" and "as far as every state can
// go before two of them touch". Coarser than this and the tightest safe layout starts leaving
// avoidable gap on the table; finer buys precision the eye can't tell apart.
const COMPACTION_SEARCH_STEPS = 40;

const boundsOf = (tiles: ElectoralTile[]): StateBlock['bounds'] => {
	const columns = tiles.map(({ column }) => column);
	const rows = tiles.map(({ row }) => row);

	return {
		minColumn: Math.min(...columns),
		maxColumn: Math.max(...columns) + 1,
		minRow: Math.min(...rows),
		maxRow: Math.max(...rows) + 1,
	};
};

const centerOfBounds = ({ minColumn, maxColumn, minRow, maxRow }: StateBlock['bounds']): Vector => ({
	column: (minColumn + maxColumn) / 2,
	row: (minRow + maxRow) / 2,
});

/**
 * The middle of a state's own bounding box, in grid cells — the point the click ripple measures
 * every other state's distance from, and the point the bounce scales around.
 */
export const stateCenter = (state: ElectoralState): Vector =>
	centerOfBounds(boundsOf(expandStateTiles(state)));

const blockOf = (tiles: ElectoralTile[]): StateBlock => {
	const bounds = boundsOf(tiles);

	return { tiles, bounds, center: centerOfBounds(bounds) };
};

// Two unit tiles at these positions overlap iff they're within one full tile width of each other
// on both axes; exactly 1 apart means they're touching edge-to-edge, not overlapping.
const tilesOverlap = (a: Vector, b: Vector): boolean =>
	Math.abs(a.column - b.column) < 1 - 1e-6 && Math.abs(a.row - b.row) < 1 - 1e-6;

const boundsOverlap = (a: StateBlock['bounds'], pullA: Vector, b: StateBlock['bounds'], pullB: Vector): boolean =>
	a.minColumn + pullA.column < b.maxColumn + pullB.column &&
	b.minColumn + pullB.column < a.maxColumn + pullA.column &&
	a.minRow + pullA.row < b.maxRow + pullB.row &&
	b.minRow + pullB.row < a.maxRow + pullA.row;

/**
 * How far each state can move toward the map's center, as a fraction of its own distance from
 * that center, before any two states' tiles would touch more than edge-to-edge. Every state
 * moves by the same fraction — only the distance travelled differs — so states never cross paths
 * or change which side of another state they're on.
 */
const findSafePullFraction = (blocks: StateBlock[], center: Vector): number => {
	const pullAt = (fraction: number): Vector[] =>
		blocks.map(({ center: blockCenter }) => ({
			column: (center.column - blockCenter.column) * fraction,
			row: (center.row - blockCenter.row) * fraction,
		}));

	const isSafe = (fraction: number): boolean => {
		const pulls = pullAt(fraction);

		for (let a = 0; a < blocks.length; a += 1) {
			for (let b = a + 1; b < blocks.length; b += 1) {
				if (!boundsOverlap(blocks[a].bounds, pulls[a], blocks[b].bounds, pulls[b])) {
					continue;
				}

				const overlaps = blocks[a].tiles.some((tileA) =>
					blocks[b].tiles.some((tileB) =>
						tilesOverlap(
							{ column: tileA.column + pulls[a].column, row: tileA.row + pulls[a].row },
							{ column: tileB.column + pulls[b].column, row: tileB.row + pulls[b].row },
						),
					),
				);

				if (overlaps) {
					return false;
				}
			}
		}

		return true;
	};

	for (let step = COMPACTION_SEARCH_STEPS; step >= 0; step -= 1) {
		const fraction = step / COMPACTION_SEARCH_STEPS;

		if (isSafe(fraction)) {
			return fraction;
		}
	}

	return 0;
};

/**
 * Tightens the gaps between state blocks by pulling each one toward the map's center. Every
 * state's own shape moves as a rigid unit — its tiles keep their size and arrangement, and its
 * label rides along with it — so only the empty space between states shrinks.
 *
 * `tightness` of 0 reproduces the source map's spacing exactly; 1 pulls every state as close to
 * the center, and to its neighbors, as it can get without any two states' tiles touching more
 * than edge-to-edge. That upper bound is measured (via findSafePullFraction), not assumed, so no
 * `tightness` value can ever produce an overlap.
 */
export const applyStateSpacing = (states: ElectoralState[], tightness: number): ElectoralState[] => {
	if (tightness === 0) {
		return states;
	}

	const blocks = states.map((state) => blockOf(expandStateTiles(state)));
	const overallBounds = blocks.reduce(
		(bounds, block) => ({
			minColumn: Math.min(bounds.minColumn, block.bounds.minColumn),
			maxColumn: Math.max(bounds.maxColumn, block.bounds.maxColumn),
			minRow: Math.min(bounds.minRow, block.bounds.minRow),
			maxRow: Math.max(bounds.maxRow, block.bounds.maxRow),
		}),
		blocks[0].bounds,
	);
	const center: Vector = {
		column: (overallBounds.minColumn + overallBounds.maxColumn) / 2,
		row: (overallBounds.minRow + overallBounds.maxRow) / 2,
	};

	const maxSafeFraction = findSafePullFraction(blocks, center);
	const fraction = maxSafeFraction * tightness;

	return states.map((state, index) => {
		const pull = {
			column: (center.column - blocks[index].center.column) * fraction,
			row: (center.row - blocks[index].center.row) * fraction,
		};

		return {
			...state,
			column: state.column + pull.column,
			row: state.row + pull.row,
			labelColumn: state.labelColumn + pull.column,
			labelRow: state.labelRow + pull.row,
		};
	});
};

/** Height of a label's capitals, as a fraction of a cell. Measured off the source map. */
const LABEL_CAP_HEIGHT_CELLS = 0.45;

/** Labels sitting on their own state's tiles are knocked out in white; the rest are inked. */
export const isLabelOverTiles = (state: ElectoralState): boolean => {
	// labelRow is a baseline, which can land on the gridline below the glyphs; the middle of the
	// capitals is what actually has to be over a tile.
	const glyphRow = state.labelRow - LABEL_CAP_HEIGHT_CELLS / 2;

	return expandStateTiles(state).some(
		({ column, row }) =>
			state.labelColumn >= column &&
			state.labelColumn < column + 1 &&
			glyphRow >= row &&
			glyphRow < row + 1,
	);
};
