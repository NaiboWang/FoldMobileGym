/** One accepted UI request owns an operation until its Promise settles.
 * Already accepted global theme changes may finish after navigation; only new
 * requests need a current visible source. No persistent/task state lives here.
 */
export class ThemeApplyGate {
  private running = false;

  async run(allowed: () => boolean, operation: () => void | Promise<void>): Promise<boolean> {
    if (this.running || !allowed()) return false;
    this.running = true;
    try {
      await operation();
      return true;
    } finally {
      this.running = false;
    }
  }
}
