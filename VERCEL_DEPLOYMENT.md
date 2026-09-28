# VERCEL_DEPLOYMENT.md — Deploying to Vercel (Webhook Mode)

This is the primary, recommended way to run this bot 24/7:

```
Telegram → HTTPS Webhook → Vercel Serverless Function (api/telegram.ts) → MongoDB Atlas
```

No polling loop, no `npm run dev`/`npm start` process running anywhere in
production - Vercel only invokes `api/telegram.ts` when Telegram actually
sends an update.

---

## 0. If you're reading this after the bot leaked credentials or sent spam - do this first

If your bot has been sending messages you didn't send, or you're not sure
whether `BOT_TOKEN`/`MONGODB_URI` were ever committed to a public (or even
private-but-shared) git repository, **rotate both immediately, before
anything else in this guide**:

1. **Telegram**: message **@BotFather** → `/mybots` → select your bot →
   **API Token** → **Revoke current token**. This instantly invalidates the
   old token everywhere, including for whoever/whatever was misusing it.
2. **MongoDB Atlas**: Database Access → edit your database user → set a new
   password (or delete the user and create a new one).
3. Update your **local** `.env` with the new values. Never put real values
   in `.env.example` - see step 5 below.
4. Only after rotating, continue with deployment - use the NEW token/URI in
   Vercel's environment variables (step 5).

This project's `.env.example` must only ever contain variable **names**,
never real values. `.env` (which does hold real values) is git-ignored - see
`.gitignore`.

---

## 1. Push the project to a GitHub repository

```bash
git init
git add .
git commit -m "Initial commit"
```
Before pushing, double check secrets aren't tracked:
```bash
git ls-files | grep -E '^\.env$'   # should print nothing
cat .env.example                    # should show empty VAR= lines, no real values
```
Then create a repo on GitHub and push:
```bash
git remote add origin https://github.com/<you>/<repo>.git
git branch -M main
git push -u origin main
```

## 2. Create a Vercel account

Go to vercel.com and sign up (GitHub login is the easiest option, since it
also grants Vercel repo access in the same step).

## 3. Import the repository

Vercel dashboard → **Add New...** → **Project** → select your GitHub repo →
**Import**.

## 4. Build settings

- **Framework Preset**: leave as **Other** (this is a plain Node.js
  serverless-function project, not Next.js/etc.).
- **Build Command**: leave it as configured by `vercel.json`
  (a no-op `echo`) - the project intentionally skips running
  `npm run build` for deployment, because Vercel's Node runtime compiles
  `api/telegram.ts` and everything it imports from `src/` directly from
  TypeScript on its own. The `build`/`start` scripts in `package.json` are
  only for optional self-hosted polling mode (see `SETUP.md`), not for this
  deployment path.
- **Output Directory**: `public` (already set in `vercel.json`; it only holds a
  placeholder page - the real work is the serverless function under `/api`).
- **Install Command**: default (`npm install`) is fine.

You generally don't need to touch any of these manually since `vercel.json`
already encodes them; just don't override Build Command back to
`npm run build` in the dashboard.

## 5. Environment Variables

In the Vercel project → **Settings → Environment Variables**, add each of
these for the **Production** environment (and Preview, if you want preview
deployments to also run a working bot against the same or a separate test
bot/database):

| Name | Example value | Notes |
|---|---|---|
| `BOT_TOKEN` | `YOUR_BOT_TOKEN` | From @BotFather. Use a **rotated/fresh** token if this one was ever exposed. |
| `ADMIN_ID` | `YOUR_ADMIN_ID` | Your numeric Telegram user ID (from @userinfobot). |
| `ARCHIVE_GROUP_ID` | `YOUR_GROUP_ID` | The forum group's numeric chat ID. |
| `MONGODB_URI` | `YOUR_MONGODB_URI` | From MongoDB Atlas. Use a **rotated** password if this was ever exposed. |
| `TOPIC_NAME_SEPARATOR` | `\|` | |
| `PAGE_SIZE` | `10` | |
| `LOG_LEVEL` | `info` | |
| `BOT_MODE` | `webhook` | Always `webhook` on Vercel. |
| `WEBHOOK_DOMAIN` | `https://your-project.vercel.app` | Optional - only read by the local `set-webhook` script, not by the deployed function itself. Fill it in once you know your Vercel URL (step 7). |
| `WEBHOOK_SECRET` | *(a random string)* | Optional but recommended. Generate with `node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"`. Protects `/api/telegram` from receiving forged requests. |

