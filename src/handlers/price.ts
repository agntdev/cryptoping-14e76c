import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { COINS, data, formatPrice, quotes, symbol } from "../crypto.js";
import { inlineButton, inlineKeyboard } from "../toolkit/index.js";
const composer = new Composer<Ctx>();
composer.command("price", async ctx => { const input = ctx.match?.trim(); const d = data(ctx); const requested = !input || input.toLowerCase() === "all" ? d.watchlist.map(w => w.ticker) : [symbol(input)]; if (!requested.length) { await ctx.reply("Your watchlist is empty — tap Add ticker to begin.", { reply_markup: inlineKeyboard([[inlineButton("Add ticker", "watchlist:add")]]) }); return; } if (requested.some(t => !COINS[t])) { await ctx.reply("I couldn't find that ticker. Try BTC, ETH, or TON."); return; } const result = await quotes(requested); if (!Object.keys(result).length) { await ctx.reply("Price service is unavailable right now. Try again shortly."); return; } const lines = requested.map(t => { const q = result[t]; return q ? `${t} — ${formatPrice(q.price)} (${q.change >= 0 ? "+" : ""}${q.change.toFixed(2)}% 24h)` : `${t} — price unavailable`; }); await ctx.reply(lines.join("\n"), { reply_markup: inlineKeyboard([[inlineButton("View watchlist", "watchlist:view"), inlineButton("Add alert", "alert:create:start")]]) }); });
export default composer;
