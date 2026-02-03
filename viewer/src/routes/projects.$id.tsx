import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { FolderKanban, CircleDot, Clock, Shield, Brain } from "lucide-react";

import { Drawer } from "@/components/Drawer";
import { Section, InfoItem, LoadingState, ErrorState } from "@/components/ui";
import { api, type Project } from "@/lib/api";
import { PROJECT_STATUS_CONFIG, getStatusConfig } from "@/lib/config";
import { parseJsonArray, formatDate } from "@/lib/utils";

export const Route = createFileRoute("/projects/$id")({
	component: ProjectDetail,
});

function ProjectDetail() {
	const { id } = Route.useParams();
	const navigate = useNavigate();

	const {
		data: project,
		isLoading,
		error,
	} = useQuery({
		queryKey: ["project", id],
		queryFn: () => api.project(Number(id)),
	});

	const handleClose = () => navigate({ to: "/projects" });

	return (
		<Drawer open={true} onClose={handleClose} title={project?.name ?? "Project"}>
			{isLoading && <LoadingState message="Loading project..." />}
			{error && <ErrorState error={error} />}
			{project && <ProjectContent project={project} />}
		</Drawer>
	);
}

function ProjectContent({ project }: { project: Project }) {
	const stack = parseJsonArray(project.stack);
	const status = getStatusConfig(PROJECT_STATUS_CONFIG, project.status, project.status);

	return (
		<div className="space-y-6">
			{/* Header */}
			<div className="flex items-start gap-3">
				<div className="rounded-lg bg-gray-800 p-2">
					<FolderKanban size={24} className="text-gray-400" />
				</div>
				<div className="flex-1">
					<h3 className="text-xl font-semibold text-white">{project.name}</h3>
					<div className="mt-1 flex items-center gap-2">
						<span
							className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${status.color}`}
						>
							<CircleDot size={10} />
							{status.label}
						</span>
					</div>
				</div>
			</div>

			{/* Description */}
			{project.description && (
				<Section title="Description">
					<p className="text-gray-300">{project.description}</p>
				</Section>
			)}

			{/* Stack */}
			{stack.length > 0 && (
				<Section title="Stack">
					<div className="flex flex-wrap gap-2">
						{stack.map((tech: string) => (
							<span key={tech} className="rounded-md bg-gray-800 px-3 py-1 text-sm text-gray-300">
								{tech}
							</span>
						))}
					</div>
				</Section>
			)}

			{/* Permissions */}
			<Section title="Permissions">
				<div className="grid grid-cols-2 gap-4">
					<InfoItem icon={Shield} label="Project" value={project.permission} />
					<InfoItem icon={Brain} label="Default Memory" value={project.defaultMemoryPermission} />
				</div>
			</Section>

			{/* Context Summary */}
			{project.contextSummary && (
				<Section title="Context Summary">
					<div className="rounded-lg bg-gray-800/50 p-4">
						<p className="text-sm whitespace-pre-wrap text-gray-300">{project.contextSummary}</p>
					</div>
				</Section>
			)}

			{/* Timestamps */}
			<Section title="Timestamps">
				<div className="grid grid-cols-2 gap-4 text-sm">
					<InfoItem icon={Clock} label="Created" value={formatDate(project.createdAt)} />
					<InfoItem icon={Clock} label="Updated" value={formatDate(project.updatedAt)} />
				</div>
			</Section>
		</div>
	);
}
