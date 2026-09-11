'use client';

import { ReactNode, Children, cloneElement, isValidElement, useState } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverEvent,
  DragOverlay,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { cn } from '@/lib/utils';

export interface WidgetGridProps {
  /** Grid children (widgets) */
  children: ReactNode;
  /** Additional CSS classes */
  className?: string;
  /** Grid layout variant */
  variant?: 'auto' | 'fixed' | 'masonry' | 'vertical';
  /** Gap between widgets */
  gap?: 'sm' | 'md' | 'lg';
  /** Enable sortable drag-and-drop */
  sortable?: boolean;
  /** Unique IDs for sortable items (required when sortable=true) */
  itemIds?: string[];
  /** Callback when order changes */
  onOrderChange?: (newOrder: string[]) => void;
}

interface SortableItemProps {
  id: string;
  children: ReactNode;
  disabled?: boolean;
  isOver?: boolean;
}

/**
 * SortableItem - Wrapper for draggable widgets
 * Entire widget is draggable (similar to table column headers)
 */
function SortableItem({ id, children, disabled, isOver }: SortableItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn(
        'relative',
        // Cursor styles
        !disabled && 'cursor-grab active:cursor-grabbing',
        // Dragging state - semi-transparent
        isDragging && 'opacity-50',
        // Drop target indicator - semi-transparent (like dragging state)
        isOver && !isDragging && 'opacity-50'
      )}
    >
      {children}
    </div>
  );
}

/**
 * WidgetGrid - Responsive grid layout for widgets with optional drag-and-drop sorting
 *
 * Drag behavior:
 * - Entire widget is draggable (no separate handle)
 * - Visual feedback: opacity when dragging, ring highlight when hovering
 * - Similar to table column drag behavior
 *
 * Variants:
 * - auto: Auto-fit columns based on content (default)
 * - fixed: Fixed column layout (2 on md, 3 on lg, 4 on xl)
 * - masonry: CSS columns for masonry-like layout
 * - vertical: Vertical stack layout (best for sortable)
 *
 * @example
 * ```tsx
 * // With drag-and-drop sorting
 * <WidgetGrid
 *   variant="vertical"
 *   sortable
 *   itemIds={['widget1', 'widget2']}
 *   onOrderChange={(newOrder) => saveOrder(newOrder)}
 * >
 *   <SmallWidget title="Widget 1">...</SmallWidget>
 *   <SmallWidget title="Widget 2">...</SmallWidget>
 * </WidgetGrid>
 * ```
 */
export function WidgetGrid({
  children,
  className,
  variant = 'auto',
  gap = 'md',
  sortable = false,
  itemIds = [],
  onOrderChange,
}: WidgetGridProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 8px movement before drag starts
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const gapClasses = {
    sm: 'gap-3',
    md: 'gap-3.5',
    lg: 'gap-6',
  };

  const variantClasses = {
    auto: 'flex flex-wrap items-start',
    fixed: 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4',
    masonry: 'columns-1 md:columns-2 lg:columns-3 xl:columns-4 space-y-4',
    vertical: 'flex flex-col',
  };

  // Non-sortable mode - render children directly
  if (!sortable || itemIds.length === 0) {
    return (
      <div className={cn(variantClasses[variant], gapClasses[gap], className)}>
        {children}
      </div>
    );
  }

  // Convert children to array for sortable rendering
  const childrenArray = Children.toArray(children);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragOver = (event: DragOverEvent) => {
    setOverId(event.over?.id as string | null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    setOverId(null);

    if (over && active.id !== over.id) {
      const oldIndex = itemIds.indexOf(active.id as string);
      const newIndex = itemIds.indexOf(over.id as string);
      const newOrder = arrayMove(itemIds, oldIndex, newIndex);
      onOrderChange?.(newOrder);
    }
  };

  // Find the active child for drag overlay
  const activeIndex = activeId ? itemIds.indexOf(activeId) : -1;
  const activeChild = activeIndex >= 0 ? childrenArray[activeIndex] : null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
        <div className={cn(variantClasses[variant], gapClasses[gap], className)}>
          {itemIds.map((id, index) => (
            <SortableItem key={id} id={id} isOver={overId === id}>
              {childrenArray[index]}
            </SortableItem>
          ))}
        </div>
      </SortableContext>

      {/* Drag Overlay - shows dragged item */}
      <DragOverlay>
        {activeChild && isValidElement(activeChild) ? (
          <div className="opacity-90 shadow-2xl rounded-2xl cursor-grabbing">
            {cloneElement(activeChild)}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

export default WidgetGrid;
