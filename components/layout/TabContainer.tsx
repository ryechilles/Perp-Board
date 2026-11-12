'use client';

import { ReactNode, createContext, useContext, useState } from 'react';
import { cn } from '@/lib/utils';

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
  /** Tab bar variant: 'horizontal' (default) or 'sidebar' (full-width segmented control) */
  variant?: 'horizontal' | 'sidebar';
}

/**
 * TabContainer - Main container for tabbed navigation
 *
 * Supports two variants:
 * - 'horizontal': Traditional horizontal tab bar with underline indicator
 * - 'sidebar': Underline tabs spanning the column
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

  // Sidebar variant - underline tabs spanning the column
  if (variant === 'sidebar') {
    return (
      <TabContext.Provider value={{ activeTab, setActiveTab: handleTabChange }}>
        <div className={cn('flex flex-col', className)}>
          <div role="tablist" className="flex items-stretch overflow-x-auto hairline-b">
            {tabs.map((tab) => {
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  id={`tab-${tab.id}`}
                  aria-selected={active}
                  disabled={tab.disabled}
                  onClick={() => !tab.disabled && handleTabChange(tab.id)}
                  className={cn(
                    'relative h-11 lg:h-10 px-3 flex-shrink-0 text-[0.8125rem] whitespace-nowrap transition-colors',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/50',
                    active
                      ? 'font-medium text-foreground after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:bg-up'
                      : 'text-muted-foreground hover:text-foreground',
                    tab.disabled && 'opacity-50 cursor-not-allowed'
                  )}
                >
                  {tab.label}
                </button>
              );
            })}
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
