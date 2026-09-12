# CryptoPing — Bot specification

**Archetype:** finance

**Voice:** professional and concise — write every user-facing message, button label, error, and empty state in this voice.

Personal Telegram bot for private, per-user crypto price tracking: add tickers, create price-threshold or percent-change alerts, request on-demand prices, and receive optional local-time morning summaries. Alerts respect user quiet hours and per-rule cooldowns; owner receives daily usage/reporting to ADMIN_CHAT_ID.

> This is the complete contract for the bot. Implement EVERY entry point, flow, feature, integration, and edge case below. The completeness review checks the bot against this document after each build pass.

## Primary audience

- individual crypto traders
- casual crypto holders
- crypto hobbyists wanting lightweight alerts

## Success criteria

- Users can add/remove tickers and create both price-threshold and percent-change alerts via inline flows.
- Alerts are evaluated by the background poller and delivered to users when rules match, respecting quiet hours and per-rule cooldowns.
- Users can run /price [TICKER|all] to get current prices and a compact watchlist snapshot; when the price API fails, /price returns a friendly error.
- Morning summaries are delivered at the user's local scheduled time or queued and delivered after quiet hours.
- Daily admin report containing active user counts and top-fired alerts is sent to ADMIN_CHAT_ID every day.

## Entry points

Every feature must be reachable from the bot's command/button surface (button-first; only /start and /help are slash commands).

- **/start** (command, actor: user, command: /start) — Open the main menu and start onboarding
- **Add ticker** (button, actor: user, callback: watchlist:add) — Begin inline flow to add a ticker from seeded list or enter a custom ticker
  - inputs: seeded selection (BTC/ETH/TON button) or free-text ticker symbol
  - outputs: watchlist item created or 'ticker not found' suggestions
- **View watchlist** (button, actor: user, callback: watchlist:view) — Show personal watchlist with current prices and 1h change
  - outputs: compact snapshot: list of tickers, price, 1h % change, per-item actions (add alert, remove)
- **Add alert** (button, actor: user, callback: alert:create:start) — Choose price-threshold or percent-change alert via inline keyboard
  - inputs: alert type selection, ticker, comparator/direction, value, percent window (if percent-change), confirm
  - outputs: new Alert rule saved and confirmation message
- **/price** (command, actor: user, command: /price) — /price [TICKER|all] - returns current price for a ticker or snapshot of personal watchlist
  - inputs: optional ticker symbol or 'all'
  - outputs: current price(s) or friendly error if price API unavailable
- **Set quiet hours** (button, actor: user, callback: settings:quiet_hours) — Inline flow to set local start/end times when non-urgent alerts are suppressed
  - inputs: start time, end time, timezone confirmation
  - outputs: quiet hours saved; bot acknowledges behavior
- **Morning summary** (button, actor: user, callback: settings:morning_summary) — Toggle and set local time for daily summary of watched coins
  - inputs: on/off toggle, time selection, timezone
  - outputs: morning summary schedule saved, next delivery time preview
- **/help** (command, actor: user, command: /help) — Show help and fallback command list
  - outputs: short help text and buttons to common actions

## Flows

### Onboarding & watchlist setup
_Trigger:_ /start

1. Bot welcomes user, detects or asks for timezone (ForceReply) and confirms default settings (default cooldown 6h, percent-change window 1h).
2. Show inline seeded tickers (BTC, ETH, TON) and 'Add custom ticker' button.
3. If user chooses seeded ticker, add to watchlist; if custom, accept free-text ticker, validate against price API, show suggestions if ambiguous.

_Data touched:_ User profile, Watchlist item

### Create price-threshold alert
_Trigger:_ callback alert:create:start -> 'Price threshold'

1. User selects ticker (from watchlist or enters new).
2. User selects direction (above / below) via inline buttons.
3. User enters numeric price (slash command or ForceReply for free input).
4. Bot shows confirmation summary (ticker, comparator, cooldown) with Confirm/Cancel buttons.
5. On Confirm, save Alert rule and send acknowledgement.

_Data touched:_ Watchlist item, Alert rule

### Create percent-change alert
_Trigger:_ callback alert:create:start -> 'Percent change'

