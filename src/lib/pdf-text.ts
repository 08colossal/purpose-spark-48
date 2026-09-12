/**
 * Extrai o texto de um PDF no navegador, para alimentar o tutor de IA.
 */
export async function extractPdfText(
  file: File,
): Promise<{ text: string; pageCount: number }> {
  const pdfjs = await import("pdfjs-dist");
  const worker = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;

  const buffer = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: buffer }).promise;
  const parts: string[] = [];

  const maxPages = Math.min(doc.numPages, 80);
  for (let pageNumber = 1; pageNumber <= maxPages; pageNumber += 1) {
    const page = await doc.getPage(pageNumber);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    if (pageText) parts.push(pageText);
  }

  return { text: parts.join("\n\n").slice(0, 200000), pageCount: doc.numPages };
}
