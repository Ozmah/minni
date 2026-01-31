import {
	Outlet,
	RouterProvider,
	createRootRoute,
	createRoute,
	createRouter,
	Link,
} from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import { StrictMode } from "react";
import ReactDOM from "react-dom/client";

import { BunStatus } from "@/components/BunStatus";
import { Canvas } from "@/components/canvas";

import "./styles.css";

// Layout
// TODO tanstack devtools specific for the plugin
const rootRoute = createRootRoute({
	component: () => (
		<div className="flex min-h-screen flex-col bg-gray-900 text-gray-100">
			{/* Header */}
			<header className="flex items-center justify-between border-b border-gray-700 bg-gray-800 px-4 py-3">
				<h1 className="text-lg font-semibold">Minni Viewer</h1>
				<nav className="flex gap-4">
					<NavLink to="/">Canvas</NavLink>
					<NavLink to="/database">Database</NavLink>
				</nav>
			</header>

			{/* Content */}
			<main className="flex-1 overflow-hidden">
				<Outlet />
			</main>

			<BunStatus />
			<TanStackRouterDevtools position="bottom-right" />
		</div>
	),
});

function NavLink({ to, children }: { to: string; children: React.ReactNode }) {
	return (
		<Link
			to={to}
			className="rounded px-3 py-1 text-sm transition-colors hover:bg-gray-700 [&.active]:bg-blue-600 [&.active]:text-white"
		>
			{children}
		</Link>
	);
}

// Routes
const canvasRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/",
	component: Canvas,
});

const databaseRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/database",
	component: () => (
		<div className="flex h-full items-center justify-center text-gray-400">
			Database browser coming soon...
		</div>
	),
});

// Router
const routeTree = rootRoute.addChildren([canvasRoute, databaseRoute]);

const router = createRouter({
	routeTree,
	defaultPreload: "intent",
});

declare module "@tanstack/react-router" {
	interface Register {
		router: typeof router;
	}
}

// Mount
const rootElement = document.getElementById("app");
if (rootElement && !rootElement.innerHTML) {
	ReactDOM.createRoot(rootElement).render(
		<StrictMode>
			<RouterProvider router={router} />
		</StrictMode>,
	);
}
