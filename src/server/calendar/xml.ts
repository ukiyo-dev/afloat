export function xmlBlocks(xml: string, localName: string): string[] {
  const pattern = new RegExp(
    `<(?:[\\w-]+:)?${localName}\\b[^>]*>([\\s\\S]*?)<\\/(?:[\\w-]+:)?${localName}>`,
    "gi"
  );
  return [...xml.matchAll(pattern)].map((match) => match[1] ?? "");
}

export function firstXmlText(xml: string, localName: string): string | null {
  const [block] = xmlBlocks(xml, localName);
  return block === undefined ? null : decodeXml(block.trim());
}

export function hasXmlTag(xml: string, localName: string): boolean {
  return new RegExp(`<(?:[\\w-]+:)?${localName}\\b`, "i").test(xml);
}

export function decodeXml(value: string): string {
  const cdata = value.match(/^<!\[CDATA\[([\s\S]*)\]\]>$/);
  const normalized = cdata?.[1] ?? value;

  return normalized
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", "\"")
    .replaceAll("&apos;", "'")
    .replaceAll("&amp;", "&");
}
