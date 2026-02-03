import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
	ListTodo,
	Circle,
	AlertTriangle,
	Clock,
	FolderKanban,
	GitBranch,
	Workflow,
} from "lucide-react";

import { Drawer } from "@/components/Drawer";
import { Section, InfoItem, LoadingState, ErrorState } from "@/components/ui";
import { api, type TaskDetail } from "@/lib/api";
import {
	TASK_STATUS_CONFIG,
	TASK_PRIORITY_CONFIG,
	getStatusConfig,
	type StatusConfigWithIcon,
} from "@/lib/config";
import { formatDate } from "@/lib/utils";

export const Route = createFileRoute("/tasks/$id")({
	component: TaskDetail,
});

function TaskDetail() {
	const { id } = Route.useParams();
	const navigate = useNavigate();

	const {
		data: task,
		isLoading,
		error,
	} = useQuery({
		queryKey: ["task", id],
		queryFn: () => api.task(Number(id)),
	});

	const handleClose = () => navigate({ to: "/tasks" });

	return (
		<Drawer open={true} onClose={handleClose} title={task?.title ?? "Task"}>
			{isLoading && <LoadingState message="Loading task..." />}
			{error && <ErrorState error={error} />}
			{task && <TaskContent task={task} />}
		</Drawer>
	);
}

function TaskContent({ task }: { task: TaskDetail }) {
	const statusDefault: StatusConfigWithIcon = {
		color: "bg-gray-500/20 text-gray-400",
		label: task.status,
		icon: Circle,
	};
	const status = TASK_STATUS_CONFIG[task.status] ?? statusDefault;
	const priority = getStatusConfig(TASK_PRIORITY_CONFIG, task.priority, task.priority);
	const StatusIcon = status.icon;

	return (
		<div className="space-y-6">
			{/* Header */}
			<div className="flex items-start gap-3">
				<div className="rounded-lg bg-gray-800 p-2">
					<ListTodo size={24} className="text-gray-400" />
				</div>
				<div className="flex-1">
					<h3 className="text-xl font-semibold text-white">{task.title}</h3>
					<div className="mt-1 flex items-center gap-2">
						<span
							className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${status.color}`}
						>
							<StatusIcon size={10} />
							{status.label}
						</span>
						<span
							className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${priority.color}`}
						>
							<AlertTriangle size={10} />
							{priority.label}
						</span>
					</div>
				</div>
			</div>

			{/* Relations */}
			<Section title="Relations">
				<div className="space-y-2">
					{task.projectId && (
						<>
							<InfoItem icon={FolderKanban} label="Project ID" value={String(task.projectId)} />
							<InfoItem icon={Workflow} label="Project Name" value={String(task.projectName)} />
						</>
					)}
					{task.parentId && (
						<InfoItem icon={GitBranch} label="Parent Task ID" value={String(task.parentId)} />
					)}
					{!task.projectId && !task.parentId && (
						<p className="text-sm text-gray-500">No relations</p>
					)}
				</div>
			</Section>

			{/* Timestamps */}
			<Section title="Timestamps">
				<div className="grid grid-cols-2 gap-4 text-sm">
					<InfoItem icon={Clock} label="Created" value={formatDate(task.createdAt)} />
					<InfoItem icon={Clock} label="Updated" value={formatDate(task.updatedAt)} />
				</div>
			</Section>

			{/* Description */}
			{task.description && (
				<Section title="Description">
					<div className="rounded-lg bg-gray-800/50 p-4">
						<p className="text-sm whitespace-pre-wrap text-gray-300">{task.description}</p>
					</div>
				</Section>
			)}
		</div>
	);
}
