import { useState } from "react";

import { MEMORY_TYPE_CONFIG, MEMORY_STATUS_CONFIG } from "@/lib/config";

import { MEMORY_TYPE, MEMORY_STATUS, PERMISSION } from "../../../../src/schema";

interface MemoryEditFormProps {
	data: Record<string, unknown>;
	onSave: (updates: Record<string, unknown>) => void;
	onCancel: () => void;
	saving: boolean;
}

const PERMISSION_LABELS: Record<string, string> = {
	open: "Open",
	guarded: "Guarded",
	read_only: "Read Only",
	locked: "Locked",
};

export function MemoryEditForm({ data, onSave, onCancel, saving }: MemoryEditFormProps) {
	const [title, setTitle] = useState((data.title as string) ?? "");
	const [content, setContent] = useState((data.content as string) ?? "");
	const [type, setType] = useState((data.type as string) ?? "note");
	const [status, setStatus] = useState((data.status as string) ?? "draft");
	const [permission, setPermission] = useState((data.permission as string) ?? "guarded");

	const handleSubmit = (e: React.SyntheticEvent<HTMLFormElement>) => {
		e.preventDefault();

		// Need to update this, maybe a union?
		const updates: Record<string, unknown> = {};
		if (title !== data.title) updates.title = title;
		if (content !== data.content) updates.content = content;
		if (type !== data.type) updates.type = type;
		if (status !== data.status) updates.status = status;
		if (permission !== data.permission) updates.permission = permission;

		if (Object.keys(updates).length === 0) {
			onCancel();
			return;
		}

		onSave(updates);
	};

	return (
		<form onSubmit={handleSubmit} className="space-y-4">
			{/* Title */}
			<div>
				<label htmlFor="edit-title" className="mb-1 block text-xs font-medium text-gray-400">
					Title
				</label>
				<input
					id="edit-title"
					type="text"
					value={title}
					onChange={(e) => setTitle(e.target.value)}
					className="w-full rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-200 focus:border-blue-500 focus:outline-none"
					required
					maxLength={200}
				/>
			</div>

			{/* Content */}
			<div>
				<label htmlFor="edit-content" className="mb-1 block text-xs font-medium text-gray-400">
					Content
				</label>
				<textarea
					id="edit-content"
					value={content}
					onChange={(e) => setContent(e.target.value)}
					rows={8}
					className="w-full rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-200 focus:border-blue-500 focus:outline-none"
					required
				/>
			</div>

			{/* Type + Status + Permission row */}
			<div className="grid grid-cols-3 gap-3">
				<div>
					<label htmlFor="edit-type" className="mb-1 block text-xs font-medium text-gray-400">
						Type
					</label>
					<select
						id="edit-type"
						value={type}
						onChange={(e) => setType(e.target.value)}
						className="w-full rounded-md border border-gray-700 bg-gray-800 px-2 py-2 text-sm text-gray-200 focus:border-blue-500 focus:outline-none"
					>
						{MEMORY_TYPE.map((t) => (
							<option key={t} value={t}>
								{MEMORY_TYPE_CONFIG[t]?.label ?? t}
							</option>
						))}
					</select>
				</div>

				<div>
					<label htmlFor="edit-status" className="mb-1 block text-xs font-medium text-gray-400">
						Status
					</label>
					<select
						id="edit-status"
						value={status}
						onChange={(e) => setStatus(e.target.value)}
						className="w-full rounded-md border border-gray-700 bg-gray-800 px-2 py-2 text-sm text-gray-200 focus:border-blue-500 focus:outline-none"
					>
						{MEMORY_STATUS.map((s) => (
							<option key={s} value={s}>
								{MEMORY_STATUS_CONFIG[s]?.label ?? s}
							</option>
						))}
					</select>
				</div>

				<div>
					<label htmlFor="edit-permission" className="mb-1 block text-xs font-medium text-gray-400">
						Permission
					</label>
					<select
						id="edit-permission"
						value={permission}
						onChange={(e) => setPermission(e.target.value)}
						className="w-full rounded-md border border-gray-700 bg-gray-800 px-2 py-2 text-sm text-gray-200 focus:border-blue-500 focus:outline-none"
					>
						{PERMISSION.map((p) => (
							<option key={p} value={p}>
								{PERMISSION_LABELS[p] ?? p}
							</option>
						))}
					</select>
				</div>
			</div>

			{/* Actions */}
			<div className="flex justify-end gap-3 border-t border-gray-700 pt-4">
				<button
					type="button"
					onClick={onCancel}
					className="rounded-md px-4 py-2 text-sm text-gray-300 hover:bg-gray-800"
					disabled={saving}
				>
					Cancelar
				</button>
				<button
					type="submit"
					className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
					disabled={saving}
				>
					{saving ? "Guardando..." : "Guardar"}
				</button>
			</div>
		</form>
	);
}
