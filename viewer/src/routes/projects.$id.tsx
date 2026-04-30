import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Clock, FolderKanban, Pencil, Save, Shield, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";

import { Drawer } from "@/components/Drawer";
import { Section, InfoItem, LoadingState, ErrorState, MarkdownContent } from "@/components/ui";
import { api, unwrap } from "@/lib/api";
import { parseJsonArray, formatDate } from "@/lib/utils";
import { setDeleteTarget } from "@/stores/ui";

import type { Permission, Project } from "../../../src/schema";

const PERMISSIONS: Permission[] = ["open", "guarded", "read_only", "locked"];

export const Route = createFileRoute("/projects/$id")({
	component: ProjectDetail,
});

function ProjectDetail() {
	const { id } = Route.useParams();
	const navigate = useNavigate();
	const qc = useQueryClient();
	const [editing, setEditing] = useState(false);

	const {
		data: project,
		isLoading,
		error,
	} = useQuery({
		queryKey: ["project", id],
		queryFn: () =>
			api.api
				.projects({ id: Number(id) })
				.get()
				.then(unwrap),
	});

	const handleClose = () => navigate({ to: "/projects" });
	const updateMutation = useMutation({
		mutationFn: (body: ProjectFormState) =>
			api.api
				.projects({ id: Number(id) })
				.patch({
					name: body.name,
					description: body.description,
					stack: parseStackInput(body.stack),
					permission: body.permission,
				})
				.then(unwrap),
		onSuccess: async () => {
			setEditing(false);
			await Promise.all([
				qc.invalidateQueries({ queryKey: ["project", id] }),
				qc.invalidateQueries({ queryKey: ["projects"] }),
				qc.invalidateQueries({ queryKey: ["hud"] }),
			]);
		},
	});

	return (
		<Drawer
			open={true}
			onClose={handleClose}
			title={editing ? `Edit ${project?.name ?? "Project"}` : (project?.name ?? "Project")}
		>
			{isLoading && <LoadingState message="Loading project..." />}
			{error && <ErrorState error={error} />}
			{project &&
				(editing ? (
					<ProjectEditForm
						project={project}
						error={updateMutation.error}
						pending={updateMutation.isPending}
						onCancel={() => setEditing(false)}
						onSubmit={(body) => updateMutation.mutate(body)}
					/>
				) : (
					<div className="space-y-6">
						<ProjectMetadata project={project} onEdit={() => setEditing(true)} />
						<ProjectDescription project={project} />
					</div>
				))}
		</Drawer>
	);
}

type ProjectFormState = {
	name: string;
	description: string;
	stack: string;
	permission: Permission;
};

function parseStackInput(value: string) {
	return value
		.split(",")
		.map((item) => item.trim())
		.filter(Boolean);
}

