import { AuthenticationError } from "@/server/services/auth-service";
import { syncStatusCode } from "@/server/services/sync-result";
import { syncRecalibrate } from "@/server/services/sync-service";

export async function POST() {
  try {
    const result = await syncRecalibrate();
    return Response.json(result, { status: syncStatusCode(result) });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return Response.json({ status: "unauthorized", message: error.message }, { status: 401 });
    }
    throw error;
  }
}
