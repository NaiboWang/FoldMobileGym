import { describe, expect, it } from 'vitest';
import { findMatchingChatMessages, messageSearchText, splitSearchMatches } from '../apps/Wechat/utils/searchMessages';
import type { ChatSession, Message } from '../apps/Wechat/types';

const message = (id: string, type: Message['type'], content: string, timestamp = 1): Message => ({ id, type, content, senderId: 'fixture', timestamp });
const chat = (id: string, messages: Message[]): ChatSession => ({ id, user: { wxid: id, name: id, avatar: '/fixture.png' }, messages });

describe('WeChat local message search', () => {
  it('returns no records for a whitespace-only query', () => {
    expect(findMatchingChatMessages([chat('a', [message('1', 'text', 'meeting')])], '  ', new Set())).toEqual([]);
  });
  it('groups matches, counts records and sorts by the newest matching record without mutation', () => {
    const records = [chat('a', [message('1', 'text', 'Meeting tomorrow', 2), message('2', 'text', 'MEETING today', 4)]),
      chat('b', [message('3', 'text', 'meeting recap', 6), message('4', 'text', 'unrelated', 10)])];
    const original = JSON.stringify(records);
    const results = findMatchingChatMessages(records, ' meeting ', new Set());
    expect(results.map(r => [r.chat.id, r.count, r.preview])).toEqual([['b', 1, 'meeting recap'], ['a', 2, 'MEETING today']]);
    expect(JSON.stringify(records)).toBe(original);
  });
  it('does not reveal blocked conversations or match image paths/system messages', () => {
    const records = [chat('blocked', [message('1', 'text', 'meeting')]), chat('a', [
      message('2', 'image', '/meeting.png'), message('3', 'system', 'meeting'), message('4', 'time', 'meeting'),
    ])];
    expect(findMatchingChatMessages(records, 'meeting', new Set(['blocked']))).toEqual([]);
  });
  it('searches a file display name, not its storage path', () => {
    const file = { ...message('1', 'file', '/private/internal/report.pdf'), fileName: 'Meeting.pdf' };
    expect(messageSearchText(file)).toBe('Meeting.pdf');
    expect(findMatchingChatMessages([chat('a', [file])], 'internal', new Set())).toEqual([]);
    expect(findMatchingChatMessages([chat('a', [file])], 'meeting', new Set())[0].count).toBe(1);
  });
  it('matches Chinese text and treats regular-expression punctuation literally', () => {
    expect(splitSearchMatches('周报 周报', '周报').filter(p => p.matched)).toHaveLength(2);
    expect(splitSearchMatches('literal [a+b] text', '[a+b]')).toEqual([
      { text: 'literal ', matched: false }, { text: '[a+b]', matched: true }, { text: ' text', matched: false },
    ]);
  });
  it('preserves case and complete text in highlighted segments', () => {
    const text = 'Meeting and MEETING';
    const parts = splitSearchMatches(text, 'meeting');
    expect(parts.filter(p => p.matched).map(p => p.text)).toEqual(['Meeting', 'MEETING']);
    expect(parts.map(p => p.text).join('')).toBe(text);
  });
});
