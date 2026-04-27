import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { Cog, Hammer, Sparkles } from "lucide-react";

import { api, unwrap } from "@/lib/api";

export const Route = createFileRoute("/composer")({
	component: ComposerRoute,
});

function ComposerRoute() {
	const pathname = useRouterState({ select: (state) => state.location.pathname });

	return pathname === "/composer" ? <ComposerIndex /> : <Outlet />;
}

function ComposerIndex() {
	const { data: hud } = useQuery({
		queryKey: ["hud"],
		queryFn: () => api.api.hud.get().then(unwrap),
	});
	const {
		data: devModes,
		isLoading,
		error,
	} = useQuery({
		queryKey: ["dev-modes"],
		queryFn: () => api.api["dev-modes"].get().then(unwrap),
	});

	return (
		<div className="mx-auto max-w-5xl p-6">
			<div className="mb-8 flex items-start gap-4">
				<div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-amber-300">
					<Hammer size={24} aria-hidden="true" />
				</div>
				<div>
					<h2 className="text-2xl font-semibold tracking-tight text-white">Composer</h2>
					<p className="mt-1 max-w-2xl text-sm text-gray-400">
						Forge dev modes from metadata, principles, and existing memories. V1 is focused: no
						inline memory creation and no autosave.
					</p>
				</div>
			</div>

			{hud?.devMode && (
				<Link
					to="/composer/dev-modes/$id"
					params={{ id: String(hud.devMode.id) }}
					className="mb-6 flex items-center justify-between rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-left hover:border-emerald-400/40"
				>
					<div className="flex items-center gap-3">
						<Sparkles size={18} className="text-emerald-300" aria-hidden="true" />
						<div>
							<p className="text-sm font-medium text-emerald-100">Open active dev mode</p>
							<p className="text-sm text-emerald-200/70">{hud.devMode.name}</p>
						</div>
					</div>
					<span className="text-sm text-emerald-200">Compose →</span>
				</Link>
			)}

			<section>
				<h3 className="mb-3 text-sm font-medium tracking-wide text-gray-500 uppercase">
					Dev modes
				</h3>

				{isLoading && <p className="text-sm text-gray-400">Loading dev modes...</p>}
				{error && <p className="text-sm text-red-400">Failed to load dev modes.</p>}

				{devModes && devModes.length > 0 ? (
					<div className="grid gap-3 md:grid-cols-2">
						{devModes.map((devMode) => (
							<Link
								key={devMode.id}
								to="/composer/dev-modes/$id"
								params={{ id: String(devMode.id) }}
								className="rounded-lg border border-gray-700 bg-gray-800/50 p-4 hover:border-gray-600 hover:bg-gray-800"
							>
								<div className="flex items-start gap-3">
									<Cog size={18} className="mt-0.5 text-gray-400" aria-hidden="true" />
									<div className="min-w-0">
										<p className="truncate font-medium text-white">{devMode.name}</p>
										{devMode.description && (
											<p className="mt-1 line-clamp-2 text-sm text-gray-400">
												{devMode.description}
											</p>
										)}
										<p className="mt-2 text-xs text-gray-500">Permission: {devMode.permission}</p>
									</div>
								</div>
							</Link>
						))}
					</div>
				) : null}
			</section>
		</div>
	);
}
