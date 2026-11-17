import { describe, expect, it } from 'vitest';
import { createImageAttemptPool } from '../apps/X/utils/imageAttemptPool';

function fixture(options?: Parameters<typeof createImageAttemptPool>[1]) {
  let now = 0, next = 0;
  const tasks = new Map<number, { at: number; callback: () => void }>(), all: (() => void)[] = [];
  const pool = createImageAttemptPool({ now: () => now, schedule: (callback, delay) => { const id = ++next; tasks.set(id, { at: now + delay, callback }); all.push(callback); return id; }, cancel: id => { tasks.delete(id); } }, options);
  const advance = (ms: number) => {
    const end = now + ms;
    while (true) { const pending = [...tasks.entries()].sort((a, b) => a[1].at - b[1].at)[0]; if (!pending || pending[1].at > end) break; now = pending[1].at; tasks.delete(pending[0]); pending[1].callback(); }
    now = end;
  };
  return { pool, advance, tasks, all };
}
describe('Page-owned X image attempts', () => {
  it('does not start a timer until a pending consumer is visible', () => {
    const f = fixture(), entry = f.pool.get('https://example.test/image.jpg'), lease = entry.connect();
    expect(f.tasks.size).toBe(0); f.advance(100000); expect(entry.getSnapshot().phase).toBe('direct');
    lease.setVisible(true); expect(f.tasks.size).toBe(1); lease.setVisible(true); expect(f.tasks.size).toBe(1);
  });
  it('retains the proxy budget across actual virtual-row detach/remount', () => {
    const f = fixture(), entry = f.pool.get('https://example.test/image.jpg'); entry.fail('direct');
    for (let i = 0; i < 4; i++) { const lease = f.pool.get('https://example.test/image.jpg').connect(); lease.setVisible(true); f.advance(1000); lease.release(); f.advance(10000); expect(entry.getSnapshot().phase).toBe('proxy'); }
    const last = f.pool.get('https://example.test/image.jpg').connect(); last.setVisible(true); f.advance(1000);
    expect(entry.getSnapshot().phase).toBe('failed'); expect(f.tasks.size).toBe(0);
  });
  it('does not charge hidden or unmounted time', () => {
    const f = fixture(), entry = f.pool.get('/local.jpg'), lease = entry.connect(); lease.setVisible(true); f.advance(1800); lease.setVisible(false); f.advance(9000);
    expect(entry.getSnapshot().phase).toBe('direct'); lease.release(); f.advance(9000);
    const resumed = f.pool.get('/local.jpg').connect(); resumed.setVisible(true); f.advance(3199); expect(entry.getSnapshot().phase).toBe('direct'); f.advance(1); expect(entry.getSnapshot().phase).toBe('failed');
  });
  it('counts a union of duplicate visible consumers, not one budget per image', () => {
    const f = fixture(), entry = f.pool.get('/local.jpg'), a = entry.connect(), b = entry.connect(); a.setVisible(true); b.setVisible(true);
    f.advance(2000); a.release(); f.advance(2000); expect(entry.getSnapshot().phase).toBe('direct'); b.setVisible(false); f.advance(9000); b.setVisible(true); f.advance(1000); expect(entry.getSnapshot().phase).toBe('failed');
  });
  it('gives direct and proxy separate real budgets and rejects obsolete phase failures', () => {
    const f = fixture(), entry = f.pool.get('https://example.test/image.jpg'), lease = entry.connect(); lease.setVisible(true); f.advance(5000);
    expect(entry.getSnapshot().phase).toBe('proxy'); entry.fail('direct'); f.all[0](); f.advance(4999); expect(entry.getSnapshot().phase).toBe('proxy'); f.advance(1); expect(entry.getSnapshot().phase).toBe('failed');
  });
  it('stops charging a successful DOM image without disabling another pending duplicate', () => {
    const f = fixture(), entry = f.pool.get('/local.jpg'), a = entry.connect(), b = entry.connect(); a.setVisible(true); b.setVisible(true); a.loaded(); f.advance(5000); expect(entry.getSnapshot().phase).toBe('failed');
    a.release(); b.release(); expect(f.tasks.size).toBe(0);
  });
  it('creates a fresh budget for a later mount after all consumers loaded successfully', () => {
    const f = fixture(), entry = f.pool.get('/local.jpg'), lease = entry.connect(); lease.setVisible(true); lease.loaded(); lease.release();
    const next = f.pool.get('/local.jpg'); expect(next).not.toBe(entry); const newLease = next.connect(); newLease.setVisible(true); f.advance(4999); expect(next.getSnapshot().phase).toBe('direct');
  });
  it('supports effect replay without permanently disposing a pending entry', () => {
    const f = fixture(), entry = f.pool.get('/local.jpg'); const first = entry.connect(); first.setVisible(true); first.release(); const replay = entry.connect(); replay.setVisible(true); f.advance(5000); expect(entry.getSnapshot().phase).toBe('failed');
  });
  it('keeps source keys and page owners independent', () => {
    const a = fixture(), b = fixture(), source = 'https://example.test/image.jpg', first = a.pool.get(source), second = a.pool.get(source + '?replacement=1'), foreign = b.pool.get(source);
    first.fail('direct'); first.fail('proxy'); expect(second.getSnapshot().phase).toBe('direct'); expect(foreign.getSnapshot().phase).toBe('direct');
  });
  it('evicts only idle entries while an active source keeps its budget', () => {
    const f = fixture({ maxIdle: 1 }), active = f.pool.get('/active.jpg'), lease = active.connect(); lease.setVisible(true); f.advance(2000);
    const old = f.pool.get('/old.jpg'); old.connect().release(); f.advance(1); f.pool.get('/new.jpg').connect().release();
    expect(f.pool.get('/old.jpg')).not.toBe(old); expect(f.pool.get('/active.jpg')).toBe(active); f.advance(3000); expect(active.getSnapshot().phase).toBe('failed');
  });
  it('allows an inactive failed source a new attempt only after the cooldown on remount', () => {
    const f = fixture(), entry = f.pool.get('/local.jpg'), lease = entry.connect(); entry.fail('direct'); lease.release(); f.advance(29999); expect(f.pool.get('/local.jpg')).toBe(entry); f.advance(30000);
    expect(f.pool.get('/local.jpg')).not.toBe(entry);
  });
  it('does not retire controllers temporarily released during a large effect replay', () => {
    const f = fixture({ maxIdle: 1 }), a = f.pool.get('/a.jpg'), b = f.pool.get('/b.jpg');
    const firstA = a.connect(), firstB = b.connect(); firstA.setVisible(true); firstB.setVisible(true); f.advance(1000);
    firstA.release(); firstB.release();
    const replayA = a.connect(), replayB = b.connect(); replayA.setVisible(true); replayB.setVisible(true); f.advance(4000);
    expect(a.getSnapshot().phase).toBe('failed'); expect(b.getSnapshot().phase).toBe('failed');
    replayA.release(); replayB.release(); expect(f.tasks.size).toBe(0);
  });
  it('disposal cancels all active timers and rejects retained queued callbacks', () => {
    const f = fixture(), entry = f.pool.get('https://example.test/image.jpg'), lease = entry.connect(); lease.setVisible(true); f.pool.dispose(); f.all.forEach(callback => callback()); lease.setVisible(true); entry.fail('direct');
    expect(entry.getSnapshot().phase).toBe('direct'); expect(f.tasks.size).toBe(0);
  });
});

