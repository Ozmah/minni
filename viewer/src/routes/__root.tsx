import { QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { createRootRoute, Link, Outlet } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import { Brain, FolderKanban, Gauge, Hammer, PanelLeft } from "lucide-react";
import { useEffect, useRef } from "react";

import { DeleteConfirmModal } from "@/components/DeleteConfirmModal";
import { EditModal } from "@/components/EditModal";
import { HudWidget } from "@/components/HudWidget";
import { Spacer } from "@/components/ui";
import { api } from "@/lib/api";
import { queryClient } from "@/lib/query-client";

const navItems = [
	{ to: "/", label: "Cockpit", icon: Gauge, exact: true },
	{ to: "/projects", label: "Projects", icon: FolderKanban, exact: false },
	{ to: "/composer", label: "Composer", icon: Hammer, exact: false },
	{ to: "/memories", label: "Memories", icon: Brain, exact: false },
	{ to: "/canvas", label: "Canvas", icon: PanelLeft, exact: false },
] as const;

export const Route = createRootRoute({
	component: RootLayout,
});

const POLL_INTERVAL = 3000;

/** Maps entity types from /api/changes to their TanStack Query keys. */
const ENTITY_QUERY_MAP: Record<string, string[]> = {
	canvas: ["canvas", "hud"],
	memory: ["memories", "memory", "hud"],
	project: ["projects", "project", "hud"],
	dev_mode: ["dev-modes", "dev-mode", "hud"],
};

function RootLayout() {
	return (
		<QueryClientProvider client={queryClient}>
			<AppShell />
		</QueryClientProvider>
	);
}

function AppShell() {
	usePollingInvalidation();

	return (
		<>
			<div className="flex h-screen bg-gray-900 text-gray-100">
				<Sidebar />
				<main className="flex-1 overflow-auto">
					<Outlet />
				</main>
			</div>
			<DeleteConfirmModal />
			<EditModal />
			<TanStackRouterDevtools position="bottom-right" />
		</>
	);
}

/** Polls /api/changes and invalidates Query caches when timestamps advance. */
function usePollingInvalidation() {
	const qc = useQueryClient();
	const lastSeen = useRef<Record<string, number>>({});

	useEffect(() => {
		const timer = setInterval(async () => {
			const res = await api.api.changes.get();
			if (res.error) return;

			const changes = res.data;

			for (const [entity, timestamp] of Object.entries(changes)) {
				const prev = lastSeen.current[entity];
				if (prev !== undefined && timestamp > prev) {
					const keys = ENTITY_QUERY_MAP[entity];
					if (keys) {
						for (const key of keys) {
							qc.invalidateQueries({ queryKey: [key] });
						}
					}
				}
				lastSeen.current[entity] = timestamp;
			}
		}, POLL_INTERVAL);

		return () => clearInterval(timer);
	}, [qc]);
}

function Sidebar() {
	return (
		<aside className="flex w-56 flex-col border-r border-gray-700 bg-gray-800">
			<div className="border-b border-gray-700 px-4 py-3">
				<h1 className="text-lg font-semibold text-white">Minni</h1>
			</div>
			<nav className="p-2">
				<ul className="space-y-1">
					{navItems.map(({ to, label, icon: Icon, exact }) => (
						<li key={to}>
							<Link
								to={to}
								activeOptions={{ exact: Boolean(exact) }}
								className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-gray-300 transition-colors hover:bg-gray-700 hover:text-white [&.active]:bg-gray-700 [&.active]:text-white"
							>
								<Icon size={18} />
								{label}
							</Link>
						</li>
					))}
				</ul>
			</nav>
			<Spacer />
			<HudWidget />
		</aside>
	);
}
