import { listCalDavCalendars } from "@/server/services/sync-service";
import { AuthenticationError } from "@/server/services/auth-service";

export async function GET() {
  try {
    const result = await listCalDavCalendars();
    return Response.json(result, { status: result.status === "succeeded" ? 200 : 409 });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return Response.json({ status: "unauthorized", message: error.message }, { status: 401 });
    }
    return Response.json(
      {
        status: "failed",
        message: error instanceof Error ? error.message : "Failed to list CalDAV calendars."
      },
      { status: 502 }
    );
  }
}
