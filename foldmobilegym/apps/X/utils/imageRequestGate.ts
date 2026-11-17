/** A lease authorizes an exact transport binding, never a future proxy phase. */
export function permittedXImageSource(desired: string | null | undefined, permitted: string | undefined, loaded: string | undefined): string | undefined {
  if (loaded) return loaded;
  return desired && desired === permitted ? desired : undefined;
}

export function ownsXImageBinding(binding: string | null, desired: string | null | undefined, permitted: string | undefined): boolean {
  return Boolean(desired && desired === permitted && binding === desired);
}
