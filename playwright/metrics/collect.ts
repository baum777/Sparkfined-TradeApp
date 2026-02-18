#!/usr/bin/env node

/**
 * Playwright Metrics Collector
 * 
 * Collects test duration metrics from Playwright JSON report,
 * aggregates by project, identifies slow tests, and generates
 * summary reports for CI observability.
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface TestRunRow {
  title: string;
  file: string;
  project: string;
  durationMs: number;
  status: 'passed' | 'failed' | 'skipped' | 'timedOut' | 'interrupted';
  retry?: number;
}

interface TestResult {
  title: string;
  file: string;
  duration: number;
  status: 'passed' | 'failed' | 'skipped' | 'timedOut';
  projectName?: string;
}

interface ProjectMetrics {
  project: string;
  totalDuration: number;
  passed: number;
  failed: number;
  skipped: number;
  testCount: number;
  avgDuration: number;
  slowTests: Array<{ title: string; file: string; duration: number }>;
}

interface RunMetrics {
  timestamp: string;
  gitSha?: string;
  gitBranch?: string;
  projects: ProjectMetrics[];
  topSlowTests: Array<{ title: string; file: string; duration: number; project: string }>;
  totalDuration: number;
  totalPassed: number;
  totalFailed: number;
  totalSkipped: number;
  regressionFlags: {
    warnings: string[];
    failures: string[];
  };
}

interface Budgets {
  test_max_ms: number;
  project_max_ms: Record<string, number>;
  top_n: number;
  regression_thresholds: {
    warn_project_duration_pct: number;
    fail_project_duration_pct: number;
    warn_test_duration_pct: number;
  };
}

function loadJsonReport(reportPath: string): any {
  if (!fs.existsSync(reportPath)) {
    console.error(`❌ JSON report not found: ${reportPath}`);
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(reportPath, 'utf-8'));
}

function loadBudgets(): Budgets {
  const budgetsPath = path.join(__dirname, 'budgets.json');
  if (!fs.existsSync(budgetsPath)) {
    console.error(`❌ Budgets file not found: ${budgetsPath}`);
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(budgetsPath, 'utf-8'));
}

/**
 * Flatten Playwright JSON reporter suites recursively
 */
function flattenSuites(suites: any[], projectName?: string, suitePath: string[] = []): TestRunRow[] {
  const rows: TestRunRow[] = [];
  
  for (const suite of suites) {
    const currentProject = suite.projectName || projectName || suite.project?.name || 'unknown';
    const currentPath = suitePath.concat(suite.title ? [suite.title] : []);
    
    // Process specs in this suite
    if (Array.isArray(suite.specs)) {
      for (const spec of suite.specs) {
        const specFile = spec.file || spec.relativePath || 'unknown';
        
        if (Array.isArray(spec.tests)) {
          for (const test of spec.tests) {
            const testTitle = test.title || 'Unknown Test';
            const fullTitle = currentPath.length > 0 
              ? `${currentPath.join(' › ')} › ${testTitle}`
              : testTitle;
            
            // Process all results (including retries)
            if (Array.isArray(test.results)) {
              for (let i = 0; i < test.results.length; i++) {
                const result = test.results[i];
                if (result && result.status) {
                  rows.push({
                    title: fullTitle,
                    file: specFile,
                    project: result.projectName || test.projectName || currentProject,
                    durationMs: result.duration || 0,
                    status: result.status,
                    retry: i > 0 ? i : undefined,
                  });
                }
              }
            }
          }
        }
      }
    }
    
    // Recursively process nested suites
    if (Array.isArray(suite.suites)) {
      const nestedRows = flattenSuites(suite.suites, currentProject, currentPath);
      rows.push(...nestedRows);
    }
  }
  
  return rows;
}

/**
 * Extract test results from JSON report with multiple shape support
 */
