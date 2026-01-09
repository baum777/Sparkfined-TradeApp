import type { AnalysisResult, SetupCard } from './schema.js';

function fmtNum(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return 'n/a';
  // Keep stable; avoid locale differences.
  const abs = Math.abs(n);
  const decimals = abs >= 100 ? 2 : abs >= 1 ? 4 : 6;
  return n.toFixed(decimals);
}

function fmtConf(c: number): string {
  const clamped = Math.min(1, Math.max(0, Number.isFinite(c) ? c : 0));
  return clamped.toFixed(2);
}

function fmtGate(setup: SetupCard): string {
  const pass = setup.onchainGate?.pass !== false;
  return pass ? 'PASS' : 'FAIL';
}

export function renderAnalysisText(result: AnalysisResult): string {
  const lines: string[] = [];

  // 1) Headline
  lines.push(result.headline || 'Analysis');

  // 2) Summary bullets
  for (const b of result.summaryBullets ?? []) {
    if (typeof b === 'string' && b.trim()) lines.push(`- ${b.trim()}`);
  }

  // 3) Top setups
  const setups = (result.plan ?? []).slice(0, 3);
  if (setups.length) {
    lines.push('');
    lines.push('Setups:');
    setups.forEach((s, idx) => {
      lines.push(
        `${idx + 1}) ${s.name} (${s.bias.toUpperCase()}, tf=${s.timeframe}, conf=${fmtConf(s.confidence)}, gate=${fmtGate(s)})`
      );
      lines.push(`   Entry: ${s.entry.type}${s.entry.level == null ? '' : ` @ ${fmtNum(s.entry.level)}`} — ${s.entry.rule}`);
      lines.push(`   Stop: @ ${fmtNum(s.stop.level)} — ${s.stop.rule}`);
      lines.push(`   Invalidation: ${s.stop.invalidation}`);
      if (s.targets?.length) {
        const t = s.targets.map(x => `${fmtNum(x.level)} (${x.rationale})`).join(' | ');
        lines.push(`   Targets: ${t}`);
      }
      const gateNotes = (s.onchainGate?.notes ?? []).filter(Boolean);
      if (gateNotes.length) lines.push(`   Gate notes: ${gateNotes.join(' | ')}`);
      const notes = (s.notes ?? []).filter(Boolean);
      if (notes.length) lines.push(`   Notes: ${notes.join(' | ')}`);
    });
  }

  // 4) Risk & invalidation
  lines.push('');
  lines.push(`Risk posture: ${result.risk.posture}`);
  if (result.risk.keyRisks?.length) lines.push(`Key risks: ${result.risk.keyRisks.join(' | ')}`);
  if (result.risk.guardrails?.length) lines.push(`Guardrails: ${result.risk.guardrails.join(' | ')}`);
  if (result.details.invalidationRules?.length) lines.push(`Invalidation rules: ${result.details.invalidationRules.join(' | ')}`);

  // 5) Details block pointers
  lines.push('');
  lines.push('Details (expand):');
  lines.push(`- regimeExplain: ${result.details.regimeExplain || ''}`.trimEnd());
  lines.push(
    `- srTable: supports=[${(result.details.srTable.supports ?? []).join(', ')}], resistances=[${(result.details.srTable.resistances ?? []).join(', ')}]`
  );
  if (result.details.patternReview?.length) {
    const pr = result.details.patternReview
      .map(p => `${p.type}@${p.tf}:${p.verdict}(${fmtConf(p.confidence)})`)
      .join(' | ');
    lines.push(`- patternReview: ${pr}`);
  }
  lines.push(`- onchainExplain: ${result.details.onchainExplain || ''}`.trimEnd());

  return lines.join('\n');
}

