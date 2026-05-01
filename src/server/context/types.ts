export type ContextMemoryPlacement = "project" | "dev_mode" | "shared" | null;

export type ContextLoadoutItem = {
	key: string;
	kind: "overview" | "rule" | "principle" | "memory" | "command";
	title: string;
	subtitle: string;
	text: string;
	memoryId?: number;
	overview?: {
		type: "project" | "dev-mode";
		name: string;
		description: string | null;
		permission: string;
		stack?: string[];
		conventionCount?: number;
		gotchaCount?: number;
		principleCount?: number;
	};
	rule?: {
		kind: "convention" | "gotcha" | "principle";
		statement: string;
		rationale: string | null;
		severity: string;
		permission: string;
		example: string | null;
	};
	memory?: {
		id: number;
		title: string;
		type: string;
		status: string;
		permission: string;
		placement: ContextMemoryPlacement;
		content: string;
	};
	command?: {
		key: string;
		command: string;
		summary: string | null;
		group: string;
		risk: string;
		visibility: string;
		permission: string;
		notes: string | null;
	};
};

export type ContextLoadoutSection = {
	key: "project" | "dev-mode" | "commands" | "memories";
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
		commands: number;
	};
};
