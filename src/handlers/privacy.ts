import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { inlineButton, inlineKeyboard, registerMainMenuItem } from "../toolkit/index.js";
registerMainMenuItem({ label: "Delete data", data: "privacy:delete", order: 90 });
const composer = new Composer<Ctx>();
composer.callbackQuery("privacy:delete", async ctx => { await ctx.answerCallbackQuery(); await ctx.editMessageText("Delete your watchlist, alerts, and settings?", { reply_markup: inlineKeyboard([[inlineButton("Delete data", "privacy:confirm"), inlineButton("Keep data", "menu:main")]]) }); });
composer.callbackQuery("privacy:confirm", async ctx => { await ctx.answerCallbackQuery(); ctx.session = {}; await ctx.editMessageText("Your CryptoPing data has been deleted."); });
export default composer;
