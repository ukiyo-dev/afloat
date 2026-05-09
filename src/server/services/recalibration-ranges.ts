const DEFAULT_RECALIBRATE_MAX_YEARS = 50;

export function* recalibrationRanges(
  now: Date,
  maxYears = DEFAULT_RECALIBRATE_MAX_YEARS
): Generator<{ startAt: Date; endAt: Date }> {
  yield* recalibrationRangesForDirection(now, -1, maxYears);
  yield* recalibrationRangesForDirection(now, 1, maxYears);
}

export function* recalibrationRangesForDirection(
  now: Date,
  direction: -1 | 1,
  maxYears: number
): Generator<{ startAt: Date; endAt: Date }> {
  for (let year = 0; year < maxYears; year += 1) {
    const near = addYears(now, direction * year);
    const far = addYears(now, direction * (year + 1));

    yield direction === -1
      ? { startAt: far, endAt: near }
      : { startAt: near, endAt: far };
  }
}

export function addYears(date: Date, years: number): Date {
  const next = new Date(date);
  next.setUTCFullYear(next.getUTCFullYear() + years);
  return next;
}
