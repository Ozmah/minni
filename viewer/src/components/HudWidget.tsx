import { useQuery } from "@tanstack/react-query";
import { FolderKanban, Brain, ListTodo, PanelLeft, User, Globe } from "lucide-react";

import { api, unwrap } from "@/lib/api";
import { PROJECT_STATUS_CONFIG, getStatusConfig } from "@/lib/config";

export function HudWidget() {
	const { data: hud } = useQuery({
		queryKey: ["hud"],
		queryFn: () => api.api.hud.get().then(unwrap),
		refetchInterval: 3000,
	});

	if (!hud) return null;

	const projectStatus = hud.project?.status
		? getStatusConfig(PROJECT_STATUS_CONFIG, hud.project.status)
		: null;

	return (
		<div className="border-t border-gray-700 px-3 py-3 pb-10">
			{/* Project */}
			<div className="mb-2 flex items-center gap-2">
				{hud.project ? (
					<>
						<FolderKanban size={14} className="shrink-0 text-gray-500" />
						<span className="truncate text-xs font-medium text-gray-200">{hud.project.name}</span>
						{projectStatus && (
							<span
								className={`ml-auto shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${projectStatus.color}`}
							>
								{projectStatus.label}
							</span>
						)}
					</>
				) : (
					<>
						<Globe size={14} className="shrink-0 text-gray-500" />
						<span className="text-xs text-gray-400">Global</span>
					</>
				)}
			</div>

			{/* Identity */}
			<div className="mb-3 flex items-center gap-2">
				<User size={14} className="shrink-0 text-gray-500" />
				<span className="truncate text-xs text-gray-400">
					{hud.identity?.title ?? "No identity"}
				</span>
			</div>

			{/* Counts */}
			<div className="grid grid-cols-2 gap-x-3 gap-y-1">
				<CountItem icon={FolderKanban} label="Projects" value={hud.counts.projects} />
				<CountItem icon={Brain} label="Memories" value={hud.counts.memories} />
				<CountItem
					icon={ListTodo}
					label="Tasks"
					value={`${hud.counts.tasks.todo}/${hud.counts.tasks.inProgress}/${hud.counts.tasks.done}`}
				/>
				<CountItem icon={PanelLeft} label="Canvas" value={hud.counts.canvas} />
			</div>
		</div>
	);
}

function CountItem({
	icon: Icon,
	label,
	value,
}: {
	icon: React.ComponentType<{ size?: number; className?: string }>;
	label: string;
	value: number | string;
}) {
	return (
		<div className="flex items-center gap-1.5" title={label}>
			<Icon size={12} className="shrink-0 text-gray-600" />
			<span className="text-[11px] text-gray-500">{value}</span>
		</div>
	);
}
