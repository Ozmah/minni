/**
 * SSE event broadcaster for viewer invalidation.
 *
 * Entirely experimental again
 *
 * Single channel: GET /api/events
 * Typed events signal "something changed", viewer invalidates the right query.
 * No data in the stream — just type + action signals.
 */

// ============================================================================
// TYPES
// ============================================================================

export interface ServerEvent {
	type: "canvas" | "memory" | "task" | "project";
	action?: "created" | "updated" | "deleted" | "cleared";
	id?: string | number;
}

interface Subscriber {
	controller: ReadableStreamDefaultController;
	connectedAt: number;
}

// ============================================================================
// SUBSCRIBER MANAGEMENT
// ============================================================================

const subscribers = new Map<string, Subscriber>();

export function getSubscriberCount(): number {
	return subscribers.size;
}

function safeEnqueue(controller: ReadableStreamDefaultController, data: Uint8Array): boolean {
	try {
		controller.enqueue(data);
		return true;
	} catch {
		return false;
	}
}

// ============================================================================
// BROADCASTING
// ============================================================================

/** Emit a typed event to all connected viewers. */
export function emit(event: ServerEvent): void {
	const msg = new TextEncoder().encode(`data: ${JSON.stringify(event)}\n\n`);

	for (const [id, sub] of subscribers) {
		if (!safeEnqueue(sub.controller, msg)) {
			subscribers.delete(id);
		}
	}
}

// ============================================================================
// SSE STREAM
// ============================================================================

/** Creates an SSE stream Response for a new subscriber. */
export function createEventStream(): Response {
	const id = crypto.randomUUID();

	const stream = new ReadableStream({
		start(controller) {
			subscribers.set(id, {
				controller,
				connectedAt: Date.now(),
			});

			// Send initial ping so the client knows it's connected
			safeEnqueue(controller, new TextEncoder().encode(`data: {"type":"connected"}\n\n`));
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
		},
	});
}
