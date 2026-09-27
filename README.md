# Telegram Archive Bot — Fully Dynamic

A Telegram forum-topic archive bot where **years, semesters, categories and
content types are never hardcoded** — every level of the hierarchy is
discovered live from the *names of Telegram forum topics*, in the form:

```
السنة | الترم | Category/Section | نوع المحتوى
```

Example topics:
```
سنة أولى | ترم أول | Anatomy | شرح
سنة أولى | ترم أول | تراكمي أولى | أسئلة
سنة أولى | ترم أول | متنوعات | ملفات
```

Adding a brand-new topic like `سنة ثانية | ترم ثاني | Pharmacology | امتحانات`
makes `سنة ثانية`, `ترم ثاني`, `Pharmacology` and `امتحانات` all appear in the
bot's menus automatically — **zero code changes, zero redeploys.**

---

## 🚀 Deployment

**Production runs on Vercel via a webhook**, not polling:
```
Telegram → HTTPS Webhook → api/telegram.ts (Vercel Serverless Function) → MongoDB Atlas
```
Full step-by-step instructions: **[`VERCEL_DEPLOYMENT.md`](./VERCEL_DEPLOYMENT.md)**
(includes a troubleshooting section for deployment failures and for a bot
that sends duplicate/repeated messages).

Local development still uses polling (`BOT_MODE=polling`, `npm run dev`) -
see `SETUP.md`. The two modes are deliberately kept in separate entrypoints
(`src/index.ts` for polling, `api/telegram.ts` for the webhook) so they can
never run against the same bot at once.

### 🔒 Security - read before you commit/push anything
- `.env` holds your real secrets and is git-ignored. **Never** put real
  values in `.env.example` - it must only ever contain variable *names*.
- If `BOT_TOKEN` or `MONGODB_URI` were ever committed to git (even briefly,
  even in a private repo), treat them as compromised: revoke the bot token
  via @BotFather and rotate the MongoDB Atlas password immediately, then use
  the new values going forward. A leaked bot token is the most common real
  cause of a bot suddenly sending messages nobody asked for - anyone who has
  the token can call the Bot API directly, with no code from this repo
  involved at all. See `VERCEL_DEPLOYMENT.md` step 0.
- The webhook handler (`api/telegram.ts`) supports an optional
  `WEBHOOK_SECRET` that Telegram echoes back on every request, so the
  endpoint can reject anything that didn't actually come from Telegram.

---

## ⚠️ Read this first: what the Telegram Bot API can and cannot do

This is the single most important design constraint in this project, and it
shapes how `/sync` works.

| Capability | Available to a **bot**? |
|---|---|
| Get notified when a topic is created/renamed while the bot is present | ✅ Yes (`forum_topic_created` / `forum_topic_edited` service messages) |
| Receive files/messages posted inside a topic while the bot is present | ✅ Yes, via `message_thread_id` |
| **List all topics that already exist in a forum** | ❌ **No.** This is `channels.getForumTopics` / `messages.getForumTopics` in Telegram's API, and its own docs say *"Only users can use this method"* — it is **MTProto/user-account only**, not exposed to Bot API tokens at all. |
| **Fetch old message history** (files sent before the bot joined) | ❌ **No.** The Bot API has no chat-history-fetching method for bots. |

**Consequence:** this bot cannot retroactively "discover" topics or files
that existed *before* it was added to the group. It only ever learns about
things that happen while it's present and receiving updates. This is a
Telegram platform limitation, not a shortcut taken in this codebase.

**What this means practically:**
- Any topic/category/content type/file created **after** the bot is added
  and correctly configured (see `SETUP.md`) is picked up **immediately, live**
  — no `/sync` needed.
