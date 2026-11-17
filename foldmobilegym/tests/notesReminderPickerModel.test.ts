import { describe, expect, it } from 'vitest';

const NOW_TS = new Date(2026, 3, 22, 23, 26).getTime();

describe('Notes 提醒时间选择模型', () => {
  it('会把非 5 分钟刻度向上取整', async () => {
    const { roundUpToReminderStep } = await import('../system/Notes/components/dateTimePickerModel');

    expect(roundUpToReminderStep(new Date(2026, 3, 22, 23, 18).getTime())).toBe(
      new Date(2026, 3, 22, 23, 20).getTime(),
    );
    expect(roundUpToReminderStep(new Date(2026, 3, 22, 23, 20).getTime())).toBe(
      new Date(2026, 3, 22, 23, 20).getTime(),
    );
  });

  it('以上午 00:00 的今天为锚点计算最晚可选时间', async () => {
    const { getReminderBounds } = await import('../system/Notes/components/dateTimePickerModel');

    expect(getReminderBounds(NOW_TS)).toEqual({
      minTs: new Date(2026, 3, 22, 23, 30).getTime(),
      maxTs: new Date(2027, 3, 23, 11, 55).getTime(),
    });
  });

  it('会把初始提醒时间夹到当前可选范围内', async () => {
    const { clampReminderSelection } = await import('../system/Notes/components/dateTimePickerModel');

    expect(
      clampReminderSelection(new Date(2026, 3, 22, 21, 3).getTime(), NOW_TS),
    ).toBe(new Date(2026, 3, 22, 23, 30).getTime());

    expect(
      clampReminderSelection(new Date(2027, 3, 25, 9, 0).getTime(), NOW_TS),
    ).toBe(new Date(2027, 3, 23, 11, 55).getTime());
  });
  it.each([[2026, 2, 7], [2026, 9, 31]])(
    'enumerates each local calendar day once across clock changes (%s-%s-%s)',
    async (year, month, day) => {
      const { getReminderBounds, getReminderDateOptions, startOfLocalDay } = await import('../system/Notes/components/dateTimePickerModel');
      const now = new Date(year, month, day, 12, 0).getTime();
      const options = getReminderDateOptions(now);
      const expected = new Date(year, month, day);
      expect(options).toHaveLength(367);
      for (const option of options) {
        expect(option.value).toBe(expected.getTime());
        expected.setDate(expected.getDate() + 1);
      }
      expect(options.at(-1)?.value).toBe(startOfLocalDay(getReminderBounds(now).maxTs));
    },
  );

});
