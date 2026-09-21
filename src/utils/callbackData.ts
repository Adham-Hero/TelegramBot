/**
 * Telegram limits callback_data to 64 bytes, so we never embed free text
 * (topic names, search queries) in it - only short action codes + Mongo
 * ObjectIds (24 hex chars) + small page numbers. Anything free-text
 * (like the current search query) is looked up server-side from a
 * per-user session document instead of round-tripping through the button.
 */

export type CallbackAction =
  | 'home'
  | 'node' // browse into a hierarchy node (or list files if it's a leaf)
  | 'file' // resend a specific file
  | 'search_page' // paginate the last search results
  | 'admin_menu'
  | 'admin_sync'
  | 'admin_stats'
  | 'admin_uncat'; // paginate uncategorized topics list

const SEP = ':';

export interface DecodedCallback {
  action: CallbackAction;
  id?: string;
  page?: number;
}

export function encodeCallback(action: CallbackAction, id?: string, page?: number): string {
  const parts: string[] = [action];
  if (id !== undefined) parts.push(id);
  if (page !== undefined) parts.push(String(page));
  const data = parts.join(SEP);
  if (Buffer.byteLength(data, 'utf8') > 64) {
    throw new Error(`callback_data too long (${data.length} chars): ${data}`);
  }
  return data;
}

export function decodeCallback(data: string): DecodedCallback {
  const [action, second, third] = data.split(SEP);
  const decoded: DecodedCallback = { action: action as CallbackAction };

  // node/file use `second` as an id; search_page/admin_uncat use it as a page
  if (['node', 'file', 'admin_uncat'].includes(action) && second !== undefined) {
    if (action === 'admin_uncat') {
      decoded.page = Number(second);
    } else {
      decoded.id = second;
    }
  }
  if (third !== undefined) decoded.page = Number(third);
  if (action === 'search_page' && second !== undefined) decoded.page = Number(second);

  return decoded;
}
