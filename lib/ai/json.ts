import { AIError } from "@/lib/ai/errors";

/**
 * Extract a JSON object/array from model text that may include fences or prose.
 */
export function extractJsonText(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new AIError("INVALID_JSON", "Empty AI response", { retryable: false });
  }

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) return fenced[1].trim();

  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    return sliceBalancedJson(trimmed) ?? trimmed;
  }

  const objectStart = trimmed.indexOf("{");
  const arrayStart = trimmed.indexOf("[");
  const startCandidates = [objectStart, arrayStart].filter((index) => index >= 0);
  if (startCandidates.length === 0) {
    throw new AIError("INVALID_JSON", "AI response did not contain JSON", {
      retryable: false,
    });
  }
  const start = Math.min(...startCandidates);
  const sliced = sliceBalancedJson(trimmed.slice(start));
  if (!sliced) {
    throw new AIError("INVALID_JSON", "AI response did not contain JSON", {
      retryable: false,
    });
  }
  return sliced;
}

function sliceBalancedJson(input: string): string | null {
  const open = input[0];
  if (open !== "{" && open !== "[") return null;
  const close = open === "{" ? "}" : "]";
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }
    if (char === open) depth += 1;
    if (char === close) {
      depth -= 1;
      if (depth === 0) return input.slice(0, index + 1);
    }
  }
  return null;
}

export function parseJsonFromText<T = unknown>(raw: string): T {
  const jsonText = extractJsonText(raw);
  try {
    return JSON.parse(jsonText) as T;
  } catch (error) {
    throw new AIError("INVALID_JSON", "Failed to parse AI JSON response", {
      retryable: false,
      cause: error,
    });
  }
}
