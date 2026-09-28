import 'dotenv/config';

/**
 * Usage:
 *   npm run set-webhook -- set https://your-project.vercel.app
 *   npm run set-webhook -- set              (uses WEBHOOK_DOMAIN from .env)
 *   npm run set-webhook -- info
 *   npm run set-webhook -- delete
 *
 * Reads BOT_TOKEN from the environment (.env locally, or export it in your
 * shell) - never pass it on the command line where it could end up in
 * shell history.
 */

const BOT_TOKEN = process.env.BOT_TOKEN;
if (!BOT_TOKEN) {
  console.error('❌ BOT_TOKEN is not set. Add it to .env or export it before running this script.');
  process.exit(1);
}

const API_BASE = `https://api.telegram.org/bot${BOT_TOKEN}`;

function redactToken(url: string): string {
  return url.replace(BOT_TOKEN!, '***REDACTED***');
}

async function callTelegram(method: string, params?: Record<string, string>) {
  const url = new URL(`${API_BASE}/${method}`);
  if (params) {
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  }
  const res = await fetch(url.toString());
  const json: any = await res.json();
  if (!json.ok) {
    throw new Error(`Telegram API error on ${method}: ${JSON.stringify(json)}`);
  }
  return json.result;
}

async function main() {
  const [, , rawAction, rawUrlArg] = process.argv;
  const action = rawAction || 'set';

  if (action === 'info') {
    const info = await callTelegram('getWebhookInfo');
    console.log('Current webhook info:');
    console.log(JSON.stringify(info, null, 2));
    return;
  }

  if (action === 'delete') {
    await callTelegram('deleteWebhook', { drop_pending_updates: 'true' });
    console.log('✅ Webhook deleted. The bot will not receive any updates until you set one again.');
    return;
  }

  if (action === 'set') {
    const domain = (rawUrlArg || process.env.WEBHOOK_DOMAIN || '').trim().replace(/\/+$/, '');
    if (!domain) {
      console.error(
        '❌ No target URL given. Pass it as an argument (npm run set-webhook -- set https://your-app.vercel.app) ' +
          'or set WEBHOOK_DOMAIN in .env.'
      );
      process.exit(1);
    }
    if (!/^https:\/\//i.test(domain)) {
      console.error('❌ The URL must start with https:// - Telegram refuses plain http:// webhooks.');
      process.exit(1);
    }

    const webhookUrl = `${domain}/api/telegram`;
    const params: Record<string, string> = {
      url: webhookUrl,
      // Only receive update types the bot actually handles - reduces
      // needless invocations (e.g. skip "chat_member" spam in large groups).
      allowed_updates: JSON.stringify(['message', 'callback_query', 'my_chat_member']),
    };

    const secret = process.env.WEBHOOK_SECRET;
    if (secret) {
      params.secret_token = secret;
    } else {
      console.warn(
        '⚠️  WEBHOOK_SECRET is not set - the webhook will be registered without a secret token. ' +
          'This still works, but anyone who discovers your URL could POST fake updates to it. ' +
          'Recommended: set WEBHOOK_SECRET in .env and in your Vercel project, then rerun this script.'
      );
    }

    await callTelegram('setWebhook', params);
    console.log(`✅ Webhook registered: ${redactToken(webhookUrl)}`);

    const info = await callTelegram('getWebhookInfo');
    console.log('\nConfirmed webhook info:');
    console.log(JSON.stringify(info, null, 2));
    return;
  }

  console.error(`Unknown action "${action}". Use: set | info | delete`);
  process.exit(1);
}

main().catch((err) => {
  console.error('❌', err instanceof Error ? err.message : err);
  process.exit(1);
});
