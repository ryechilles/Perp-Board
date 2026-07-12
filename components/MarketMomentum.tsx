'use client';

import { Activity } from 'lucide-react';
import { SmallWidget } from '@/components/widgets/base';
import { TooltipList, Skeleton } from '@/components/ui';
import { getRsiPillStyle, getRsiSignal } from '@/lib/utils';

interface MarketMomentumProps {
  avgRsi7: number | null;
  avgRsi14: number | null;
  exchangeLabel?: string;
}


export function MarketMomentum({ avgRsi7, avgRsi14, exchangeLabel = 'OKX' }: MarketMomentumProps) {
  const dailySignal = getRsiSignal(avgRsi7, avgRsi14);

  const isLoading = avgRsi7 === null && avgRsi14 === null;

  return (
    <SmallWidget
      title="Today Market Avg RSI"
      icon={<Activity className="w-4 h-4" />}
      subtitle={`Top 100 ${exchangeLabel} Perp Tokens`}
      loading={isLoading}
      skeleton={<Skeleton className="h-[52px] w-full rounded-xl" />}
      className="w-full"
      tooltip={
        <TooltipList items={[
          `${exchangeLabel} perp top 100 by market cap`,
          "Avg = (D-RSI7 + D-RSI14) / 2",
          "≤20: Extreme Oversold",
          "≤25: Oversold",
          "≤30: Very Weak",
          "≤40: Weak",
          "≤60: Neutral",
          "≤70: Strong",
          "≤80: Very Strong",
          "≤85: Overbought",
          ">85: Extreme Overbought",
        ]} />
      }
    >
      <div className="group/momentum">
        {/* Signal Pill - Centered, full width */}
        <div className="flex justify-center">
          <span className={`inline-block w-full text-center px-6 py-3 rounded-xl text-lg font-semibold whitespace-nowrap ${dailySignal.pillStyle}`}>
            {dailySignal.label}
          </span>
        </div>

        {/* Daily RSI Values - Show on hover with smooth transition */}
        <div className="flex items-center justify-between text-[0.6875rem] max-h-0 opacity-0 overflow-hidden transition-[max-height,opacity,margin] duration-200 ease-out group-hover/momentum:max-h-10 group-hover/momentum:opacity-100 group-hover/momentum:mt-3 group-focus-within/momentum:max-h-10 group-focus-within/momentum:opacity-100 group-focus-within/momentum:mt-3 [@media(hover:none)]:max-h-10 [@media(hover:none)]:opacity-100 [@media(hover:none)]:mt-3">
          <div className="flex items-center gap-1.5">
            <span className="text-muted-foreground">D-RSI7 Avg</span>
            <span className={`px-2 py-0.5 rounded-md font-semibold tabular-nums min-w-[42px] text-center ${getRsiPillStyle(avgRsi7)}`}>
              {avgRsi7 != null ? avgRsi7.toFixed(1) : '--'}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-muted-foreground">D-RSI14 Avg</span>
            <span className={`px-2 py-0.5 rounded-md font-semibold tabular-nums min-w-[42px] text-center ${getRsiPillStyle(avgRsi14)}`}>
              {avgRsi14 != null ? avgRsi14.toFixed(1) : '--'}
            </span>
          </div>
        </div>
      </div>
    </SmallWidget>
  );
}