function ProjectEditForm({
	project,
	pending,
	error,
	onCancel,
	onSubmit,
}: {
	project: Project;
	pending: boolean;
	error: unknown;
	onCancel: () => void;
	onSubmit: (body: ProjectFormState) => void;
}) {
	const [form, setForm] = useState<ProjectFormState>(() => ({
		name: project.name,
		description: project.description ?? "",
		stack: parseJsonArray(project.stack).join(", "),
		permission: project.permission,
	}));

	useEffect(() => {
		setForm({
			name: project.name,
			description: project.description ?? "",
			stack: parseJsonArray(project.stack).join(", "),
			permission: project.permission,
		});
	}, [project]);

	return (
		<form
			className="space-y-4"
			onSubmit={(event) => {
				event.preventDefault();
				if (form.name.trim()) onSubmit(form);
			}}
		>
			<label className="block">
				<span className="mb-1 block text-sm font-medium text-gray-300">Name</span>
				<input
					value={form.name}
					onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
					className="min-h-11 w-full rounded-md border border-gray-700 bg-gray-950 px-3 text-base text-white outline-none focus:border-gray-500"
					required
				/>
			</label>

			<label className="block">
				<span className="mb-1 block text-sm font-medium text-gray-300">Description</span>
				<textarea
					value={form.description}
					onChange={(event) =>
						setForm((current) => ({ ...current, description: event.target.value }))
					}
					rows={10}
					maxLength={5000}
					className="w-full rounded-md border border-gray-700 bg-gray-950 px-3 py-2 text-base text-white outline-none focus:border-gray-500"
				/>
				<p className="mt-1 text-xs text-gray-600">{form.description.length}/5000</p>
			</label>

			<label className="block">
				<span className="mb-1 block text-sm font-medium text-gray-300">Stack</span>
				<input
					value={form.stack}
					onChange={(event) => setForm((current) => ({ ...current, stack: event.target.value }))}
					className="min-h-11 w-full rounded-md border border-gray-700 bg-gray-950 px-3 text-base text-white outline-none focus:border-gray-500"
				/>
			</label>

			<label className="block">
				<span className="mb-1 block text-sm font-medium text-gray-300">Permission</span>
				<select
					value={form.permission}
					onChange={(event) =>
						setForm((current) => ({ ...current, permission: event.target.value as Permission }))
					}
					className="min-h-11 w-full rounded-md border border-gray-700 bg-gray-950 px-3 text-base text-white outline-none focus:border-gray-500"
				>
					{PERMISSIONS.map((permission) => (
						<option key={permission} value={permission}>
							{permission}
						</option>
					))}
				</select>
			</label>

			{Boolean(error) && (
				<p className="rounded-md border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-300">
					{error instanceof Error ? error.message : "Update failed"}
				</p>
			)}

			<div className="flex justify-end gap-2">
				<button
					type="button"
					onClick={onCancel}
					disabled={pending}
					className="min-h-10 rounded-md border border-gray-700 px-4 text-sm text-gray-300 hover:bg-gray-800 disabled:opacity-50"
				>
					Cancel
				</button>
				<button
					type="submit"
					disabled={!form.name.trim() || pending}
					className="inline-flex min-h-10 items-center gap-2 rounded-md bg-white px-4 text-sm font-medium text-gray-950 hover:bg-gray-200 disabled:opacity-50"
				>
					<Save size={16} aria-hidden="true" /> {pending ? "Saving..." : "Save"}
				</button>
			</div>
		</form>
	);
}

function ProjectMetadata({ project, onEdit }: { project: Project; onEdit: () => void }) {
	const stack = parseJsonArray(project.stack);

	return (
		<div className="space-y-6">
			{/* Header */}
			<div className="flex flex-wrap items-start justify-between gap-3 border-b border-gray-800/70 pb-4">
				<div className="flex min-w-0 items-start gap-3">
					<div className="rounded-lg bg-gray-800 p-2">
						<FolderKanban size={24} className="text-gray-400" aria-hidden="true" />
					</div>
					<div className="min-w-0 flex-1">
						<h3 className="truncate text-xl font-semibold text-white">{project.name}</h3>
						<p className="mt-1 text-sm text-gray-500">Permission: {project.permission}</p>
					</div>
				</div>
				<ProjectActions project={project} onEdit={onEdit} />
			</div>

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
				<div className="grid grid-cols-1 gap-4">
					<InfoItem icon={Shield} label="Project" value={project.permission} />
				</div>
			</Section>

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

function ProjectDescription({ project }: { project: Project }) {
	if (!project.description) return null;

	return (
		<Section title="Description">
			<MarkdownContent content={project.description} className="prose-sm" />
		</Section>
	);
}

function ProjectActions({ project, onEdit }: { project: Project; onEdit: () => void }) {
	return (
		<div className="ml-auto flex shrink-0 items-center gap-1">
			<button
				type="button"
				onClick={onEdit}
				className="inline-flex min-h-9 items-center gap-1.5 rounded-md px-2.5 text-sm font-medium text-gray-300 transition-colors hover:bg-gray-800 hover:text-gray-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500 motion-reduce:transition-none"
			>
				<Pencil size={14} aria-hidden="true" />
				Edit
			</button>
			<button
				type="button"
				onClick={() =>
					setDeleteTarget({
						type: "project",
						id: project.id,
						name: project.name,
					})
				}
				className="inline-flex min-h-9 items-center gap-1.5 rounded-md px-2.5 text-sm font-medium text-gray-400 transition-colors hover:bg-red-500/10 hover:text-red-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500 motion-reduce:transition-none"
			>
				<Trash2 size={14} aria-hidden="true" />
				Delete
			</button>
		</div>
	);
}
