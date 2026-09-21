# SETUP.md — Full Setup Guide

This walks through everything from creating the bot to testing dynamic
category/content-type discovery, in order.

---

## 1. Create the bot

1. Open Telegram, message **@BotFather**.
2. Send `/newbot`, choose a name and a username (must end in `bot`).
3. BotFather replies with a token like `123456789:AAExampleTokenReplaceMe`.
   Save it — this goes into `.env` as `BOT_TOKEN`.
4. **Disable privacy mode** so the bot can see all messages/topic events in
   the group (not just commands addressed to it):
   ```
   /setprivacy
   <choose your bot>
   Disable
   ```
   This is required — without it, the bot will miss file uploads and some
   topic events.

## 2. Create the archive Group

1. In Telegram, create a **new Group** (not a channel).
2. Convert it to a **Supergroup** if it isn't already (this happens
   automatically once you add enough members, or you can enable it directly
   in group settings on some clients).

## 3. Enable Topics (make it a Forum)

1. Open the group's settings (tap the group name → the pencil/settings icon).
2. Find **"Topics"** and turn it **ON**. The group becomes a forum; you'll now
   see a topics list instead of a flat chat.

## 4. Add the bot to the group

1. Group settings → **Add Member** → search for your bot's username → add it.

## 5. Give the bot the required permissions

1. Group settings → **Administrators** → **Add Admin** → select your bot.
2. Grant at minimum:
   - **Manage Topics** (needed to reliably receive topic-related events)
   - Standard message-reading permissions (default for admins)
3. You do **not** need to give it permission to delete messages/ban users
   unless you want it to moderate — the archive functionality doesn't need
   those.

## 6. How to name Topics (this is the data source — get this right)

Every topic name must follow exactly this pattern, separated by `|`
(configurable via `TOPIC_NAME_SEPARATOR` in `.env`):

```
السنة | الترم | Category أو Section | نوع المحتوى
```

Rules:
- Exactly **4** parts, separated by `|`.
- Extra spaces around `|` are fine: `"سنة أولى |  ترم أول | Anatomy |شرح"`
  is treated identically to `"سنة أولى | ترم أول | Anatomy | شرح"`.
- The 3rd part ("category/section") can be **anything** — a real subject
  name (`Anatomy`), or a non-subject bucket (`تراكمي أولى`, `متنوعات`,
  `مراجعات عامة`) — the bot treats them all the same way, as a plain grouping
  label.
- The 4th part (content type) can be anything too — `شرح`, `أسئلة`, `امتحانات`,
  `فيديوهات`, `PDF`, whatever you use. No fixed list exists in the code.
- A topic name that does **not** split into exactly 4 non-empty parts is
  filed under **Uncategorized** (visible to the admin via `/admin`) instead
  of guessed at.

Examples that work:
```
سنة أولى | ترم أول | Anatomy | شرح
سنة أولى | ترم أول | Anatomy | أسئلة
سنة رابعة | ترم أول | Physiology | امتحانات
سنة أولى | ترم أول | تراكمي أولى | أسئلة
سنة أولى | ترم أول | متنوعات | ملفات
```

## 7. Get the Group's numeric chat ID

You need `ARCHIVE_GROUP_ID` (a negative number for supergroups, e.g.
`-1001234567890`). Easiest ways:
- Add **@userinfobot** or **@RawDataBot** to the group temporarily, send any
  message, read the chat ID from its reply, then remove it, **or**
- Forward any message from the group to **@userinfobot** in a private chat.

## 8. Get your own numeric Telegram user ID

Message **@userinfobot** privately — it replies with your numeric ID. This
becomes `ADMIN_ID`.

## 9. Install and run MongoDB

Any of these work:
- **Local install:** follow MongoDB's official install docs for your OS,
  then run `mongod` (default listens on `mongodb://localhost:27017`).
- **Docker:**
  ```bash
  docker run -d --name archive-mongo -p 27017:27017 -v archive-mongo-data:/data/db mongo:7
  ```
- **MongoDB Atlas** (managed, free tier available): create a cluster, get its
  connection string, use that as `MONGODB_URI` instead of localhost.

## 10. Configure `.env`

