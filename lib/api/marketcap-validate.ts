/**
 * Sanity gates for the CoinLore market-cap payload — shared by the
 * /api/marketcap proxy and its tests.
 *
 * CoinLore does NOT fail cleanly: instead of an error it can serve a
 * structurally valid payload whose `market_cap_usd` fields are the literal
 * string "0?" and whose ranks are scrambled. Such a payload is worse than no
 * payload — it makes every real coin look unranked, which collapses the board's
 * universe (see MARKET_CAP in lib/constants).
 */

import { MARKET_CAP } from '../constants';

export interface CoinLoreCoin {
  symbol?: string;
  rank?: number | string;
  market_cap_usd?: string;
  nameid?: string;
}

/**
 * A row is well-formed when its market cap is a real number. Note `Number()`,
 * not `parseFloat()`: parseFloat('0?') is 0 (indistinguishable from a legitimate
 * zero-cap coin), while Number('0?') is NaN — which is exactly the corruption
 * this gate exists to catch. A genuine '0' still passes.
 */
export function isWellFormed(coin: CoinLoreCoin): boolean {
  if (!coin || typeof coin.symbol !== 'string' || !coin.symbol) return false;
  if (!Number.isFinite(Number(coin.rank))) return false;
  return Number.isFinite(Number(coin.market_cap_usd));
}

/**
 * Whole-payload sanity check. The totals gate catches the common "most rows are
 * '0?'" failure; the top-rank check catches a payload that is thin only where it
 * matters most (the majors that actually define the universe).
 * Returns null when sane, otherwise the reason it was rejected.
 */
export function payloadProblem(coins: CoinLoreCoin[]): string | null {
  if (coins.length < MARKET_CAP.MIN_VALID_TOTAL) {
    return `payload too thin: ${coins.length} well-formed rows`;
  }
  // Every coin ranked in the top N must carry a real, positive market cap.
  const topRanks = new Set<number>();
  for (const coin of coins) {
    const rank = Number(coin.rank);
    if (rank >= 1 && rank <= MARKET_CAP.SANITY_TOP_RANK) {
      if (!(Number(coin.market_cap_usd) > 0)) {
        return `rank ${rank} (${coin.symbol}) has no market cap`;
      }
      topRanks.add(rank);
    }
  }
  if (topRanks.size < MARKET_CAP.SANITY_TOP_RANK) {
    return `only ${topRanks.size} of the top ${MARKET_CAP.SANITY_TOP_RANK} ranks present`;
  }
  return null;
}
