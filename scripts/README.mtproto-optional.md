# Optional: one-time historical import via MTProto (advanced, use with care)

## Why this exists

The main bot (everything in `src/`) uses the official **Bot API**. As explained
in the root `README.md`, the Bot API has **no method to list a forum's
existing topics** and **no method to fetch old chat history**. That means the
bot can only see topics/files from the moment it's added onward.

If you already have **years of history** sitting in old topics before adding
the bot, and re-triggering each topic manually (renaming it once, forwarding
old files) is too tedious, the only way to pull that history programmatically
is **MTProto** - the protocol real Telegram clients use - via a **user
account**, not a bot account. Libraries: [GramJS](https://gram.js.org/) (Node)
or [Telethon](https://docs.telethon.dev/) (Python).

## Read this before you do it

- This logs in with **your own personal Telegram account** (phone number +
  login code), not the bot token. It is fundamentally different from
  everything else in this project.
- Telegram's Terms of Service restrict automating **user accounts**
  (as opposed to bot accounts, which are explicitly meant to be automated).
  Heavy or unusual automated activity on a user account can get that account
  **limited or banned**. Bots don't carry this risk; user-account scripts do.
- Because of that risk, treat this as a **one-off, manual, throttled import
  tool** you run once locally to backfill history - never as a
  permanently-running service, and never at high request rates.
- You are only ever accessing a group you are already a member of/admin of -
  this script is not for reading anyone else's private data.

## What it would do (not implemented here)

A minimal GramJS-based import script would:
1. Log in interactively with your phone number (stores a reusable session string).
2. Call `client.invoke(new Api.channels.GetForumTopics({...}))` to list all
   topics (this is the very method - `channels.getForumTopics` - that is
   marked "Only users can use this method" in Telegram's docs, confirming
   the bot really cannot do this itself).
3. For each topic, paginate through its message history and download the
   files, feeding them into the **same MongoDB models** this project already
   defines (`Topic`, `HierarchyNode`, `ArchiveFile`) via the same
   `topicService`/parsing logic, so the data lands in an identical shape to
   what the live bot produces.
4. Ideally, re-upload each file **through the bot** into its matching topic
   (or just insert the DB record pointing at the file_id you already have) so
   future `telegramFileId` lookups stay consistent with how the bot serves
   files.

## Recommended alternative (safer, no extra code, no separate login)

For most groups, it's actually less work to:
1. Open each existing topic in Telegram and rename it once (even to the exact
   same name) - Telegram sends a `forum_topic_edited` event the bot receives,
   which registers the topic immediately (see `src/bot/handlers/topicEvents.ts`).
2. Forward the important old files into their topic (or just leave them - any
   *new* file sent from now on is captured automatically; only pre-existing
   files need forwarding).
3. Run `/sync` in the bot.

This uses only the Bot API, carries none of the account-ban risk above, and
the dynamic discovery logic is identical either way.
