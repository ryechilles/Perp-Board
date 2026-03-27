'use client';

import { Button } from '@/components/ui';

interface TablePaginationProps {
  currentPage: number;
  totalPages: number;
  pageSize: number;
  totalItems: number;
  status: 'connecting' | 'live' | 'error';
  onPageChange: (page: number) => void;
}

export function TablePagination({
  currentPage,
  totalPages,
  pageSize,
  totalItems,
  status,
  onPageChange,
}: TablePaginationProps) {
  const startItem = (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);

  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-gray-950/[0.10] dark:border-white/[0.10] flex-shrink-0">
      <div className="flex items-center gap-3">
        <span className="text-xs text-muted-foreground">
          {startItem}-{endItem} of {totalItems}
        </span>
        <span
          className={`w-1.5 h-1.5 rounded-full ${
            status === 'live'
              ? 'bg-green-500'
              : status === 'connecting'
                ? 'bg-yellow-500 animate-pulse'
                : 'bg-red-500'
          }`}
          title={
            status === 'live'
              ? 'Live'
              : status === 'connecting'
                ? 'Connecting...'
                : 'Reconnecting...'
          }
        />
      </div>
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onPageChange(1)}
          disabled={currentPage === 1}
          className="px-2 py-1 h-auto text-xs text-muted-foreground"
        >
          ««
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="px-2 py-1 h-auto text-xs text-muted-foreground"
        >
          «
        </Button>

        {/* Page numbers */}
        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
          let pageNum: number;
          if (totalPages <= 5) {
            pageNum = i + 1;
          } else if (currentPage <= 3) {
            pageNum = i + 1;
          } else if (currentPage >= totalPages - 2) {
            pageNum = totalPages - 4 + i;
          } else {
            pageNum = currentPage - 2 + i;
          }
          return (
            <Button
              key={pageNum}
              variant={currentPage === pageNum ? 'default' : 'ghost'}
              size="sm"
              onClick={() => onPageChange(pageNum)}
              className={`px-2.5 py-1 h-auto text-xs ${
                currentPage !== pageNum ? 'text-muted-foreground' : ''
              }`}
            >
              {pageNum}
            </Button>
          );
        })}

        <Button
          variant="ghost"
          size="sm"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="px-2 py-1 h-auto text-xs text-muted-foreground"
        >
          »
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onPageChange(totalPages)}
          disabled={currentPage === totalPages}
          className="px-2 py-1 h-auto text-xs text-muted-foreground"
        >
          »»
        </Button>
      </div>
    </div>
  );
}
