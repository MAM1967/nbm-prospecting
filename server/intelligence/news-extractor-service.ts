/**
 * Python news extraction service wrapper
 * Uses newspaper4k for robust article extraction
 */

import { exec } from "child_process";
import { promisify } from "util";
import path from "path";

const execAsync = promisify(exec);

const PYTHON_SCRIPT = path.join(process.cwd(), "news-extractor-service.py");

export interface ExtractedArticle {
  title: string;
  text: string;
  authors: string[];
  publish_date?: string;
  summary: string;
  keywords: string[];
  url: string;
  publishedAt?: string;
  description?: string;
  source?: string;
}

/**
 * Extract article content using Python newspaper4k service
 */
export async function extractArticleWithNewspaper4k(
  url: string
): Promise<ExtractedArticle | null> {
  try {
    const { stdout, stderr } = await execAsync(
      `python3 ${PYTHON_SCRIPT} --url "${url}"`
    );

    if (stderr && !stderr.includes("Error")) {
      console.warn(`[News Extractor] Warning: ${stderr}`);
    }

    const result = JSON.parse(stdout);
    return result;
  } catch (error: any) {
    console.error(`[News Extractor] Failed to extract ${url}:`, error.message);
    return null;
  }
}

/**
 * Fetch articles from RSS feed using Python service
 */
export async function fetchRSSWithNewspaper4k(
  feedUrl: string,
  daysBack: number = 90
): Promise<ExtractedArticle[]> {
  try {
    const { stdout, stderr } = await execAsync(
      `python3 ${PYTHON_SCRIPT} --rss "${feedUrl}" --days ${daysBack}`
    );

    if (stderr && !stderr.includes("Error")) {
      console.warn(`[News Extractor] Warning: ${stderr}`);
    }

    const articles = JSON.parse(stdout);
    return Array.isArray(articles) ? articles : [];
  } catch (error: any) {
    console.error(
      `[News Extractor] Failed to fetch RSS ${feedUrl}:`,
      error.message
    );
    return [];
  }
}

/**
 * Check if Python service is available
 */
// Cache the Python service check result to avoid repeated checks
let pythonServiceAvailable: boolean | null = null;
let pythonServiceChecked = false;

export async function checkPythonService(): Promise<boolean> {
  // Only check once per process
  if (pythonServiceChecked) {
    return pythonServiceAvailable || false;
  }

  pythonServiceChecked = true;

  try {
    await execAsync(`python3 --version`);
    // Check if newspaper4k is installed (newspaper4k uses 'newspaper' module name)
    try {
      const { stdout, stderr } = await execAsync(
        `python3 -c "from newspaper import Article; print('OK')" 2>&1`
      );
      if (stdout.includes('OK') || stdout.trim() === 'OK') {
        pythonServiceAvailable = true;
        console.log("[News Extractor] Python newspaper4k service is available");
        return true;
      }
      pythonServiceAvailable = false;
      return false;
    } catch (error: any) {
      // Check stderr for import errors
      const errorOutput = error.stderr || error.stdout || error.message || "";
      if (errorOutput.includes("ModuleNotFoundError") || errorOutput.includes("ImportError")) {
        if (!(global as any).__python_service_warned) {
          console.warn(
            "[News Extractor] newspaper4k not installed. Run: pip3 install -r requirements-news.txt"
          );
          (global as any).__python_service_warned = true;
        }
      }
      pythonServiceAvailable = false;
      return false;
    }
  } catch {
    if (!(global as any).__python_service_warned) {
      console.warn("[News Extractor] Python3 not found");
      (global as any).__python_service_warned = true;
    }
    pythonServiceAvailable = false;
    return false;
  }
}

