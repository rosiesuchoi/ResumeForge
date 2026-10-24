import { extractText, getDocumentProxy } from "unpdf";

/** Extract plain text plus hyperlink targets (LinkedIn/GitHub links are often hidden behind link text). */
export async function readPdf(buf: ArrayBuffer): Promise<{ text: string; links: string[]; pages: number }> {
  const pdf = await getDocumentProxy(new Uint8Array(buf));
  const { text } = await extractText(pdf, { mergePages: true });
  const links = new Set<string>();
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const annots = (await page.getAnnotations()) as { subtype?: string; url?: string }[];
    for (const a of annots) if (a.subtype === "Link" && a.url) links.add(a.url);
  }
  return { text: String(text).replace(/[ \t]+\n/g, "\n").trim(), links: [...links], pages: pdf.numPages };
}
