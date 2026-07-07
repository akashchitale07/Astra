import fs from "fs";
import { createRequire } from "module";
import mammoth from "mammoth";

const require = createRequire(import.meta.url);
const pdfParse = require("pdf-parse");

export interface ExtractionResult {
  text: string;
  status: "success" | "failed";
}

/**
 * Extracts raw text from TXT, PDF, and DOCX files.
 */
export async function extractTextFromFile(filePath: string, contentType: string): Promise<ExtractionResult> {
  try {
    if (!fs.existsSync(filePath)) {
      console.error(`File not found for text extraction: ${filePath}`);
      return { text: "", status: "failed" };
    }

    const fileBuffer = fs.readFileSync(filePath);

    // TXT File Extraction
    if (contentType.includes("text/plain") || filePath.endsWith(".txt")) {
      const text = fileBuffer.toString("utf8");
      return { text: text.trim(), status: "success" };
    }

    // PDF File Extraction
    if (contentType.includes("pdf") || filePath.endsWith(".pdf")) {
      try {
        const data = await pdfParse(fileBuffer);
        return { text: data.text.trim(), status: "success" };
      } catch (err) {
        console.error("PDF extraction error:", err);
        return { text: "", status: "failed" };
      }
    }

    // DOCX File Extraction
    if (contentType.includes("word") || filePath.endsWith(".docx")) {
      try {
        const result = await mammoth.extractRawText({ buffer: fileBuffer });
        return { text: result.value.trim(), status: "success" };
      } catch (err) {
        console.error("DOCX extraction error:", err);
        return { text: "", status: "failed" };
      }
    }

    // Unrecognized file types (like images, zip, etc.) for Phase 1
    console.log(`Unsupported file type for text extraction: ${contentType}`);
    return { text: "", status: "failed" };
  } catch (error) {
    console.error("File text extraction failed completely:", error);
    return { text: "", status: "failed" };
  }
}
