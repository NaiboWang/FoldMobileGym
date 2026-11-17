/** Every move, including a return above origin, updates the sheet offset. */
export function getTransferDragOffset(startY: number, currentY: number, maximum: number): number {
  return Math.max(0, Math.min(currentY - startY, Math.max(0, maximum)));
}
