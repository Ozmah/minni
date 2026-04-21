import type { LucideIcon } from "lucide-react";

import { useEffect, useRef, useState } from "react";

type CopyIconButtonProps = {
	icon: LucideIcon;
	label: string;
	confirmLabel?: string;
	onCopy: () => Promise<void> | void;
	className?: string;
	iconSize?: number;
};

export function CopyIconButton({
	icon: Icon,
	label,
	confirmLabel = "Copied",
	onCopy,
	className,
	iconSize = 14,
}: CopyIconButtonProps) {
	const [showTooltip, setShowTooltip] = useState(false);
	const [tooltipKey, setTooltipKey] = useState(0);
	const [busy, setBusy] = useState(false);
	const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	useEffect(() => {
		return () => {
			if (timeoutRef.current) clearTimeout(timeoutRef.current);
		};
	}, []);

	const handleClick = async (event: React.MouseEvent<HTMLButtonElement>) => {
		event.preventDefault();
		event.stopPropagation();
		if (busy) return;

		setBusy(true);
		try {
			await onCopy();
			setShowTooltip(true);
			setTooltipKey((current) => current + 1);
			if (timeoutRef.current) clearTimeout(timeoutRef.current);
			timeoutRef.current = setTimeout(() => setShowTooltip(false), 1500);
		} catch (error) {
			console.error(label, error);
		} finally {
			setBusy(false);
		}
	};

	return (
		<span className="relative inline-flex">
			<button
				type="button"
				onClick={handleClick}
				disabled={busy}
				aria-label={label}
				title={label}
				className={
					className ??
					"rounded p-1.5 text-gray-500 transition-colors hover:bg-gray-700 hover:text-gray-200 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-emerald-500 disabled:opacity-50 motion-reduce:transition-none"
				}
			>
				<Icon size={iconSize} aria-hidden="true" />
			</button>
			{showTooltip && (
				<span
					key={tooltipKey}
					role="status"
					aria-live="polite"
					className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-1.5 -translate-x-1/2"
				>
					<span className="tooltip-pop block rounded-md bg-gray-700 px-2 py-1 text-[11px] font-medium whitespace-nowrap text-white shadow-lg ring-1 ring-black/20">
						{confirmLabel}
						<span
							aria-hidden="true"
							className="absolute top-full left-1/2 h-0 w-0 -translate-x-1/2 border-x-4 border-t-4 border-x-transparent border-t-gray-700"
						/>
					</span>
				</span>
			)}
		</span>
	);
}