function extractTestResults(jsonReport: any, reportPath: string): { rows: TestRunRow[]; debugInfo: any } {
  const debugInfo: any = {
    topLevelKeys: Object.keys(jsonReport),
    hasSuites: Array.isArray(jsonReport.suites),
    hasTests: Array.isArray(jsonReport.tests),
    reportPath,
  };
  
  let rows: TestRunRow[] = [];
  
  // Shape 1: Playwright JSON Reporter with suites
  if (Array.isArray(jsonReport.suites)) {
    rows = flattenSuites(jsonReport.suites);
    debugInfo.shape = 'suites';
    debugInfo.suiteCount = jsonReport.suites.length;
  }
  // Shape 2: Direct tests array (fallback)
  else if (Array.isArray(jsonReport.tests)) {
    for (const test of jsonReport.tests) {
      const project = test.projectName || test.project?.name || 'unknown';
      const file = test.file || test.spec?.file || 'unknown';
      const title = test.title || test.spec?.title || 'Unknown';
      
      if (Array.isArray(test.results)) {
        for (let i = 0; i < test.results.length; i++) {
          const result = test.results[i];
          if (result && result.status) {
            rows.push({
              title,
              file,
              project,
              durationMs: result.duration || 0,
              status: result.status,
              retry: i > 0 ? i : undefined,
            });
          }
        }
      }
    }
    debugInfo.shape = 'tests';
    debugInfo.testCount = jsonReport.tests.length;
  }
  // Shape 3: Minimal/legacy shape
  else {
    debugInfo.shape = 'minimal';
    debugInfo.message = 'No suites or tests array found in report';
  }
  
  return { rows, debugInfo };
}

/**
 * Get canonical result for a test (last result if retries exist)
 */
function getCanonicalResult(rows: TestRunRow[]): Map<string, TestRunRow> {
  const canonical = new Map<string, TestRunRow>();
  
  // Group by test key (project + file + title)
  const byTest = new Map<string, TestRunRow[]>();
  for (const row of rows) {
    const key = `${row.project}::${row.file}::${row.title}`;
    if (!byTest.has(key)) {
      byTest.set(key, []);
    }
    byTest.get(key)!.push(row);
  }
  
  // For each test, use the last result (final attempt)
  for (const [key, testRows] of byTest.entries()) {
    // Sort by retry number (undefined = 0, then 1, 2, etc.)
    testRows.sort((a, b) => (a.retry ?? 0) - (b.retry ?? 0));
    const lastRow = testRows[testRows.length - 1];
    canonical.set(key, lastRow);
  }
  
  return canonical;
}

function aggregateByProject(canonicalRows: Map<string, TestRunRow>): Map<string, TestRunRow[]> {
  const byProject = new Map<string, TestRunRow[]>();
  
  for (const row of canonicalRows.values()) {
    const project = row.project || 'unknown';
    if (!byProject.has(project)) {
      byProject.set(project, []);
    }
    byProject.get(project)!.push(row);
  }
  
  return byProject;
}

function calculateProjectMetrics(
  project: string,
  rows: TestRunRow[],
  budgets: Budgets
): ProjectMetrics {
  const totalDuration = rows.reduce((sum, r) => sum + r.durationMs, 0);
  const passed = rows.filter(r => r.status === 'passed').length;
  const failed = rows.filter(r => r.status === 'failed' || r.status === 'timedOut' || r.status === 'interrupted').length;
  const skipped = rows.filter(r => r.status === 'skipped').length;
  const testCount = rows.length;
  const avgDuration = testCount > 0 ? totalDuration / testCount : 0;
  
  // Sort by duration descending and take top N
  const slowTests = rows
    .map(r => ({ title: r.title, file: r.file, duration: r.durationMs }))
    .sort((a, b) => b.duration - a.duration)
    .slice(0, budgets.top_n);
  
  return {
    project,
    totalDuration,
    passed,
    failed,
    skipped,
    testCount,
    avgDuration,
    slowTests,
  };
}

