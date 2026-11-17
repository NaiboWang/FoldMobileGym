export interface SmsComposeDraft {
  recipient: string;
  body: string;
  boundPhone: string | null;
}

// Explicit incoming text is a separate compose request, not permission to overwrite
// an unfinished ordinary message to the same address.
export const smsComposeDraftKey = (address: string, body: string) =>
  JSON.stringify([address.replace(/\s/g, ''), body]);

export function patchSmsComposeDraft(
  drafts: Record<string, SmsComposeDraft> | undefined,
  key: string,
  seed: SmsComposeDraft,
  patch: Partial<SmsComposeDraft>,
): Record<string, SmsComposeDraft> {
  return { ...drafts, [key]: { ...(drafts?.[key] ?? seed), ...patch } };
}
