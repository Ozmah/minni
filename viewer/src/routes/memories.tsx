import { createFileRoute } from "@tanstack/react-router";

import { MemoriesPage } from "./memories/-index";

export const Route = createFileRoute("/memories")({
	component: MemoriesPage,
});
