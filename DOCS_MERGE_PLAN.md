# Documentation Merge Plan

**Datum:** 2024-12-19  
**Status:** Execution Plan

---

## Final Docs Set (7 Core Docs)

1. **`README.md`** — Overview, quickstart, env vars summary
2. **`docs/ARCHITECTURE.md`** — System architecture, data flow, modules
3. **`docs/TERMINAL.md`** — Terminal UX, execution flow, integration
4. **`docs/DISCOVER.md`** — Discover overlay, filters, ranking
5. **`docs/DEPLOYMENT.md`** — Environments, flags, monitoring, hardening
6. **`docs/SECURITY.md`** — Security constraints, abuse mitigations
7. **`docs/QA.md`** — Testing checklists, user flows

---

## Merge Plan by Document

### 1. `README.md` (Update)

**Content Sources:**
- Current `README.md` (keep structure)
- `shared/docs/LOCAL_DEV.md` (merge quickstart details)
- `shared/docs/ENVIRONMENT.md` (link, add summary table)

**Changes:**
- Add link to `docs/README.md` for detailed docs
- Update env vars summary (add `VITE_RESEARCH_EMBED_TERMINAL`, `VITE_SENTRY_DSN`)
- Merge local dev details from `shared/docs/LOCAL_DEV.md`
- Keep troubleshooting section

**Remove:**
- Duplicate env var details (link to `shared/docs/ENVIRONMENT.md` instead)

---

### 2. `docs/ARCHITECTURE.md` (Merge)

**Content Sources:**
- Current `docs/ARCHITECTURE.md` (keep as base)
- `shared/docs/ARCHITECTURE.md` (merge shared architecture details)
- `ROUTING_NOTES.md` (merge routing section)
- `reasoning-layer_v0.1.md` (merge reasoning layer section)

**Changes:**
- Add routing section from `ROUTING_NOTES.md`
- Add reasoning layer section from `reasoning-layer_v0.1.md`
- Merge shared architecture details
- Update data flow diagram if needed

**Remove:**
- Duplicate system overview sections

---

### 3. `docs/TERMINAL.md` (Create New)

**Content Sources:**
- `TERMINAL_RESEARCH_INTEGRATION.md` (extract findings + architecture)
- `IMPLEMENTATION_SUMMARY.md` (extract implementation details)
- `MANUAL_GATE_REPORT.md` (extract testing details)
- `docs/terminal_phase1_manual_checklist.md` (extract checklist)

**Structure:**
1. Overview (Terminal purpose, features)
2. Architecture (TerminalShell, ExecutionPanel, terminalStore)
3. Research Integration (embedded terminal, sync, feature flag)
4. Execution Flow (quote → swap → confirmation)
5. Fee Engine (tiers, calculation)
6. Safety Features (warnings, error handling)
7. Testing Checklist (manual verification)

**Remove:**
- Duplicate implementation details
- Outdated assumptions

---

### 4. `docs/DISCOVER.md` (Create New)

**Content Sources:**
- `PHASE2_DELIVERABLES.md` (extract implementation details)
- Code analysis (filter engine, presets, ranking)

**Structure:**
1. Overview (Discover purpose, features)
2. Filter Engine (hard rejects, presets, requirements)
3. Ranking System (scoring, downranking)
4. UI Components (overlay, tabs, token cards)
5. Integration (deep-link to Terminal)

**Remove:**
- File lists (outdated)
- Implementation checklist (keep only relevant details)

---

### 5. `docs/DEPLOYMENT.md` (Merge)

**Content Sources:**
- `shared/docs/DEPLOYMENT.md` (keep as base)
- `PRE_BETA_HARDENING_SUMMARY.md` (merge hardening section)

**Changes:**
- Add hardening section (Error Boundaries, Sentry, warnings)
- Add feature flags section (`VITE_RESEARCH_EMBED_TERMINAL`, `VITE_SENTRY_DSN`)
- Update monitoring section (Sentry integration)
- Keep deployment routing details

**Remove:**
- Duplicate deployment instructions

---

### 6. `docs/SECURITY.md` (Move & Update)

**Content Sources:**
- `shared/docs/SECURITY.md` (move to docs/)

**Changes:**
- Move from `shared/docs/` to `docs/`
- Update non-custodial constraints
- Add abuse mitigation details from code analysis
- Keep auth, rate limiting, secret handling sections

**Remove:**
- Nothing (keep all security details)

---

### 7. `docs/QA.md` (Create New)

**Content Sources:**
- `PRE_BETA_STABILITY_CHECKLIST.md` (extract checklist)
- `USER_FLOW_SIMULATIONS.md` (extract user flows)
- `MANUAL_GATE_REPORT.md` (extract testing procedures)
- `docs/terminal_phase1_manual_checklist.md` (extract checklist)

**Structure:**
1. Pre-Beta Checklist (architecture, execution, economic, UI/UX, performance, deployment, security)
2. User Flow Simulations (5 scenarios)
3. Manual Testing Procedures (Terminal, Discover, Research)
4. Acceptance Criteria

**Remove:**
- Duplicate checklists
- Outdated test procedures

---

## Archive Plan

**Create `ARCHIVE/` directory:**
- `ARCHIVE/REPO_1TO1_SPEC_ANSWERS.md`
- `ARCHIVE/AGENT_TEAM_VALIDATION_AUDIT.md`
- `ARCHIVE/team_*.md` (4 files)
- `ARCHIVE/product_spec.md`
- `ARCHIVE/tech_spec.md`
- `ARCHIVE/shared/docs/CONTRACT_DRIFT_REPORT.md`

---

## Delete Plan

**Delete (outdated/duplicate):**
- `shared/docs/STATUS.md` (outdated, info in other docs)

---

## Update Plan

**Update links in:**
- `README.md` → link to `docs/README.md`
- Code comments → update doc paths if changed
- `docs/CONTRIBUTING.md` → verify links

---

## New File: `docs/README.md` (Index)

**Content:**
- Links to all 7 core docs
- Quick navigation
- Doc purpose summary

