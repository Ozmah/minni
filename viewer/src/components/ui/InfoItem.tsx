import type { LucideIcon } from "lucide-react";

interface InfoItemProps {
	icon: LucideIcon;
	label: string;
	value: string;
}

export function InfoItem({ icon: Icon, label, value }: InfoItemProps) {
	return (
		<div className="flex items-center gap-2 text-gray-400">
			<Icon size={14} />
			<span className="text-gray-500">{label}:</span>
			<span className="text-gray-300">{value}</span>
		</div>
	);
}
