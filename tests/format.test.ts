import { describe, expect, it } from 'vitest';
import { deltaTone, fundingApr, fundingTone, moneyParts, priceParts, rsiTone, signOf } from '@/lib/format';
import { getTdDisplay } from '@/lib/utils';

describe('priceParts', () => {
  it('splits on the decimal point with thousands separators', () => {
    expect(priceParts(69113.3)).toEqual({ int: '69,113', frac: '30' });
    expect(priceParts(1956.24)).toEqual({ int: '1,956', frac: '24' });
  });

  it('scales precision with magnitude and trims trailing zeros below 1000', () => {
    expect(priceParts(647)).toEqual({ int: '647', frac: '' });
    expect(priceParts(80.5612)).toEqual({ int: '80', frac: '5612' });
    expect(priceParts(0.31261)).toEqual({ int: '0', frac: '31261' });
    expect(priceParts(0.000123)).toEqual({ int: '0', frac: '000123' });
  });

  it('uses subscript-zero notation below 0.0001', () => {
    // 0.0000043 → 0.0₅43
    expect(priceParts(0.0000043)).toEqual({ int: '0', zeros: 5, frac: '43' });
    expect(priceParts(0.00000461)).toEqual({ int: '0', zeros: 5, frac: '461' });
    // rounding that carries into the next magnitude stays consistent
    expect(priceParts(0.00009996)).toEqual({ int: '0', zeros: 3, frac: '1' });
  });

  it('degrades to 0 for missing or non-positive prices', () => {
    expect(priceParts(0)).toEqual({ int: '0', frac: '' });
    expect(priceParts(NaN)).toEqual({ int: '0', frac: '' });
  });
});

describe('moneyParts', () => {
  it('picks the unit by magnitude', () => {
    expect(moneyParts(1.38e12)).toEqual({ value: '1.38', unit: 'T' });
    expect(moneyParts(2.3985e11)).toEqual({ value: '239.85', unit: 'B' });
    expect(moneyParts(6.14e6, 1)).toEqual({ value: '6.1', unit: 'M' });
    expect(moneyParts(48200)).toEqual({ value: '48.20', unit: 'K' });
  });

  it('keeps the sign and returns null when there is nothing to show', () => {
    expect(moneyParts(-48200)).toEqual({ value: '−48.20', unit: 'K' });
    expect(moneyParts(0)).toBeNull();
    expect(moneyParts(null)).toBeNull();
  });
});

describe('tones', () => {
  it('colours a change by direction, zero is neutral', () => {
    expect(deltaTone(1.2)).toBe('up');
    expect(deltaTone(-0.01)).toBe('down');
    expect(deltaTone(0)).toBe('neutral');
    expect(deltaTone(null)).toBe('neutral');
  });

  it('colours RSI only at the extremes', () => {
    expect(rsiTone(25)).toBe('cold');
    expect(rsiTone(26)).toBe('neutral');
    expect(rsiTone(74.9)).toBe('neutral');
    expect(rsiTone(75)).toBe('hot');
    expect(rsiTone(undefined)).toBe('neutral');
  });

  it('colours funding only from ±10% APR', () => {
    expect(fundingTone(9.9)).toBe('neutral');
    expect(fundingTone(10)).toBe('up');
    expect(fundingTone(-17.8)).toBe('down');
  });

  it('annualizes funding by its settlement interval', () => {
    expect(fundingApr(0.0001, 8)).toBeCloseTo(10.95, 2);
    expect(fundingApr(0.0001, 1)).toBeCloseTo(87.6, 1);
    // a missing interval falls back to the 8h default
    expect(fundingApr(0.0001, null)).toBeCloseTo(10.95, 2);
  });

  it('uses a real minus sign', () => {
    expect(signOf(-1)).toBe('−');
    expect(signOf(1)).toBe('+');
    expect(signOf(0)).toBe('');
  });
});

describe('getTdDisplay', () => {
  it('reports a completed signal, and marks 13 as the strong one', () => {
    expect(getTdDisplay({ signal: { type: 'buy', count: 9 }, setup: null, countdown: null })).toMatchObject({
      kind: 'signal', side: 'buy', letter: 'B', count: 9, strong: false,
    });
    expect(getTdDisplay({ signal: { type: 'sell', count: 13 }, setup: null, countdown: null })).toMatchObject({
      kind: 'signal', side: 'sell', letter: 'S', count: 13, strong: true,
    });
  });

  it('shows a count in progress only once it is worth showing', () => {
    expect(getTdDisplay({ signal: null, setup: { type: 'buy', count: 3 }, countdown: null }).kind).toBe('none');
    expect(getTdDisplay({ signal: null, setup: { type: 'buy', count: 4 }, countdown: null })).toMatchObject({
      kind: 'progress', letter: 'B', count: 4,
    });
  });

  it('prefers whichever of setup / countdown is closer to completing', () => {
    const td = { signal: null, setup: { type: 'sell' as const, count: 5 }, countdown: { type: 'buy' as const, count: 11 } };
    expect(getTdDisplay(td)).toMatchObject({ kind: 'progress', letter: 'B', count: 11 });
  });

  it('has nothing to show without data', () => {
    expect(getTdDisplay(null).kind).toBe('none');
    expect(getTdDisplay(undefined).kind).toBe('none');
  });
});
