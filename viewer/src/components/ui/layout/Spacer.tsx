/** Flexible spacer that fills remaining vertical space with an optional visual divider. */
export function Spacer({ divider = false }: { divider?: boolean }) {
	return <div className="flex-1">{divider && <div className="border-t border-gray-700" />}</div>;
}
