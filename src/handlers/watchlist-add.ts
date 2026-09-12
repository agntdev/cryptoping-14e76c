import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { addTicker, COINS, data, symbol } from "../crypto.js";
import { inlineButton, inlineKeyboard, registerMainMenuItem } from "../toolkit/index.js";

registerMainMenuItem({ label: "Add ticker", data: "watchlist:add", order: 10 });
const composer = new Composer<Ctx>();
const choices = inlineKeyboard([[inlineButton("BTC", "watchlist:pick:BTC"), inlineButton("ETH", "watchlist:pick:ETH"), inlineButton("TON", "watchlist:pick:TON")], [inlineButton("Add custom ticker", "watchlist:custom")], [inlineButton("Back to menu", "menu:main")]]);
composer.callbackQuery("watchlist:add", async ctx => { await ctx.answerCallbackQuery(); await ctx.editMessageText("Choose a ticker to track.", { reply_markup: choices }); });
composer.callbackQuery(/^watchlist:pick:(BTC|ETH|TON)$/, async ctx => { await ctx.answerCallbackQuery(); const ticker = ctx.match[1]; const added = addTicker(ctx, ticker); await ctx.editMessageText(added ? `${ticker} is now on your watchlist.` : `${ticker} is already on your watchlist.`, { reply_markup: inlineKeyboard([[inlineButton("View watchlist", "watchlist:view"), inlineButton("Add alert", "alert:create:start")], [inlineButton("Back to menu", "menu:main")]]) }); });
composer.callbackQuery("watchlist:custom", async ctx => { await ctx.answerCallbackQuery(); ctx.session.step = "ticker"; ctx.session.flow = { ...ctx.session.flow, type: undefined }; await ctx.reply("Send the ticker symbol you want to track, for example BTC.", { reply_markup: { force_reply: true, input_field_placeholder: "Ticker symbol" } }); });
composer.on("message:text", async (ctx, next) => { if (ctx.session.step !== "ticker" || ctx.session.flow?.type) return next(); const ticker = symbol(ctx.message.text); if (!COINS[ticker]) { await ctx.reply("I couldn't find that ticker. Try BTC, ETH, or TON."); return; } addTicker(ctx, ticker); ctx.session.step = undefined; await ctx.reply(`${ticker} is now on your watchlist.`, { reply_markup: inlineKeyboard([[inlineButton("View watchlist", "watchlist:view")]]) }); });
export default composer;
