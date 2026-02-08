import { Elysia } from "elysia";

import { createEventStream } from "../events";

export const eventsRoutes = () =>
	new Elysia({ prefix: "/api/events" }).get("/", () => createEventStream());
