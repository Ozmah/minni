import type { Project, Memory, Task } from "../../../src/schema";

export type { Project, Memory, Task };

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

export const api = {
	stats: () => fetchJson<Stats>("/api/stats"),
	projects: () => fetchJson<Project[]>("/api/projects"),
	memories: (params?: { project?: number; limit?: number }) => {
		const search = new URLSearchParams();
		if (params?.project) search.set("project", String(params.project));
		if (params?.limit) search.set("limit", String(params.limit));
		const query = search.toString();
		return fetchJson<Memory[]>(`/api/memories${query ? `?${query}` : ""}`);
	},
	tasks: (params?: { project?: number; limit?: number }) => {
		const search = new URLSearchParams();
		if (params?.project) search.set("project", String(params.project));
		if (params?.limit) search.set("limit", String(params.limit));
		const query = search.toString();
		return fetchJson<Task[]>(`/api/tasks${query ? `?${query}` : ""}`);
	},
};
