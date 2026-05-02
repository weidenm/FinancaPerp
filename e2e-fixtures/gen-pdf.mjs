import { writeFileSync } from "node:fs";
import { PDFDocument, StandardFonts } from "pdf-lib";

const doc = await PDFDocument.create();
const page = doc.addPage([420, 200]);
const font = await doc.embedFont(StandardFonts.Helvetica);
page.drawText("MCP import PDF texto livre 55,00 BRL", { x: 40, y: 110, size: 12, font });
const bytes = await doc.save({ useObjectStreams: false });
writeFileSync(new URL("./mcp-import.pdf", import.meta.url), bytes);