describe('Page-owned intrinsic footprint metadata', () => {
  it('retains real metadata across proxy/failure without restarting visible time', () => {
    const f = fixture(), entry = f.pool.get('https://media.example/image.png'), lease = entry.connect();
    lease.setVisible(true); f.advance(2000); entry.rememberIntrinsic({ width: 320, height: 480 });
    f.advance(2999); expect(entry.getSnapshot().phase).toBe('direct');
    entry.rememberIntrinsic({ width: 640, height: 960 }); f.advance(1);
    expect(entry.getSnapshot()).toEqual({ phase: 'proxy', intrinsicSize: { width: 640, height: 960 } });
    f.advance(5000); expect(entry.getSnapshot()).toEqual({ phase: 'failed', intrinsicSize: { width: 640, height: 960 } });
    expect(f.tasks.size).toBe(0);
  });
  it('survives virtual detach/reconnect but stays isolated from a different source', () => {
    const f = fixture(), entry = f.pool.get('https://media.example/image.png'); entry.fail('direct');
    const first = entry.connect(); first.setVisible(true); entry.rememberIntrinsic({ width: 320, height: 480 }); f.advance(1000); first.release();
    f.advance(10000); const again = f.pool.get('https://media.example/image.png');
    expect(again).toBe(entry); expect(again.getSnapshot().intrinsicSize).toEqual({ width: 320, height: 480 });
    expect(f.pool.get('https://media.example/new.png').getSnapshot().intrinsicSize).toBeUndefined();
    const next = again.connect(); next.setVisible(true); f.advance(4000); expect(again.getSnapshot().phase).toBe('failed');
  });
  it('copies metadata and avoids duplicate subscriber updates or invalid geometry', () => {
    const f = fixture(), entry = f.pool.get('/local.png'), size = { width: 320, height: 480 }; let updates = 0;
    entry.subscribe(() => { updates++; }); entry.rememberIntrinsic(size); const snapshot = entry.getSnapshot(); size.width = 1;
    expect(snapshot.intrinsicSize?.width).toBe(320); entry.rememberIntrinsic({ width: 320, height: 480 });
    entry.rememberIntrinsic({ width: NaN, height: 480 }); expect(entry.getSnapshot()).toBe(snapshot); expect(updates).toBe(1);
  });
  it('rejects metadata callbacks belonging to a disposed controller', () => {
    const f = fixture(), entry = f.pool.get('/local.png'), initial = entry.getSnapshot(); f.pool.dispose();
    entry.rememberIntrinsic({ width: 320, height: 480 }); expect(entry.getSnapshot()).toBe(initial);
  });
});
