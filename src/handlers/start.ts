import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { mainMenuKeyboard, inlineButton, inlineKeyboard } from "../toolkit/index.js";
import { data } from "../crypto.js";

// The /start handler renders the bot's MAIN MENU — the primary way users operate
// a button-first bot. A feature adds its own button by calling
// `registerMainMenuItem(...)` in its own `src/handlers/<slug>.ts`; this handler
// renders whatever is registered (plus a Help button), so you do NOT edit this
// file to add a feature. Send ONE message — no placeholder line above the menu.
const composer = new Composer<Ctx>();

const WELCOME = "Track crypto prices, alerts, and daily summaries from one private menu.";

composer.command("start", async (ctx) => {
  const firstRun = !ctx.session.profile;
  data(ctx);
  await ctx.reply(WELCOME, { reply_markup: mainMenuKeyboard() });
  if (firstRun) await ctx.reply("Choose a starter ticker, or add your own.", { reply_markup: inlineKeyboard([[inlineButton("BTC", "watchlist:pick:BTC"), inlineButton("ETH", "watchlist:pick:ETH"), inlineButton("TON", "watchlist:pick:TON")], [inlineButton("Add custom ticker", "watchlist:custom")]]) });
});

// "Back to menu" — re-render the main menu in place from any sub-view.
composer.callbackQuery("menu:main", async (ctx) => {
  await ctx.answerCallbackQuery();
  await ctx.editMessageText(WELCOME, { reply_markup: mainMenuKeyboard() });
});

export default composer;
