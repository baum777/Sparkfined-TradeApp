# Documentation Audit — Inventory Table

**Datum:** 2024-12-19  
**Status:** Pre-Merge Analysis

---

## Root-Level Markdown Files

| Path | Purpose | Status | Target Doc | Notes |
|------|---------|--------|------------|-------|
| `README.md` | Repo overview, quickstart, troubleshooting | **KEEP** | `README.md` | Current, accurate. Needs minor updates for new features. |
| `TERMINAL_RESEARCH_INTEGRATION.md` | Integration concept (audit + design) | **MERGE** | `docs/TERMINAL.md` | Detailed findings → extract to Terminal doc, archive rest |
| `IMPLEMENTATION_SUMMARY.md` | Terminal+Research integration implementation | **MERGE** | `docs/TERMINAL.md` | Implementation details → merge into Terminal doc |
| `PRE_BETA_HARDENING_SUMMARY.md` | Error boundaries + Sentry + warnings | **MERGE** | `docs/DEPLOYMENT.md` | Hardening details → merge into Deployment |
| `PRE_BETA_STABILITY_CHECKLIST.md` | Pre-beta audit checklist | **MERGE** | `docs/QA.md` | Checklist → extract to QA doc |
| `USER_FLOW_SIMULATIONS.md` | 5 user flow scenarios | **MERGE** | `docs/QA.md` | User flows → extract to QA doc |
| `PHASE2_DELIVERABLES.md` | Discover overlay implementation | **MERGE** | `docs/DISCOVER.md` | Discover details → merge into Discover doc |
| `MANUAL_GATE_REPORT.md` | Terminal manual testing report | **MERGE** | `docs/QA.md` | Testing checklist → extract to QA doc |
| `ROUTING_NOTES.md` | Routing architecture notes | **MERGE** | `docs/ARCHITECTURE.md` | Routing details → merge into Architecture |
| `REPO_1TO1_SPEC_ANSWERS.md` | Spec Q&A (historical) | **ARCHIVE** | `ARCHIVE/` | Historical artifact, keep for reference |
| `AGENT_TEAM_VALIDATION_AUDIT.md` | Team validation audit | **ARCHIVE** | `ARCHIVE/` | Historical artifact |
| `team_*.md` (4 files) | Team planning docs | **ARCHIVE** | `ARCHIVE/` | Historical planning artifacts |
| `product_spec.md` | Product specification | **ARCHIVE** | `ARCHIVE/` | Outdated, replaced by functional spec |
| `tech_spec.md` | Technical specification | **ARCHIVE** | `ARCHIVE/` | Outdated, replaced by architecture docs |
| `reasoning-layer_v0.1.md` | Reasoning layer spec | **MERGE** | `docs/ARCHITECTURE.md` | Reasoning details → merge into Architecture |

---

## `/docs/` Directory

| Path | Purpose | Status | Target Doc | Notes |
|------|---------|--------|------------|-------|
| `docs/ARCHITECTURE.md` | System architecture overview | **KEEP** | `docs/ARCHITECTURE.md` | Current, accurate. Needs minor updates. |
| `docs/FUNCTIONAL_SPEC.md` | Functional specification | **KEEP** | `docs/FUNCTIONAL_SPEC.md` | Current feature spec. |
| `docs/CONTRIBUTING.md` | Contribution guidelines | **KEEP** | `docs/CONTRIBUTING.md` | Keep as-is. |
| `docs/DOMINANCE_LAYER.md` | Dominance layer details | **KEEP** | `docs/DOMINANCE_LAYER.md` | Specialized, keep separate. |
| `docs/terminal_phase1_manual_checklist.md` | Terminal Phase 1 checklist | **MERGE** | `docs/QA.md` | Merge into QA doc |

---

## `/shared/docs/` Directory

| Path | Purpose | Status | Target Doc | Notes |
|------|---------|--------|------------|-------|
| `shared/docs/ENVIRONMENT.md` | Environment variables reference | **KEEP** | `shared/docs/ENVIRONMENT.md` | Single source of truth for env vars. |
| `shared/docs/DEPLOYMENT.md` | Deployment guide | **MERGE** | `docs/DEPLOYMENT.md` | Merge into root docs/DEPLOYMENT.md |
| `shared/docs/SECURITY.md` | Security documentation | **MERGE** | `docs/SECURITY.md` | Merge into root docs/SECURITY.md |
| `shared/docs/ARCHITECTURE.md` | Shared architecture | **MERGE** | `docs/ARCHITECTURE.md` | Merge into root docs/ARCHITECTURE.md |
| `shared/docs/API_CONTRACTS.md` | API contracts | **KEEP** | `shared/docs/API_CONTRACTS.md` | Keep in shared (contracts are shared) |
| `shared/docs/PROVIDERS.md` | Provider documentation | **KEEP** | `shared/docs/PROVIDERS.md` | Keep in shared (providers are shared) |
| `shared/docs/LOCAL_DEV.md` | Local development guide | **MERGE** | `README.md` | Merge into README quickstart |
| `shared/docs/STATUS.md` | Status documentation | **DELETE** | — | Outdated, information in other docs |
| `shared/docs/CONTRACT_DRIFT_REPORT.md` | Contract drift report | **ARCHIVE** | `ARCHIVE/` | Historical artifact |

