import { describe, expect, it } from 'vitest';
import { isExpectedMeetingDetail, meetingFactRequirements } from '../foldagent_meeting_source';

const one = { id: 'sched-1', meetingId: '123 456 789', status: 'pending' };
const two = { id: 'sched-2', meetingId: '234 567 890', status: 'pending' };
const state = { scheduledMeetings: [one, two], currentScheduledMeeting: one };
describe('scheduled meeting source identity', () => {
  it('accepts the correct pending detail by internal ID or unique public number', () => {
    expect(isExpectedMeetingDetail('/meeting/detail', one.id, state)).toBe(true);
    expect(isExpectedMeetingDetail('/meeting/detail?dialog=actions', one.meetingId, state)).toBe(true);
  });
  it('rejects home, editing, history and unrelated route prefixes', () => {
    for (const route of ['/', '/meeting/edit', '/history/detail', '/meeting/details', '/meeting/detail/other']) {
      expect(isExpectedMeetingDetail(route, one.id, state)).toBe(false);
    }
  });
  it('rejects wrong selection, missing selection and removed targets', () => {
    expect(isExpectedMeetingDetail('/meeting/detail', two.id, state)).toBe(false);
    expect(isExpectedMeetingDetail('/meeting/detail', one.id, { ...state, currentScheduledMeeting: null })).toBe(false);
    expect(isExpectedMeetingDetail('/meeting/detail', one.id, { ...state, scheduledMeetings: [two] })).toBe(false);
  });
  it('rejects ambiguous numbers and collisions between public and internal identifiers', () => {
    expect(isExpectedMeetingDetail('/meeting/detail', one.meetingId,
      { ...state, scheduledMeetings: [one, { ...two, meetingId: one.meetingId }] })).toBe(false);
    expect(isExpectedMeetingDetail('/meeting/detail', one.id,
      { ...state, scheduledMeetings: [one, { ...two, meetingId: one.id }] })).toBe(false);
  });
  it('rejects non-pending and malformed targets without throwing', () => {
    for (const status of ['cancelled', 'ended', 'ongoing', undefined]) {
      expect(isExpectedMeetingDetail('/meeting/detail', one.id,
        { ...state, scheduledMeetings: [{ ...one, status }] })).toBe(false);
    }
    for (const expected of [null, undefined, '', ' ', [], 1]) {
      expect(isExpectedMeetingDetail('/meeting/detail', expected, state)).toBe(false);
    }
    for (const app of [null, {}, { scheduledMeetings: null }, { scheduledMeetings: [null], currentScheduledMeeting: {} }]) {
      expect(isExpectedMeetingDetail('/meeting/detail', one.id, app)).toBe(false);
    }
  });
});

describe('meeting fact delivery requirements', () => {
  const meeting = { ...one, title: 'Planning', startTime: 60000, duration: 30 };
  const app = { scheduledMeetings: [null, meeting], currentScheduledMeeting: meeting };
  const format = (value: number) => ({ time: `time:${value}`, date: `date:${value}` });
  it('requires subject, public number and both full date/time pairs', () => {
    const result = meetingFactRequirements('/meeting/detail', one.id, app, format)!;
    expect(result.facts.map(fact => fact.field)).toEqual(['subject', 'number', 'start_time', 'start_date', 'end_time', 'end_date']);
    expect(result.facts.map(fact => fact.text)).toEqual(['Planning', one.meetingId, 'time:60000', 'date:60000', 'time:1860000', 'date:1860000']);
  });
  it('binds every fact key to current identity and all source facts', () => {
    const original = meetingFactRequirements('/meeting/detail', one.id, app, format)!;
    for (const change of [{ title: 'Other' }, { meetingId: '999' }, { startTime: 120000 }, { duration: 45 }]) {
      const updated = { ...meeting, ...change };
      const next = meetingFactRequirements('/meeting/detail', one.id,
        { scheduledMeetings: [updated], currentScheduledMeeting: updated }, format)!;
      expect(next.facts.every(fact => !original.facts.some(old => old.key === fact.key))).toBe(true);
    }
  });
  it('does not derive facts for a wrong object or invalid source data', () => {
    expect(meetingFactRequirements('/', one.id, app, format)).toBeNull();
    expect(meetingFactRequirements('/meeting/detail', two.id, app, format)).toBeNull();
    for (const change of [{ title: '' }, { meetingId: '' }, { startTime: NaN }, { startTime: 1e20 }, { duration: 0 }, { duration: Infinity }]) {
      const updated = { ...meeting, ...change };
      expect(meetingFactRequirements('/meeting/detail', one.id,
        { scheduledMeetings: [updated], currentScheduledMeeting: updated }, format)).toBeNull();
    }
    expect(meetingFactRequirements('/meeting/detail', one.id, app, () => ({ time: '', date: '' }))).toBeNull();
  });
});
