import { CHAMBER_CHANGE_EVENT, DATA_ATTRIBUTE, type ChamberId } from '../config/constants';

const MAPPED_CHAMBER_ID: ChamberId = 'president';

const showChamber = (map: HTMLElement, chamberId: string | null): void => {
	map.hidden = chamberId !== MAPPED_CHAMBER_ID;
};

export const initElectoralMap = (): void => {
	const map = document.querySelector<HTMLElement>(`[${DATA_ATTRIBUTE.electoralMap}]`);

	if (!map) {
		return;
	}

	document.addEventListener(CHAMBER_CHANGE_EVENT, (event) => {
		showChamber(map, (event as CustomEvent<{ chamberId: string }>).detail.chamberId);
	});

	// The switcher activates its first tab before this script runs, so its opening announcement
	// is read off the document rather than waited for.
	showChamber(map, document.documentElement.getAttribute(DATA_ATTRIBUTE.activeChamber));
};
