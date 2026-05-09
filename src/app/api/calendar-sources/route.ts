import { saveCalendarSourceMapping } from "@/server/services/calendar-source-service";
import { AuthenticationError } from "@/server/services/auth-service";

export async function POST(request: Request) {
  try {
    const source = await saveCalendarSourceMapping(await request.json());
    return Response.json({
      id: source.id,
      externalCalendarId: source.externalCalendarId,
      name: source.name,
      semantic: source.semantic,
      enabled: source.enabled
    });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return Response.json({ error: error.message }, { status: 401 });
    }
    return Response.json(
      { error: error instanceof Error ? error.message : "Invalid calendar source mapping." },
      { status: 400 }
    );
  }
}
