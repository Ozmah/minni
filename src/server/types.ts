/**
 * Shared types for the Minni viewer server.
 */

import { z } from "zod";

// === RESPONSE SCHEMAS ===

export const ErrorResponse = z.object({ error: z.string() });
export const SuccessResponse = z.object({ success: z.literal(true), id: z.number() });

// === CONFIG ===

export interface ServerConfig {
	preferredPort: number;
	maxCanvasPages: number;
	maxContentLength: number;
}

export const DEFAULT_CONFIG: ServerConfig = {
	preferredPort: 8593,
	maxCanvasPages: 20,
	maxContentLength: 500_000, // 500KB
};

export const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
