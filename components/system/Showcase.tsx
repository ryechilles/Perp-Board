'use client';

import { ReactNode, useState } from 'react';
import Link from 'next/link';
import { SlidersHorizontal, X } from 'lucide-react';
import { Button, Chips, IconButton, InfoTip, Kbd, SearchField, Segmented, Skeleton, Tabs, Tag, ThemeToggle, TipBody, TokenAvatar } from '@/components/ui';
import {
  Delta, EmptyLine, FavoriteButton, Figure, FundingValue, Gauge, List, ListHeading, ListRow, Meter, Money, Panel, Percent, Price,
  RsiReading, RSI_GAUGE_TICKS, RSI_GAUGE_ZONES, SparkDelta, Sparkline, Stat, TdValue, TokenCell,
} from '@/components/data';
import { cn } from '@/lib/utils';

// ── Token inventory (names as used in class names) ───────────────────────

const COLORS: { group: string; items: { name: string; cls: string; use: string }[] }[] = [
  {
    group: 'Surface',
    items: [
      { name: 'surface-0', cls: 'bg-surface-0', use: 'Page ground, app bar' },
      { name: 'surface-1', cls: 'bg-surface-1', use: 'Table, panels' },
      { name: 'surface-2', cls: 'bg-surface-2', use: 'Sidebar' },
      { name: 'surface-pop', cls: 'bg-surface-pop', use: 'Tooltip, drawer' },
      { name: 'fill', cls: 'bg-fill', use: 'Control fill, hover' },
      { name: 'fill-strong', cls: 'bg-fill-strong', use: 'Pressed, skeleton' },
    ],
  },
  {
    group: 'Text',
    items: [
      { name: 'fg', cls: 'bg-fg', use: 'Primary text' },
      { name: 'fg-muted', cls: 'bg-fg-muted', use: 'Secondary text' },
      { name: 'fg-faint', cls: 'bg-fg-faint', use: 'Placeholders, units' },
    ],
  },
  {
    group: 'Line · Accent',
    items: [
      { name: 'line', cls: 'bg-line', use: 'Rules' },
      { name: 'line-strong', cls: 'bg-line-strong', use: 'Control outlines' },
      { name: 'accent', cls: 'bg-accent', use: 'Selected, live, focus' },
      { name: 'accent-soft', cls: 'bg-accent-soft', use: 'Selected fill' },
    ],
  },
  {
    group: 'Data',
    items: [
      { name: 'up', cls: 'bg-up', use: 'Price up' },
      { name: 'down', cls: 'bg-down', use: 'Price down' },
      { name: 'cold', cls: 'bg-cold', use: 'RSI ≤ 25' },
      { name: 'hot', cls: 'bg-hot', use: 'RSI ≥ 75' },
      { name: 'track', cls: 'bg-track', use: 'Meter tracks' },
      { name: 'star', cls: 'bg-star', use: 'Watchlist star' },
    ],
  },
];

const TYPE = [
  { name: 'text-display', spec: '30 / 600', cls: 'text-display font-semibold', sample: '37.5' },
  { name: 'text-title', spec: '15 / 600', cls: 'text-title font-semibold', sample: 'Market RSI' },
  { name: 'text-body', spec: '13 / 400–600', cls: 'text-body', sample: 'BTC 69,113.30 −3.58%' },
  { name: 'text-small', spec: '12 / 400', cls: 'text-small text-fg-muted', sample: 'Avg daily RSI · Top 50 OKX perps' },
  { name: 'text-caption', spec: '11 / 500', cls: 'caps', sample: 'Funding APR' },
];

const SAMPLE_SPARK_DOWN = [9, 8, 8.4, 7, 6.2, 5.8, 5];
const SAMPLE_SPARK_UP = [4, 4.6, 4.2, 5.4, 5, 6.2, 7];

const ROWS = [
  { symbol: 'BTC', price: 69113.3, d24: -3.58, d7: -8.76, rate: -0.0000375, cap: 1.38e12, rsi: 22, rsiW: 35, td: { signal: { type: 'buy', count: 9 }, setup: null, countdown: null }, spark: SAMPLE_SPARK_DOWN },
  { symbol: 'HYPE', price: 74.028, d24: 3.86, d7: 4.36, rate: 0.0000991, cap: 2.477e10, rsi: 78, rsiW: 61, td: { signal: null, setup: { type: 'sell', count: 6 }, countdown: null }, spark: SAMPLE_SPARK_UP },
  { symbol: 'TRX', price: 0.31261, d24: -0.94, d7: -2.15, rate: 0.0000831, cap: 2.96e10, rsi: 48, rsiW: 37, td: null, spark: SAMPLE_SPARK_DOWN },
  { symbol: 'SHIB', price: 0.0000043, d24: 0.19, d7: -3.89, rate: -0.00002, cap: 2.54e9, rsi: 35, rsiW: 34, td: { signal: { type: 'sell', count: 13 }, setup: null, countdown: null }, spark: SAMPLE_SPARK_DOWN },
] as const;

