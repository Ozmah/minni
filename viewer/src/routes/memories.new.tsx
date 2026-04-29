import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";

import { MemoryEditForm } from "@/components/edit-forms/MemoryEditForm";
import { Modal } from "@/components/ui";
import { api, unwrap } from "@/lib/api";

import type { Memory, MemoryStatus, MemoryType, Permission } from "../../../src/schema";

type MemoryCreateInput = {
	title: string;
	content: string;
	type: MemoryType;
	status: MemoryStatus;
	permission: Permission;
};

export const Route = createFileRoute("/memories/new")({
	component: NewMemoryModal,
});

function NewMemoryModal() {
	const navigate = useNavigate();
	const qc = useQueryClient();

	const createMutation = useMutation({
		mutationFn: (body: MemoryCreateInput) => api.api.memories.post(body).then(unwrap),
		onSuccess: async (created) => {
			const memory = created as Memory;
			await Promise.all([
				qc.invalidateQueries({ queryKey: ["memories"] }),
				qc.invalidateQueries({ queryKey: ["hud"] }),
			]);
			await navigate({ to: "/memories/$id", params: { id: String(memory.id) } });
		},
	});

	const close = () => navigate({ to: "/memories" });

	return (
		<Modal open={true} onClose={close} title="New Memory">
			<MemoryEditForm
				data={{}}
				onSave={(updates) =>
					createMutation.mutate({
						title: updates.title as string,
						content: updates.content as string,
						type: updates.type as MemoryType,
						status: updates.status as MemoryStatus,
						permission: updates.permission as Permission,
					})
				}
				onCancel={close}
				saving={createMutation.isPending}
			/>
			{createMutation.error && (
				<p className="mt-3 rounded-md border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-300">
					{createMutation.error instanceof Error ? createMutation.error.message : "Create failed"}
				</p>
			)}
		</Modal>
	);
}
