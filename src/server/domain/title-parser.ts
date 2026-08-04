import type { ParsedTitle, QualityMark } from "./types";

const SEQUENCE_PATTERN = /(?:^|\s)(\d+)$/u;
const THREAD_PATTERN = /(?:^|\s)(?:T|始)$/u;

export function parseTitle(rawTitle: string): ParsedTitle {
  const trimmed = rawTitle.trim();
  const { quality, body } = stripQuality(trimmed);
  const sequenceMatch = body.match(SEQUENCE_PATTERN);
  const sequence = sequenceMatch ? Number.parseInt(sequenceMatch[1] ?? "", 10) : null;
  const withoutSequence = sequenceMatch
    ? body.slice(0, sequenceMatch.index).trim()
    : body.trim();
  const threadMatch = withoutSequence.match(THREAD_PATTERN);
  const titleBody = threadMatch
    ? withoutSequence.slice(0, threadMatch.index).trim()
    : withoutSequence;

  const [group, item] = splitGroupItem(titleBody);
  const reservedUntrackedItem = item === "---";

  return {
    rawTitle,
    titleBody,
    group,
    item,
    sequence: reservedUntrackedItem ? null : sequence,
    threadStart: !reservedUntrackedItem && (threadMatch !== null || sequence === 1),
    quality
  };
}

function stripQuality(value: string): { quality: QualityMark; body: string } {
  if (value.startsWith("🌟")) {
    return { quality: "excellent", body: value.slice("🌟".length).trim() };
  }

  if (value.startsWith("❔")) {
    return { quality: "uncertain", body: value.slice("❔".length).trim() };
  }

  return { quality: null, body: value };
}

function splitGroupItem(titleBody: string): [string, string] {
  const separator = titleBody.indexOf("：");
  if (separator === -1) {
    return [titleBody, titleBody];
  }

  const group = titleBody.slice(0, separator).trim();
  const item = titleBody.slice(separator + 1).trim();
  return [group, item || group];
}
