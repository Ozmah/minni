interface SectionProps {
	title: string;
	children: React.ReactNode;
}

export function Section({ title, children }: SectionProps) {
	return (
		<section>
			<h4 className="mb-2 text-sm font-medium tracking-wider text-gray-500 uppercase">{title}</h4>
			{children}
		</section>
	);
}