```bash
cp .env.example .env
```
Then edit `.env`:
```env
BOT_TOKEN=123456789:AAExampleTokenReplaceMe
ADMIN_ID=111111111
ARCHIVE_GROUP_ID=-1001234567890
MONGODB_URI=mongodb://localhost:27017/telegram_archive_bot
TOPIC_NAME_SEPARATOR=|
PAGE_SIZE=10
LOG_LEVEL=info
BOT_MODE=polling
```
Leave `BOT_MODE=polling` unless you're deploying behind a public HTTPS domain
(see Deployment section).

## 11. Install dependencies and run the bot

```bash
npm install
npm run dev      # ts-node-dev, auto-reloads on file changes (development)
# or, for production:
npm run build
npm start
```
You should see log lines: `MongoDB connected` and `Bot launched in polling mode`.

## 12. Do an initial reconciliation

In Telegram, message the bot privately (as the admin account) with:
```
/sync
```
Since the bot only registers topics **created or edited while it's
running and added**, `/sync` on a totally fresh setup with pre-existing
topics won't find anything by itself — see the ⚠️ section in `README.md`
for why, and the two ways to backfill old topics (rename each once, or the
optional advanced MTProto script in `scripts/`).

For a **fresh group created from scratch after adding the bot**, you don't
need `/sync` at all — every topic you create from now on registers itself
immediately.

## 13. Test: browsing

In a private chat with the bot, send `/start`. You should see buttons for
every year discovered so far. Tap through Year → Semester → Category →
Content Type → a file button → the bot sends you the file.

## 14. Test: adding a brand-new Topic (core requirement — no code changes)

1. In the archive group, create a new topic named exactly:
   ```
   سنة ثانية | ترم ثاني | Pharmacology | امتحانات
   ```
2. Send `/start` again in your private chat with the bot (or navigate back to
   "سنة ثانية"/create it if this is the first topic for that year).
   You should immediately see `سنة ثانية` → `ترم ثاني` → `Pharmacology` →
   `امتحانات` appear, with **no restart and no code change**.

## 15. Test: adding a brand-new Category (non-subject bucket)

1. Create another topic:
   ```
   سنة ثانية | ترم ثاني | مراجعات عامة | ملفات
   ```
2. Confirm `مراجعات عامة` appears as a new category button under
   `سنة ثانية → ترم ثاني`, alongside `Pharmacology`.

## 16. Test: adding a brand-new Content Type

1. Under any existing category, create a topic with a content type you
   haven't used before, e.g.:
   ```
   سنة أولى | ترم أول | Anatomy | فيديوهات
   ```
2. Confirm `فيديوهات` appears as a new content-type button under
   `سنة أولى → ترم أول → Anatomy`, next to `شرح`/`أسئلة`.

## 17. Test: malformed topic names

Create a topic named just `Important Files` (no `|` separators). It should
**not** appear in `/start`'s menus. As the admin, run `/admin` →
"⚠️ Uncategorized Topics" and confirm it's listed with a reason. Rename it to
a valid 4-part name and run `/sync` — it should move into the tree correctly.

## 18. Admin commands reference

- `/admin` — opens the admin menu (Sync / Stats / Uncategorized Topics)
- `/sync` — reconciliation pass (see README's ⚠️ section for exact scope)
- `/stats` — users, topics, per-level counts, files, last sync time

## 19. Deployment

### Option A — simplest: polling, always-on VM/container
Any VPS, small droplet, Railway/Render/Fly.io app, or a Docker container is
enough since `BOT_MODE=polling` doesn't need a public URL:
```bash
npm run build
npm start
```
Use a process manager (`pm2`, `systemd`, or your platform's own restart
policy) so it survives crashes/reboots.

### Option B — webhook mode (needs a public HTTPS domain)
Set in `.env`:
```env
BOT_MODE=webhook
WEBHOOK_DOMAIN=https://your-domain.example.com
WEBHOOK_PORT=8443
```
Telegraf will register the webhook and listen on `WEBHOOK_PORT` — put this
behind a reverse proxy (Nginx/Caddy) terminating TLS on 443 if you don't want
to expose 8443 directly, or use one of Telegram's whitelisted webhook ports
(443, 80, 88, 8443).

### Database in production
Use MongoDB Atlas (or a managed MongoDB instance) rather than a local
`mongod` for anything long-running; update `MONGODB_URI` accordingly. Make
sure the network mounts/firewall rules allow the app to reach it.

### Logs
Written to `logs/combined.log` and `logs/error.log` (see `src/utils/logger.ts`).
Rotate these with `logrotate` or your platform's log management if running
long-term.
