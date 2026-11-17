export interface SmsHoldPointer { pointerId: number; clientX: number; clientY: number; button: number; isPrimary: boolean }

/** One pending pointer gesture per list; never captures the pointer or prevents native scrolling. */
export function createSmsConversationHold() {
  type Press = Pick<SmsHoldPointer, 'pointerId' | 'clientX' | 'clientY'>;
  let press: Press | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let suppressClick = false;
  const clear = () => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
    press = null;
  };
  const cancel = (pointerId?: number) => {
    if (pointerId !== undefined && press?.pointerId !== pointerId) return;
    if (press) suppressClick = true;
    clear();
  };
  return {
    start(pointer: SmsHoldPointer, canOpen: () => boolean, open: () => void) {
      const hadPress = press !== null;
      cancel();
      suppressClick = false;
      if (!pointer.isPrimary || pointer.button !== 0 || !Number.isFinite(pointer.clientX) || !Number.isFinite(pointer.clientY)) {
        suppressClick = hadPress;
        return;
      }
      const source = { pointerId: pointer.pointerId, clientX: pointer.clientX, clientY: pointer.clientY };
      press = source;
      timer = setTimeout(() => {
        timer = null;
        if (press !== source) return;
        press = null;
        suppressClick = true;
        if (canOpen()) open();
      }, 500);
    },
    move(pointer: Pick<SmsHoldPointer, 'pointerId' | 'clientX' | 'clientY'>) {
      if (press && press.pointerId === pointer.pointerId && Math.hypot(pointer.clientX - press.clientX, pointer.clientY - press.clientY) > 8) cancel();
    },
    end(pointerId: number) {
      if (press?.pointerId === pointerId) clear();
    },
    cancel,
    consumeClick() {
      const suppressed = suppressClick;
      suppressClick = false;
      return suppressed;
    },
  };
}
