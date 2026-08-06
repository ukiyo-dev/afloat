export interface DurationParseOptions {
  allowDecimal?: boolean;
  compactWhitespace?: boolean;
}

export function parseDurationText(
  value: string,
  options: DurationParseOptions = {}
): number | null {
  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  const numberPattern = options.allowDecimal ? "\\d+(?:\\.\\d+)?" : "\\d+";
  if (new RegExp(`^${numberPattern}$`).test(normalized)) {
    return Number(normalized);
  }

  const input = options.compactWhitespace ? normalized.replace(/\s+/g, "") : normalized;
  const separator = options.compactWhitespace ? "" : "\\s*";
  const match = input.match(
    new RegExp(`^(?:(${numberPattern})h)?${separator}(?:(${numberPattern})m)?$`)
  );
  if (!match || (!match[1] && !match[2])) {
    return null;
  }

  const hours = match[1] ? Number(match[1]) : 0;
  const minutes = match[2] ? Number(match[2]) : 0;
  return hours * 60 + minutes;
}
