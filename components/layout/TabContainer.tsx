'use client';

import { ReactNode, createContext, useContext, useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { PillButtonGroup, PillButtonOption } from '@/components/ui';

// Tab context for state management
interface TabContextValue {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

const TabContext = createContext<TabContextValue | null>(null);

function useTabContext() {
  const context = useContext(TabContext);
  if (!context) {
    throw new Error('Tab components must be used within TabContainer');
  }
  return context;
}

// Tab item configuration
export interface TabItem {
  id: string;
  label: string;
  icon?: ReactNode;
  badge?: string | number;
  disabled?: boolean;
}

// TabContainer props
export interface TabContainerProps {
  /** Available tabs */
  tabs: TabItem[];
  /** Default active tab ID */
  defaultTab?: string;
  /** Controlled active tab */
  activeTab?: string;
  /** Callback when tab changes */
  onTabChange?: (tabId: string) => void;
  /** Children (TabPanel components) - optional */
  children?: ReactNode;
  /** Additional CSS classes for the container */
  className?: string;
  /** Tab bar variant: 'horizontal' (default) or 'sidebar' (uses PillButtonGroup template) */
  variant?: 'horizontal' | 'sidebar';
}

/**
 * TabContainer - Main container for tabbed navigation
 *
 * Supports two variants:
 * - 'horizontal': Traditional horizontal tab bar with underline indicator
 * - 'sidebar': Uses PillButtonGroup with Apple-style drag-to-scroll + fade hints
 */
export function TabContainer({
  tabs,
  defaultTab,
  activeTab: controlledActiveTab,
  onTabChange,
  children,
  className,
  variant = 'horizontal',
}: TabContainerProps) {
  const [internalActiveTab, setInternalActiveTab] = useState(
    defaultTab || tabs[0]?.id || ''
  );

  // Support both controlled and uncontrolled mode
  const activeTab = controlledActiveTab ?? internalActiveTab;

  const handleTabChange = (tabId: string) => {
    if (!controlledActiveTab) {
      setInternalActiveTab(tabId);
    }
    onTabChange?.(tabId);
  };

  // Convert tabs to PillButtonGroup options for sidebar variant
  const pillOptions = useMemo((): PillButtonOption<string>[] => {
    return tabs.map((tab) => ({
      value: tab.id,
      label: tab.label,
      icon: tab.icon,
      badge: tab.badge,
      disabled: tab.disabled,
    }));
  }, [tabs]);

  // ── Apple-style scroll state ──
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  // Drag-to-scroll state
  const isDragging = useRef(false);
  const startX = useRef(0);
  const scrollStart = useRef(0);
  const hasDragged = useRef(false);

  const checkOverflow = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 1);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
  }, []);

  useEffect(() => {
    checkOverflow();
    const el = scrollRef.current;
    if (!el) return;

    el.addEventListener('scroll', checkOverflow);
    const ro = new ResizeObserver(checkOverflow);
    ro.observe(el);

    // Wheel → horizontal scroll
    const handleWheel = (e: WheelEvent) => {
      if (el.scrollWidth <= el.clientWidth) return; // no overflow, skip
      e.preventDefault();
      el.scrollLeft += e.deltaY || e.deltaX;
    };
    el.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      el.removeEventListener('scroll', checkOverflow);
      el.removeEventListener('wheel', handleWheel);
      ro.disconnect();
    };
  }, [checkOverflow]);

  // Drag-to-scroll handlers (mouse)
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    const el = scrollRef.current;
    if (!el) return;
    isDragging.current = true;
    hasDragged.current = false;
    startX.current = e.clientX;
    scrollStart.current = el.scrollLeft;
    el.style.cursor = 'grabbing';
    el.style.userSelect = 'none';
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging.current) return;
    const el = scrollRef.current;
    if (!el) return;
    const dx = e.clientX - startX.current;
    if (Math.abs(dx) > 3) hasDragged.current = true;
    el.scrollLeft = scrollStart.current - dx;
  }, []);

  const handleMouseUp = useCallback(() => {
    isDragging.current = false;
    const el = scrollRef.current;
    if (el) {
      el.style.cursor = '';
      el.style.userSelect = '';
    }
  }, []);

  // Clean up on mouse leave
  const handleMouseLeave = useCallback(() => {
    if (isDragging.current) handleMouseUp();
  }, [handleMouseUp]);

  // Auto-scroll active tab into view
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    // Find the active button inside the scroll container
    const activeBtn = container.querySelector('[data-active="true"]') as HTMLElement | null;
    if (!activeBtn) return;
    // Scroll so the button is fully visible with a small margin
    const margin = 8;
    const btnLeft = activeBtn.offsetLeft - margin;
    const btnRight = activeBtn.offsetLeft + activeBtn.offsetWidth + margin;
    if (btnLeft < container.scrollLeft) {
      container.scrollTo({ left: btnLeft, behavior: 'smooth' });
    } else if (btnRight > container.scrollLeft + container.clientWidth) {
      container.scrollTo({ left: btnRight - container.clientWidth, behavior: 'smooth' });
    }
  }, [activeTab]);

  // Sidebar variant - Apple-style scrollable tabs
  if (variant === 'sidebar') {
    return (
      <TabContext.Provider value={{ activeTab, setActiveTab: handleTabChange }}>
        <div className={cn('flex flex-col', className)}>
          {/* Scroll container with fade edges */}
          <div className="relative">
            {/* Scrollable area */}
            <div
              ref={scrollRef}
              className="overflow-x-auto min-w-0"
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseLeave}
            >
              <PillButtonGroup
                options={pillOptions}
                value={activeTab}
                onChange={handleTabChange}
                scrollable
              />
            </div>

            {/* Left fade */}
            {canScrollLeft && (
              <div className="absolute left-0 top-0 bottom-0 w-6 pointer-events-none bg-gradient-to-r from-muted to-transparent rounded-l-lg" />
            )}

            {/* Right fade */}
            {canScrollRight && (
              <div className="absolute right-0 top-0 bottom-0 w-6 pointer-events-none bg-gradient-to-l from-muted to-transparent rounded-r-lg" />
            )}
          </div>

          {/* Tab Panels (only render if children exist) */}
          {children && <div className="flex-1 mt-4">{children}</div>}
        </div>
      </TabContext.Provider>
    );
  }

  // Default horizontal variant - underline style
  return (
    <TabContext.Provider value={{ activeTab, setActiveTab: handleTabChange }}>
      <div className={cn('flex flex-col', className)}>
        {/* Tab List */}
        <div className="flex items-center gap-1 border-b border-gray-950/[0.10] dark:border-white/[0.10]">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => !tab.disabled && handleTabChange(tab.id)}
              disabled={tab.disabled}
              className={cn(
                // Base styles
                'flex items-center gap-2 px-4 py-2.5 text-sm font-medium',
                'border-b-2 -mb-px transition-colors duration-150',
                // Active state
                activeTab === tab.id
                  ? 'border-foreground text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground',
                // Disabled state
                tab.disabled && 'opacity-50 cursor-not-allowed'
              )}
            >
              {tab.icon && <span className="w-4 h-4">{tab.icon}</span>}
              <span>{tab.label}</span>
              {tab.badge !== undefined && (
                <span
                  className={cn(
                    'px-1.5 py-0.5 text-xs rounded-full',
                    activeTab === tab.id
                      ? 'bg-foreground text-background'
                      : 'bg-muted text-muted-foreground'
                  )}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Tab Panels (only render if children exist) */}
        {children && <div className="flex-1">{children}</div>}
      </div>
    </TabContext.Provider>
  );
}

// TabPanel props
export interface TabPanelProps {
  /** Tab ID this panel belongs to */
  tabId: string;
  /** Panel content */
  children: ReactNode;
  /** Additional CSS classes */
  className?: string;
  /** Keep panel mounted when inactive (for preserving state) */
  keepMounted?: boolean;
}

/**
 * TabPanel - Content panel for a specific tab
 */
export function TabPanel({
  tabId,
  children,
  className,
  keepMounted = false,
}: TabPanelProps) {
  const { activeTab } = useTabContext();
  const isActive = activeTab === tabId;

  if (!isActive && !keepMounted) {
    return null;
  }

  return (
    <div
      className={cn(className, !isActive && 'hidden')}
      role="tabpanel"
      aria-labelledby={`tab-${tabId}`}
    >
      {children}
    </div>
  );
}

export default TabContainer;
