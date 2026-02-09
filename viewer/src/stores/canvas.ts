import { Store } from "@tanstack/store";

interface CanvasNavState {
	currentIndex: number;
}

export const canvasStore = new Store<CanvasNavState>({ currentIndex: 0 });

export const navigateTo = (index: number) => {
	canvasStore.setState((s) => ({ ...s, currentIndex: index }));
};

export const navigatePrev = () => {
	canvasStore.setState((s) => {
		if (s.currentIndex <= 0) return s;
		return { ...s, currentIndex: s.currentIndex - 1 };
	});
};

/** Requires pageCount since upper bound lives in Query, not the store. */
export const navigateNext = (pageCount: number) => {
	canvasStore.setState((s) => {
		if (s.currentIndex >= pageCount - 1) return s;
		return { ...s, currentIndex: s.currentIndex + 1 };
	});
};
