import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { ListTodo, Clock, Circle, FolderKanban, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";

import { TaskStatusMenu } from "@/components/TaskStatusMenu";
import { Muted } from "@/components/ui/Typography";
import { api, type Task } from "@/lib/api";
import { TASK_STATUS_CONFIG, TASK_PRIORITY_CONFIG } from "@/lib/config";

import type { TaskStatus } from "../../../src/schema";

// ============================================================================
// ROUTE
// ============================================================================

export const Route = createFileRoute("/tasks")({
	component: TasksPage,
});

// ============================================================================
// TREE HELPERS
// ============================================================================

interface TaskNode extends Task {
	children: TaskNode[];
}

/** Builds a tree from a flat task list. Orphaned subtasks become roots. */
function buildTree(tasks: Task[]): TaskNode[] {
	const map = new Map<number, TaskNode>();
	const roots: TaskNode[] = [];

	for (const t of tasks) {
		map.set(t.id, { ...t, children: [] });
	}

	for (const node of map.values()) {
		if (node.parentId && map.has(node.parentId)) {
			map.get(node.parentId)!.children.push(node);
		} else {
			roots.push(node);
		}
	}

	return roots;
}

/** Flattens a tree filtering by status, keeping parents visible if any child matches. */
function filterTree(nodes: TaskNode[], status: TaskStatus | "all"): TaskNode[] {
	if (status === "all") return nodes;

	return nodes.reduce<TaskNode[]>((acc, node) => {
		const filteredChildren = filterTree(node.children, status);
		if (node.status === status || filteredChildren.length > 0) {
			acc.push({ ...node, children: filteredChildren });
		}
		return acc;
	}, []);
}

// ============================================================================
// PAGE
// ============================================================================

const TABS: Array<{ key: TaskStatus | "all"; label: string }> = [
	{ key: "all", label: "All" },
	{ key: "todo", label: "To Do" },
	{ key: "in_progress", label: "In Progress" },
	{ key: "done", label: "Done" },
	{ key: "cancelled", label: "Cancelled" },
];

function TasksPage() {
	const [activeTab, setActiveTab] = useState<TaskStatus | "all">("all");
	const [projectFilter, setProjectFilter] = useState<number | "all">("all");

	const {
		data: tasks,
		isLoading,
		error,
	} = useQuery({
		queryKey: ["tasks"],
		queryFn: () => api.tasks({ limit: 200 }),
	});

	const { data: projects } = useQuery({
		queryKey: ["projects"],
		queryFn: () => api.projects(),
	});

	const counts = useMemo(() => {
		if (!tasks) return { all: 0, todo: 0, in_progress: 0, done: 0, cancelled: 0 };
		return {
			all: tasks.length,
			todo: tasks.filter((t) => t.status === "todo").length,
			in_progress: tasks.filter((t) => t.status === "in_progress").length,
			done: tasks.filter((t) => t.status === "done").length,
			cancelled: tasks.filter((t) => t.status === "cancelled").length,
		};
	}, [tasks]);

	const tree = useMemo(() => {
		if (!tasks) return [];
		const projectFiltered =
			projectFilter === "all" ? tasks : tasks.filter((t) => t.projectId === projectFilter);
		const built = buildTree(projectFiltered);
		return filterTree(built, activeTab);
	}, [tasks, activeTab, projectFilter]);

	if (isLoading) {
		return <div className="p-6 text-gray-400">Loading tasks...</div>;
	}

	if (error) {
		return <div className="p-6 text-red-400">Error: {error.message}</div>;
	}

	if (!tasks?.length) {
		return (
			<div className="flex flex-col items-center justify-center p-12 text-gray-400">
				<ListTodo size={48} className="mb-4 opacity-50" />
				<p className="text-lg">No tasks yet</p>
				<p className="mt-2 text-sm">Create one using minni_task</p>
			</div>
		);
	}

	return (
		<>
			<div className="p-6">
				{/* Header */}
				<div className="mb-4">
					<h2 className="text-2xl font-semibold tracking-tight">Tasks</h2>
					<Muted>
						{counts.all} total &middot; {counts.todo} todo &middot; {counts.in_progress} wip
						&middot; {counts.done} done
					</Muted>
				</div>

				{/* Project filter */}
				{projects && projects.length > 0 && (
					<div className="mb-3 flex items-center gap-2">
						<FolderKanban size={14} className="text-gray-500" />
						<select
							value={projectFilter === "all" ? "all" : String(projectFilter)}
							onChange={(e) =>
								setProjectFilter(e.target.value === "all" ? "all" : Number(e.target.value))
							}
							className="rounded-md border border-gray-700 bg-gray-800 px-2 py-1 text-sm text-gray-300 outline-none focus:border-gray-500"
						>
							<option value="all">All projects</option>
							{projects.map((p) => (
								<option key={p.id} value={p.id}>
									{p.name}
								</option>
							))}
						</select>
					</div>
				)}

				{/* Status tabs */}
				<div className="mb-4 flex gap-1 rounded-lg bg-gray-800/50 p-1">
					{TABS.map((tab) => {
						const count = counts[tab.key];
						const isActive = activeTab === tab.key;
						return (
							<button
								key={tab.key}
								onClick={() => setActiveTab(tab.key)}
								className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
									isActive
										? "bg-gray-700 font-medium text-white"
										: "text-gray-400 hover:text-gray-300"
								}`}
							>
								{tab.label}
								{count > 0 && (
									<span className={`ml-1.5 ${isActive ? "text-gray-300" : "text-gray-500"}`}>
										{count}
									</span>
								)}
							</button>
						);
					})}
				</div>

				{/* Tree list */}
				{tree.length === 0 ? (
					<div className="py-12 text-center text-gray-500">
						No {activeTab === "all" ? "" : activeTab.replace("_", " ")} tasks
					</div>
				) : (
					<div className="space-y-1">
						{tree.map((node) => (
							<TaskTreeNode key={node.id} node={node} depth={0} />
						))}
					</div>
				)}
			</div>
			<Outlet />
		</>
	);
}

// ============================================================================
// TREE NODE
// ============================================================================

function TaskTreeNode({ node, depth }: { node: TaskNode; depth: number }) {
	const [expanded, setExpanded] = useState(true);
	const hasChildren = node.children.length > 0;

	return (
		<div>
			<TaskCard
				task={node}
				depth={depth}
				hasChildren={hasChildren}
				expanded={expanded}
				onToggle={() => setExpanded((p) => !p)}
			/>
			{hasChildren && expanded && (
				<div className="relative ml-4 border-l border-gray-700/50 pl-0">
					{node.children.map((child) => (
						<TaskTreeNode key={child.id} node={child} depth={depth + 1} />
					))}
				</div>
			)}
		</div>
	);
}

// ============================================================================
// CARD
// ============================================================================

function TaskCard({
	task,
	depth,
	hasChildren,
	expanded,
	onToggle,
}: {
	task: Task;
	depth: number;
	hasChildren: boolean;
	expanded: boolean;
	onToggle: () => void;
}) {
	const statusConfig = TASK_STATUS_CONFIG[task.status] ?? TASK_STATUS_CONFIG.todo;
	const priorityConfig = TASK_PRIORITY_CONFIG[task.priority] ?? TASK_PRIORITY_CONFIG.medium;
	const StatusIcon = statusConfig.icon ?? Circle;

	return (
		<article
			className={`flex items-center gap-2 rounded-lg border border-gray-700 bg-gray-800/50 p-2.5 transition-colors hover:border-gray-600 hover:bg-gray-800 ${depth > 0 ? "ml-3" : ""}`}
		>
			{/* Expand/collapse toggle */}
			{hasChildren ? (
				<button
					onClick={onToggle}
					className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-gray-500 hover:text-gray-300"
				>
					<ChevronRight
						size={14}
						className={`transition-transform ${expanded ? "rotate-90" : ""}`}
					/>
				</button>
			) : (
				<span className="w-5 shrink-0" />
			)}

			{/* Status icon */}
			<StatusIcon size={16} className={`shrink-0 ${statusConfig.color}`} />

			{/* Title + link */}
			<Link
				to="/tasks/$id"
				params={{ id: task.id.toString() }}
				className="flex-1 truncate text-sm font-medium text-white hover:underline"
			>
				{task.title}
			</Link>

			{/* Priority badge */}
			<span className={`shrink-0 rounded px-1.5 py-0.5 text-xs ${priorityConfig.color}`}>
				{task.priority}
			</span>

			{/* Date */}
			<span className="flex shrink-0 items-center gap-1 text-xs text-gray-500">
				<Clock size={10} />
				{new Date(task.updatedAt).toLocaleDateString()}
			</span>

			{/* Status menu */}
			<TaskStatusMenu taskId={task.id} currentStatus={task.status} />
		</article>
	);
}
