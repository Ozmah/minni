import { Elysia } from "elysia";

import { getChanges } from "../changes";

export const changesRoutes = () =>
	new Elysia({ prefix: "/api" }).get("/changes", () => getChanges());
