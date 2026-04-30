import { X } from "lucide-react";
import { useEffect, useRef } from "react";

interface DrawerProps {
	open: boolean;
	onClose: () => void;
	title?: string;
	children: React.ReactNode;
	content?: React.ReactNode;
	footer?: React.ReactNode;
}

export function Drawer({ open, onClose, title, children, content, footer }: DrawerProps) {
	const onCloseRef = useRef(onClose);
	onCloseRef.current = onClose;

	useEffect(() => {
		if (!open) return;

		const handleEsc = (e: KeyboardEvent) => {
			if (e.key === "Escape") onCloseRef.current();
		};

		document.body.style.overflow = "hidden";
		document.addEventListener("keydown", handleEsc);

		return () => {
			document.body.style.overflow = "";
			document.removeEventListener("keydown", handleEsc);
		};
	}, [open]);

	return (
		<>
			{/* Backdrop */}
			<div
				className={`fixed inset-0 z-40 bg-black/50 transition-opacity ${
					open ? "opacity-100" : "pointer-events-none opacity-0"
				}`}
				onClick={onClose}
			/>

			{/* Panel */}
			<aside
				className={`fixed top-0 right-0 z-50 flex h-full w-full max-w-4xl flex-col bg-gray-900 shadow-xl transition-transform ${
					open ? "translate-x-0" : "translate-x-full"
				}`}
			>
				{/* Header */}
				<header className="flex items-center justify-between border-b border-gray-700 px-6 py-4">
					<h2 className="text-lg font-semibold text-white">{title}</h2>
					<button
						type="button"
						onClick={onClose}
						aria-label="Close drawer"
						className="rounded-md p-1 text-gray-400 hover:bg-gray-800 hover:text-white"
					>
						<X size={20} aria-hidden="true" />
					</button>
				</header>

				{/* Metadata / No-content fallback */}
				{content !== undefined ? (
					<>
						<div className="shrink-0 px-6 pt-6">{children}</div>
						<div className="min-h-0 flex-1 overflow-y-auto p-6">{content}</div>
					</>
				) : (
					<div className="flex-1 overflow-y-auto p-6">{children}</div>
				)}

				{/* Actions */}
				{footer !== undefined && (
					<footer className="shrink-0 border-t border-gray-700 px-6 py-4">{footer}</footer>
				)}
			</aside>
		</>
	);
}
