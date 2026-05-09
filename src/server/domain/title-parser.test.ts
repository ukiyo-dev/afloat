import { describe, expect, it } from "vitest";

import { parseTitle } from "./title-parser";

describe("parseTitle", () => {
  it("parses group item sequence and quality mark", () => {
    const parsed = parseTitle("🌟Afloat：线程承诺 01");

    expect(parsed.group).toBe("Afloat");
    expect(parsed.item).toBe("线程承诺");
    expect(parsed.sequence).toBe(1);
    expect(parsed.quality).toBe("excellent");
  });

  it("uses the whole title as group and item when no chinese colon exists", () => {
    const parsed = parseTitle("写作 2");

    expect(parsed.group).toBe("写作");
    expect(parsed.item).toBe("写作");
    expect(parsed.sequence).toBe(2);
  });
});
