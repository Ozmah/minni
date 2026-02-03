import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Result } from "better-result";
import { FolderKanban, CircleDot, Clock, Shield, Brain } from "lucide-react";
import { api, type Project } from "@/lib/api";
import { Drawer } from "@/components/Drawer";

function parseStack(stack: string | null): string[] {
	if (!stack) return [];
	return Result.try(() => JSON.parse(stack))
		.map((parsed) => (Array.isArray(parsed) ? parsed : []))
		.unwrapOr([]);
}

export const Route = createFileRoute("/projects/$id")({
	component: ProjectDetail,
});

function ProjectDetail() {
	const { id } = Route.useParams();
	const navigate = useNavigate();

	const { data: project, isLoading, error } = useQuery({
		queryKey: ["project", id],
		queryFn: () => api.project(Number(id)),
	});

	const handleClose = () => navigate({ to: "/projects" });

	return (
		<Drawer open={true} onClose={handleClose} title={project?.name ?? "Project"}>
			{isLoading && <LoadingState />}
			{error && <ErrorState error={error} />}
			{project && <ProjectContent project={project} />}
		</Drawer>
	);
}

function ProjectContent({ project }: { project: Project }) {
	const stack = parseStack(project.stack);

	const statusConfig = {
		active: { color: "bg-green-500/20 text-green-400", label: "Active" },
		paused: { color: "bg-yellow-500/20 text-yellow-400", label: "Paused" },
		completed: { color: "bg-blue-500/20 text-blue-400", label: "Completed" },
		archived: { color: "bg-gray-500/20 text-gray-400", label: "Archived" },
	}[project.status] ?? { color: "bg-gray-500/20 text-gray-400", label: project.status };

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
						<span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${statusConfig.color}`}>
							<CircleDot size={10} />
							{statusConfig.label}
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
						<p className="whitespace-pre-wrap text-sm text-gray-300">{project.contextSummary}</p>
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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
	return (
		<section>
			<h4 className="mb-2 text-sm font-medium uppercase tracking-wider text-gray-500">{title}</h4>
			{children}
		</section>
	);
}

function InfoItem({ icon: Icon, label, value }: { icon: typeof Clock; label: string; value: string }) {
	return (
		<div className="flex items-center gap-2 text-gray-400">
			<Icon size={14} />
			<span className="text-gray-500">{label}:</span>
			<span className="text-gray-300">{value}</span>
		</div>
	);
}

function formatDate(date: string | Date): string {
	return new Date(date).toLocaleDateString(undefined, {
		year: "numeric",
		month: "short",
		day: "numeric",
		hour: "2-digit",
		minute: "2-digit",
	});
}

function LoadingState() {
	return <div className="text-gray-400">Loading project...</div>;
}

function ErrorState({ error }: { error: Error }) {
	return <div className="text-red-400">Error: {error.message}</div>;
}
