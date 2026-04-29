import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Save } from "lucide-react";
import { useState } from "react";

import { api, unwrap } from "@/lib/api";

import type { DevMode, Permission } from "../../../src/schema";

export const Route = createFileRoute("/composer/dev-modes/new")({
	component: NewDevModePage,
});

const PERMISSIONS: Permission[] = ["open", "guarded", "read_only", "locked"];

function NewDevModePage() {
	const navigate = useNavigate();
	const qc = useQueryClient();
	const [name, setName] = useState("");
	const [description, setDescription] = useState("");
	const [permission, setPermission] = useState<Permission>("guarded");

	const createMutation = useMutation({
		mutationFn: () =>
			api.api["dev-modes"]
				.post({ name, description: description.trim() || undefined, permission })
				.then(unwrap),
		onSuccess: async (created) => {
			const devMode = created as DevMode;
			await Promise.all([
				qc.invalidateQueries({ queryKey: ["dev-modes"] }),
				qc.invalidateQueries({ queryKey: ["hud"] }),
			]);
			await navigate({ to: "/composer/dev-modes/$id", params: { id: String(devMode.id) } });
		},
	});

	return (
		<form
			className="mx-auto max-w-3xl p-6"
			onSubmit={(event) => {
				event.preventDefault();
				if (name.trim()) createMutation.mutate();
			}}
		>
			<Link
				to="/composer"
				className="mb-6 inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-300"
			>
				<ArrowLeft size={14} aria-hidden="true" /> Composer
			</Link>

			<div className="rounded-xl border border-gray-800 bg-gray-900/70 p-5">
				<div className="mb-5">
					<h2 className="text-2xl font-semibold tracking-tight text-white">New Dev Mode</h2>
					<p className="mt-1 text-sm text-gray-500">
						Create the shell, then compose principles and memories.
					</p>
				</div>

				<div className="space-y-4">
					<label className="block">
						<span className="mb-1 block text-sm font-medium text-gray-300">Name</span>
						<input
							value={name}
							onChange={(event) => setName(event.target.value)}
							className="min-h-11 w-full rounded-md border border-gray-700 bg-gray-950 px-3 text-base text-white outline-none focus:border-gray-500"
							required
						/>
					</label>

					<label className="block">
						<span className="mb-1 block text-sm font-medium text-gray-300">Description</span>
						<textarea
							value={description}
							onChange={(event) => setDescription(event.target.value)}
							rows={4}
							maxLength={500}
							className="w-full rounded-md border border-gray-700 bg-gray-950 px-3 py-2 text-base text-white outline-none focus:border-gray-500"
						/>
						<p className="mt-1 text-xs text-gray-600">{description.length}/500</p>
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
				</div>

				{createMutation.error && (
					<p className="mt-4 rounded-md border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-300">
						{createMutation.error instanceof Error ? createMutation.error.message : "Create failed"}
					</p>
				)}

				<div className="mt-6 flex justify-end">
					<button
						type="submit"
						disabled={!name.trim() || createMutation.isPending}
						className="inline-flex min-h-10 items-center gap-2 rounded-md bg-white px-4 text-sm font-medium text-gray-950 hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-50"
					>
						<Save size={16} aria-hidden="true" />
						{createMutation.isPending ? "Creating..." : "Create"}
					</button>
				</div>
			</div>
		</form>
	);
}