// ── Page furniture (this page only) ──────────────────────────────────────

function Section({ title, lead, children }: { title: string; lead?: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-title font-semibold">{title}</h2>
        {lead && <p className="max-w-prose text-fg-muted">{lead}</p>}
      </div>
      {children}
    </section>
  );
}

function Specimen({ name, note, children, className }: { name: string; note?: string; children: ReactNode; className?: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-3 rounded-panel bg-surface-1 p-4 shadow-edge">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="font-semibold">{name}</h3>
        {note && <span className="text-right text-caption text-fg-faint">{note}</span>}
      </div>
      <div className={cn('flex min-h-control-lg flex-wrap items-center gap-2', className)}>{children}</div>
    </div>
  );
}

const grid = 'grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3';

/** Every token and component, rendered with the real implementations. */
export function Showcase() {
  const [seg, setSeg] = useState('crypto');
  const [chip, setChip] = useState<string | undefined>('meme');
  const [multi, setMulti] = useState<string[]>(['price', 'change']);
  const [tab, setTab] = useState('rsi');
  const [query, setQuery] = useState('');
  const [fav, setFav] = useState(true);

  return (
    <div className="h-full overflow-y-auto bg-surface-0">
      <div className="mx-auto flex max-w-6xl flex-col gap-12 px-4 py-8 md:px-6">
        <header className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <Link href="/" className="focus-ring caps rounded-tag hover:text-fg">← Perp Board</Link>
            <h1 className="text-display font-semibold">UI system</h1>
            <p className="max-w-prose text-fg-muted">
              Three layers: tokens, components built only from tokens, and screens built only from components. This page
              renders the real implementations — if something looks wrong here, it is wrong everywhere. Rules are in DESIGN.md.
            </p>
          </div>
          <ThemeToggle />
        </header>

        {/* ── Tokens ── */}
        <Section title="Colour" lead="Accent means selected, live or focused. Up / down mean price direction. Cold / hot mean an RSI extreme. Everything else is neutral.">
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {COLORS.map((g) => (
              <div key={g.group} className="flex flex-col gap-3 rounded-panel bg-surface-1 p-4 shadow-edge">
                <h3 className="caps">{g.group}</h3>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {g.items.map((c) => (
                    <div key={c.name} className="flex min-w-0 flex-col gap-1">
                      <span className={cn('h-9 rounded-control shadow-edge', c.cls)} />
                      <code className="truncate font-sans text-small font-medium">{c.name}</code>
                      <span className="truncate text-caption text-fg-muted">{c.use}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Type" lead="One face (Inter), five sizes, three weights. Numbers are tabular everywhere.">
          <div className="flex flex-col rounded-panel bg-surface-1 px-4 shadow-edge">
            {TYPE.map((t) => (
              <div key={t.name} className="grid grid-cols-[8rem_1fr] items-baseline gap-4 py-3 rule-b last:shadow-none">
                <div className="flex flex-col">
                  <code className="font-sans text-small font-medium">{t.name}</code>
                  <span className="text-caption text-fg-muted">{t.spec}</span>
                </div>
                <span className={cn('num', t.cls)}>{t.sample}</span>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Size and shape" lead="Controls come in three heights, rows in one. Three radii by role. Spacing stays on the 4px grid.">
          <div className={grid}>
            <Specimen name="Control height" note="h-control-sm · md · lg, h-row" className="items-end gap-4">
              {[
                ['sm 24', 'h-control-sm'],
                ['md 28', 'h-control-md'],
                ['lg 32', 'h-control-lg'],
                ['row 36', 'h-row'],
              ].map(([label, cls]) => (
                <div key={label} className="flex flex-col items-start gap-1.5">
                  <span className={cn('w-10 rounded-control bg-fill-strong', cls)} />
                  <span className="text-caption text-fg-muted">{label}</span>
                </div>
              ))}
            </Specimen>
            <Specimen name="Radius" note="rounded-tag · control · panel" className="gap-4">
              {[
                ['tag 4', 'rounded-tag'],
                ['control 6', 'rounded-control'],
                ['panel 10', 'rounded-panel'],
                ['full', 'rounded-full'],
              ].map(([label, cls]) => (
                <div key={label} className="flex flex-col items-start gap-1.5">
                  <span className={cn('size-9 bg-fill-strong', cls)} />
                  <span className="text-caption text-fg-muted">{label}</span>
                </div>
              ))}
            </Specimen>
            <Specimen name="Elevation" note="shadow-seg · pop · drawer" className="gap-4">
              {[
                ['seg', 'shadow-seg'],
                ['pop', 'shadow-pop'],
                ['drawer', 'shadow-drawer'],
              ].map(([label, cls]) => (
                <div key={label} className="flex flex-col items-start gap-1.5">
                  <span className={cn('h-9 w-14 rounded-control bg-surface-pop', cls)} />
                  <span className="text-caption text-fg-muted">{label}</span>
                </div>
              ))}
            </Specimen>
          </div>
        </Section>

        {/* ── Base components ── */}
        <Section title="Base components" lead="components/ui — interaction and chrome.">
          <div className={grid}>
            <Specimen name="Button" note="solid · outline · ghost / sm · md · lg">
              <Button variant="solid">Apply</Button>
              <Button>
                <SlidersHorizontal className="size-3.5" aria-hidden="true" />
                Customize
              </Button>
              <Button variant="ghost">Reset</Button>
              <Button size="sm">Small</Button>
              <Button disabled>Disabled</Button>
            </Specimen>
            <Specimen name="IconButton" note="label is required">
              <ThemeToggle />
              <IconButton label="Close"><X className="size-4" aria-hidden="true" /></IconButton>
              <IconButton label="Close" variant="outline"><X className="size-4" aria-hidden="true" /></IconButton>
            </Specimen>
            <Specimen name="Segmented" note="one of several views">
              <Segmented
                options={[{ value: 'crypto', label: 'Crypto' }, { value: 'stock', label: 'Stocks' }, { value: 'all', label: 'All' }]}
                value={seg}
                onChange={setSeg}
              />
              <Segmented size="sm" options={[{ value: '1h', label: '1h' }, { value: '4h', label: '4h' }, { value: '24h', label: '24h' }]} value="4h" onChange={() => {}} />
            </Specimen>
            <Specimen name="Chips" note="filters that toggle">
              <Chips
                options={[
                  { value: 'top25', label: 'Top 25' },
                  { value: 'meme', label: 'Meme' },
                  { value: 'oversold', label: 'Oversold', dot: 'cold', count: 3 },
                ]}
                value={chip}
                onChange={setChip}
              />
            </Specimen>
            <Specimen name="Chips · multiple" note="size sm">
              <Chips
                multiple
                size="sm"
                options={[{ value: 'price', label: 'Price' }, { value: 'change', label: '24h change' }, { value: 'cap', label: 'Market cap' }]}
                value={multi}
                onChange={setMulti}
              />
            </Specimen>
            <Specimen name="Tabs" note="pages inside a region">
              <Tabs
                className="w-full"
                tabs={[{ id: 'rsi', label: 'RSI' }, { id: 'funding', label: 'Funding' }, { id: 'altcoin', label: 'Altcoin' }, { id: 'btc', label: 'BTC' }]}
                value={tab}
                onChange={setTab}
              />
            </Specimen>
            <Specimen name="SearchField" note="⌘K focuses it">
              <SearchField value={query} onChange={setQuery} shortcut className="w-full" />
            </Specimen>
            <Specimen name="Tag · Kbd" note="neutral · up · down · cold · hot">
              <Tag>Weak</Tag>
              <Tag tone="up">B9</Tag>
              <Tag tone="down" solid>S13</Tag>
              <Tag tone="cold">Oversold</Tag>
              <Tag tone="hot">Overbought</Tag>
              <Kbd>⌘K</Kbd>
            </Specimen>
            <Specimen name="Tip · InfoTip" note="hover, focus or click">
              <span className="text-fg-muted">Daily RSI</span>
              <InfoTip label="Daily RSI" align="start" content={<TipBody title="Daily RSI = (D-RSI7 + D-RSI14) / 2" items={['≤25 Oversold', '≥75 Overbought']} />} />
            </Specimen>
            <Specimen name="Skeleton" note="loading placeholder">
              <Skeleton className="size-5 rounded-full" />
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-3 w-12" />
            </Specimen>
            <Specimen name="TokenAvatar" note="logo with letter fallback">
              <TokenAvatar symbol="BTC" size="sm" />
              <TokenAvatar symbol="ETH" size="md" />
              <TokenAvatar symbol="SOL" size="lg" />
              <TokenAvatar symbol="" size="lg" />
            </Specimen>
          </div>
        </Section>

        {/* ── Data components ── */}
        <Section title="Data components" lead="components/data — how a market value looks. The colour rules live here, not in the screens.">
          <div className={grid}>
            <Specimen name="Price" note="fraction steps back" className="flex-col items-end">
              <Price value={69113.3} />
              <Price value={1956.24} />
              <Price value={0.31261} />
              <Price value={0.0000043} />
            </Specimen>
            <Specimen name="Delta · Percent" note="the only red and green">
              <Delta value={3.86} />
              <Delta value={-2.59} />
              <Delta value={0} />
              <Percent value={12.4} decimals={1} tone="neutral" />
            </Specimen>
            <Specimen name="Money" note="$ and unit step back">
              <Money value={1.38e12} />
              <Money value={2.3985e11} />
              <Money value={6.1e6} decimals={1} />
              <Money value={-48200} signed />
              <Money value={129000} signed />
            </Specimen>
            <Specimen name="RsiReading · Meter" note="neutral · ≤25 cold · ≥75 hot" className="gap-4">
              <RsiReading value={22} />
              <RsiReading value={48} />
              <RsiReading value={81} />
              <Meter value={60} />
            </Specimen>
            <Specimen name="FundingValue" note="coloured from ±10% APR" className="gap-4">
              <FundingValue rate={0.000015} interval={8} />
              <FundingValue rate={-0.000037} interval={8} />
              <FundingValue rate={0.0001} interval={8} />
              <FundingValue rate={0.0001} interval={8} show="rate" />
            </Specimen>
            <Specimen name="TdValue" note="9 tinted · 13 solid · in progress faint" className="gap-4">
              <TdValue td={ROWS[0].td} />
              <TdValue td={ROWS[3].td} />
              <TdValue td={ROWS[1].td} />
              <TdValue td={null} />
            </Specimen>
            <Specimen name="Sparkline · SparkDelta" note="colour follows the change" className="gap-4">
              <Sparkline data={SAMPLE_SPARK_UP} change={4.2} />
              <SparkDelta change={-8.76} sparklineData={SAMPLE_SPARK_DOWN} />
            </Specimen>
            <Specimen name="TokenCell · FavoriteButton" className="gap-4">
              <TokenCell symbol="BTC" />
              <TokenCell symbol="HYPE" />
              <span className="group"><FavoriteButton symbol="BTC" active={fav} onToggle={() => setFav((v) => !v)} /></span>
            </Specimen>
            <Specimen name="Stat" note="title · display" className="items-start gap-6">
              <Stat value={<Figure>36.7</Figure>} label="Avg daily RSI 7" />
              <Stat size="display" value={<Figure tone="up">31</Figure>} label="Positive · longs pay" />
            </Specimen>
            <Specimen name="Gauge" note="zones optional" className="flex-col items-stretch">
              <Gauge zones={RSI_GAUGE_ZONES} position={37.5} ticks={RSI_GAUGE_TICKS} label="Market RSI 37.5" />
            </Specimen>
            <div className="overflow-hidden rounded-panel bg-surface-2 shadow-edge">
              <Panel title="Panel" note="Top 50" info="A panel is a block of the Insights sidebar." actions={<Figure className="text-small text-fg-muted">2</Figure>} flush>
                <ListHeading label="ListHeading" dot="up" count={2} />
                <List>
                  <ListRow symbol="BTC" detail={<Price value={69113.3} />} value={<RsiReading value={22} />} />
                  <ListRow symbol="SOL" detail={<Price value={80.56} />} value={<Delta value={-1.35} />} />
                </List>
                <EmptyLine>EmptyLine — one quiet line, never a hero</EmptyLine>
              </Panel>
            </div>
          </div>
        </Section>

        {/* ── Composition ── */}
        <Section title="Table rows" lead="Row height, column rhythm and every readout together.">
          <div className="overflow-x-auto rounded-panel bg-surface-1 shadow-edge">
            <table className="w-full min-w-max border-separate border-spacing-0">
              <thead>
                <tr className="caps">
                  {['Token', 'Price', '24h', '7 days', 'Funding APR', 'Market cap', 'Daily RSI', 'Weekly RSI', 'TD'].map((h, i) => (
                    <th key={h} className={cn('h-control-lg px-3 font-medium rule-b', i === 0 ? 'text-left' : 'text-right')}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ROWS.map((r) => (
                  <tr key={r.symbol} className="data-row group">
                    <td className="h-row px-3 rule-b"><TokenCell symbol={r.symbol} /></td>
                    <td className="px-3 text-right rule-b"><Price value={r.price} /></td>
                    <td className="px-3 text-right rule-b"><Delta value={r.d24} /></td>
                    <td className="px-3 text-right rule-b"><SparkDelta change={r.d7} sparklineData={[...r.spark]} /></td>
                    <td className="px-3 text-right rule-b"><FundingValue rate={r.rate} interval={8} /></td>
                    <td className="px-3 text-right rule-b"><Money value={r.cap} /></td>
                    <td className="px-3 text-right rule-b"><RsiReading value={r.rsi} /></td>
                    <td className="px-3 text-right rule-b"><RsiReading value={r.rsiW} /></td>
                    <td className="px-3 text-right rule-b"><TdValue td={r.td} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      </div>
    </div>
  );
}
