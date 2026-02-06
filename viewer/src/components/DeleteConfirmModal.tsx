import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useStore } from "@tanstack/react-store";
import { AlertTriangle } from "lucide-react";
import { useEffect } from "react";

import { uiStore, showDeleteModal, cancelDelete, confirmDelete } from "../stores/ui";
import { Modal } from "./ui/Modal";

const TYPE_LABELS: Record<string, string> = {
	project: "proyecto",
	memory: "memoria",
	task: "tarea",
};

const TYPE_ROUTES: Record<string, string> = {
	project: "/projects",
	memory: "/memories",
	task: "/tasks",
};

export function DeleteConfirmModal() {
	const queryClient = useQueryClient();
	const navigate = useNavigate();
	const isOpen = useStore(showDeleteModal);
	const target = useStore(uiStore, (s) => s.deleteTarget);

	// Mount Derived
	useEffect(() => {
		const unsub = showDeleteModal.mount();
		return unsub;
	}, []);

	if (!isOpen || !target) return null;

	const typeLabel = TYPE_LABELS[target.type] || target.type;

	const handleConfirm = async () => {
		const { success, type } = await confirmDelete();
		if (success && type) {
			await queryClient.invalidateQueries({ queryKey: [`${type}s`] });
			navigate({ to: TYPE_ROUTES[type] });
		}
	};

	return (
		<Modal
			open={true}
			onClose={cancelDelete}
			title={`Eliminar ${typeLabel}`}
			persistent
			footer={
				<>
					<button
						onClick={cancelDelete}
						className="rounded-md px-4 py-2 text-sm text-gray-300 hover:bg-gray-800"
					>
						Cancelar
					</button>
					<button
						onClick={handleConfirm}
						className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
					>
						Eliminar
					</button>
				</>
			}
		>
			<div className="flex gap-4">
				<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-500/20">
					<AlertTriangle className="h-5 w-5 text-red-500" />
				</div>
				<div>
					<p className="text-gray-300">Esta accion eliminara permanentemente:</p>
					<p className="mt-2 font-medium text-white">{target.name}</p>
					<p className="mt-3 text-sm text-gray-500">Esta accion no se puede deshacer.</p>
				</div>
			</div>
		</Modal>
	);
}
