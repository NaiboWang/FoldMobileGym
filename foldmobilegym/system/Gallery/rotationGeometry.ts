export function rotationGeometry(width: number, height: number, turns: number) {
  if (![width, height, turns].every(Number.isSafeInteger) || width < 1 || height < 1) throw new TypeError('Invalid rotation geometry');
  const quarterTurns = ((turns % 4) + 4) % 4;
  return { width: quarterTurns % 2 ? height : width, height: quarterTurns % 2 ? width : height, quarterTurns };
}

/** Refuse animation flattening. PNG acTL is the W3C PNG animation-control chunk.
 * https://www.w3.org/TR/png/#acTL-chunk . The browser still validates raster data. */
export function isStillRotationSource(bytes: Uint8Array, mime: string): boolean {
  const type = mime.split(';')[0].trim().toLowerCase();
  if (type === 'image/jpeg') return bytes.length >= 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  if (type !== 'image/png' || bytes.length < 20 || ![137,80,78,71,13,10,26,10].every((value,index) => bytes[index] === value)) return false;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  for (let offset = 8; offset + 12 <= bytes.length;) {
    const length = view.getUint32(offset);
    if (length > bytes.length - offset - 12) return false;
    const name = String.fromCharCode(...bytes.slice(offset + 4, offset + 8));
    if (name === 'acTL') return false;
    if (name === 'IEND') return length === 0;
    offset += length + 12;
  }
  return false;
}
