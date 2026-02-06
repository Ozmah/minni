import { Derived, Store } from "@tanstack/store";
import { Result } from "better-result";

import { api } from "../lib/api";

// === Types ===

export type DeleteTargetType = "project" | "memory" | "task";

export interface DeleteTarget {
	type: DeleteTargetType;
	id: number;
	name: string;
}

export interface UIState {
	unreadCanvasCount: number;
	deleteTarget: DeleteTarget | null;
}

const initialState: UIState = {
	unreadCanvasCount: 0,
	deleteTarget: null,
};

export const uiStore = new Store<UIState>(initialState);

// === Derived State ===

export const canvasHasNewContent = new Derived({
	fn: () => uiStore.state.unreadCanvasCount > 0,
	deps: [uiStore],
});

export const showDeleteModal = new Derived({
	fn: () => uiStore.state.deleteTarget !== null,
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

// === Delete Modal Actions ===

export const setDeleteTarget = (target: DeleteTarget | null) => {
	uiStore.setState((state) => ({
		...state,
		deleteTarget: target,
	}));
};

export const cancelDelete = () => {
	setDeleteTarget(null);
};

export const confirmDelete = async (): Promise<{
	success: boolean;
	type: DeleteTargetType | null;
}> => {
	const target = uiStore.state.deleteTarget;
	if (!target) return { success: false, type: null };

	const deleteOp = async () => {
		switch (target.type) {
			case "project":
				return api.deleteProject(target.id);
			case "memory":
				return api.deleteMemory(target.id);
			case "task":
				return api.deleteTask(target.id);
		}
	};

	const result = await Result.tryPromise({
		try: deleteOp,
		catch: (e) => (e instanceof Error ? e.message : String(e)),
	});
	const deletedType = target.type;
	setDeleteTarget(null);

	if (result.isErr()) {
		console.error("[Delete] Failed:", result.error);
		return { success: false, type: deletedType };
	}
	return { success: true, type: deletedType };
};
