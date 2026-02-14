import { X } from "lucide-react";
import { useEffect } from "react";

interface ModalProps {
	open: boolean;
	onClose: () => void;
	title?: string;
	children: React.ReactNode;
	/** Footer slot for action buttons */
	footer?: React.ReactNode;
	/** If true, clicking backdrop won't close modal (force explicit action) */
	persistent?: boolean;
}

export function Modal({ open, onClose, title, children, footer, persistent = false }: ModalProps) {
	useEffect(() => {
		if (!open) return;

		const handleEsc = (e: KeyboardEvent) => {
			if (e.key === "Escape" && !persistent) onClose();
		};

		document.body.style.overflow = "hidden";
		document.addEventListener("keydown", handleEsc);

		return () => {
			document.body.style.overflow = "";
			document.removeEventListener("keydown", handleEsc);
		};
	}, [open, onClose, persistent]);

	if (!open) return null;

	return (
		<>
			{/* Backdrop */}
			<div className="fixed inset-0 z-50 bg-black/60" onClick={persistent ? undefined : onClose} />

			{/* Modal */}
			<div className="fixed inset-0 z-50 flex items-center justify-center p-4">
				<div className="w-full max-w-md rounded-lg bg-gray-900 shadow-xl">
					{/* Header */}
					{title && (
						<header className="flex items-center justify-between border-b border-gray-700 px-6 py-4">
							<h2 className="text-lg font-semibold text-white">{title}</h2>
							{!persistent && (
								<button
									onClick={onClose}
									className="rounded-md p-1 text-gray-400 hover:bg-gray-800 hover:text-white"
								>
									<X size={20} />
								</button>
							)}
						</header>
					)}

					{/* Content */}
					<div className="p-6">{children}</div>

					{/* Footer */}
					{footer && (
						<footer className="flex justify-end gap-3 border-t border-gray-700 px-6 py-4">
							{footer}
						</footer>
					)}
				</div>
			</div>
		</>
	);
}