function detectRegressions(
  currentMetrics: RunMetrics,
  previousMetrics: RunMetrics | null,
  budgets: Budgets
): { warnings: string[]; failures: string[] } {
  const warnings: string[] = [];
  const failures: string[] = [];
  
  if (!previousMetrics) {
    return { warnings, failures };
  }
  
  // Compare project durations
  for (const currentProject of currentMetrics.projects) {
    const previousProject = previousMetrics.projects.find(p => p.project === currentProject.project);
    if (!previousProject) continue;
    
    const durationIncrease = currentProject.totalDuration - previousProject.totalDuration;
    const durationIncreasePct = (durationIncrease / previousProject.totalDuration) * 100;
    
    if (durationIncreasePct > budgets.regression_thresholds.fail_project_duration_pct) {
      failures.push(
        `Project ${currentProject.project}: Duration increased by ${durationIncreasePct.toFixed(1)}% ` +
        `(${previousProject.totalDuration}ms → ${currentProject.totalDuration}ms)`
      );
    } else if (durationIncreasePct > budgets.regression_thresholds.warn_project_duration_pct) {
      warnings.push(
        `Project ${currentProject.project}: Duration increased by ${durationIncreasePct.toFixed(1)}% ` +
        `(${previousProject.totalDuration}ms → ${currentProject.totalDuration}ms)`
      );
    }
    
    // Check against absolute budget
    const projectBudget = budgets.project_max_ms[currentProject.project];
    if (projectBudget && currentProject.totalDuration > projectBudget) {
      warnings.push(
        `Project ${currentProject.project}: Duration ${currentProject.totalDuration}ms exceeds budget ${projectBudget}ms`
      );
    }
  }
  
  // Check individual test budgets
  for (const test of currentMetrics.topSlowTests) {
    if (test.duration > budgets.test_max_ms) {
      warnings.push(
        `Slow test: ${test.title} (${test.duration}ms) exceeds budget ${budgets.test_max_ms}ms`
      );
    }
  }
  
  return { warnings, failures };
}

function getGitInfo(): { sha?: string; branch?: string } {
  try {
    const sha = execSync('git rev-parse HEAD', { encoding: 'utf-8', stdio: 'pipe' })
      .trim();
    const branch = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf-8', stdio: 'pipe' })
      .trim();
    return { sha, branch };
  } catch {
    return {};
  }
}

function loadPreviousMetrics(historyDir: string): RunMetrics | null {
  if (!fs.existsSync(historyDir)) {
    return null;
  }
  
  const files = fs.readdirSync(historyDir)
    .filter(f => f.endsWith('.json'))
    .sort()
    .reverse();
  
  if (files.length === 0) {
    return null;
  }
  
  try {
    const lastFile = path.join(historyDir, files[0]);
    return JSON.parse(fs.readFileSync(lastFile, 'utf-8'));
  } catch {
    return null;
  }
}

