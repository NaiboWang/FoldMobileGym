/** Skip only consecutive history entries belonging to the deleted event. */
export function calendarDeletionBackSteps(entries: readonly { pathname: string }[] | undefined, index: number, detailPath: string): number {
  let target = Math.max(0, index - 1);
  while (target > 0 && (entries?.[target]?.pathname === detailPath || entries?.[target]?.pathname === `${detailPath}/edit`)) target--;
  return Math.max(1, index - target);
}