**Never** paste real values into `.env.example`, the README, or any commit -
only into Vercel's Environment Variables UI (and your local, git-ignored
`.env`).

## 6. MongoDB Atlas Network Access

Vercel serverless functions don't have a fixed/static outbound IP address on
Hobby or Pro plans, so an IP-allowlist won't work reliably. In Atlas:
**Network Access → Add IP Address → Allow Access from Anywhere**
(`0.0.0.0/0`). Combine this with a strong database user password (see step 0)
and TLS (which Atlas connection strings already use by default) - the
password is what's actually protecting the database, not the IP allowlist.

## 7. Deploy

Click **Deploy**. Vercel builds and deploys the project; when it finishes
you'll see a URL like `https://your-project.vercel.app`.

## 8. Get your Vercel deployment URL

Copy the production URL from the deployment summary (or **Settings →
Domains**). This is the `WEBHOOK_DOMAIN` value from step 5 - add/update it
in Vercel's environment variables now if you hadn't yet, and redeploy if you
changed it (environment variable changes require a redeploy to take effect
for **existing** deployments; new deployments pick them up automatically).

You can sanity-check the deployment is live before touching Telegram at all:
```bash
curl https://your-project.vercel.app/api/telegram
# {"ok":true,"service":"telegram-archive-bot","mode":"webhook"}
```

## 9. Register the Telegram webhook

From your local machine (with `.env` containing the real `BOT_TOKEN`, and
optionally `WEBHOOK_SECRET` if you set one in Vercel too):
```bash
npm run set-webhook -- set https://your-project.vercel.app
```
or, if `WEBHOOK_DOMAIN` is already set in your local `.env`:
```bash
npm run set-webhook
```
This calls Telegram's `setWebhook` API pointing at
`https://your-project.vercel.app/api/telegram`, and prints back
`getWebhookInfo` so you can confirm it took effect. Other actions:
```bash
npm run set-webhook -- info     # show current webhook status
npm run set-webhook -- delete   # remove the webhook (e.g. before switching to local polling)
```

## 10. Test `/start`

Message your bot privately on Telegram with `/start`. You should get the
welcome message and a list of discovered years (or a message saying no data
is archived yet, if this is a fresh archive group).

## 11. Create a new Topic

In the archive forum group, create a topic named:
```
سنة أولى | ترم أول | Anatomy | شرح
```
(See `SETUP.md` section 6 for the exact naming rules.)

## 12. Test Dynamic Categories

Send `/start` again (or navigate back). The new year/semester/category/
content type should appear immediately - no redeploy needed, since the
webhook function picks up the `forum_topic_created` event live.

## 13. Test sending files

Post a file inside that topic, then browse to it through the bot
(Year → Semester → Category → Content Type → the file). Confirm the bot
sends it back correctly, and confirm it does not send it twice.

## 14. `/admin`

Message the bot with `/admin` from the `ADMIN_ID` account. You should see
the admin menu (Sync / Stats / Uncategorized Topics). Test from a different
account too - it should be rejected.

## 15. `/sync`

Run `/sync` from the admin menu or `/sync` command. See `README.md`'s
"what the Telegram Bot API can and cannot do" section for exactly what this
does and doesn't cover.

## 16. Troubleshooting

**Bot doesn't respond at all / deployment seems broken**
- Check `curl https://your-project.vercel.app/api/telegram` (GET) returns
  `{"ok":true,...}`. If it 500s or the request fails outright, open
  Vercel Dashboard → your project → Deployments → [latest] → Functions →
  api/telegram → Logs and look for a startup error - the most common cause
  is a missing/misspelled required environment variable (`BOT_TOKEN`,
  `ADMIN_ID`, `ARCHIVE_GROUP_ID`, `MONGODB_URI`), which makes the function
  fail to even load. Fix the variable in Settings → Environment Variables
  and redeploy.
