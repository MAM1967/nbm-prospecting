/**
 * NER (Named Entity Recognition) extraction service wrapper
 * Uses Python spaCy service for robust person and company extraction
 */

import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);
const PYTHON_NER_SERVICE_PATH = "./ner-extractor-service.py";

export interface ExtractedExecutive {
  name: string;
  title: string;
  confidence: number;
}

export interface ExtractedCompany {
  name: string;
  normalizedName: string;
}

// Cache the Python service check result
let nerServiceAvailable: boolean | null = null;
let nerServiceChecked = false;

/**
 * Check if the Python spaCy NER service is available
 */
export async function isNERServiceAvailable(): Promise<boolean> {
  if (nerServiceChecked) {
    return nerServiceAvailable || false;
  }

  nerServiceChecked = true;

  try {
    // Check if Python script exists
    await execAsync(`test -f ${PYTHON_NER_SERVICE_PATH}`);
    
    // Check if spaCy can be imported
    try {
      const { stdout, stderr } = await execAsync(
        `python3 -c "import spacy; print('OK')" 2>&1`
      );
      if (stdout.includes('OK') || stdout.trim() === 'OK') {
        nerServiceAvailable = true;
        console.log("[NER Extractor] Python spaCy service is available");
        return true;
      }
    } catch (error: any) {
      const errorOutput = error.stderr || error.stdout || error.message || "";
      if (errorOutput.includes("ModuleNotFoundError") || errorOutput.includes("ImportError")) {
        if (!(global as any).__ner_service_warned) {
          console.warn(
            "[NER Extractor] spaCy not installed. Run: pip3 install spacy && python3 -m spacy download en_core_web_sm"
          );
          (global as any).__ner_service_warned = true;
        }
      }
    }
    
    nerServiceAvailable = false;
    return false;
  } catch (error: any) {
    if (!(global as any).__ner_service_warned) {
      console.warn("[NER Extractor] Python NER service not available");
      (global as any).__ner_service_warned = true;
    }
    nerServiceAvailable = false;
    return false;
  }
}

/**
 * Extract executives from text using spaCy NER
 */
export async function extractExecutivesWithNER(
  text: string
): Promise<ExtractedExecutive[]> {
  if (!(await isNERServiceAvailable())) {
    return [];
  }

  try {
    // Escape text for shell
    const escapedText = text.replace(/"/g, '\\"').replace(/\$/g, '\\$');
    const { stdout, stderr } = await execAsync(
      `python3 ${PYTHON_NER_SERVICE_PATH} --text "${escapedText}" --type executives`
    );

    if (stderr && !stderr.includes("Loaded spaCy model")) {
      console.warn(`[NER Extractor] Warning: ${stderr}`);
    }

    const result = JSON.parse(stdout);
    if (result.error) {
      console.error(`[NER Extractor] Error: ${result.error}`);
      return [];
    }

    return result.executives || [];
  } catch (error: any) {
    console.error(
      `[NER Extractor] Failed to extract executives:`,
      error.message || error
    );
    return [];
  }
}

/**
 * Extract companies from text using spaCy NER
 */
export async function extractCompaniesWithNER(
  text: string
): Promise<ExtractedCompany[]> {
  if (!(await isNERServiceAvailable())) {
    return [];
  }

  try {
    // Escape text for shell
    const escapedText = text.replace(/"/g, '\\"').replace(/\$/g, '\\$');
    const { stdout, stderr } = await execAsync(
      `python3 ${PYTHON_NER_SERVICE_PATH} --text "${escapedText}" --type companies`
    );

    if (stderr && !stderr.includes("Loaded spaCy model")) {
      console.warn(`[NER Extractor] Warning: ${stderr}`);
    }

    const result = JSON.parse(stdout);
    if (result.error) {
      console.error(`[NER Extractor] Error: ${result.error}`);
      return [];
    }

    return result.companies || [];
  } catch (error: any) {
    console.error(
      `[NER Extractor] Failed to extract companies:`,
      error.message || error
    );
    return [];
  }
}

/**
 * Extract both executives and companies from text using spaCy NER
 */
export async function extractEntitiesWithNER(
  text: string
): Promise<{ executives: ExtractedExecutive[]; companies: ExtractedCompany[] }> {
  if (!(await isNERServiceAvailable())) {
    return { executives: [], companies: [] };
  }

  try {
    // Escape text for shell
    const escapedText = text.replace(/"/g, '\\"').replace(/\$/g, '\\$');
    const { stdout, stderr } = await execAsync(
      `python3 ${PYTHON_NER_SERVICE_PATH} --text "${escapedText}" --type both`
    );

    if (stderr && !stderr.includes("Loaded spaCy model")) {
      console.warn(`[NER Extractor] Warning: ${stderr}`);
    }

    const result = JSON.parse(stdout);
    if (result.error) {
      console.error(`[NER Extractor] Error: ${result.error}`);
      return { executives: [], companies: [] };
    }

    return {
      executives: result.executives || [],
      companies: result.companies || [],
    };
  } catch (error: any) {
    console.error(
      `[NER Extractor] Failed to extract entities:`,
      error.message || error
    );
    return { executives: [], companies: [] };
  }
}

