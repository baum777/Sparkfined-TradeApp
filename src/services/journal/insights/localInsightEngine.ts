import type { JournalEntryStub } from "@/stubs/contracts";
import type { JournalInsightV1, Finding, Improvement } from "./types";

/**
 * Generate a unique insight ID
 */
function generateInsightId(): string {
  return `insight_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Local heuristic-based insight engine
 * Deterministically analyzes entry and produces JournalInsightV1
 */
export function generateLocalInsight(entry: JournalEntryStub): JournalInsightV1 {
  const startTime = performance.now();
  
  const findings: Finding[] = [];
  const improvements: Improvement[] = [];
  
  // Track what's missing for summary
  const missingFields: string[] = [];
  
  // --- FINDINGS ANALYSIS ---
  
  // Check if pending (needs confirmation)
  if (entry.status === "pending") {
    findings.push({
      title: "Pending review",
      detail: "Entry awaiting confirmation. Review and confirm key fields to complete.",
      evidence: [{ entryId: entry.id, field: "status", value: "pending" }],
    });
  }
  
  // Check summary/notes quality
  const summaryLength = entry.summary?.length ?? 0;
  if (summaryLength < 20) {
    findings.push({
      title: "Brief notes",
      detail: "Notes are too short to provide meaningful review context later.",
      evidence: [{ entryId: entry.id, field: "summary", value: `${summaryLength} chars` }],
    });
    missingFields.push("detailed notes");
  }
  
  // Check if it looks like a complete setup
  const hasSetupKeywords = /breakout|support|resistance|pullback|reversal|trend/i.test(entry.summary || "");
  if (!hasSetupKeywords && summaryLength > 0) {
    findings.push({
      title: "Missing setup type",
      detail: "No clear setup pattern identified in notes. Consider adding setup classification.",
      evidence: [{ entryId: entry.id, field: "summary" }],
    });
    missingFields.push("setup type");
  }
  
  // Note: The current JournalEntryStub is minimal. In a real implementation,
  // we'd check for: exit, result, risk%, stop-loss, emotion tags, chart links, etc.
  // For now, we infer based on available fields.
  
  // If archived, note reduced relevance
  if (entry.status === "archived") {
    findings.push({
      title: "Archived entry",
      detail: "This entry was archived and may not reflect your current trading approach.",
      evidence: [{ entryId: entry.id, field: "status", value: "archived" }],
    });
  }
  
  // --- IMPROVEMENTS GENERATION ---
  
  // P1: High priority - critical for trade review
  if (entry.status === "pending") {
    improvements.push({
      action: "Confirm entry with result",
      why: "Pending entries block accurate performance tracking",
      priority: "P1",
      evidence: [{ entryId: entry.id, field: "status" }],
    });
  }
  
  if (summaryLength < 30) {
    improvements.push({
      action: "Add exit reasoning",
      why: "Understanding your exit logic improves future decision-making",
      priority: "P1",
      evidence: [{ entryId: entry.id, field: "summary" }],
    });
  }
  
  // P2: Medium priority - improves analysis
  if (!hasSetupKeywords) {
    improvements.push({
      action: "Define setup type",
      why: "Categorizing setups helps identify your edge",
      priority: "P2",
      evidence: [{ entryId: entry.id, field: "summary" }],
    });
  }
  
  improvements.push({
    action: "Add emotion tag",
    why: "Tracking emotional state reveals patterns in decision quality",
    priority: "P2",
    evidence: [{ entryId: entry.id, field: "emotion" }],
  });
  
  // P3: Low priority - nice to have
  improvements.push({
    action: "Attach chart screenshot",
    why: "Visual context makes future review more valuable",
    priority: "P3",
    evidence: [{ entryId: entry.id, field: "attachments" }],
  });
  
  // Sort by priority and take top 3
  const priorityOrder = { P1: 0, P2: 1, P3: 2 };
  improvements.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
  const topImprovements = improvements.slice(0, 5); // Keep max 5 for storage, show 3 in UI
  
  // --- CALCULATE CONFIDENCE AND STRENGTH ---
  
  // Higher confidence when based on explicit field checks
  const hasExplicitMissing = findings.some(f => 
    f.title.includes("Missing") || f.title.includes("Brief") || f.title.includes("Pending")
  );
  const confidence = hasExplicitMissing ? 0.85 : 0.65;
  
  // Strength based on number of findings
  let strength: "low" | "medium" | "high";
  if (findings.length >= 3) {
    strength = "high";
  } else if (findings.length >= 1) {
    strength = "medium";
  } else {
    strength = "low";
  }
  
  // --- GENERATE SUMMARY ---
  
  let summary: string;
  if (entry.status === "pending") {
    if (missingFields.length > 0) {
      summary = `Pending entry needs review. Missing: ${missingFields.slice(0, 2).join(", ")}. Confirm to track performance.`;
    } else {
      summary = "Pending entry ready for confirmation. Review the details and confirm to complete.";
    }
  } else if (findings.length === 0) {
    summary = "Entry looks complete. Consider adding more context for future reference.";
  } else {
    const topFinding = findings[0];
    summary = `${topFinding.title}. ${findings.length > 1 ? `${findings.length - 1} more observation${findings.length > 2 ? "s" : ""} found.` : ""}`.trim();
  }
  
  // Ensure summary doesn't exceed ~160 chars
  if (summary.length > 160) {
    summary = summary.slice(0, 157) + "...";
  }
  
  const endTime = performance.now();
  
  return {
    insightId: generateInsightId(),
    version: "insight_v1",
    entryId: entry.id,
    createdAt: Date.now(),
    summary,
    confidence,
    strength,
    findings,
    improvements: topImprovements,
    meta: {
      cache: "miss",
      latencyMs: Math.round(endTime - startTime),
    },
  };
}