- Run `npm run set-webhook -- info` and check `url` matches your current
  Vercel deployment and `last_error_message` is empty. A `last_error_message`
  mentioning a non-200 response or timeout points at the same function logs.
- Confirm MongoDB Atlas Network Access allows `0.0.0.0/0` (step 6) - a
  connection timeout to Atlas is the single most common cause of the
  function erroring out on Vercel.

**Bot sends duplicate / repeated / "random" messages**
- This almost always means Telegram is retrying an update because it didn't
  get a fast `200 OK` the first time, and the handler re-runs and re-sends
  whatever it was already sending. `api/telegram.ts` in this version of the
  project always answers `200` (even on internal errors) and additionally
  records each `update_id` in MongoDB before processing (see
  `src/database/models/ProcessedUpdate.ts`), so a genuine Telegram retry is
  detected and skipped rather than reprocessed. If you're still seeing
  duplicates after updating to this version:
  - Confirm only one webhook is registered (`npm run set-webhook -- info`)
    and that no polling process is running anywhere else against the same
    bot (check any old Railway/Render/VPS/local `npm run dev` you may have
    left running with the same `BOT_TOKEN`).
  - Check the function logs for repeated "Duplicate Telegram update ignored"
    lines - if you see these, the dedupe guard is working correctly and
    doing its job; the retry you're seeing from Telegram's side is being
    suppressed, not causing a new duplicate send.
- **If the duplicates/spam started suddenly and look like messages you never
  triggered at all** (not just repeats of your own actions), suspect a
  **leaked `BOT_TOKEN`** rather than a retry bug - see step 0 at the top of
  this document and rotate the token immediately. A stolen token lets
  anyone call the Bot API directly, completely outside this codebase.

**Vercel build fails**
- Make sure Build Command wasn't manually overridden in the dashboard to
  `npm run build` (see step 4) - `vercel.json` sets a no-op `buildCommand` and `outputDirectory: public` on
  purpose.
- Run `npm run typecheck` locally first; fix any TypeScript errors it
  reports before pushing.

**MongoDB Atlas connection errors under real traffic**
- Confirm you're running the version of `src/database/connection.ts` that
  caches the connection across warm invocations (the module has a comment
  explaining why). Without caching, every single request opens a fresh
  connection, which can exhaust Atlas's connection limit under any real
  load and shows up as intermittent, hard-to-reproduce failures.

**Unauthorized admin command usage**
- `/admin`, `/sync`, `/stats` all check `ctx.from.id === config.adminId`
  (see `src/bot/commands/admin.ts`, `isAdmin()`/`requireAdmin()`). If
  someone else can run them, double-check `ADMIN_ID` in Vercel's environment
  variables is actually your numeric Telegram user ID, not a group ID or a
  stale/wrong value.

## 17. Performance (if the bot feels slow)

1. **Region (biggest win).** `vercel.json` pins the function to `fra1`
   (Frankfurt). Your MongoDB Atlas cluster should be in a nearby region
   (Frankfurt/Ireland/Paris/Stockholm on AWS or GCP). If the cluster is in the
   US, either move it (Atlas → cluster → Edit → region) or change `regions` to
   match it. Function and database in different continents adds a delay to
   every single query.
2. **Cold starts.** The first request after a quiet period is slower. Create a
   free monitor at cron-job.org (or UptimeRobot) that requests
   `https://<project>.vercel.app/api/telegram?warm=1` every 5 minutes; that
   keeps MongoDB connected and the bot initialised.
3. **Indexes.** After the first successful deploy, add the environment variable
   `AUTO_INDEX=false` in Vercel and redeploy, so cold starts stop re-checking
   indexes.
4. Check Vercel → your project → Logs for the duration of each request to see
   whether the time is spent on cold starts or on every request.
