import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { FolderKanban, Clock, CircleDot } from "lucide-react";

import { api, type Project } from "@/lib/api";
import { parseJsonArray, extractDescription } from "@/lib/utils";

export const Route = createFileRoute("/projects")({
	component: ProjectsPage,
});

function ProjectsPage() {
	const {
		data: projects,
		isLoading,
		error,
	} = useQuery({
		queryKey: ["projects"],
		queryFn: api.projects,
	});

	if (isLoading) {
		return <PageLoading>Loading projects...</PageLoading>;
	}

	if (error) {
		return <PageError error={error} />;
	}

	if (!projects?.length) {
		return (
			<PageEmpty
				icon={FolderKanban}
				title="No projects yet"
				description="Create one using minni_project"
			/>
		);
	}

	return (
		<>
			<div className="p-6">
				<h2 className="mb-6 text-2xl font-semibold tracking-tight">Projects</h2>
				<div className="space-y-3">
					{projects.map((project) => (
						<ProjectCard key={project.id} project={project} />
					))}
				</div>
			</div>
			<Outlet />
		</>
	);
}

function ProjectCard({ project }: { project: Project }) {
	const stack = parseJsonArray(project.stack);
	const description = extractDescription(project.description);
	const statusColor =
		{
			active: "text-green-400",
			paused: "text-yellow-400",
			completed: "text-blue-400",
			archived: "text-gray-500",
		}[project.status] || "text-gray-400";

	return (
		<Link
			to="/projects/$id"
			params={{ id: String(project.id) }}
			className="block rounded-lg border border-gray-700 bg-gray-800/50 p-4 transition-colors hover:border-gray-600 hover:bg-gray-800"
		>
			<div className="flex items-start justify-between">
				<div className="flex items-center gap-2">
					<FolderKanban size={18} className="text-gray-400" />
					<h3 className="font-medium text-white">{project.name}</h3>
				</div>
				<span className={`flex items-center gap-1 text-xs ${statusColor}`}>
					<CircleDot size={12} />
					{project.status}
				</span>
			</div>

			{description && <p className="mt-2 text-sm text-gray-400">{description}</p>}

			{stack.length > 0 && (
				<div className="mt-3 flex flex-wrap gap-1">
					{stack.map((tech: string) => (
						<span key={tech} className="rounded bg-gray-700 px-2 py-0.5 text-xs text-gray-300">
							{tech}
						</span>
					))}
				</div>
			)}

			<div className="mt-3 flex items-center gap-1 text-xs text-gray-500">
				<Clock size={12} />
				{new Date(project.updatedAt).toLocaleDateString()}
			</div>
		</Link>
	);
}

function PageLoading({ children }: { children: React.ReactNode }) {
	return <div className="p-6 text-gray-400">{children}</div>;
}

function PageError({ error }: { error: Error }) {
	return <div className="p-6 text-red-400">Error: {error.message}</div>;
}

function PageEmpty({
	icon: Icon,
	title,
	description,
}: {
	icon: typeof FolderKanban;
	title: string;
	description: string;
}) {
	return (
		<div className="flex flex-col items-center justify-center p-12 text-gray-400">
			<Icon size={48} className="mb-4 opacity-50" />
			<p className="text-lg">{title}</p>
			<p className="mt-2 text-sm">{description}</p>
		</div>
	);
}
