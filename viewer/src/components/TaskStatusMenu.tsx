import { useMutation, useQueryClient } from "@tanstack/react-query";
import { MoreVertical } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { api } from "@/lib/api";
import { TASK_STATUS_CONFIG } from "@/lib/config";

import type { TaskStatus } from "../../../src/schema";

interface TaskStatusMenuProps {
	taskId: number;
	currentStatus: TaskStatus;
	invalidateKeys?: string[][];
}

export function TaskStatusMenu({ taskId, currentStatus, invalidateKeys }: TaskStatusMenuProps) {
	const queryClient = useQueryClient();
	const [open, setOpen] = useState(false);
	const ref = useRef<HTMLDivElement>(null);

	const mutation = useMutation({
		mutationFn: (status: TaskStatus) => api.api.tasks({ id: taskId }).patch({ status }),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["tasks"] });
			for (const key of invalidateKeys ?? []) {
				queryClient.invalidateQueries({ queryKey: key });
			}
		},
		onError: (error) => {
			// TODO we might need some sort of notifications, console log in the meantime
			console.error("[TaskStatusMenu] Update failed:", error);
		},
	});

	// Close on outside click or Escape
	useEffect(() => {
		if (!open) return;
		const onDown = (e: MouseEvent) => {
			if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
		};
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") setOpen(false);
		};
		document.addEventListener("mousedown", onDown);
		document.addEventListener("keydown", onKey);
		return () => {
			document.removeEventListener("mousedown", onDown);
			document.removeEventListener("keydown", onKey);
		};
	}, [open]);

	return (
		<div ref={ref} className="relative">
			{/* Trigger */}
			<button
				onClick={(e) => {
					e.preventDefault();
					e.stopPropagation();
					setOpen((p) => !p);
				}}
				disabled={mutation.isPending}
				className={`flex h-7 w-7 items-center justify-center rounded-md transition-colors hover:bg-gray-700 ${
					mutation.isPending ? "opacity-50" : "text-gray-400 hover:text-gray-200"
				}`}
				aria-label="Change task status"
			>
				<MoreVertical size={16} />
			</button>

			{/* Menu */}
			{open && (
				<div className="absolute right-0 z-50 mt-1 w-44 overflow-hidden rounded-lg border border-gray-700 bg-gray-900 py-1 shadow-xl">
					<div className="px-3 py-1.5 text-xs font-medium text-gray-500">Status</div>
					{(
						Object.entries(TASK_STATUS_CONFIG) as [
							TaskStatus,
							(typeof TASK_STATUS_CONFIG)[TaskStatus],
						][]
					).map(([value, config]) => {
						if (value === currentStatus) return null;
						const Icon = config.icon;
						return (
							<button
								key={value}
								onClick={(e) => {
									e.preventDefault();
									e.stopPropagation();
									mutation.mutate(value);
									setOpen(false);
								}}
								className="flex w-full items-center gap-2.5 px-3 py-1.5 text-sm text-gray-300 transition-colors hover:bg-gray-800 hover:text-white"
							>
								<Icon size={14} className={config.color} />
								<span className="flex-1 pl-2 text-left">{config.label}</span>
							</button>
						);
					})}
				</div>
			)}
		</div>
	);
}
