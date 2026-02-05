import { InclusionReason, ComposerResult } from "../retrieval";

// Re-export previous retrieval helpers but keep them under utils for future imports
// Note: this file provides thin wrappers to the original implementations (moved here)

export type RetrievalResult = {
  archiveName?: string;
  content: string;
  score?: number;
  frameId?: string;
  metadata?: any;
};

export function simpleTokenEstimate(text: string) {
  return text.split(/\s+/).filter(Boolean).length;
}

export function filterResults(
  results: RetrievalResult[],
  opts: {
    recencyMs?: number;
    minScore?: number;
    allowedSensitivity?: string[];
    limit?: number;
  } = {},
) {
  const now = Date.now();
  let out = results.filter((r) => {
    if (opts.recencyMs && r.metadata?.timestamp) {
      if (now - r.metadata.timestamp > opts.recencyMs) return false;
    }
    if (opts.minScore && typeof r.score === "number") {
      if (r.score < opts.minScore) return false;
    }
    if (opts.allowedSensitivity && r.metadata?.sensitivity) {
      if (!opts.allowedSensitivity.includes(r.metadata.sensitivity)) return false;
    }
    return true;
  });

  if (opts.limit) out = out.slice(0, opts.limit);
  return out;
}

export function composePrependContext(
  results: RetrievalResult[],
  opts: { limit?: number; tokenBudget?: number } = {},
): ComposerResult {
  const limit = opts.limit ?? 5;
  const tokenBudget = opts.tokenBudget ?? 3000;

  const decisions: any[] = [];
  const parts: string[] = [];
  let usedTokens = 0;

  for (const r of results.slice(0, limit)) {
    const est = simpleTokenEstimate(r.content);
    if (usedTokens + est > tokenBudget) break;
    usedTokens += est;
    decisions.push({
      frameId: r.frameId,
      score: r.score,
      uri: r.metadata?.uri,
      frameIndex: r.metadata?.frameIndex,
      reason: "included",
    });
    parts.push(
      `Source: ${r.metadata?.uri || r.archiveName} (frame ${r.metadata?.frameIndex || r.frameId})\n${r.content}`,
    );
  }

  const prependContext = parts.join("\n---\n");
  return { prependContext, decisions, usedTokens } as ComposerResult;
}
