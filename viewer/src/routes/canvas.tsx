import { createFileRoute } from "@tanstack/react-router";
import { Canvas } from "@/components/canvas";

export const Route = createFileRoute("/canvas")({
	component: CanvasPage,
});

function CanvasPage() {
	return (
		<div className="h-full">
			<Canvas />
		</div>
	);
}
