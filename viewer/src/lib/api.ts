import type { Project, Memory, Task } from "../../../src/schema";

export type { Project, Memory, Task };

/** Task with joined project data and subtasks (returned by /api/tasks/:id) */
export interface TaskDetail extends Task {
	projectName: string | null;
	subtasks: Task[];
}

export interface Stats {
	projects: number;
	memories: number;
	tasks: number;
}

async function fetchJson<T>(url: string): Promise<T> {
	const response = await fetch(url);
	if (!response.ok) {
		throw new Error(`HTTP ${response.status}: ${response.statusText}`);
	}
	return response.json();
}

async function patchResource<T>(url: string, body: Record<string, unknown>): Promise<T> {
	const response = await fetch(url, {
		method: "PATCH",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(body),
	});
	if (!response.ok) {
		throw new Error(`HTTP ${response.status}: ${response.statusText}`);
	}
	return response.json();
}

interface DeleteResponse {
	success: boolean;
	id: number;
}

async function deleteResource(url: string): Promise<DeleteResponse> {
	const response = await fetch(url, { method: "DELETE" });
	if (!response.ok) {
		throw new Error(`HTTP ${response.status}: ${response.statusText}`);
	}
	return response.json();
}

export const api = {
	stats: () => fetchJson<Stats>("/api/stats"),
	projects: () => fetchJson<Project[]>("/api/projects"),
	project: (id: number) => fetchJson<Project>(`/api/projects/${id}`),
	memories: (params?: { project?: number; limit?: number }) => {
		const search = new URLSearchParams();
		if (params?.project) search.set("project", String(params.project));
		if (params?.limit) search.set("limit", String(params.limit));
		const query = search.toString();
		return fetchJson<Memory[]>(`/api/memories${query ? `?${query}` : ""}`);
	},
	memory: (id: number) => fetchJson<Memory>(`/api/memories/${id}`),
	tasks: (params?: { project?: number; limit?: number }) => {
		const search = new URLSearchParams();
		if (params?.project) search.set("project", String(params.project));
		if (params?.limit) search.set("limit", String(params.limit));
		const query = search.toString();
		return fetchJson<Task[]>(`/api/tasks${query ? `?${query}` : ""}`);
	},
	task: (id: number) => fetchJson<TaskDetail>(`/api/tasks/${id}`),

	// Update operations
	updateTaskStatus: (id: number, status: string) =>
		patchResource<{ success: boolean; id: number; status: string }>(`/api/tasks/${id}`, { status }),

	// Delete operations
	deleteProject: (id: number) => deleteResource(`/api/projects/${id}`),
	deleteMemory: (id: number) => deleteResource(`/api/memories/${id}`),
	deleteTask: (id: number) => deleteResource(`/api/tasks/${id}`),
};
