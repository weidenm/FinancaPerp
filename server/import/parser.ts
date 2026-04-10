import * as pdfParse from "pdf-parse";
import * as xlsx from "xlsx";
import { createWorker, type Worker } from "tesseract.js";
import type { RawDocument } from "../domain/ledger/types";

let ocrWorkerPromise: Promise<Worker> | null = null;

async function getOcrWorker(): Promise<Worker> {
  if (!ocrWorkerPromise) {
    ocrWorkerPromise = (async () => {
      const worker = await createWorker("por");
      return worker;
    })();
  }
  return ocrWorkerPromise;
}

async function extractPdf(buffer: Buffer): Promise<string> {
  const parse = (pdfParse as any).default || pdfParse;
  const data = await parse(buffer);
  return data.text || "";
}

function extractCsv(buffer: Buffer): string {
  return buffer.toString("utf-8");
}

function extractTxt(buffer: Buffer): string {
  return buffer.toString("utf-8");
}

function extractXlsx(buffer: Buffer): Record<string, unknown>[] {
  const workbook = xlsx.read(buffer, { type: "buffer" });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  return xlsx.utils.sheet_to_json(sheet);
}

async function extractImageOcr(buffer: Buffer): Promise<string> {
  const worker = await getOcrWorker();
  const res = await worker.recognize(buffer);
  return res.data.text || "";
}

export async function parseUploadToRawDocuments(files: Express.Multer.File[]): Promise<RawDocument[]> {
  const docs: RawDocument[] = [];

  for (const file of files) {
    const name = file.originalname || "unknown";
    const lower = name.toLowerCase();
    const mimetype = file.mimetype || "";

    if (mimetype === "application/pdf" || lower.endsWith(".pdf")) {
      docs.push({ source: "pdf", originalName: name, rawText: await extractPdf(file.buffer) });
      continue;
    }

    if (mimetype === "text/csv" || lower.endsWith(".csv")) {
      docs.push({ source: "csv", originalName: name, rawText: extractCsv(file.buffer) });
      continue;
    }

    if (
      mimetype === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
      lower.endsWith(".xlsx")
    ) {
      docs.push({ source: "xlsx", originalName: name, rows: extractXlsx(file.buffer) });
      continue;
    }

    if (lower.endsWith(".ofx") || mimetype === "application/x-ofx" || mimetype === "application/octet-stream") {
      docs.push({ source: "ofx", originalName: name, rawText: file.buffer.toString("utf-8") });
      continue;
    }

    if (mimetype === "text/plain" || lower.endsWith(".txt")) {
      docs.push({ source: "txt", originalName: name, rawText: extractTxt(file.buffer) });
      continue;
    }

    if (mimetype.startsWith("image/")) {
      docs.push({ source: "image", originalName: name, rawText: await extractImageOcr(file.buffer) });
      continue;
    }

    throw new Error(`UNSUPPORTED_FORMAT:${name}`);
  }

  return docs;
}

