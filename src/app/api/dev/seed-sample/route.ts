import { AuthenticationError } from "@/server/services/auth-service";
import { seedSampleAndRecompute } from "@/server/services/dev-seed-service";

export async function POST() {
  if (process.env.NODE_ENV === "production") {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  try {
    return Response.json(await seedSampleAndRecompute());
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return Response.json({ error: error.message }, { status: 401 });
    }
    throw error;
  }
}
