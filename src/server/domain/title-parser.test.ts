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

  it("preserves a trailing number on the reserved item without parsing sequence semantics", () => {
    const parsed = parseTitle("写作：--- 27");

    expect(parsed).toMatchObject({
      rawTitle: "写作：--- 27",
      titleBody: "写作：---",
      group: "写作",
      item: "---",
      sequence: null
    });
  });
});
