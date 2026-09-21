import winston from 'winston';
import { config } from '../config';

export const logger = winston.createLogger({
  level: config.logLevel,

  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
      const metaStr = Object.keys(meta).length
        ? ` ${JSON.stringify(meta)}`
        : '';

      return `[${timestamp}] ${level.toUpperCase()}: ${
        stack || message
      }${metaStr}`;
    })
  ),

  transports: [
    // Vercel Serverless: use console logging only.
    new winston.transports.Console(),
  ],

  exitOnError: false,
});