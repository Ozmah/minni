import { RouterProvider } from "@tanstack/react-router";
import { StrictMode } from "react";
import ReactDOM from "react-dom/client";

import { initMarked } from "./lib/marked-config";
import { router } from "./router";
import "./styles.css";

async function boot() {
	await initMarked();

	const rootElement = document.getElementById("app");
	if (rootElement && !rootElement.innerHTML) {
		ReactDOM.createRoot(rootElement).render(
			<StrictMode>
				<RouterProvider router={router} />
			</StrictMode>,
		);
	}
}

boot();
