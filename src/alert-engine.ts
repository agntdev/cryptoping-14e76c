import type { Ctx } from "./bot.js";
import { data, formatPrice, inQuiet, now, quotes } from "./crypto.js";
import { inlineButton, inlineKeyboard } from "./toolkit/index.js";

/** Evaluate one user's durable rules against one deduplicated fresh quote batch. */
export async function evaluateAlerts(ctx: Ctx): Promise<number> {
  const d = data(ctx);
  const active = d.alerts.filter(a => a.enabled);
  const batch = await quotes(active.map(a => a.ticker));
  let fired = 0;
  for (const rule of active) {
    const quote = batch[rule.ticker];
    if (!quote?.fresh) continue; // never fire from stale or partial API data
    const matches = rule.type === "threshold"
      ? (rule.direction === "above" ? quote.price >= rule.value : quote.price <= rule.value)
      : (rule.direction === "up" ? quote.change >= rule.value : quote.change <= -rule.value);
    const timestamp = now();
    if (!matches || (rule.lastFiredAt && timestamp - rule.lastFiredAt < rule.cooldown * 3_600_000)) continue;
    const description = rule.type === "threshold" ? `${rule.direction} ${formatPrice(rule.value)}` : `${rule.direction} ${rule.value}%`;
    const text = `${rule.ticker} is ${formatPrice(quote.price)}. Your alert (${description}) matched.`;
    rule.lastFiredAt = timestamp; // session storage serializes this check/update per chat
    if (inQuiet(d.profile, timestamp)) { d.queued.push({ alertId: rule.id, text, queuedAt: timestamp, kind: "alert" }); continue; }
    try { await ctx.api.sendMessage(ctx.chat!.id, text, { reply_markup: inlineKeyboard([[inlineButton("Snooze", `alert:snooze:${rule.id}`), inlineButton("View watchlist", "watchlist:view")]]) }); fired++; } catch { /* blocked chats must not abort remaining rules */ }
  }
  return fired;
}

export async function deliverQueued(ctx: Ctx): Promise<number> {
  const d = data(ctx);
  if (inQuiet(d.profile) || !d.queued.length) return 0;
  const pending = [...d.queued].sort((a, b) => a.queuedAt - b.queuedAt);
  d.queued = [];
  for (const item of pending) { try { await ctx.api.sendMessage(ctx.chat!.id, `Delayed during quiet hours: ${item.text}`); } catch { d.queued.push(item); } }
  return pending.length - d.queued.length;
}
