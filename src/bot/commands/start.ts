import { Context } from 'telegraf';
import { renderHome } from '../handlers/render';

export async function startCommand(ctx: Context) {
  await ctx.reply(
    'أهلاً بك في أرشيف المذاكرة 📚\nكل الأقسام هنا تُكتشف تلقائيًا من التوبيكات في الجروب - لا حاجة لأي إعداد يدوي عند إضافة مادة أو قسم جديد.'
  );
  await renderHome(ctx);
}
