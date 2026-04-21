import { createFileRoute } from "@tanstack/react-router";

import { MemoryDetailRoute } from "./memories/-detail";

export const Route = createFileRoute("/memories/$id")({
	component: RouteComponent,
});

function RouteComponent() {
	const { id } = Route.useParams();
	return <MemoryDetailRoute id={Number(id)} />;
}