- For topics that **already existed** before adding the bot, `/sync` will
  **not** find them by itself (it can't ask Telegram for a topic list).
  Instead, either:
  1. Rename each old topic once (even to its own name) — this fires
     `forum_topic_edited`, which the bot *does* receive, registering it
     retroactively; forward any old files you want archived into that
     topic once, or
  2. Use the optional, clearly-labeled advanced script in
     `scripts/README.mtproto-optional.md` (uses a real user-account login,
     carries real risk — read it before using it).
- `/sync` itself is a **reconciliation pass**, not a Telegram fetch: it
  re-parses any topic still marked "uncategorized" (e.g. if you renamed it to
  fix a typo) and self-heals the hierarchy tree. See `src/services/syncService.ts`
  for the exact logic and reasoning, spelled out in comments.

---

## Architecture

```
api/
  telegram.ts    Vercel Serverless Function - the ONLY thing Telegram talks to
                 in production. Always answers 200 (see comments in the file
                 for why), dedupes retried updates via ProcessedUpdate, and
                 lazily creates+caches one Telegraf bot instance per warm
                 container so handlers are registered exactly once.
src/
  index.ts       LOCAL/POLLING entrypoint only (`npm run dev` / `npm start`).
                 Never used on Vercel - refuses to start if BOT_MODE=webhook.
  bot/
    commands/    /start, /search, /admin, /sync, /stats
    callbacks/   single router for all inline-button presses
    keyboards/   inline keyboard builders (no hardcoded button sets - built from DB nodes)
    handlers/    topic-created/edited events, file-received events, user tracking, rendering
  services/
    topicService.ts    parses topic names, grows the HierarchyNode tree
    syncService.ts      reconciliation pass + admin stats
    archiveService.ts   read-side: browse the tree, list files
    searchService.ts    free-text search across files
  database/
    models/      HierarchyNode (generic tree), Topic, ArchiveFile, User, SyncLog,
                 ProcessedUpdate (webhook idempotency guard, TTL-cleaned after 3 days)
    connection.ts  caches the MongoDB connection across warm serverless
                   invocations instead of reconnecting on every request
  utils/
    topicParser.ts   the only place that knows the "4 segments" format - purely structural, no fixed vocab
    normalizer.ts    text normalization so "Anatomy"/"anatomy"/"  Anatomy " are the same node
    emoji.ts         PRESENTATION ONLY icon picker - never used for grouping logic
    callbackData.ts  short, safe callback_data encode/decode (Telegram's 64-byte limit)
    pagination.ts
    validators.ts
    logger.ts        console-only logging (no local log files - Vercel's filesystem isn't persistent)
  config/        env var loading + validation
scripts/
  set-webhook.ts               registers/inspects/deletes the Telegram webhook against your Vercel URL
  simulate-hierarchy-test.ts   standalone script proving the dynamic-discovery
                               scenario works with zero code changes (run with
                               `npx ts-node --transpile-only scripts/simulate-hierarchy-test.ts`)
  README.mtproto-optional.md   optional/advanced historical-import notes
```

### Why one generic `HierarchyNode` collection instead of `Year`/`Subject`/etc. models

A single schema with a `level` field (`year|semester|category|contentType`)
and a `parentId` pointer is what makes "no hardcoded categories" literally
true at the database level, not just at the UI level: a new category is just
a new document, never a new collection, enum value, or code path.

### Data flow for a new topic
```
Telegram: admin creates topic "سنة ثانية | ترم ثاني | Pharmacology | امتحانات"
   → forum_topic_created update arrives at the bot
   → topicEvents.ts calls topicService.upsertTopicFromTelegram()
   → parseTopicName() splits on "|", normalizes each segment
   → ensureHierarchyNodes() walks Year→Semester→Category→ContentType,
     get-or-creating each HierarchyNode (MongoDB upsert, race-safe)
   → Topic document saved with status "parsed" and node references
   → immediately visible in /start's menus - no restart, no /sync
```

### Data flow for a new file
```
Telegram: someone posts a PDF inside that topic
   → message with message_thread_id arrives at the bot
   → fileEvents.ts looks up the Topic by (chatId, message_thread_id)
   → if parsed, an ArchiveFile document is created, denormalized with
     year/semester/category/contentType strings + the leaf node id
   → immediately searchable and browsable
```

## Uncategorized topics

Any topic whose name doesn't split into exactly 4 non-empty `|`-separated
segments is stored with `status: "uncategorized"` and a human-readable
`parseFailReason`, and is **never** guessed at. Admins see these under
`/admin` → "⚠️ Uncategorized Topics" and can fix them by renaming the topic
in Telegram (which re-registers it automatically).

## Supporting fewer/more than 4 levels later

`src/utils/topicParser.ts` defines the level list as a single array:
```ts
export const LEVEL_KEYS = ['year', 'semester', 'category', 'contentType'] as const;
```
Everything else in the codebase (hierarchy building, keyboards, breadcrumbs)
iterates over this array generically — it has no idea there are "4" levels,
just "however many `LEVEL_KEYS` says." Changing depth is a change to this one
array (plus `MIN_LEVELS`/`MAX_LEVELS` if you want variable-depth topics).

See `SETUP.md` for installation, configuration, and testing instructions.
