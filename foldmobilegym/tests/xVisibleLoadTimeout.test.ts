import { describe, expect, it, vi } from 'vitest';
import { createVisibleLoadTimeout } from '../apps/X/utils/visibleLoadTimeout';

function fixture() {
  let now = 0;
  const tasks: { callback: () => void; delay: number; id: number }[] = [];
  const cancel = vi.fn(), expire = vi.fn();
  const controller = createVisibleLoadTimeout(expire, 5000, {
    now: () => now, schedule: (callback, delay) => { const id = tasks.length; tasks.push({ callback, delay, id }); return id; }, cancel,
  });
  return { controller, tasks, cancel, expire, at: (time: number) => { now = time; } };
}
describe('X image visible loading budget', () => {
  it('starts only on visibility, and repeated visible notifications do not extend it', () => {
    const f = fixture(); expect(f.tasks).toHaveLength(0);
    f.controller.resume(); f.at(1000); f.controller.resume();
    expect(f.tasks).toHaveLength(1); expect(f.tasks[0].delay).toBe(5000);
  });
  it('pauses rather than discarding the elapsed visible time', () => {
    const f = fixture(); f.controller.resume(); f.at(1800); f.controller.pause();
    expect(f.cancel).toHaveBeenCalledWith(0);
    f.at(10000); f.controller.resume(); expect(f.tasks[1].delay).toBe(3200);
  });
  it('charges no additional time for repeated hidden notifications', () => {
    const f = fixture(); f.controller.resume(); f.at(1000); f.controller.pause();
    f.at(9000); f.controller.pause(); f.controller.resume(); expect(f.tasks[1].delay).toBe(4000);
  });
  it('cannot be starved by repeated foreground visits', () => {
    const f = fixture(); f.controller.resume(); f.at(1800); f.controller.pause();
    f.at(10000); f.controller.resume(); f.at(11800); f.controller.pause();
    f.at(20000); f.controller.resume(); expect(f.tasks[2].delay).toBe(1400);
    f.at(21400); f.tasks[2].callback(); expect(f.expire).toHaveBeenCalledTimes(1);
    f.controller.resume(); expect(f.tasks).toHaveLength(3);
  });
  it('ignores canceled callbacks after pause or a new active interval', () => {
    const f = fixture(); f.controller.resume(); f.at(1000); f.controller.pause(); f.controller.resume();
    f.tasks[0].callback(); expect(f.expire).not.toHaveBeenCalled();
    f.tasks[1].callback(); expect(f.expire).toHaveBeenCalledTimes(1);
    f.tasks[1].callback(); expect(f.expire).toHaveBeenCalledTimes(1);
  });
  it('disposes permanently and rejects late callbacks after source/phase cleanup', () => {
    const f = fixture(); f.controller.resume(); f.controller.dispose();
    f.tasks[0].callback(); f.controller.resume(); expect(f.expire).not.toHaveBeenCalled(); expect(f.tasks).toHaveLength(1);
    const nextPhase = fixture(); nextPhase.controller.resume(); expect(nextPhase.tasks[0].delay).toBe(5000);
  });
  it('clamps exhausted budgets to zero without adding time after a clock rewind', () => {
    const f = fixture(); f.at(1000); f.controller.resume(); f.at(500); f.controller.pause();
    f.controller.resume(); expect(f.tasks[1].delay).toBe(5000);
    f.at(7000); f.controller.pause(); f.controller.resume(); expect(f.tasks[2].delay).toBe(0);
  });
});
