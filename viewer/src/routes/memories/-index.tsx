import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, Outlet } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { useMemo, useState } from "react";

import type { MemoryFilters } from "@/lib/memories";

import { memoriesEnrichedQueryOptions } from "./-queries";
import {
	groupItems,
	INITIAL_FILTERS,
	LibraryRow,
	SegmentedGroupBy,
	Toolbar,
	type GroupBy,
} from "./-shared";

export function MemoriesPage() {
	const queryClient = useQueryClient();
	const [filters, setFilters] = useState<MemoryFilters>(INITIAL_FILTERS);
	const [groupBy, setGroupBy] = useState<GroupBy>("type");
	const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
	const queryFilters = useMemo(
		() => ({ ...filters, onlyActive: groupBy === "context" }),
		[filters, groupBy],
	);

	const { data, isLoading, error } = useQuery(memoriesEnrichedQueryOptions(queryFilters));
	const groups = useMemo(() => groupItems(data?.items ?? [], groupBy), [data?.items, groupBy]);

	const toggle = (key: string) =>
		setCollapsed((prev) => {
			const next = new Set(prev);
			if (next.has(key)) next.delete(key);
			else next.add(key);
			return next;
		});

	return (
		<>
			<div className="px-6 py-6">
				<header className="mb-5">
					<div className="flex items-end justify-between gap-4">
						<div>
							<h2 className="text-2xl font-semibold tracking-tight text-white">Memories</h2>
							<p className="mt-1 text-xs text-gray-500 tabular-nums">
								{data?.meta.total ?? 0} results
							</p>
						</div>
						<div className="flex items-center gap-2">
							<Link
								to="/memories/new"
								className="inline-flex min-h-10 items-center gap-2 rounded-md border border-gray-700 px-3 text-sm text-gray-200 hover:bg-gray-800"
							>
								<Plus size={16} aria-hidden="true" /> New Memory
							</Link>
							<SegmentedGroupBy value={groupBy} onChange={setGroupBy} />
						</div>
					</div>
					<div className="mt-3">
						<Toolbar filters={filters} setFilters={setFilters} facets={data?.facets} />
					</div>
				</header>

				{isLoading ? (
					<p className="py-12 text-center text-sm text-gray-500">Loading memories…</p>
				) : error ? (
					<p className="py-12 text-center text-sm text-red-400">{error.message}</p>
				) : groups.length === 0 ? (
					<p className="py-12 text-center text-sm text-gray-500">No memories match your filters.</p>
				) : (
					<div className="space-y-8">
						{groups.map((group) => {
							const isCollapsed = collapsed.has(group.key);
							return (
								<section key={group.key}>
									<button
										type="button"
										onClick={() => toggle(group.key)}
										className="flex w-full items-baseline gap-3 border-b border-gray-800 pb-2 text-left"
									>
										<span
											className={`shrink-0 text-gray-500 transition-transform ${isCollapsed ? "" : "rotate-90"}`}
										>
											▸
										</span>
										<h3 className="text-sm font-medium text-gray-200">{group.title}</h3>
										<span className="ml-auto text-xs text-gray-500 tabular-nums">
											{group.items.length}
										</span>
									</button>
									{!isCollapsed && (
										<ul role="list" className="divide-y divide-gray-800/60">
											{group.items.map((memory) => (
												<li key={memory.id} className="relative">
													<Link
														to="/memories/$id"
														params={{ id: String(memory.id) }}
														aria-label={`Open ${memory.title}`}
														className="absolute inset-0 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 focus-visible:ring-inset"
													/>
													<LibraryRow
														memory={memory}
														hideType={groupBy === "type"}
														queryClient={queryClient}
													/>
												</li>
											))}
										</ul>
									)}
								</section>
							);
						})}
					</div>
				)}
			</div>
			<Outlet />
		</>
	);
}
