---
Owner: Core Team
Status: active
Version: 1.0
LastUpdated: 2026-02-27
Canonical: true
---

# Documentation Index

**Last Updated:** 2024-12-19

This directory contains the core documentation for Sparkfined. All documentation reflects the **current implementation state** (no roadmap speculation).

---

## Core Documentation

### [Architecture](./ARCHITECTURE.md)
System architecture, data flow, modules, routing, reasoning layer, and deployment model.

### [Terminal](./TERMINAL.md)
Trading Terminal documentation: architecture, execution flow, Research integration, fee engine, safety features, and testing.

### [Discover](./DISCOVER.md)
Discover Overlay documentation: filter engine, ranking system, presets, integration with Terminal.

### [Deployment](./DEPLOYMENT.md)
Deployment guide: environments, feature flags, monitoring (Sentry), hardening, and health checks.

### [Security](./SECURITY.md)
Security documentation: authentication, secret handling, rate limiting, non-custodial constraints, abuse mitigations.

### [QA](./QA.md)
Quality assurance: pre-beta checklist, user flow simulations, manual testing procedures, acceptance criteria.

---

## Additional Documentation

### [Functional Spec](./FUNCTIONAL_SPEC.md)
Functional specification: contract boundaries, API surface, error modes, NFRs.

### [Contributing](./CONTRIBUTING.md)
Contribution guidelines and development workflow.

### [Dominance Layer](./DOMINANCE_LAYER.md)
Dominance layer details: risk policy, autonomy tiers, golden tasks, auto-correct loop.

---

## Shared Documentation

### [Environment](../shared/docs/ENVIRONMENT.md)
Complete environment variables reference (Frontend, Backend, Vercel).

### [API Contracts](../shared/docs/API_CONTRACTS.md)
API contract specifications and response envelopes.

### [Providers](../shared/docs/PROVIDERS.md)
Provider documentation (LLM, Onchain, Market data).

---

## Quick Links

- **Getting Started:** See [README.md](../README.md) for quickstart
- **Local Development:** See [README.md](../README.md) for local dev setup
- **Testing:** See [QA.md](./QA.md) for testing procedures
- **Deployment:** See [Deployment.md](./DEPLOYMENT.md) for production setup

---

## Documentation Principles

1. **Single Source of Truth:** Each topic documented once
2. **Current State Only:** No roadmap speculation
3. **Code Wins:** Documentation reflects actual implementation
4. **Minimal Set:** Core docs only, historical artifacts archived

---

**Questions?** Check the relevant doc or see [Contributing](./CONTRIBUTING.md) for how to contribute.

