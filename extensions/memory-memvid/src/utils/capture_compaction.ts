export type Frame = {
  frameId: string;
  content: string;
  timestamp: number;
  sessionId?: string;
  source?: string;
  uri?: string;
  frameIndex?: number;
  sensitivity?: "public" | "private" | "restricted" | string;
  tags?: string[];
};

export type CompactionOptions = {
  timeWindowMs?: number; // group frames within this window
  maxSummaryWords?: number; // how long the compacted summary should be
  preferLatest?: boolean; // precedence: prefer latest frame for SETS
  sensitivityThreshold?: ("public" | "private" | "restricted")[]; // allowed sensitivities to include in compacted result
};

export type CompactedFrame = {
  frameId: string; // synthetic id for the compacted frame
  content: string; // compacted content (summary)
  timestamp: number; // timestamp of latest frame in group
  constituents: string[]; // frameIds included
  provenance?: { uri?: string; frameIndex?: number; timestamp?: number }[];
  metadata?: Record<string, any>;
};

export function summarizeText(text: string, maxWords = 30) {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) return text;
  return words.slice(0, maxWords).join(" ") + "...";
}

// Determine whether a frame is considered a "SET" authoritative frame vs an UPDATE.
// Heuristic: if content is short and tagged as 'update' in tags -> UPDATE. If content contains
// declarative phrases or starts with verbs like "set", "update", or contains 'state:' treat as SET.
function isLikelySet(frame: Frame) {
  const tags = frame.tags || [];
  if (tags.includes("set")) return true;
  if (tags.includes("update")) return false;
  const c = (frame.content || "").toLowerCase();
  if (/^set\b|^state\b|^config\b/.test(c)) return true;
  if (/updated by|changed to|now:/.test(c)) return false;
  return c.length < 200 && c.split(/\s+/).length < 20;
}

// Compact frames by session and time proximity with additional rules:
// - Groups frames by session/time window (like before)
// - Within a group, apply precedence: prefer latest "SET" frames as authoritative; combine updates sensibly
// - Preserve provenance and metadata; include sensitivity handling
export function compactFrames(frames: Frame[], opts: CompactionOptions = {}): CompactedFrame[] {
  const timeWindow = opts.timeWindowMs ?? 1000 * 60 * 5; // default 5 minutes
  const maxWords = opts.maxSummaryWords ?? 60;
  const preferLatest = opts.preferLatest ?? true;
  const allowedSens = opts.sensitivityThreshold;

  // sort frames by timestamp ascending
  const sorted = [...frames].sort((a, b) => a.timestamp - b.timestamp);

  const groups: Frame[][] = [];

  for (const f of sorted) {
    const lastGroup = groups[groups.length - 1];
    if (!lastGroup) {
      groups.push([f]);
      continue;
    }

    // only merge if same sessionId (both defined and equal) or both missing
    const last = lastGroup[lastGroup.length - 1];
    const sameSession = (last.sessionId || null) === (f.sessionId || null);
    if (sameSession && f.timestamp - last.timestamp <= timeWindow) {
      lastGroup.push(f);
    } else {
      groups.push([f]);
    }
  }

  // build compacted frames with precedence handling
  const compacted: CompactedFrame[] = groups.map((g, idx) => {
    // apply sensitivity filter if provided
    const included = allowedSens
      ? g.filter((x) => (x.sensitivity ? allowedSens.includes(x.sensitivity as any) : true))
      : g;

    // if nothing included after sensitivity filter, fall back to original group
    const effective = included.length > 0 ? included : g;

    // precedence: find latest SET frame if preferLatest
    let authoritative: Frame | null = null;
    if (preferLatest) {
      for (let i = effective.length - 1; i >= 0; i--) {
        if (isLikelySet(effective[i])) {
          authoritative = effective[i];
          break;
        }
      }
    }

    // compose content: prefer authoritative content, then append recent updates
    let content = "";
    if (authoritative) {
      content += authoritative.content;
      // include any updates that came after authoritative
      const later = effective.filter((x) => x.timestamp > authoritative!.timestamp);
      if (later.length) content += "\n" + later.map((x) => x.content).join("\n");
    } else {
      // fallback: concatenate all contents
      content = effective.map((x) => x.content).join("\n");
    }

    const summary = summarizeText(content, maxWords);
    const timestamp = effective[effective.length - 1].timestamp;
    const constituents = effective.map((x) => x.frameId);
    const provenance = effective.map((x) => ({
      uri: x.uri,
      frameIndex: x.frameIndex,
      timestamp: x.timestamp,
    }));

    const metadata: Record<string, any> = {
      source: "compaction",
      originalCount: g.length,
      includedCount: effective.length,
      authoritativeFrame: authoritative ? authoritative.frameId : null,
    };

    return {
      frameId: `compacted-${idx}-${constituents[0]}`,
      content: summary,
      timestamp,
      constituents,
      provenance,
      metadata,
    };
  });

  return compacted;
}
