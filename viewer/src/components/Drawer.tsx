import { useEffect } from "react";
import { X } from "lucide-react";

interface DrawerProps {
	open: boolean;
	onClose: () => void;
	title?: string;
	children: React.ReactNode;
}

export function Drawer({ open, onClose, title, children }: DrawerProps) {
	useEffect(() => {
		if (!open) return;

		const handleEsc = (e: KeyboardEvent) => {
			if (e.key === "Escape") onClose();
		};

		document.body.style.overflow = "hidden";
		document.addEventListener("keydown", handleEsc);

		return () => {
			document.body.style.overflow = "";
			document.removeEventListener("keydown", handleEsc);
		};
	}, [open, onClose]);

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
				className={`fixed right-0 top-0 z-50 flex h-full w-full max-w-xl flex-col bg-gray-900 shadow-xl transition-transform ${
					open ? "translate-x-0" : "translate-x-full"
				}`}
			>
				{/* Header */}
				<header className="flex items-center justify-between border-b border-gray-700 px-6 py-4">
					<h2 className="text-lg font-semibold text-white">{title}</h2>
					<button
						onClick={onClose}
						className="rounded-md p-1 text-gray-400 hover:bg-gray-800 hover:text-white"
					>
						<X size={20} />
					</button>
				</header>

				{/* Content */}
				<div className="flex-1 overflow-y-auto p-6">{children}</div>
			</aside>
		</>
	);
}