function generateSummary(metrics: RunMetrics, budgets: Budgets, debugInfo?: any): string {
  const lines: string[] = [];
  
  lines.push('# E2E Test Metrics Summary\n');
  lines.push(`**Timestamp:** ${metrics.timestamp}`);
  if (metrics.gitSha) {
    lines.push(`**Git SHA:** ${metrics.gitSha.substring(0, 7)}`);
  }
  if (metrics.gitBranch) {
    lines.push(`**Branch:** ${metrics.gitBranch}`);
  }
  if (debugInfo?.reportPath) {
    lines.push(`**Report Path:** ${debugInfo.reportPath}`);
  }
  lines.push('');
  
  // Show debug info if no data found
  if (metrics.totalPassed === 0 && metrics.totalFailed === 0 && metrics.totalSkipped === 0) {
    lines.push('## ⚠️ No Test Data Found\n');
    if (debugInfo) {
      lines.push('**Debug Information:**');
      lines.push(`- Top-level keys: ${debugInfo.topLevelKeys?.join(', ') || 'none'}`);
      lines.push(`- Shape detected: ${debugInfo.shape || 'unknown'}`);
      if (debugInfo.message) {
        lines.push(`- Message: ${debugInfo.message}`);
      }
      lines.push('');
      lines.push('**Possible causes:**');
      lines.push('- JSON report has minimal structure (status only)');
      lines.push('- Report file may be in different location');
      lines.push('- Tests may not have run yet');
      lines.push('');
    }
  }
  
  // Overall summary
  lines.push('## Overall Summary\n');
  lines.push(`- **Total Duration:** ${(metrics.totalDuration / 1000).toFixed(1)}s`);
  lines.push(`- **Passed:** ${metrics.totalPassed}`);
  lines.push(`- **Failed:** ${metrics.totalFailed}`);
  lines.push(`- **Skipped:** ${metrics.totalSkipped}`);
  lines.push('');
  
  // Project breakdown
  lines.push('## Project Breakdown\n');
  lines.push('| Project | Duration | Tests | Passed | Failed | Avg Duration |');
  lines.push('|---------|----------|-------|--------|--------|--------------|');
  for (const project of metrics.projects) {
    const duration = (project.totalDuration / 1000).toFixed(1);
    const avg = (project.avgDuration / 1000).toFixed(2);
    lines.push(
      `| ${project.project} | ${duration}s | ${project.testCount} | ${project.passed} | ${project.failed} | ${avg}s |`
    );
  }
  lines.push('');
  
  // Top slow tests
  lines.push(`## Top ${budgets.top_n} Slow Tests\n`);
  lines.push('| Test | File | Duration | Project |');
  lines.push('|------|------|----------|---------|');
  for (const test of metrics.topSlowTests.slice(0, budgets.top_n)) {
    const duration = (test.duration / 1000).toFixed(2);
    const fileName = path.basename(test.file);
    lines.push(`| ${test.title} | ${fileName} | ${duration}s | ${test.project} |`);
  }
  lines.push('');
  
  // Regression flags
  if (metrics.regressionFlags.warnings.length > 0 || metrics.regressionFlags.failures.length > 0) {
    lines.push('## ⚠️ Regression Flags\n');
    
    if (metrics.regressionFlags.failures.length > 0) {
      lines.push('### ❌ Failures\n');
      for (const failure of metrics.regressionFlags.failures) {
        lines.push(`- ${failure}`);
      }
      lines.push('');
    }
    
    if (metrics.regressionFlags.warnings.length > 0) {
      lines.push('### ⚠️ Warnings\n');
      for (const warning of metrics.regressionFlags.warnings) {
        lines.push(`- ${warning}`);
      }
      lines.push('');
    }
    
    lines.push('### Next Actions\n');
    lines.push('1. Review slow tests and optimize if possible');
    lines.push('2. Check for flaky tests causing retries');
    lines.push('3. Verify no unintended timeout increases');
    lines.push('4. Consider splitting large test files');
    lines.push('');
  } else {
    lines.push('## ✅ No Regression Flags\n');
    lines.push('All metrics within acceptable ranges.\n');
  }
  
  return lines.join('\n');
}

function saveMetrics(metrics: RunMetrics, outputDir: string): void {
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  const metricsPath = path.join(outputDir, 'last_run_metrics.json');
  fs.writeFileSync(metricsPath, JSON.stringify(metrics, null, 2));
  console.log(`✅ Metrics saved: ${metricsPath}`);
}

function saveSummary(summary: string, outputDir: string): void {
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  const summaryPath = path.join(outputDir, 'last_run_summary.md');
  fs.writeFileSync(summaryPath, summary);
  console.log(`✅ Summary saved: ${summaryPath}`);
}

function saveHistory(metrics: RunMetrics, historyDir: string): void {
  if (!fs.existsSync(historyDir)) {
    fs.mkdirSync(historyDir, { recursive: true });
  }
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const historyFile = path.join(historyDir, `${timestamp}.json`);
  fs.writeFileSync(historyFile, JSON.stringify(metrics, null, 2));
  console.log(`✅ History saved: ${historyFile}`);
}

function tryLoadReportFromMultipleSources(): { report: any; path: string } | null {
  // Try multiple possible locations
  const candidates = [
    path.join(process.cwd(), 'playwright-report', 'results.json', '.last-run.json'),
    path.join(process.cwd(), 'playwright-report', 'results.json'),
    path.join(process.cwd(), 'test-results', 'results.json'),
  ];
  
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      try {
        const report = JSON.parse(fs.readFileSync(candidate, 'utf-8'));
        // Check if it has useful data (not just minimal)
        if (report.suites || report.tests || (report.status && Object.keys(report).length > 2)) {
          return { report, path: candidate };
        }
      } catch {
        // Continue to next candidate
      }
    }
  }
  
  // If no good candidate found, return the first existing one (even if minimal)
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      try {
        return { report: JSON.parse(fs.readFileSync(candidate, 'utf-8')), path: candidate };
      } catch {
        // Continue
      }
    }
  }
  
  return null;
}

