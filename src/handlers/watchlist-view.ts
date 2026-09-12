import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { data, formatPrice, quotes } from "../crypto.js";
import { inlineButton, inlineKeyboard, registerMainMenuItem } from "../toolkit/index.js";
registerMainMenuItem({ label: "Watchlist", data: "watchlist:view", order: 20 });
const composer = new Composer<Ctx>();
async function show(ctx: Ctx, edit: boolean) { const d = data(ctx); if (!d.watchlist.length) { const text = "No tickers yet — tap Add ticker to start tracking one."; if (edit) await ctx.editMessageText(text, { reply_markup: inlineKeyboard([[inlineButton("Add ticker", "watchlist:add")]]) }); else await ctx.reply(text); return; } const q = await quotes(d.watchlist.map(w => w.ticker)); const text = d.watchlist.map(w => { const x = q[w.ticker]; return x ? `${w.ticker} — ${formatPrice(x.price)} (${x.change >= 0 ? "+" : ""}${x.change.toFixed(2)}% 24h)` : `${w.ticker} — price unavailable`; }).join("\n"); const rows = d.watchlist.map(w => [inlineButton(`Add ${w.ticker} alert`, `alert:ticker:${w.ticker}`), inlineButton(`Remove ${w.ticker}`, `watchlist:remove:${w.ticker}`)]); rows.push([inlineButton("Add ticker", "watchlist:add"), inlineButton("Back to menu", "menu:main")]); if (edit) await ctx.editMessageText(text, { reply_markup: inlineKeyboard(rows) }); else await ctx.reply(text, { reply_markup: inlineKeyboard(rows) }); }
composer.callbackQuery("watchlist:view", async ctx => { await ctx.answerCallbackQuery(); await show(ctx, true); });
composer.callbackQuery(/^watchlist:remove:(.+)$/, async ctx => { await ctx.answerCallbackQuery(); const ticker = ctx.match[1]; const d = data(ctx); d.watchlist = d.watchlist.filter(w => w.ticker !== ticker); d.alerts = d.alerts.filter(a => a.ticker !== ticker); await ctx.editMessageText(`${ticker} and its alerts were removed.`, { reply_markup: inlineKeyboard([[inlineButton("View watchlist", "watchlist:view")]]) }); });
export default composer;
