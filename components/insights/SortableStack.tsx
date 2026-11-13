'use client';

import { ReactNode, Children, cloneElement, isValidElement, useId, useState } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragOverlay,
} from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { cn } from '@/lib/utils';

function SortableItem({ id, children }: { id: string; children: ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      {...attributes}
      {...listeners}
      className={cn('relative cursor-grab active:cursor-grabbing', isDragging && 'opacity-40')}
    >
      {children}
    </div>
  );
}

interface SortableStackProps {
  /** One child per id, in the same order as `itemIds` */
  children: ReactNode;
  itemIds: string[];
  onOrderChange?: (newOrder: string[]) => void;
}

/**
 * A vertical stack whose items can be dragged into a new order (the whole item
 * is the handle; 8px of movement starts a drag, so clicks still work).
 */
export function SortableStack({ children, itemIds, onOrderChange }: SortableStackProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  // A stable id keeps dnd-kit's aria-describedby identical on server and client
  const dndId = useId();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const items = Children.toArray(children);

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    setActiveId(null);
    if (over && active.id !== over.id) {
      onOrderChange?.(arrayMove(itemIds, itemIds.indexOf(active.id as string), itemIds.indexOf(over.id as string)));
    }
  };

  const activeChild = activeId ? items[itemIds.indexOf(activeId)] : null;

  return (
    <DndContext
      id={dndId}
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={(e) => setActiveId(e.active.id as string)}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
        <div className="flex flex-col">
          {itemIds.map((id, index) => (
            <SortableItem key={id} id={id}>
              {items[index]}
            </SortableItem>
          ))}
        </div>
      </SortableContext>

      <DragOverlay>
        {activeChild && isValidElement(activeChild) ? (
          <div className="cursor-grabbing rounded-panel bg-surface-pop shadow-drawer">{cloneElement(activeChild)}</div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
