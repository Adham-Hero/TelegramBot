import dotenv from 'dotenv';
dotenv.config();

function required(name: string): string {
  const v = process.env[name];
  if (!v || v.trim() === '') {
    throw new Error(`Missing required environment variable: ${name}. Check your .env file against .env.example.`);
  }
  return v;
}

function optionalNumber(name: string, fallback: number): number {
  const v = process.env[name];
  if (!v) return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export const config = {
  botToken: required('BOT_TOKEN'),
  adminId: Number(required('ADMIN_ID')),
  archiveGroupId: Number(required('ARCHIVE_GROUP_ID')),
  mongodbUri: required('MONGODB_URI'),
  topicSeparator: process.env.TOPIC_NAME_SEPARATOR || '|',
  pageSize: optionalNumber('PAGE_SIZE', 10),
  logLevel: process.env.LOG_LEVEL || 'info',
  botMode: (process.env.BOT_MODE as 'polling' | 'webhook') || 'polling',
  webhookDomain: process.env.WEBHOOK_DOMAIN || '',
  webhookPort: optionalNumber('WEBHOOK_PORT', 8443),
};

export type AppConfig = typeof config;