1. User selects ticker.
2. User selects direction (up / down) via inline buttons.
3. User enters percent threshold and selects comparison window (default 1h or other options via buttons).
4. Bot confirms summary with Confirm/Cancel.
5. On Confirm, save Alert rule and acknowledge.

_Data touched:_ Watchlist item, Alert rule

### Background price poller and alert dispatch
_Trigger:_ scheduled poller event

1. Poll configured public crypto price API for all unique tickers across active users (with dedup and rate-limit handling).
2. If API returns stale/failed data for a ticker, skip alert evaluation for that ticker this cycle; do not send alerts with stale data.
3. Evaluate each user's alert rules for returned fresh prices. Respect per-rule cooldown and user's quiet hours (suppress and queue non-urgent notifications).
4. When an alert fires, send notification message with ticker, current price, rule summary, and 'snooze/change' quick actions. Record Notification record last-fired timestamp to enforce cooldown.
5. Log fired alert for daily admin report counters.

_Data touched:_ Alert rule, Price cache, Notification record, User profile (quiet hours)

### On-demand /price
_Trigger:_ /price command

1. Parse input: specific ticker or 'all'.
2. Fetch fresh price(s) for requested ticker(s); if API fails, attempt quick silent retries.
3. If still failing, respond with friendly error explaining service issue and suggest trying later.
4. If successful, return price(s) and 1h change where applicable.

_Data touched:_ Price cache, Watchlist item

### Morning summary delivery
_Trigger:_ scheduled per-user morning time

1. At user's local scheduled time, if in quiet hours then queue summary for delivery after quiet period ends; otherwise fetch fresh prices and compile compact summary of watched coins and recent % moves.
2. Send summary message with quick actions (view watchlist, add alert, snooze summaries).

_Data touched:_ User profile, Watchlist item, Price cache

### Quiet hours suppression and queued delivery
_Trigger:_ alert fire during quiet hours

1. Detect quiet hours from user's stored start/end times and timezone (handle midnight-wrapping).
2. Suppress immediate non-urgent message; mark notification as queued and include reason in queued metadata.
3. On quiet hours end or next active period, deliver queued messages in chronological order with note they were queued.

_Data touched:_ User profile, Notification record, Alert rule

### Admin daily report
_Trigger:_ daily scheduler (owner timezone)

1. Aggregate active user count and top-fired alert types for the previous 24 hours.
2. Send compact report to ADMIN_CHAT_ID (configured by owner) with top 10 fired alert types and counts.
3. Rotate/trim daily counters as needed.

_Data touched:_ Notification record, Alert rule

## Owner-supplied settings

The OWNER provides these; they are collected in chat and injected into the environment at deploy. Read each one from the environment where it is used (`ctx.env.<KEY>` / `env.<KEY>` on Cloudflare Workers; `process.env.<KEY>` only as a Node/harness fallback — never the sole read). Do NOT invent your own way of learning the value, do NOT ask for it in a bot message, and do NOT hardcode a default.

- **ADMIN_CHAT_ID** — Where daily admin reports and owner notifications are sent
  - this is the OWNER's own chat id; the platform already knows it. Read `ADMIN_CHAT_ID` via `ctx.env` (prefer toolkit `adminChatId` / `requireOwner`) — never ask a user, never treat whoever writes first as the admin, never invent claim-admin or open manage for everyone.
  - may be UNSET at runtime: the bot must still start, and the feature needing ADMIN_CHAT_ID must say so plainly instead of failing.

Your behavioral specs run WITHOUT these values, so no spec may depend on one.

## Data entities

Durable data (must survive a restart) uses the toolkit's persistent store, never in-memory maps.

An entity that merely NAMES an owner-supplied setting above (an admin chat, an API account) is not something to store or discover — read it from the environment.

- **User profile** _(retention: persistent)_ — Per-user settings and metadata
  - fields: chat_id, timezone, quiet_hours_start, quiet_hours_end, morning_summary_time, alert_cooldown_default_hours, language_pref, queued_notifications
- **Watchlist item** _(retention: persistent)_ — A user-owned tracked ticker
  - fields: id, user_chat_id, ticker_symbol, display_name, added_at
