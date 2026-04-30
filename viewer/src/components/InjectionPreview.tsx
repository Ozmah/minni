import { Copy } from "lucide-react";

import { CopyIconButton } from "@/components/ui";
import { copyText } from "@/lib/clipboard";

export function InjectionPreview({ value }: { value: string }) {
	return (
		<div className="relative">
			<div className="absolute top-2 right-2 z-10">
				<CopyIconButton
					icon={Copy}
					label="Copy injection preview"
					onCopy={() => copyText(value)}
					className="rounded-md border border-gray-700 bg-gray-900/90 p-1.5 text-gray-400 shadow-sm transition-colors hover:bg-gray-800 hover:text-gray-100 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-emerald-500 disabled:opacity-50 motion-reduce:transition-none"
				/>
			</div>
			<pre className="max-h-[460px] overflow-auto rounded-lg border border-gray-800 bg-gray-950 p-4 pr-12 text-sm leading-6 whitespace-pre-wrap text-gray-300">
				{value}
			</pre>
		</div>
	);
}
