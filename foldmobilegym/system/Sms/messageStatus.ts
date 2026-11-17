export type SmsMessageStatusKey = 'status_sending' | 'status_sent' | 'status_delivered' | 'status_read' | 'status_failed' | 'status_unknown';

/** Display only the provider's actual state; never promote a failure to Sent. */
export function smsMessageStatusKey(status: unknown): SmsMessageStatusKey | undefined {
  if (status === undefined || status === null || status === '') return undefined;
  switch (status) {
    case 'sending': return 'status_sending';
    case 'sent': return 'status_sent';
    case 'delivered': return 'status_delivered';
    case 'read': return 'status_read';
    case 'failed': return 'status_failed';
    default: return 'status_unknown';
  }
}