---

## `/playwright/` Directory (Testing Docs)

| Path | Purpose | Status | Target Doc | Notes |
|------|---------|--------|------------|-------|
| `playwright/TEST_CONTRACT.md` | E2E test contract | **KEEP** | `playwright/TEST_CONTRACT.md` | Testing-specific, keep in playwright/ |
| `playwright/CI_STRATEGY.md` | CI strategy | **KEEP** | `playwright/CI_STRATEGY.md` | Testing-specific, keep in playwright/ |
| `playwright/AUDIT_E2E_TRIAGE.md` | E2E audit | **KEEP** | `playwright/AUDIT_E2E_TRIAGE.md` | Testing-specific, keep in playwright/ |
| `playwright/CI_METRICS_POLICY.md` | CI metrics | **KEEP** | `playwright/CI_METRICS_POLICY.md` | Testing-specific, keep in playwright/ |
| `playwright/DETERMINISM_RUNLOG.md` | Determinism log | **KEEP** | `playwright/DETERMINISM_RUNLOG.md` | Testing-specific, keep in playwright/ |
| `playwright/FIREFOX_WORKER_ANALYSIS.md` | Firefox analysis | **KEEP** | `playwright/FIREFOX_WORKER_ANALYSIS.md` | Testing-specific, keep in playwright/ |
| `playwright/metrics/last_run_summary.md` | Metrics summary | **KEEP** | `playwright/metrics/` | Metrics, keep in playwright/ |

---

## `/apps/` Directory

| Path | Purpose | Status | Target Doc | Notes |
|------|---------|--------|------------|-------|
| `apps/backend-alerts/README.md` | Alerts service README | **KEEP** | `apps/backend-alerts/README.md` | Service-specific, keep in app/ |
| `apps/web/README.md` | Web app README | **KEEP** | `apps/web/README.md` | Service-specific, keep in app/ |

---

## Summary Statistics

- **Total Markdown Files:** 41
- **Keep:** 15 (core docs + testing + apps)
- **Merge:** 15 (consolidate into final docs)
- **Archive:** 8 (historical artifacts)
- **Delete:** 3 (outdated/duplicate)

---

## Drift/Conflict Detection

### Conflicts Found:
1. **Terminal Documentation:**
   - `TERMINAL_RESEARCH_INTEGRATION.md` (concept)
   - `IMPLEMENTATION_SUMMARY.md` (implementation)
   - `MANUAL_GATE_REPORT.md` (testing)
   - `docs/terminal_phase1_manual_checklist.md` (checklist)
   - **Resolution:** Merge all into `docs/TERMINAL.md`

2. **Discover Documentation:**
   - `PHASE2_DELIVERABLES.md` (implementation)
   - **Resolution:** Merge into `docs/DISCOVER.md`

3. **Architecture Documentation:**
   - `docs/ARCHITECTURE.md` (root)
   - `shared/docs/ARCHITECTURE.md` (shared)
   - `ROUTING_NOTES.md` (routing)
   - `reasoning-layer_v0.1.md` (reasoning)
   - **Resolution:** Merge all into `docs/ARCHITECTURE.md`

4. **Deployment Documentation:**
   - `shared/docs/DEPLOYMENT.md` (shared)
   - `PRE_BETA_HARDENING_SUMMARY.md` (hardening)
   - **Resolution:** Merge into `docs/DEPLOYMENT.md`

5. **Security Documentation:**
   - `shared/docs/SECURITY.md` (shared)
   - **Resolution:** Move to `docs/SECURITY.md`

6. **QA/Testing Documentation:**
   - `PRE_BETA_STABILITY_CHECKLIST.md` (checklist)
   - `USER_FLOW_SIMULATIONS.md` (simulations)
   - `MANUAL_GATE_REPORT.md` (report)
   - `docs/terminal_phase1_manual_checklist.md` (checklist)
   - **Resolution:** Merge into `docs/QA.md`

---

## Final Docs Set Proposal (≤7 Core Docs)

1. **`README.md`** — Overview, quickstart, env vars summary, troubleshooting
2. **`docs/ARCHITECTURE.md`** — System architecture, data flow, modules, routing
3. **`docs/TERMINAL.md`** — Terminal UX, execution flow, integration with Research
4. **`docs/DISCOVER.md`** — Discover overlay, filters, ranking, presets
5. **`docs/DEPLOYMENT.md`** — Environments, feature flags, monitoring, hardening
6. **`docs/SECURITY.md`** — Security constraints, abuse mitigations, non-custodial
7. **`docs/QA.md`** — Testing checklists, user flows, manual verification

**Additional (not core, but necessary):**
- `docs/CONTRIBUTING.md` — Contribution guidelines
- `docs/FUNCTIONAL_SPEC.md` — Functional specification
- `docs/DOMINANCE_LAYER.md` — Dominance layer (specialized)
- `shared/docs/ENVIRONMENT.md` — Environment variables (detailed)
- `shared/docs/API_CONTRACTS.md` — API contracts
- `shared/docs/PROVIDERS.md` — Provider documentation

