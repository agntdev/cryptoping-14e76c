import type { Ctx, Session } from "./bot.js";

export const COINS: Record<string, { id: string; name: string }> = {
  BTC: { id: "bitcoin", name: "Bitcoin" }, ETH: { id: "ethereum", name: "Ethereum" }, TON: { id: "the-open-network", name: "Toncoin" },
};
export type Quote = { price: number; change: number; fresh: boolean };
export const now = (): number => Date.now();
export function data(ctx: Ctx): Required<Pick<Session, "profile" | "watchlist" | "alerts" | "queued">> {
  ctx.session.profile ??= { timezone: "UTC", cooldownHours: 6, summaryEnabled: false };
  ctx.session.watchlist ??= [];
  ctx.session.alerts ??= [];
  ctx.session.queued ??= [];
  return ctx.session as Required<Pick<Session, "profile" | "watchlist" | "alerts" | "queued">>;
}
export function symbol(raw: string): string { return raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, ""); }
export function timeValid(value: string): boolean { return /^([01]\d|2[0-3]):[0-5]\d$/.test(value); }
export function inQuiet(profile: NonNullable<Session["profile"]>, at = now()): boolean {
  if (!profile.quietStart || !profile.quietEnd || profile.quietStart === profile.quietEnd) return false;
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: profile.timezone || "UTC", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(at));
  const current = `${parts.find(p => p.type === "hour")?.value}:${parts.find(p => p.type === "minute")?.value}`;
  return profile.quietStart < profile.quietEnd ? current >= profile.quietStart && current < profile.quietEnd : current >= profile.quietStart || current < profile.quietEnd;
}
export async function quotes(tickers: string[]): Promise<Record<string, Quote>> {
  const unique = [...new Set(tickers.filter(t => COINS[t]))];
  if (!unique.length) return {};
  const result: Record<string, Quote> = {};
  // CoinGecko simple/price uses coin IDs, not ticker symbols. Chunks keep requests bounded.
  for (let i = 0; i < unique.length; i += 50) {
    const chunk = unique.slice(i, i + 50);
    let response: Response | undefined;
    for (let retry = 0; retry < 3; retry++) { try { response = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${chunk.map(t => COINS[t].id).join(",")}&vs_currencies=usd&include_24hr_change=true`); if (response.ok) break; } catch { /* retry quietly */ } }
    if (!response?.ok) continue;
    const body = await response.json() as Record<string, { usd?: number; usd_24h_change?: number }>;
    for (const ticker of chunk) { const q = body[COINS[ticker].id]; if (typeof q?.usd === "number") result[ticker] = { price: q.usd, change: q.usd_24h_change ?? 0, fresh: true }; }
  }
  return result;
}
export function formatPrice(value: number): string { return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: value < 1 ? 6 : 2 }).format(value); }
export function addTicker(ctx: Ctx, ticker: string): boolean { const d = data(ctx); if (!COINS[ticker] || d.watchlist.some(w => w.ticker === ticker)) return false; d.watchlist.push({ id: `${ticker}-${now()}`, ticker, name: COINS[ticker].name, addedAt: now() }); return true; }
