import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ChevronDown, Cog, FolderKanban, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { api, unwrap } from "@/lib/api";

import type { DevMode, Project } from "../../../src/schema";

type Permission = "open" | "guarded" | "read_only" | "locked";

type ActiveItem = {
	id: number;
	name: string;
	description?: string | null;
	permission?: Permission;
};

const PERMISSION_DOT: Record<Permission, string> = {
	open: "bg-emerald-500",
	guarded: "bg-amber-500",
	read_only: "bg-neutral-500",
	locked: "bg-red-500",
};

/* ========================================================================== *
 *  Data layer
 * ========================================================================== */

function useHud() {
	return useQuery({
		queryKey: ["hud"],
		queryFn: () => api.api.hud.get().then(unwrap),
		refetchInterval: 3000,
	});
}

function useProjects(enabled: boolean) {
	return useQuery({
		queryKey: ["projects"],
		queryFn: () => api.api.projects.get().then(unwrap),
		enabled,
	});
}

function useDevModes(enabled: boolean) {
	return useQuery({
		queryKey: ["dev-modes"],
		queryFn: () => api.api["dev-modes"].get().then(unwrap),
		enabled,
	});
}

function useActivateProject() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (id: number) => api.api.projects({ id }).activate.post().then(unwrap),
		onSuccess: async () => {
			await Promise.all([
				qc.invalidateQueries({ queryKey: ["hud"] }),
				qc.invalidateQueries({ queryKey: ["projects"] }),
			]);
		},
	});
}

function useActivateDevMode() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (id: number) => api.api["dev-modes"]({ id }).activate.post().then(unwrap),
		onSuccess: async () => {
			await Promise.all([
				qc.invalidateQueries({ queryKey: ["hud"] }),
				qc.invalidateQueries({ queryKey: ["dev-modes"] }),
			]);
		},
	});
}

function useClearActiveProject() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: () => api.api.projects["clear-active"].post().then(unwrap),
		onSuccess: async () => {
			await Promise.all([
				qc.invalidateQueries({ queryKey: ["hud"] }),
				qc.invalidateQueries({ queryKey: ["projects"] }),
			]);
		},
	});
}

function useClearActiveDevMode() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: () => api.api["dev-modes"]["clear-active"].post().then(unwrap),
		onSuccess: async () => {
			await Promise.all([
				qc.invalidateQueries({ queryKey: ["hud"] }),
				qc.invalidateQueries({ queryKey: ["dev-modes"] }),
			]);
		},
	});
}

function toProjectItem(p: Project): ActiveItem {
	return {
		id: p.id,
		name: p.name,
		description: p.stack ?? null,
		permission: p.permission as Permission,
	};
}

function toDevModeItem(d: DevMode): ActiveItem {
	return {
		id: d.id,
		name: d.name,
		description: d.description,
		permission: d.permission as Permission,
	};
}

/* ========================================================================== *
 *  Popover menu with permission dot + description
 * ========================================================================== */

interface ActivatorMenuProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	currentId: number | null;
	items: ActiveItem[] | undefined;
	onActivate: (id: number) => void;
	trigger: React.ReactNode;
	emptyLabel: string;
	placement?: "top" | "right";
	onClear?: () => void;
	clearLabel?: string;
	pending?: boolean;
}

function ActivatorMenu({
	open,
	onOpenChange,
	currentId,
	items,
	onActivate,
	trigger,
	emptyLabel,
	placement = "top",
	onClear,
	clearLabel,
	pending = false,
}: ActivatorMenuProps) {
	const containerRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (!open) return;
		const handler = (e: MouseEvent) => {
			if (!containerRef.current?.contains(e.target as Node)) onOpenChange(false);
		};
		const esc = (e: KeyboardEvent) => {
			if (e.key === "Escape") onOpenChange(false);
		};
		document.addEventListener("mousedown", handler);
		document.addEventListener("keydown", esc);
		return () => {
			document.removeEventListener("mousedown", handler);
			document.removeEventListener("keydown", esc);
		};
	}, [open, onOpenChange]);

	return (
		<div ref={containerRef} className="relative">
			{trigger}
			{open && (
				<div
					className={`absolute z-50 max-h-64 overflow-y-auto rounded-md border border-gray-700 bg-gray-800 p-1 shadow-xl ${
						placement === "right"
							? "bottom-0 left-full ml-2 w-64"
							: "right-0 bottom-full left-0 mb-2"
					}`}
				>
					{onClear && (
						<>
							<button
								type="button"
								onClick={() => {
									onClear();
									onOpenChange(false);
								}}
								disabled={pending}
								className="flex min-h-11 w-full items-center gap-2 rounded px-2 py-2 text-left text-sm text-gray-300 hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
							>
								<X size={14} className="shrink-0 text-gray-500" />
								<span>{clearLabel ?? "Clear selection"}</span>
							</button>
							<div className="my-1 border-t border-gray-700" />
						</>
					)}
					{!items || items.length === 0 ? (
						<div className="px-2 py-3 text-xs text-gray-500">{emptyLabel}</div>
					) : (
						<ul role="list">
							{items.map((item) => {
								const active = currentId === item.id;
								return (
									<li key={item.id}>
										<button
											type="button"
											onClick={() => {
												onActivate(item.id);
												onOpenChange(false);
											}}
											disabled={pending}
											className="flex min-h-11 w-full items-start gap-2 rounded px-2 py-2 text-left hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
										>
											{item.permission && (
												<span
													className={`mt-1 size-2 shrink-0 rounded-full ${PERMISSION_DOT[item.permission]}`}
													aria-hidden="true"
												/>
											)}
											<div className="min-w-0 flex-1">
												<div className="truncate text-sm text-gray-100">{item.name}</div>
												{item.description && (
													<div className="truncate text-xs text-gray-500">{item.description}</div>
												)}
											</div>
											{active && <Check size={14} className="mt-0.5 shrink-0 text-emerald-400" />}
										</button>
									</li>
								);
							})}
						</ul>
					)}
				</div>
			)}
		</div>
	);
}

