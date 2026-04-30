export type ContextMemoryPlacement = "project" | "dev_mode" | "shared" | null;

export type ContextLoadoutItem = {
	key: string;
	kind: "overview" | "rule" | "principle" | "memory";
	title: string;
	subtitle: string;
	text: string;
	memoryId?: number;
};

export type ContextLoadoutSection = {
	key: "project" | "dev-mode" | "memories";
	title: string;
	description: string;
	items: ContextLoadoutItem[];
	text: string;
};

export type ActiveContextLoadout = {
	activeProject: { id: number; name: string } | null;
	activeDevMode: { id: number; name: string } | null;
	sections: ContextLoadoutSection[];
	text: string;
	counts: {
		sections: number;
		items: number;
		memories: number;
	};
};
