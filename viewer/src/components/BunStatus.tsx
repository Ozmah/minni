import { useEffect, useState } from "react";

interface RuntimeInfo {
	bunVersion: string;
	hasBunMarkdown: boolean;
}

export function BunStatus() {
	const [runtime, setRuntime] = useState<RuntimeInfo | null>(null);

	useEffect(() => {
		fetch("/api/runtime")
			.then((r) => r.json())
			.then(setRuntime)
			.catch(() => {});
	}, []);

	if (!runtime) return null;

	return (
		<div className="fixed right-2 bottom-2 rounded border border-gray-700 bg-gray-800/80 px-2 py-1 text-xs">
			{runtime.hasBunMarkdown ? (
				<span className="text-green-400">🗡️ Bun.markdown active</span>
			) : (
				<span className="text-yellow-500">
					⚠️ No Bun.markdown — Bun v{runtime.bunVersion} (needs 1.3.8+)
				</span>
			)}
		</div>
	);
}
