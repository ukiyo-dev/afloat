import { parseDurationText } from "@/server/domain/duration";

export function parseDurationInput(value: FormDataEntryValue | null): number | null {
  if (typeof value !== "string") {
    return null;
  }

  if (value.trim() === "") {
    return null;
  }

  const parsed = parseDurationText(value, {
    compactWhitespace: true
  });
  if (parsed === null) {
    throw new Error("expectedMinutes must be minutes or duration like 1h30m.");
  }
  return parsed;
}
