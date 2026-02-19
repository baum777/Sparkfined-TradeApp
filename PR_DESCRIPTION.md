# Documentation Cleanup & Consolidation

## Summary

This PR consolidates and cleans up the repository documentation, establishing a **single source of truth** structure with minimal, current, and consistent documentation.

## Changes

### Core Documentation Created/Updated

1. **`docs/TERMINAL.md`** (NEW)
   - Complete Trading Terminal documentation
   - Architecture, execution flow, Research integration
   - Fee engine, safety features, testing checklist
   - Merged content from: `TERMINAL_RESEARCH_INTEGRATION.md`, `IMPLEMENTATION_SUMMARY.md`, `MANUAL_GATE_REPORT.md`

2. **`docs/DISCOVER.md`** (NEW)
   - Complete Discover Overlay documentation
   - Filter engine, ranking system, presets
   - Integration with Terminal
   - Merged content from: `PHASE2_DELIVERABLES.md`

3. **`docs/QA.md`** (NEW)
   - Pre-beta stability checklist
   - User flow simulations (5 scenarios)
   - Manual testing procedures
   - Acceptance criteria
   - Merged content from: `PRE_BETA_STABILITY_CHECKLIST.md`, `USER_FLOW_SIMULATIONS.md`, `MANUAL_GATE_REPORT.md`

4. **`docs/DEPLOYMENT.md`** (UPDATED)
   - Deployment guide with hardening details
   - Feature flags (`VITE_RESEARCH_EMBED_TERMINAL`, `VITE_SENTRY_DSN`)
   - Monitoring (Sentry integration)
   - Merged content from: `shared/docs/DEPLOYMENT.md`, `PRE_BETA_HARDENING_SUMMARY.md`

5. **`docs/SECURITY.md`** (MOVED)
   - Moved from `shared/docs/SECURITY.md`
   - Security constraints, abuse mitigations

6. **`docs/ARCHITECTURE.md`** (UPDATED)
   - Added routing architecture section
   - Added reasoning layer section
   - Merged content from: `ROUTING_NOTES.md`, `reasoning-layer_v0.1.md`

7. **`docs/README.md`** (NEW)
   - Documentation index with links to all core docs

8. **`README.md`** (UPDATED)
   - Updated with new doc links
   - Added env vars summary
   - Improved quickstart section

### Files Archived

All historical artifacts moved to `ARCHIVE/`:
- Historical specifications (`REPO_1TO1_SPEC_ANSWERS.md`, `product_spec.md`, `tech_spec.md`)
- Team planning docs (`team_*.md`)
- Implementation artifacts (merged into core docs)
- Contract drift reports

### Files Deleted

- `shared/docs/STATUS.md` (outdated)
- `shared/docs/DEPLOYMENT.md` (merged into `docs/DEPLOYMENT.md`)
- `shared/docs/SECURITY.md` (moved to `docs/SECURITY.md`)
- `shared/docs/ARCHITECTURE.md` (merged into `docs/ARCHITECTURE.md`)

## Documentation Principles Applied

1. **Single Source of Truth:** Each topic documented once
2. **Code Wins:** Documentation reflects actual implementation
3. **Minimal Set:** 7 core docs + necessary additional docs
4. **Current State Only:** No roadmap speculation
5. **Historical Artifacts:** Archived, not deleted

## Final Docs Set

1. `README.md` — Overview, quickstart, env vars
2. `docs/ARCHITECTURE.md` — System architecture
3. `docs/TERMINAL.md` — Terminal documentation
4. `docs/DISCOVER.md` — Discover documentation
5. `docs/DEPLOYMENT.md` — Deployment guide
6. `docs/SECURITY.md` — Security documentation
7. `docs/QA.md` — Quality assurance

## Verification

- ✅ All core docs created/updated
- ✅ Old docs archived or deleted
- ✅ Links updated in README.md
- ✅ docs/README.md index created
- ✅ No duplicate specs across multiple files
- ✅ All feature flags documented

## Breaking Changes

None. This is a documentation-only change.

## Related

- Documentation audit inventory: `DOCS_AUDIT_INVENTORY.md`
- Merge plan: `DOCS_MERGE_PLAN.md`
- Cleanup summary: `DOCS_CLEANUP_SUMMARY.md`

