/**
 * Shared types for the Minni viewer server.
 */

export interface CanvasPage {
	id: string;
	markdown: string;
	html: string;
	timestamp: number;
}

export interface SSESubscriber {
	controller: ReadableStreamDefaultController;
	connectedAt: number;
	lastActivity: number;
}

export interface ServerConfig {
	preferredPort: number;
	maxCanvasPages: number;
	maxContentLength: number;
	heartbeatInterval: number;
	connectionTimeout: number;
	maxSubscribers: number;
}

export const DEFAULT_CONFIG: ServerConfig = {
	preferredPort: 8593,
	maxCanvasPages: 20,
	maxContentLength: 500_000, // 500KB
	heartbeatInterval: 15_000, // 15s
	connectionTimeout: 120_000, // 2min
	maxSubscribers: 100,
};

export const MIME_TYPES: Record<string, string> = {
	".html": "text/html",
	".css": "text/css",
	".js": "application/javascript",
	".json": "application/json",
	".svg": "image/svg+xml",
	".png": "image/png",
	".ico": "image/x-icon",
};

export const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
