export interface MapPressPoint {
  pointerId: number;
  clientX: number;
  clientY: number;
  button: number;
  isPrimary: boolean;
}
export interface MapClientPoint { clientX: number; clientY: number }

/** Read normalized SDK click metadata; continuous tracking uses PointerEvent only. */
export function mapClickClientPoint(event: unknown): MapClientPoint | null {
  if (!event || typeof event !== 'object') return null;
  const value = event as Partial<MapClientPoint> & { changedTouches?: ArrayLike<MapClientPoint> };
  const point = typeof value.clientX === 'number' && typeof value.clientY === 'number' ? value : value.changedTouches?.[0];
  return point && Number.isFinite(point.clientX) && Number.isFinite(point.clientY)
    ? { clientX: point.clientX!, clientY: point.clientY! } : null;
}

/** One physical gesture creates at most one pin; its release is not another tap. */
export class MapLongPressGesture {
  private pointers = new Set<number>();
  private pending: { point: MapPressPoint; timer: ReturnType<typeof setTimeout> } | null = null;
  private consumed: { pointerId: number; point: MapClientPoint; endedAt: number | null } | null = null;
  constructor(private readonly now: () => number, private readonly delay = 800, private readonly slop = 8) {}

  down(point: MapPressPoint, fire: (() => boolean) | null): void {
    this.pointers.add(point.pointerId); this.cancelPending(); this.consumed = null;
    if (this.pointers.size !== 1 || !point.isPrimary || point.button !== 0 || !fire
      || !Number.isFinite(point.clientX) || !Number.isFinite(point.clientY)) return;
    // Native PointerEvent coordinates are prototype accessors, not enumerable own fields.
    const start: MapPressPoint = { pointerId: point.pointerId, clientX: point.clientX, clientY: point.clientY,
      button: point.button, isPrimary: point.isPrimary };
    const attempt = { point: start, timer: undefined as unknown as ReturnType<typeof setTimeout> };
    attempt.timer = setTimeout(() => {
      if (this.pending !== attempt) return;
      this.pending = null;
      if (fire()) this.consumed = { pointerId: start.pointerId, point: { clientX: start.clientX, clientY: start.clientY }, endedAt: null };
    }, this.delay);
    this.pending = attempt;
  }
  move(point: MapPressPoint): void {
    if (!this.pending || this.pending.point.pointerId !== point.pointerId) return;
    if (Math.hypot(point.clientX - this.pending.point.clientX, point.clientY - this.pending.point.clientY) > this.slop) this.cancelPending();
  }
  up(point: MapPressPoint): void {
    this.pointers.delete(point.pointerId);
    if (this.pending?.point.pointerId === point.pointerId) this.cancelPending();
    if (this.consumed?.pointerId === point.pointerId) {
      this.consumed.point = { clientX: point.clientX, clientY: point.clientY }; this.consumed.endedAt = this.now();
    }
  }
  cancel(pointerId: number): void {
    this.pointers.delete(pointerId);
    if (this.pending?.point.pointerId === pointerId) this.cancelPending();
    if (this.consumed?.pointerId === pointerId) this.consumed = null;
  }
  cancelPending(): void {
    if (this.pending) clearTimeout(this.pending.timer);
    this.pending = null;
  }
  consumeClick(point: MapClientPoint | null): boolean {
    const consumed = this.consumed;
    if (!consumed || consumed.endedAt === null || !point) return false;
    const elapsed = this.now() - consumed.endedAt;
    if (elapsed < 0 || elapsed > 1000) { this.consumed = null; return false; }
    if (Math.hypot(point.clientX - consumed.point.clientX, point.clientY - consumed.point.clientY) > 12) return false;
    this.consumed = null; return true;
  }
  reset(): void { this.cancelPending(); this.pointers.clear(); this.consumed = null; }
}
