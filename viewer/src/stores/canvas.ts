import { Store, Derived } from "@tanstack/store";

export interface CanvasPage {
	id: string;
	markdown: string;
	html: string;
	timestamp: number;
}

interface CanvasState {
	pages: CanvasPage[];
	currentIndex: number;
	connectionStatus: "disconnected" | "connecting" | "connected" | "error";
}

// === localStorage Persistence ===

const STORAGE_KEY = "minni-canvas-pages";

function loadFromStorage(): CanvasPage[] {
	try {
		const stored = localStorage.getItem(STORAGE_KEY);
		if (!stored) return [];
		const pages = JSON.parse(stored) as CanvasPage[];
		if (!Array.isArray(pages)) return [];
		return pages.filter(
			(p) =>
				typeof p.id === "string" &&
				typeof p.markdown === "string" &&
				typeof p.timestamp === "number",
		);
	} catch {
		return [];
	}
}

function saveToStorage(pages: CanvasPage[]): void {
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(pages));
	} catch (e) {
		console.warn("[Minni] Failed to save canvas to localStorage:", e);
	}
}

function clearStorage(): void {
	try {
		localStorage.removeItem(STORAGE_KEY);
	} catch {
		// Ignore
	}
}

// === Store ===

const storedPages = loadFromStorage();

const initialState: CanvasState = {
	pages: storedPages,
	currentIndex: storedPages.length > 0 ? storedPages.length - 1 : -1,
	connectionStatus: "disconnected",
};

export const canvasStore = new Store<CanvasState>(initialState);

// === Actions ===

export const setConnectionStatus = (status: CanvasState["connectionStatus"]) => {
	canvasStore.setState((s) => ({ ...s, connectionStatus: status }));
};

export const setPages = (pages: CanvasPage[], currentIndex: number) => {
	canvasStore.setState((s) => ({ ...s, pages, currentIndex }));
	saveToStorage(pages);
};

export const addPage = (page: CanvasPage) => {
	canvasStore.setState((s) => {
		// Avoid duplicates (SSE might resend)
		if (s.pages.some((p) => p.id === page.id)) return s;
		const newPages = [...s.pages, page];
		saveToStorage(newPages);
		return {
			...s,
			pages: newPages,
			currentIndex: newPages.length - 1,
		};
	});
};

export const navigateTo = (index: number) => {
	canvasStore.setState((s) => {
		if (index < 0 || index >= s.pages.length) return s;
		return { ...s, currentIndex: index };
	});
};

export const navigatePrev = () => {
	canvasStore.setState((s) => {
		if (s.currentIndex <= 0) return s;
		return { ...s, currentIndex: s.currentIndex - 1 };
	});
};

export const navigateNext = () => {
	canvasStore.setState((s) => {
		if (s.currentIndex >= s.pages.length - 1) return s;
		return { ...s, currentIndex: s.currentIndex + 1 };
	});
};

export const deletePage = async (id: string) => {
	try {
		await fetch(`/api/canvas/delete/${id}`, { method: "DELETE" });
		canvasStore.setState((s) => {
			const pages = s.pages.filter((p) => p.id !== id);
			const currentIndex = Math.min(s.currentIndex, pages.length - 1);
			saveToStorage(pages);
			return { ...s, pages, currentIndex };
		});
	} catch (e) {
		console.error("Failed to delete page:", e);
	}
};

export const clearPages = () => {
	canvasStore.setState((s) => ({ ...s, pages: [], currentIndex: -1 }));
	clearStorage();
};

// === Derived ===

export const currentPage = new Derived({
	fn: () => {
		const { pages, currentIndex } = canvasStore.state;
		return pages[currentIndex] ?? null;
	},
	deps: [canvasStore],
});
currentPage.mount();

export const canNavigatePrev = new Derived({
	fn: () => canvasStore.state.currentIndex > 0,
	deps: [canvasStore],
});
canNavigatePrev.mount();

export const canNavigateNext = new Derived({
	fn: () => {
		const { pages, currentIndex } = canvasStore.state;
		return currentIndex < pages.length - 1;
	},
	deps: [canvasStore],
});
canNavigateNext.mount();

export const pageCount = new Derived({
	fn: () => canvasStore.state.pages.length,
	deps: [canvasStore],
});
pageCount.mount();

export const currentPageNumber = new Derived({
	fn: () => canvasStore.state.currentIndex + 1,
	deps: [canvasStore],
});
currentPageNumber.mount();

// === SSE Connection ===

let eventSource: EventSource | null = null;

export const connectToCanvas = () => {
	if (eventSource) return;

	setConnectionStatus("connecting");
	eventSource = new EventSource("/api/canvas/stream");

	eventSource.onopen = () => setConnectionStatus("connected");

	eventSource.onmessage = (event) => {
		const data = JSON.parse(event.data);

		if (data.heartbeat) return;

		if (data.cleared) {
			clearPages();
		} else if (data.pages !== undefined) {
			const serverPages = data.pages as CanvasPage[];
			const localPages = canvasStore.state.pages;

			if (serverPages.length > 0) {
				const serverIds = new Set(serverPages.map((p) => p.id));
				const uniqueLocal = localPages.filter((p) => !serverIds.has(p.id));
				const merged = [...uniqueLocal, ...serverPages].sort((a, b) => a.timestamp - b.timestamp);
				setPages(merged, merged.length - 1);
			}
		} else if (data.page) {
			addPage(data.page);
		}
	};

	eventSource.onerror = () => {
		setConnectionStatus("error");
		eventSource?.close();
		eventSource = null;
		setTimeout(connectToCanvas, 2000);
	};
};

export const disconnectFromCanvas = () => {
	eventSource?.close();
	eventSource = null;
	setConnectionStatus("disconnected");
};
