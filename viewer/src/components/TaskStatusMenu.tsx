import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
	MoreVertical,
	Circle,
	CircleDot,
	CircleCheck,
	CircleX,
	type LucideIcon,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { api } from "@/lib/api";

import type { TaskStatus } from "../../../src/schema";

const OPTIONS: Array<{ value: TaskStatus; label: string; icon: LucideIcon; color: string }> = [
	{ value: "todo", label: "To Do", icon: Circle, color: "text-gray-400" },
	{ value: "in_progress", label: "In Progress", icon: CircleDot, color: "text-yellow-400" },
	{ value: "done", label: "Done", icon: CircleCheck, color: "text-green-400" },
	{ value: "cancelled", label: "Cancelled", icon: CircleX, color: "text-red-400" },
];

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
		mutationFn: (status: string) => api.updateTaskStatus(taskId, status),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["tasks"] });
			for (const key of invalidateKeys ?? []) {
				queryClient.invalidateQueries({ queryKey: key });
			}
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
					{OPTIONS.map((opt) => {
						const Icon = opt.icon;
						const isActive = opt.value === currentStatus;
						return !isActive ? (
							<button
								key={opt.value}
								onClick={(e) => {
									e.preventDefault();
									e.stopPropagation();
									if (opt.value !== currentStatus) mutation.mutate(opt.value);
									setOpen(false);
								}}
								className={`flex w-full items-center gap-2.5 px-3 py-1.5 text-sm transition-colors ${"text-gray-300 hover:bg-gray-800 hover:text-white"}`}
							>
								<Icon size={14} className={opt.color} />
								<span className="flex-1 pl-2 text-left">{opt.label}</span>
							</button>
						) : null;
					})}
				</div>
			)}
		</div>
	);
}
