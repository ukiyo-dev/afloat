const SEQUENCE_PATTERN = /(?:^|\s)(\d+)$/u;

export function compactActivityTitle(title: string): string | null {
  return title.trim().match(SEQUENCE_PATTERN)?.[1] ?? null;
}
