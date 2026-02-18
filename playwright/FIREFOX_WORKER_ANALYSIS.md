# Firefox Worker Analysis

## Test Results by Worker Count

| Workers | Passed | Failed | Pass Rate | Status |
|---------|--------|--------|-----------|--------|
| **1** | 28 | 4 | 87.5% | ✅ Best |
| **2** | 21 | 11 | 65.6% | ⚠️ Degraded |
| **4** | 19 | 13 | 59.4% | ❌ Worst |

## Conclusion

**Firefox kippt bereits bei workers=2**

- **workers=1**: Beste Performance (28/32 = 87.5%)
- **workers=2**: Deutliche Verschlechterung (21/32 = 65.6%)
- **workers=4**: Weitere Verschlechterung (19/32 = 59.4%)

## Failure Pattern

Die meisten Fehler sind:
- Navigation timeouts (`page.goto()` timeouts)
- Connection refused errors (`NS_ERROR_CONNECTION_REFUSED`)
- Resource contention bei paralleler Ausführung

## Recommendation

**Firefox sollte mit workers=1 laufen** für deterministische Ergebnisse.

## CI Configuration Recommendation

```typescript
// playwright.config.ts
workers: process.env.CI 
  ? (process.env.PLAYWRIGHT_PROJECT === 'firefox' ? 1 : 2)
  : undefined,
```

Oder separate CI jobs:
- Chromium/Webkit: workers=2
- Firefox: workers=1 (separate job)

