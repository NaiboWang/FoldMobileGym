/** Visible rows only; never normalize or truncate the authored message body. */
export function smsComposeRows(text: string): number {
  return Math.min(4, Math.max(1, text.split(/\r\n|\r|\n/).length));
}