- **Alert rule** _(retention: persistent)_ — Rule that determines when a notification should be sent
  - fields: id, user_chat_id, watchlist_item_id, type, direction, comparator_value, percent_window_minutes, cooldown_hours, enabled, created_at
- **Notification record** _(retention: persistent)_ — Per-rule last-fired timestamp to suppress duplicates and enable reporting
  - fields: alert_rule_id, last_fired_at, queued, queued_at
- **Price cache** _(retention: session)_ — Temporary cached price responses to deduplicate API calls during a poll cycle
  - fields: ticker_symbol, price_usd, percent_change_1h, fetched_at, stale_flag
- **Seeded tickers** _(retention: persistent)_ — Default starter set shown at onboarding
  - fields: ticker_symbol, display_name

## Integrations

- **Telegram** (required) — Bot API messaging, inline keyboards, commands, callbacks
- **Public Crypto Price API** (required) — Poll for current prices and percent-change windows used to evaluate alerts
Call external APIs against their real contract (correct endpoints, ids, params); credentials from env. Do not fake responses.

## Owner controls

- Set ADMIN_CHAT_ID (where admin/daily reports are sent)
- Force-run daily admin report
- View summary metrics (active users, top fired alerts) via admin command
- Adjust global defaults: default percent-change window, default cooldown (owner-level override)
- Pause/resume background poller (maintenance mode)

## Notifications

- Per-alert push notifications with ticker, current price, rule summary, and quick actions
- Queued notifications delivered after quiet hours with note they were delayed
- On-demand /price responses
- Morning summary messages at user local time
- Daily admin summary sent to ADMIN_CHAT_ID
- Friendly error message when user requests /price and price API is unavailable

## Permissions & privacy

- All watchlists, alert rules, and notification records are private to each user and never shared between users.
- Admin receives aggregated daily counts only; no per-user full dataset is included in owner report by default.
- Bot stores only necessary metadata (chat id, timezone, settings). No sensitive credentials are stored for users.
- Users can delete all stored data via a Delete data/Stop bot action (implementation should expose a clear command or menu).

## Edge cases

- Price API partial failure: some tickers return data, others fail — evaluate only fresh tickers and skip others for that cycle.
- Ticker ambiguous/unknown: suggest closest matches and explain ticker not found; allow retry or manual override.
- Quiet hours wrap midnight: correctly interpret and schedule suppression for cross-midnight windows.
- User moves timezone or edits morning summary while messages are queued: queued items must use queued metadata and deliver after new quiet-period end rules.
- Concurrent modifications: user edits or deletes an alert while poller is evaluating it — ensure atomic check-and-update of Notification record.
- High-frequency price oscillation: successive alerts suppressed by per-rule cooldown to avoid spam.
- Exceeding price API rate limits: throttle polling frequency, backoff and inform admin if sustained.
- Empty watchlist: /price all returns guidance and onboarding buttons.

## Required tests

- Dialog-level acceptance: user can add a seeded ticker to watchlist and confirm it appears in watchlist snapshot.
- Alert creation flow: create both price-threshold and percent-change alerts including confirmations and saved values.
- Alert firing: with mocked price API, verify alert dispatch to user, last-fired timestamp recorded, and cooldown suppression for subsequent matching prices within cooldown window.
- Quiet hours behavior: alert fired during quiet hours is queued and delivered after quiet hours end; morning summary queued/delivered behavior.
- /price command: returns prices on success and a friendly error when API is unavailable; retry behavior verified.
- Admin report: daily aggregation sends active user count and top-fired alerts to ADMIN_CHAT_ID.
- API failure handling: poller retries silently, skips stale data, and does not send alerts with incomplete data.

## Assumptions

- Seeded tickers: BTC, ETH, TON are shown at onboarding by default.
- Default percent-change evaluation window is 1 hour unless user selects another option when creating the rule.
- Default alert cooldown is 6 hours per rule unless user customizes in settings.
- Currency for prices is USD unless owner specifies otherwise (missing field).
- Bot will deduplicate API requests across users for identical tickers to reduce rate usage.
