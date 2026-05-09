import { AuthenticationError } from "@/server/services/auth-service";
import type { DashboardRangeRequest } from "@/server/services/dashboard-range";
import { recomputeCurrentOwnerViews } from "@/server/services/view-service";

export async function POST(request: Request) {
  try {
    return Response.json(await recomputeCurrentOwnerViews(rangeRequestFromUrl(request.url)));
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return Response.json({ error: error.message }, { status: 401 });
    }
    throw error;
  }
}

function rangeRequestFromUrl(url: string): DashboardRangeRequest {
  const searchParams = new URL(url).searchParams;

  return {
    range: searchParams.get("range") ?? undefined,
    date: searchParams.get("date") ?? undefined,
    start: searchParams.get("start") ?? undefined,
    end: searchParams.get("end") ?? undefined
  };
}
