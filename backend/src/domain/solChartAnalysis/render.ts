import type { AnalysisResult, SetupCard } from './contracts.js';

function fmt(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return 'n/a';
  return String(n);
}

function pct01(x: number): string {
  if (!Number.isFinite(x)) return 'n/a';
  return `${Math.round(x * 100)}%`;
}

function renderSetupCard(s: SetupCard, idx: number): string[] {
  const lines: string[] = [];
  lines.push(`${idx + 1}) ${s.name} (${s.bias.toUpperCase()}, tf=${s.timeframe}, conf=${pct01(s.confidence)})`);
  lines.push(`   Entry: ${s.entry.type} @ ${fmt(s.entry.level)} — ${s.entry.rule}`);
  lines.push(`   Stop: ${fmt(s.stop.level)} — ${s.stop.rule}`);
  if (s.targets.length) {
    lines.push(`   Targets: ${s.targets.map(t => fmt(t.level)).join(', ')}`);
  } else {
    lines.push('   Targets: n/a');
  }
  if (s.onchainGate.notes.length) {
    lines.push(`   OnchainGate: ${s.onchainGate.pass ? 'PASS' : 'FAIL'} — ${s.onchainGate.notes.join(' | ')}`);
  } else {
    lines.push(`   OnchainGate: ${s.onchainGate.pass ? 'PASS' : 'FAIL'}`);
  }
  return lines;
}

/**
 * Deterministic text renderer for the AnalysisResult JSON.
 *
 * Goal: stable, concise, and mirrors the "expandable details" contract.
 */
export function renderAnalysisText(result: AnalysisResult): string {
  const out: string[] = [];

  out.push(result.headline);
  out.push('');

  if (result.summaryBullets.length) {
    out.push('Summary:');
    for (const b of result.summaryBullets.slice(0, 6)) out.push(`- ${b}`);
    out.push('');
  }

  out.push('Setups:');
  if (!result.plan.length) {
    out.push('- (none)');
  } else {
    result.plan.slice(0, 3).forEach((s, i) => out.push(...renderSetupCard(s, i)));
  }
  out.push('');

  out.push('Risk:');
  out.push(`- posture: ${result.risk.posture}`);
  for (const k of result.risk.keyRisks.slice(0, 5)) out.push(`- risk: ${k}`);
  for (const g of result.risk.guardrails.slice(0, 5)) out.push(`- guardrail: ${g}`);
  out.push('');

  out.push('Details (expand):');
  out.push(`- details.regimeExplain: ${result.details.regimeExplain}`);
  out.push(`- details.srTable.supports: ${result.details.srTable.supports.map(x => fmt(x)).join(', ')}`);
  out.push(`- details.srTable.resistances: ${result.details.srTable.resistances.map(x => fmt(x)).join(', ')}`);
  out.push(`- details.onchainExplain: ${result.details.onchainExplain}`);

  return out.join('\n');
}

