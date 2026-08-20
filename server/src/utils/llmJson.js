/** Strip markdown code fences from model output. */
export function stripLlmCodeFences(text) {
  return String(text || '')
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
}

/** Remove trailing commas before } or ]. */
export function removeTrailingCommas(json) {
  return json.replace(/,\s*([}\]])/g, '$1');
}

/** Extract the first balanced top-level JSON object substring. */
export function extractBalancedJsonObject(text) {
  const start = text.indexOf('{');
  if (start < 0) return null;

  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escape) {
        escape = false;
        continue;
      }
      if (ch === '\\') {
        escape = true;
        continue;
      }
      if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === '{') depth++;
    if (ch === '}') {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

/** Close truncated JSON by balancing quotes/brackets (best-effort). */
export function repairTruncatedJson(text) {
  let s = text.trim();

  // Drop trailing incomplete key/value fragments.
  s = s.replace(/,\s*"[^"]*"?\s*:\s*"[^"]*$/s, '');
  s = s.replace(/,\s*"[^"]*"?\s*:\s*[^,}\]]*$/s, '');
  s = s.replace(/,\s*$/s, '');

  let openCurly = 0;
  let openSquare = 0;
  let inString = false;
  let escape = false;

  for (const ch of s) {
    if (inString) {
      if (escape) {
        escape = false;
        continue;
      }
      if (ch === '\\') {
        escape = true;
        continue;
      }
      if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === '{') openCurly++;
    if (ch === '}') openCurly--;
    if (ch === '[') openSquare++;
    if (ch === ']') openSquare--;
  }

  if (inString) s += '"';
  while (openSquare > 0) {
    s += ']';
    openSquare--;
  }
  while (openCurly > 0) {
    s += '}';
    openCurly--;
  }

  return s;
}

/**
 * Parse JSON from LLM text with several repair strategies.
 * @throws {SyntaxError} when all strategies fail
 */
export function parseJsonFromLlmText(raw) {
  const cleaned = stripLlmCodeFences(raw);

  const strategies = [
    () => JSON.parse(cleaned),
    () => JSON.parse(removeTrailingCommas(cleaned)),
    () => {
      const extracted = extractBalancedJsonObject(cleaned);
      if (!extracted) throw new SyntaxError('No JSON object found in model response');
      return JSON.parse(removeTrailingCommas(extracted));
    },
    () => JSON.parse(removeTrailingCommas(repairTruncatedJson(cleaned))),
    () => {
      const extracted = extractBalancedJsonObject(repairTruncatedJson(cleaned));
      if (!extracted) throw new SyntaxError('No JSON object found after repair');
      return JSON.parse(removeTrailingCommas(extracted));
    },
  ];

  let lastError;
  for (const strategy of strategies) {
    try {
      const parsed = strategy();
      if (parsed && typeof parsed === 'object') return parsed;
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError || new SyntaxError('Failed to parse JSON from model response');
}
