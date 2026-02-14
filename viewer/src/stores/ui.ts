import { Derived, Store } from "@tanstack/store";
import { Result } from "better-result";

import { api } from "../lib/api";

// === Types ===

export type EntityType = "project" | "memory" | "task";

export type DeleteTargetType = EntityType;

export interface DeleteTarget {
	type: DeleteTargetType;
	id: number;
	name: string;
}

export interface EditTarget {
	type: EntityType;
	id: number;
	/** Current field values to populate the form. */
	data: Record<string, unknown>;
}

export interface UIState {
	deleteTarget: DeleteTarget | null;
	editTarget: EditTarget | null;
}

const initialState: UIState = {
	deleteTarget: null,
	editTarget: null,
};

export const uiStore = new Store<UIState>(initialState);

// === Derived State ===

export const showDeleteModal = new Derived({
	fn: () => uiStore.state.deleteTarget !== null,
	deps: [uiStore],
});

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
	type: EntityType | null;
}> => {
	const target = uiStore.state.deleteTarget;
	if (!target) return { success: false, type: null };

	const deleteOp = async () => {
		switch (target.type) {
			case "project":
				return api.api.projects({ id: target.id }).delete();
			case "memory":
				return api.api.memories({ id: target.id }).delete();
			case "task":
				return api.api.tasks({ id: target.id }).delete();
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

// === Edit Modal ===

export const showEditModal = new Derived({
	fn: () => uiStore.state.editTarget !== null,
	deps: [uiStore],
});

export const setEditTarget = (target: EditTarget | null) => {
	uiStore.setState((state) => ({ ...state, editTarget: target }));
};

export const cancelEdit = () => {
	setEditTarget(null);
};

export const confirmEdit = async (
	updates: Record<string, unknown>,
): Promise<{ success: boolean; type: EntityType | null }> => {
	const target = uiStore.state.editTarget;
	if (!target) return { success: false, type: null };

	const patchOp = async () => {
		switch (target.type) {
			case "memory":
				return api.api.memories({ id: target.id }).patch(updates);
			// TODO: Add PATCH endpoints for projects and tasks
			case "project":
			case "task":
				throw new Error(`Edit not yet implemented for ${target.type}`);
		}
	};

	const result = await Result.tryPromise({
		try: patchOp,
		catch: (e) => (e instanceof Error ? e.message : String(e)),
	});
	const editedType = target.type;
	setEditTarget(null);

	if (result.isErr()) {
		console.error("[Edit] Failed:", result.error);
		return { success: false, type: editedType };
	}
	return { success: true, type: editedType };
};
