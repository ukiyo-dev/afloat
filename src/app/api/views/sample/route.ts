import { buildDerivedViews } from "@/server/views/derived-view";
import { sampleInput } from "@/server/views/sample-data";

export function GET() {
  return Response.json(buildDerivedViews(sampleInput()));
}
