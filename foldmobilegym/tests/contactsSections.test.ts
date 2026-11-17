import { describe, expect, it } from 'vitest';
import { contactSectionKey } from '../system/Contacts/utils/contactSections';

describe('contact directory section', () => {
  it.each([
    ['阿明', 'A'], ['陈晨', 'C'], ['李明', 'L'], ['王华', 'W'], ['张伟', 'Z'],
    ['哒测试', 'D'], ['婀测试', 'E'], ['嘎测试', 'G'], ['咔测试', 'K'],
    ['噢测试', 'O'], ['趴测试', 'P'], ['七测试', 'Q'], ['仨测试', 'S'], ['他测试', 'T'], ['西测试', 'X'],
    ['Alice', 'A'], ['bob', 'B'], ['123456', '#'], ['🙂', '#'], ['', '#'],
  ])('groups %s as %s', (displayName, expected) => {
    expect(contactSectionKey({ displayName })).toBe(expected);
  });
  it('prioritizes an explicit section, then a supplied Latin sort key', () => {
    expect(contactSectionKey({ displayName: '陈晨', sectionKey: 'Q', sortKey: 'chen' })).toBe('Q');
    expect(contactSectionKey({ displayName: '陈晨', sortKey: 'zhang' })).toBe('Z');
    expect(contactSectionKey({ displayName: '陈晨', sectionKey: 'invalid' })).toBe('C');
  });
});
