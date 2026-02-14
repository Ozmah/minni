interface ErrorStateProps {
	error: Error;
}

export function ErrorState({ error }: ErrorStateProps) {
	return <div className="text-red-400">Error: {error.message}</div>;
}
