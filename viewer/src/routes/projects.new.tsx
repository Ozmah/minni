import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Save } from "lucide-react";
import { useState } from "react";

import { Drawer } from "@/components/Drawer";
import { api, unwrap } from "@/lib/api";
import { parseProjectStackInput } from "@/lib/utils";

import type { Permission, Project } from "../../../src/schema";

export const Route = createFileRoute("/projects/new")({
	component: NewProjectDrawer,
});

const PERMISSIONS: Permission[] = ["open", "guarded", "read_only", "locked"];

function NewProjectDrawer() {
	const navigate = useNavigate();
	const qc = useQueryClient();
	const [name, setName] = useState("");
	const [description, setDescription] = useState("");
	const [stack, setStack] = useState("");
	const [permission, setPermission] = useState<Permission>("guarded");
	const stackItems = parseProjectStackInput(stack);
	const stackTooLarge = stackItems.length > 50;

	const createMutation = useMutation({
		mutationFn: () =>
			api.api.projects
				.post({
					name,
					description: description.trim() || undefined,
					stack: stackItems,
					permission,
				})
				.then(unwrap),
		onSuccess: async (created) => {
			const project = created as Project;
			await Promise.all([
				qc.invalidateQueries({ queryKey: ["projects"] }),
				qc.invalidateQueries({ queryKey: ["hud"] }),
			]);
			await navigate({ to: "/projects/$id", params: { id: String(project.id) } });
		},
	});

	const close = () => navigate({ to: "/projects" });

	return (
		<Drawer open={true} onClose={close} title="New Project">
			<form
				className="space-y-4"
				onSubmit={(event) => {
					event.preventDefault();
					if (name.trim() && !stackTooLarge) createMutation.mutate();
				}}
			>
				<label className="block">
					<span className="mb-1 block text-sm font-medium text-gray-300">Name</span>
					<input
						value={name}
						onChange={(event) => setName(event.target.value)}
						className="min-h-11 w-full rounded-md border border-gray-700 bg-gray-950 px-3 text-base text-white outline-none focus:border-gray-500"
						required
					/>
					<p className="mt-1 text-xs text-gray-600">Normalized to lowercase hyphenated name.</p>
				</label>

				<label className="block">
					<span className="mb-1 block text-sm font-medium text-gray-300">Description</span>
					<textarea
						value={description}
						onChange={(event) => setDescription(event.target.value)}
						rows={8}
						maxLength={5000}
						className="w-full rounded-md border border-gray-700 bg-gray-950 px-3 py-2 text-base text-white outline-none focus:border-gray-500"
					/>
					<p className="mt-1 text-xs text-gray-600">{description.length}/5000</p>
				</label>

				<label className="block">
					<span className="mb-1 block text-sm font-medium text-gray-300">Stack</span>
					<input
						value={stack}
						onChange={(event) => setStack(event.target.value)}
						placeholder="Laravel, PHP 8.3, PHPUnit"
						className={`min-h-11 w-full rounded-md border bg-gray-950 px-3 text-base text-white outline-none focus:border-gray-500 ${
							stackTooLarge ? "border-red-500/60" : "border-gray-700"
						}`}
					/>
					<p className={`mt-1 text-xs ${stackTooLarge ? "text-red-300" : "text-gray-600"}`}>
						{stackItems.length}/50 stack items
					</p>
				</label>

				<label className="block">
					<span className="mb-1 block text-sm font-medium text-gray-300">Permission</span>
					<select
						value={permission}
						onChange={(event) => setPermission(event.target.value as Permission)}
						className="min-h-11 w-full rounded-md border border-gray-700 bg-gray-950 px-3 text-base text-white outline-none focus:border-gray-500"
					>
						{PERMISSIONS.map((item) => (
							<option key={item} value={item}>
								{item}
							</option>
						))}
					</select>
				</label>

				{createMutation.error && (
					<p className="rounded-md border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-300">
						{createMutation.error instanceof Error ? createMutation.error.message : "Create failed"}
					</p>
				)}

				<div className="flex justify-end">
					<button
						type="submit"
						disabled={!name.trim() || stackTooLarge || createMutation.isPending}
						className="inline-flex min-h-10 items-center gap-2 rounded-md bg-white px-4 text-sm font-medium text-gray-950 hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-50"
					>
						<Save size={16} aria-hidden="true" />
						{createMutation.isPending ? "Creating..." : "Create"}
					</button>
				</div>
			</form>
		</Drawer>
	);
}
