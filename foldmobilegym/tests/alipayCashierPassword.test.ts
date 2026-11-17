import { describe, expect, it, vi } from 'vitest';
import { getCashierExpectedPassword, scheduleCashierPayment } from '../apps/Alipay/pages/CashierPage';

describe('Alipay cashier payment password', () => {
  it('uses the current Alipay account payment password instead of a standalone default', () => {
    expect(getCashierExpectedPassword({ paymentPassword: '123456' })).toBe('123456');
    expect(getCashierExpectedPassword({ paymentPassword: '654321' })).toBe('654321');
  });

  it('does not complete a pending payment after cancellation', () => {
    vi.useFakeTimers();
    try {
      const completePayment = vi.fn();
      const cancel = scheduleCashierPayment(completePayment);
      vi.advanceTimersByTime(100);
      cancel();
      vi.advanceTimersByTime(200);
      expect(completePayment).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('completes an uncancelled payment only once', () => {
    vi.useFakeTimers();
    try {
      const completePayment = vi.fn();
      scheduleCashierPayment(completePayment);
      vi.advanceTimersByTime(500);
      expect(completePayment).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });
});
