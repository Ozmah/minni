import { Derived, Store } from "@tanstack/store";

export interface UIState {
	unreadCanvasCount: number;
}

const initialState: UIState = {
	unreadCanvasCount: 0,
};

export const uiStore = new Store<UIState>(initialState);

// === Derived State ===

export const canvasHasNewContent = new Derived({
	fn: () => uiStore.state.unreadCanvasCount > 0,
	deps: [uiStore],
});

// === Actions ===

export const notifyCanvasContent = () => {
	uiStore.setState((state) => ({
		...state,
		unreadCanvasCount: state.unreadCanvasCount + 1,
	}));
};

export const clearCanvasNotification = () => {
	uiStore.setState((state) => ({
		...state,
		unreadCanvasCount: 0,
	}));
};
