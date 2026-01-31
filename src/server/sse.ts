/**
 * Server-Sent Events management for real time canvas updates.
 */

import { type SSESubscriber, DEFAULT_CONFIG } from "./types";

const subscribers = new Map<string, SSESubscriber>();
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;

// === Subscriber Management ===

export function getSubscriberCount(): number {
	return subscribers.size;
}

function addSubscriber(id: string, controller: ReadableStreamDefaultController): void {
	const now = Date.now();
	subscribers.set(id, {
		controller,
		connectedAt: now,
		lastActivity: now,
	});
}

function removeSubscriber(id: string): void {
	const sub = subscribers.get(id);
	if (sub) {
		safeClose(sub.controller);
		subscribers.delete(id);
	}
}

function safeClose(controller: ReadableStreamDefaultController): void {
	const closeResult = safeEnqueue(controller, null);
	if (closeResult.ok) {
		try {
			controller.close();
		} catch {
			// Already closed
		}
	}
}

function safeEnqueue(
	controller: ReadableStreamDefaultController,
	data: Uint8Array | null,
): { ok: boolean } {
	if (data === null) {
		return { ok: true };
	}
	try {
		controller.enqueue(data);
		return { ok: true };
	} catch {
		return { ok: false };
	}
}

// === Broadcasting ===

export function broadcast(data: unknown): void {
	const msg = new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`);
	const now = Date.now();

	for (const [id, sub] of subscribers) {
		const result = safeEnqueue(sub.controller, msg);
		if (result.ok) {
			sub.lastActivity = now;
		} else {
			subscribers.delete(id);
		}
	}
}

// === Heartbeat ===

function heartbeat(): void {
	const now = Date.now();
	const msg = new TextEncoder().encode(`data: {"heartbeat":true}\n\n`);

	for (const [id, sub] of subscribers) {
		if (now - sub.lastActivity > DEFAULT_CONFIG.connectionTimeout) {
			removeSubscriber(id);
			continue;
		}

		const result = safeEnqueue(sub.controller, msg);
		if (result.ok) {
			sub.lastActivity = now;
		} else {
			subscribers.delete(id);
		}
	}
}

export function startHeartbeat(): void {
	if (!heartbeatTimer) {
		heartbeatTimer = setInterval(heartbeat, DEFAULT_CONFIG.heartbeatInterval);
	}
}

export function stopHeartbeat(): void {
	if (heartbeatTimer) {
		clearInterval(heartbeatTimer);
		heartbeatTimer = null;
	}
}

// === SSE Stream Creation ===

export function createSSEStream(
	initialData?: unknown,
): Response | { error: string; status: number } {
	if (subscribers.size >= DEFAULT_CONFIG.maxSubscribers) {
		return { error: "Too many connections", status: 503 };
	}

	const id = crypto.randomUUID();

	const stream = new ReadableStream({
		start(controller) {
			addSubscriber(id, controller);
			if (initialData) {
				const msg = new TextEncoder().encode(`data: ${JSON.stringify(initialData)}\n\n`);
				safeEnqueue(controller, msg);
			}
		},
		cancel() {
			subscribers.delete(id);
		},
	});

	return new Response(stream, {
		headers: {
			"Content-Type": "text/event-stream",
			"Cache-Control": "no-cache",
			Connection: "keep-alive",
			"Access-Control-Allow-Origin": "*",
		},
	});
}
