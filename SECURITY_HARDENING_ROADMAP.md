# Security Hardening Roadmap

## Status: 2026-05-28

### ✅ Abgeschlossene Security-Maßnahmen

- [x] JWT Authentication (HS256, bcrypt salt=12)
- [x] CORS Origin-Whitelist
- [x] CSRF Protection (Double-Submit Cookie)
- [x] Security Headers (CSP, HSTS, X-Frame-Options)
- [x] Rate Limiting (Memory/Redis)
- [x] Environment Validation (Zod-Schemata)
- [x] Security Integration Tests (8 Tests)
- [x] Production Guards (JWT_SECRET ≥32 chars, Redis required)
- [x] JWT Secret Rotation Helper (`scripts/rotate-jwt-secret.mjs`) dokumentiert und verfügbar

---

## 🔴 KRITISCH: Sofort umsetzen (Priorität 1)

### 1. Auth im Frontend aktivieren

**Problem:** Frontend hat Auth bewusst deaktiviert (`VITE_ENABLE_AUTH=false`)

**Lösung:**
```bash
# .env.production
VITE_ENABLE_AUTH=true
```

**Betroffene Dateien:**
- `src/services/auth/auth.service.ts` - Stub existiert, muss aktiviert werden
- `src/components/journal/WalletGuard.tsx` - Wire real wallet connection state

**Aufwand:** 2-4 Stunden
**Risiko:** Mittel - Testen in Staging vor Production-Release

---

### 2. Incident Response Plan Finalisieren

**Problem:** Kein verbindlicher Kontaktkanal definiert (TODO in SECURITY.md Zeile 103)

**Empfohlene Struktur:**
```markdown
## Incident Response Contacts

### Primary (P0/P1 Incidents)
- Security On-Call: #security-oncall (Slack)
- Email: security@sparkfined.com

### Escalation Path
1. Security Engineer on-call
2. CTO / VP Engineering
3. CEO (for data breaches only)

### Response SLA
- P0 (Critical): 15 minutes
- P1 (High): 1 hour
- P2 (Medium): 4 hours
```

**Aufwand:** 1-2 Stunden (mit Stakeholdern abstimmen)
**Risiko:** Niedrig - Dokumentation

---

## 🟡 MITTEL: Nächster Sprint (Priorität 2)

### 3. JWT Secret Rotation Operationalisieren

**Aktueller Stand:**
- Manueller Helper existiert: `scripts/rotate-jwt-secret.mjs`
- `docs/SECURITY.md` verweist auf den Helper.
- Grace Period und Session-Invalidierung sind im Helper als operative Hinweise dokumentiert, aber nicht als automatische Runtime-Funktion umgesetzt.

**Empfehlung:** Einen Owner-geprüften Runbook-/Automation-Slice ergänzen:
- Rotation dry-run verifizieren (`--dry-run`)
- Deployment-Plattform-Schritte getrennt für `backend` und `api` festlegen
- Grace-Period-Entscheidung explizit dokumentieren
- Audit-Log-Pflicht und 401-Monitoring als Checkliste aufnehmen

**Betroffene Dateien:**
- `scripts/rotate-jwt-secret.mjs`
- `docs/SECURITY.md`
- optional `docs/DEPLOYMENT.md`

**Aufwand:** 2-4 Stunden
**Risiko:** Mittel - Staging-Probe vor Production-Rotation

---

### 4. Token Refresh Rotation

**Aktueller Stand:**
- Access Token: 15 Minuten
- Refresh Token: 30 Tage
- **FEHLEND:** Refresh-Token-Rotation bei Verwendung

**Empfehlung:** Refresh-Token rotieren bei jedem Use (Refresh-Token-Reuse-Erkennung)

**Betroffene Datei:** `backend/src/routes/auth.ts`

**Aufwand:** 6-8 Stunden
**Risiko:** Mittel - Breaking Change für Clients

---

### 5. API-Key Rotation für backend-alerts

**Aktueller Stand:** Static API-Key in `apps/backend-alerts/src/auth/authMiddleware.ts`

**Empfehlung:** 
- Key-Rotation unterstützen
- Multiple keys mit Grace Period
- Audit-Logging für Key-Usage

**Aufwand:** 4-6 Stunden
**Risiko:** Niedrig

---

### 6. Security Monitoring Enhance

**Aktuell:** Basic security signals in `backend/src/observability/securitySignals.ts`

**Empfehlungen:**
- [ ] Failed-Login-Rate-Alerting (>5失败的 Versuche/Minute/IP)
- [ ] Token-Theft-Erkennung (Token von neuer IP/User-Agent)
- [ ] Rate-Limit-Breach-Alerting
- [ ] Sentry Integration für Security-Events

**Aufwand:** 8-12 Stunden
**Risiko:** Niedrig

---

## 🟢 NIEDRIG: Backlog (Priorität 3)

### 7. Content Security Policy Report-Only Mode

**Empfehlung:** CSP zunächst mit `Content-Security-Policy-Report-Only` testen

**Betroffen:** `backend/src/http/serverSecurity.ts`

**Aufwand:** 2 Stunden
**Risiko:** Sehr niedrig

---

### 8. Dependency Audit Automation

**Aktuell:** `pnpm audit` in CI blockiert High/Critical

**Empfehlung:**
- Täglichen automatischen Audit-Job
- Dependabot/Renovate für automatische Updates
- Lockfile-Integrity-Checks

**Aufwand:** 4 Stunden
**Risiko:** Niedrig

---

### 9. Security Header Testing

**Empfehlung:** E2E-Tests für Security Headers

```typescript
// playwright/tests/security-headers.spec.ts
test('Security headers are present', async ({ page }) => {
  const response = await page.goto('/');
  expect(response.headers()['x-frame-options']).toBe('DENY');
  expect(response.headers()['x-content-type-options']).toBe('nosniff');
  expect(response.headers()['content-security-policy']).toBeDefined();
});
```

**Aufwand:** 3-4 Stunden
**Risiko:** Niedrig

---

## 📊 Metriken & Success Criteria

| Metric | Current | Target | Timeline |
|--------|---------|--------|----------|
| Auth Coverage | 0% (disabled) | 100% | Sprint 1 |
| JWT Rotation | Manual helper available | Operational runbook / automation | Sprint 2 |
| Incident Response Time | Undefined | <15min (P0) | Sprint 1 |
| Security Test Coverage | 8 tests | 20+ tests | Sprint 2 |
| Critical Vulnerabilities | 0 | 0 | Ongoing |

---

## 🎯 Nächste Schritte (Diese Woche)

1. **[SOFORT]** Security Team für Incident-Response-Kanal-Freigabe kontaktieren
2. **[2 Tage]** Auth im Frontend aktivieren + End-to-End testen
3. **[3 Tage]** JWT Rotation operationalisieren (Runbook, Grace-Period-Entscheidung, Monitoring)
4. **[5 Tage]** Security Monitoring Alerts konfigurieren

---

## 📚 Referenzen

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [JWT Best Practices](https://datatracker.ietf.org/doc/html/rfc8725)
- [CSP Guide](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)
- Internal: `docs/SECURITY.md`
- Internal: `backend/tests/integration/auth-security.spec.ts`

---

**Owner:** Security Team
**Last Updated:** 2026-05-28
**Next Review:** 2026-06-04
