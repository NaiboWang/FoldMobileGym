/** Controller-only scheduled-meeting identity; does not certify visible facts. */
export function isExpectedMeetingDetail(route: string, expected: unknown, state: unknown): boolean {
  if (!/^\/meeting\/detail(?:[?#].*)?$/.test(route) || typeof expected !== 'string' || !expected.trim()) return false;
  if (!state || typeof state !== 'object') return false;
  const app = state as { scheduledMeetings?: unknown; currentScheduledMeeting?: unknown };
  if (!Array.isArray(app.scheduledMeetings) || !app.currentScheduledMeeting
    || typeof app.currentScheduledMeeting !== 'object') return false;
  const current = app.currentScheduledMeeting as { id?: unknown };
  const matches = app.scheduledMeetings.filter(row => row && typeof row === 'object'
    && (row.id === expected || row.meetingId === expected));
  // Public meeting numbers and internal IDs are supported only when unambiguous.
  return matches.length === 1 && typeof matches[0].id === 'string'
    && matches[0].id.length > 0 && matches[0].id === current.id
    && matches[0].status === 'pending';
}

export function meetingFactRequirements(route: string, expected: unknown, state: unknown,
  formatTimestamp: (timestamp: number) => { time: string; date: string }) {
  if (!isExpectedMeetingDetail(route, expected, state)) return null;
  const app = state as { scheduledMeetings: Array<{ id: string; meetingId: string; title: string; startTime: number; duration: number }> };
  const meeting = app.scheduledMeetings.find(row => row && (row.id === expected || row.meetingId === expected))!;
  if (typeof meeting.title !== 'string' || !meeting.title.trim()
    || typeof meeting.meetingId !== 'string' || !meeting.meetingId.trim()
    || !Number.isFinite(meeting.startTime) || Math.abs(meeting.startTime) > 8640000000000000
    || !Number.isFinite(meeting.duration) || meeting.duration <= 0) return null;
  const end = meeting.startTime + meeting.duration * 60000;
  if (!Number.isFinite(end) || Math.abs(end) > 8640000000000000) return null;
  const startText = formatTimestamp(meeting.startTime), endText = formatTimestamp(end);
  if (![startText.time, startText.date, endText.time, endText.date].every(text => typeof text === 'string' && text.trim())) return null;
  const signature = [meeting.id, meeting.meetingId, meeting.title, meeting.startTime, meeting.duration];
  const texts = { subject: meeting.title, number: meeting.meetingId,
    start_time: startText.time, start_date: startText.date, end_time: endText.time, end_date: endText.date };
  return { id: meeting.id, facts: Object.entries(texts).map(([field, text]) => ({
    field, text, key: JSON.stringify([...signature, field, text]),
  })) };
}
