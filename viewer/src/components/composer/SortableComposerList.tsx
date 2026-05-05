import type { ReactNode } from "react";

import {
	closestCenter,
	DndContext,
	KeyboardSensor,
	PointerSensor,
	type DragEndEvent,
	useSensor,
	useSensors,
} from "@dnd-kit/core";
import {
	arrayMove,
	SortableContext,
	sortableKeyboardCoordinates,
	useSortable,
	verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";

type SortableComposerRenderArgs = {
	id: string;
	index: number;
	dragHandle: ReactNode;
	isDragging: boolean;
};

/** Provides accessible vertical drag-and-drop ordering for composer lists. */
export function SortableComposerList({
	ids,
	onReorder,
	renderItem,
}: {
	ids: string[];
	onReorder: (nextIds: string[]) => void;
	renderItem: (args: SortableComposerRenderArgs) => ReactNode;
}) {
	const sensors = useSensors(
		useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
		useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
	);

	function handleDragEnd(event: DragEndEvent) {
		const { active, over } = event;
		if (!over || active.id === over.id) return;

		const oldIndex = ids.indexOf(String(active.id));
		const newIndex = ids.indexOf(String(over.id));
		if (oldIndex === -1 || newIndex === -1) return;

		onReorder(arrayMove(ids, oldIndex, newIndex));
	}

	return (
		<DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
			<SortableContext items={ids} strategy={verticalListSortingStrategy}>
				<div className="space-y-2">
					{ids.map((id, index) => (
						<SortableComposerListItem key={id} id={id} index={index} renderItem={renderItem} />
					))}
				</div>
			</SortableContext>
		</DndContext>
	);
}

function SortableComposerListItem({
	id,
	index,
	renderItem,
}: {
	id: string;
	index: number;
	renderItem: (args: SortableComposerRenderArgs) => ReactNode;
}) {
	const {
		attributes,
		listeners,
		setActivatorNodeRef,
		setNodeRef,
		transform,
		transition,
		isDragging,
	} = useSortable({ id });

	const style = {
		transform: CSS.Transform.toString(transform),
		transition,
		zIndex: isDragging ? 20 : undefined,
	};

	const dragHandle = (
		<button
			type="button"
			ref={setActivatorNodeRef}
			{...attributes}
			{...listeners}
			aria-label="Drag to reorder"
			className="inline-flex size-11 shrink-0 touch-none items-center justify-center rounded-md text-gray-500 outline-none hover:bg-gray-800 hover:text-gray-300 focus-visible:ring-2 focus-visible:ring-emerald-400/70"
		>
			<GripVertical size={16} aria-hidden="true" />
		</button>
	);

	return (
		<div
			ref={setNodeRef}
			style={style}
			className={isDragging ? "opacity-80 shadow-xl shadow-black/30" : undefined}
		>
			{renderItem({ id, index, dragHandle, isDragging })}
		</div>
	);
}
