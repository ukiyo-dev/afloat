import type { DashboardData } from "@/server/services/dashboard-service";

type ThreadDateWindow = Pick<DashboardData["view"]["threads"][number], "start" | "deadline">;

export function isThreadInDateRange(
  thread: ThreadDateWindow,
  rangeStart: string,
  rangeEnd: string
): boolean {
  const threadStart = thread.start ?? rangeStart;
  const threadEnd = thread.deadline ?? rangeEnd;
  return threadStart <= rangeEnd && threadEnd >= rangeStart;
}
