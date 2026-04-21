import { useQueryClient } from "@tanstack/react-query";
import { useStore } from "@tanstack/react-store";
import { useEffect, useState } from "react";

import { type EntityType, uiStore, showEditModal, cancelEdit, confirmEdit } from "../stores/ui";
import { MemoryEditForm } from "./edit-forms/MemoryEditForm";
import { Modal } from "./ui";

const TYPE_LABELS: Record<EntityType, string> = {
	project: "project",
	memory: "memory",
};

export function EditModal() {
	const queryClient = useQueryClient();
	const isOpen = useStore(showEditModal);
	const target = useStore(uiStore, (s) => s.editTarget);
	const [saving, setSaving] = useState(false);

	useEffect(() => {
		const unsub = showEditModal.mount();
		return unsub;
	}, []);

	if (!isOpen || !target) return null;

	const typeLabel = TYPE_LABELS[target.type] ?? target.type;

	const handleSave = async (updates: Record<string, unknown>) => {
		setSaving(true);
		const { success, type } = await confirmEdit(updates);
		setSaving(false);

		if (success && type) {
			await queryClient.invalidateQueries({ queryKey: [`${type}s`] });
			await queryClient.invalidateQueries({ queryKey: [type, String(target.id)] });
		}
	};

	return (
		<Modal open={true} onClose={cancelEdit} title={`Edit ${typeLabel}`}>
			{target.type === "memory" && (
				<MemoryEditForm
					data={target.data}
					onSave={handleSave}
					onCancel={cancelEdit}
					saving={saving}
				/>
			)}
		</Modal>
	);
}