/* ========================================================================== *
 *  HudWidget — active status for sidebar footer
 * ========================================================================== */

export function HudWidget({ collapsed = false }: { collapsed?: boolean }) {
	const { data: hud } = useHud();

	const [devOpen, setDevOpen] = useState(false);
	const [projOpen, setProjOpen] = useState(false);
	const { data: devModes } = useDevModes(devOpen);
	const { data: projects } = useProjects(projOpen);
	const activateDev = useActivateDevMode();
	const activateProj = useActivateProject();
	const clearDev = useClearActiveDevMode();
	const clearProj = useClearActiveProject();

	if (!hud) return null;

	const devPerm = hud.devMode?.permission ?? null;
	const projPerm = hud.project?.permission ?? null;
	const placement = collapsed ? "right" : "top";

	return (
		<div
			className={`border-t border-gray-700 px-2 pt-2 pb-8 ${collapsed ? "flex flex-col items-center" : ""}`}
		>
			<div className="space-y-0.5">
				<ActivatorMenu
					open={devOpen}
					onOpenChange={setDevOpen}
					currentId={hud.devMode?.id ?? null}
					items={devModes?.map(toDevModeItem)}
					onActivate={(id) => activateDev.mutate(id)}
					onClear={() => clearDev.mutate()}
					clearLabel="No active dev mode"
					pending={activateDev.isPending || clearDev.isPending}
					emptyLabel="No dev modes yet"
					placement={placement}
					trigger={
						<button
							type="button"
							onClick={() => setDevOpen((o) => !o)}
							aria-expanded={devOpen}
							aria-haspopup="menu"
							aria-label={collapsed ? `Dev Mode: ${hud.devMode?.name ?? "none"}` : undefined}
							className={`flex min-h-11 items-center rounded text-left hover:bg-gray-700/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500 ${
								collapsed ? "relative w-11 justify-center" : "w-full gap-2.5 px-2 py-1.5"
							}`}
							title={collapsed ? `Dev Mode: ${hud.devMode?.name ?? "none"}` : "Dev Mode"}
						>
							<span
								className={`shrink-0 rounded-full ${
									collapsed ? "absolute mt-7 ml-7 size-2" : "size-1.5"
								} ${devPerm ? PERMISSION_DOT[devPerm] : "bg-gray-700"}`}
								aria-hidden="true"
							/>
							<Cog size={14} className="shrink-0 text-gray-500" />
							{!collapsed && (
								<>
									<span className="min-w-0 flex-1 truncate text-sm text-gray-100">
										{hud.devMode?.name ?? "No dev mode"}
									</span>
									<ChevronDown size={12} className="shrink-0 text-gray-600" />
								</>
							)}
						</button>
					}
				/>

				<ActivatorMenu
					open={projOpen}
					onOpenChange={setProjOpen}
					currentId={hud.project?.id ?? null}
					items={projects?.map(toProjectItem)}
					onActivate={(id) => activateProj.mutate(id)}
					onClear={() => clearProj.mutate()}
					clearLabel="No active project"
					pending={activateProj.isPending || clearProj.isPending}
					emptyLabel="No projects yet"
					placement={placement}
					trigger={
						<button
							type="button"
							onClick={() => setProjOpen((o) => !o)}
							aria-expanded={projOpen}
							aria-haspopup="menu"
							aria-label={collapsed ? `Project: ${hud.project?.name ?? "none"}` : undefined}
							className={`flex min-h-11 items-center rounded text-left hover:bg-gray-700/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500 ${
								collapsed ? "relative w-11 justify-center" : "w-full gap-2.5 px-2 py-1.5"
							}`}
							title={collapsed ? `Project: ${hud.project?.name ?? "none"}` : "Project"}
						>
							<span
								className={`shrink-0 rounded-full ${
									collapsed ? "absolute mt-7 ml-7 size-2" : "size-1.5"
								} ${projPerm ? PERMISSION_DOT[projPerm] : "bg-gray-700"}`}
								aria-hidden="true"
							/>
							<FolderKanban size={14} className="shrink-0 text-gray-500" />
							{!collapsed && (
								<>
									<span className="min-w-0 flex-1 truncate text-sm text-gray-100">
										{hud.project?.name ?? "No project"}
									</span>
									<ChevronDown size={12} className="shrink-0 text-gray-600" />
								</>
							)}
						</button>
					}
				/>
			</div>

			{!collapsed && (
				<div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 border-t border-gray-800 px-2 pt-2">
					<Count label="Memories" value={hud.counts.memories} />
					<Count label="Rules" value={hud.counts.rules} />
					<Count label="Commands" value={hud.counts.commands} />
					<Count label="Canvas" value={hud.counts.canvas} />
				</div>
			)}
		</div>
	);
}

function Count({ label, value }: { label: string; value: number }) {
	return (
		<div className="flex items-baseline justify-between gap-2 text-xs">
			<span className="text-gray-500">{label}</span>
			<span className="text-gray-300 tabular-nums">{value}</span>
		</div>
	);
}
