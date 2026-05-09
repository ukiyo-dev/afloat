export function parseDurationInput(value: FormDataEntryValue | null): number | null {
  if (typeof value !== "string") {
    return null;
  }

  const input = value.trim().toLowerCase();
  if (input === "") {
    return null;
  }
  if (/^\d+$/.test(input)) {
    return Number.parseInt(input, 10);
  }

  const compact = input.replace(/\s+/g, "");
  const match = compact.match(/^(?:(\d+)h)?(?:(\d+)m)?$/);
  if (!match || (!match[1] && !match[2])) {
    throw new Error("expectedMinutes must be minutes or duration like 1h30m.");
  }

  const hours = match[1] ? Number.parseInt(match[1], 10) : 0;
  const minutes = match[2] ? Number.parseInt(match[2], 10) : 0;
  return hours * 60 + minutes;
}