function main() {
  const budgets = loadBudgets();
  
  // Try to load report from multiple sources
  const reportSource = tryLoadReportFromMultipleSources();
  if (!reportSource) {
    console.error('❌ No JSON report found in expected locations:');
    console.error('   - playwright-report/results.json/.last-run.json');
    console.error('   - playwright-report/results.json');
    console.error('   - test-results/results.json');
    console.error('\n💡 Run Playwright tests first to generate a report:');
    console.error('   npx playwright test --project=chromium');
    process.exit(1);
  }
  
  const jsonReport = reportSource.report;
  const reportPath = reportSource.path;
  
  // Extract test results with shape detection
  const { rows, debugInfo } = extractTestResults(jsonReport, reportPath);
  
  // Get canonical results (last attempt for each test)
  const canonicalRows = getCanonicalResult(rows);
  
  // Aggregate by project
  const byProject = aggregateByProject(canonicalRows);
  
  const projects: ProjectMetrics[] = [];
  for (const [project, projectRows] of byProject.entries()) {
    projects.push(calculateProjectMetrics(project, projectRows, budgets));
  }
  
  // Sort all tests by duration for top slow tests (use canonical rows)
  const allSlowTests = Array.from(canonicalRows.values())
    .map(r => ({
      title: r.title,
      file: r.file,
      duration: r.durationMs,
      project: r.project,
    }))
    .sort((a, b) => b.duration - a.duration)
    .slice(0, budgets.top_n);
  
  const totalDuration = projects.reduce((sum, p) => sum + p.totalDuration, 0);
  const totalPassed = projects.reduce((sum, p) => sum + p.passed, 0);
  const totalFailed = projects.reduce((sum, p) => sum + p.failed, 0);
  const totalSkipped = projects.reduce((sum, p) => sum + p.skipped, 0);
  
  // Get git info (prefer CI env vars)
  const gitSha = process.env.GITHUB_SHA || getGitInfo().sha;
  const gitBranch = process.env.GITHUB_REF_NAME || getGitInfo().branch;
  
  const metrics: RunMetrics = {
    timestamp: new Date().toISOString(),
    gitSha,
    gitBranch,
    projects,
    topSlowTests: allSlowTests,
    totalDuration,
    totalPassed,
    totalFailed,
    totalSkipped,
    regressionFlags: { warnings: [], failures: [] },
  };
  
  // Load previous metrics for drift detection
  const historyDir = path.join(__dirname, 'history');
  const previousMetrics = loadPreviousMetrics(historyDir);
  metrics.regressionFlags = detectRegressions(metrics, previousMetrics, budgets);
  
  // Save outputs
  const outputDir = path.join(__dirname);
  saveMetrics(metrics, outputDir);
  const summary = generateSummary(metrics, budgets, debugInfo);
  saveSummary(summary, outputDir);
  saveHistory(metrics, historyDir);
  
  // Log results
  if (rows.length === 0) {
    console.warn('\n⚠️ No test data extracted from report');
    console.warn(`   Shape: ${debugInfo.shape || 'unknown'}`);
    console.warn(`   Top-level keys: ${debugInfo.topLevelKeys?.join(', ') || 'none'}`);
  } else {
    console.log(`\n✅ Extracted ${rows.length} test result rows (${canonicalRows.size} unique tests)`);
    console.log(`   Projects: ${projects.length}`);
    console.log(`   Total duration: ${(totalDuration / 1000).toFixed(1)}s`);
  }
  
  // Exit with error if failures detected (but don't fail CI - handled by continue-on-error)
  if (metrics.regressionFlags.failures.length > 0) {
    console.error('\n❌ Regression failures detected!');
    for (const failure of metrics.regressionFlags.failures) {
      console.error(`   - ${failure}`);
    }
    // Don't exit(1) - let CI handle it via continue-on-error
  } else if (metrics.regressionFlags.warnings.length > 0) {
    console.warn('\n⚠️ Regression warnings detected');
    for (const warning of metrics.regressionFlags.warnings) {
      console.warn(`   - ${warning}`);
    }
  } else if (rows.length > 0) {
    console.log('\n✅ All metrics within acceptable ranges');
  }
}

// Run main if executed directly
if (import.meta.url === `file://${__filename}` || process.argv[1] === __filename) {
  main();
}

