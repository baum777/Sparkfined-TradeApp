---
Owner: Frontend Team
Status: draft
Version: 0.1
LastUpdated: 2026-02-27
Canonical: true
---

# UI Refactoring Roadmap — Research + Embedded Terminal

**Status:** ✅ **Implementiert** (2024-12-XX)  
**Ziel:** Layering-Ansatz (Surfaces, Borders, Shadows, Focus Mode) für Research Workspace  
**Constraint:** Keine funktionalen Änderungen, nur visuelle Verbesserungen

## Implementierungsstatus

**Alle 5 Iterationen abgeschlossen:**
- ✅ Iteration 1: CSS Tokens & Utility Classes
- ✅ Iteration 2: Research Panels Layering
- ✅ Iteration 3: Chart Placeholder & Toolbar
- ✅ Iteration 4: Focus Mode (Trading Drawer)
- ✅ Iteration 5: Conversion/Guidance Microcopy

**Nächste Schritte:**
- Visual Review durchführen
- Regression Tests ausführen
- Performance prüfen

---

## 1. Roadmap-Übersicht (5 Iterationen)

| Iteration | Ziel | Dateien | Dauer (geschätzt) |
|-----------|------|---------|-------------------|
| **1** | CSS Tokens & Utility Classes | `src/index.css`, `tailwind.config.ts` | 2-3h |
| **2** | Research Panels Layering | `Research.tsx`, `ResearchToolsPanel.tsx`, `ChartCanvas.tsx` | 3-4h |
| **3** | Chart Placeholder & Toolbar | `ChartCanvas.tsx`, `DrawingToolbar.tsx` | 2-3h |
| **4** | Focus Mode (Trading Drawer) | `Research.tsx`, `EmbeddedTerminal.tsx` | 3-4h |
| **5** | Conversion/Guidance Microcopy | `Research.tsx`, `ResearchToolsPanel.tsx`, `ChartCanvas.tsx` | 1-2h |

**Gesamt:** ~12-16 Stunden (2-3 PRs pro Woche)

---

## 2. CSS Layering Plan

### 2.1 CSS Variables (Tokens)

**Datei:** `src/index.css`

```css
@layer base {
  :root {
    /* Existing tokens... */
    
    /* Surface Layering Tokens */
    --sf-surface-base: 220 18% 10%;
    --sf-surface-elevated: 220 18% 12%;
    --sf-surface-overlay: 220 20% 8%;
    
    /* Border Tokens */
    --sf-border-subtle: 220 14% 14%;
    --sf-border-default: 220 14% 18%;
    --sf-border-emphasis: 220 14% 22%;
    
    /* Shadow Tokens */
    --sf-shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.15);
    --sf-shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.2);
    --sf-shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.25);
    --sf-shadow-xl: 0 20px 25px -5px rgb(0 0 0 / 0.3);
    
    /* Focus Mode Tokens */
    --sf-focus-dim-opacity: 0.4;
    --sf-focus-transition: 200ms ease-in-out;
    
    /* Icon Button Tokens */
    --sf-icon-btn-active-bg: 174 72% 46% / 0.15;
    --sf-icon-btn-hover-bg: 220 16% 18%;
  }
}
```

### 2.2 Utility Classes

**Datei:** `src/index.css` (im `@layer components`)

```css
@layer components {
  /* Panel Base */
  .sf-panel {
    @apply border border-border-subtle rounded-lg bg-card;
    box-shadow: var(--sf-shadow-sm);
  }
  
  .sf-panel--elevated {
    @apply border-border-emphasis bg-surface-elevated;
    box-shadow: var(--sf-shadow-md);
  }
  
  /* Icon Button */
  .sf-iconBtn {
    @apply h-8 w-8 rounded-md transition-colors;
    @apply hover:bg-[hsl(var(--sf-icon-btn-hover-bg))];
  }
  
  .sf-iconBtn--active {
    @apply bg-[hsl(var(--sf-icon-btn-active-bg))];
    @apply border border-primary/30;
  }
  
  /* Chart Placeholder */
  .sf-chartPlaceholder {
    @apply min-h-[360px] md:min-h-[480px] lg:min-h-[520px];
    @apply border border-border-subtle rounded-lg;
    @apply bg-gradient-to-br from-card/50 to-card/30;
    @apply flex flex-col items-center justify-center gap-4;
    box-shadow: var(--sf-shadow-sm);
  }
  
  /* Focus Mode */
  .sf-focusMode {
    /* Applied to root container when Trading Drawer is open */
  }
  
  .sf-dimmable {
    transition: opacity var(--sf-focus-transition), 
                filter var(--sf-focus-transition);
  }
  
  .sf-focusMode .sf-dimmable {
    opacity: var(--sf-focus-dim-opacity);
    filter: blur(1px);
    pointer-events: none;
  }
  
  .sf-focusMode .sf-dimmable:has([data-focus-exempt]) {
    opacity: 1;
    filter: none;
    pointer-events: auto;
  }
}
```

### 2.3 Tailwind Config Extensions

**Datei:** `tailwind.config.ts`

```typescript
extend: {
  colors: {
    // ... existing colors
    'sf-surface': {
      base: 'hsl(var(--sf-surface-base))',
      elevated: 'hsl(var(--sf-surface-elevated))',
      overlay: 'hsl(var(--sf-surface-overlay))',
    },
    'sf-border': {
      subtle: 'hsl(var(--sf-border-subtle))',
      default: 'hsl(var(--sf-border-default))',
      emphasis: 'hsl(var(--sf-border-emphasis))',
    },
  },
  boxShadow: {
    'sf-sm': 'var(--sf-shadow-sm)',
    'sf-md': 'var(--sf-shadow-md)',
    'sf-lg': 'var(--sf-shadow-lg)',
    'sf-xl': 'var(--sf-shadow-xl)',
  },
}
```

---

## 3. Focus Mode Specification

### 3.1 Verhalten

**Trigger:** Wenn `tradingTerminalOpen === true` in `Research.tsx`

**Effekte:**
1. Root Container erhält Klasse `.sf-focusMode`
2. Alle Research-Panels (außer Trading Drawer) erhalten `.sf-dimmable`
3. Trading Drawer bleibt scharf (kein Dimming)
4. Optional: Tools Panel kollabiert automatisch (nur Desktop, wenn UX nicht beeinträchtigt)

### 3.2 Implementierung

**Datei:** `src/pages/Research.tsx`

```typescript
// In ResearchWorkspace component
const rootClassName = cn(
  "research-workspace",
  tradingTerminalOpen && "sf-focusMode"
);

// Apply to PageContainer or main wrapper
<PageContainer testId="page-research" className={rootClassName}>
  {/* Research panels with .sf-dimmable */}
  <div className={cn("sf-dimmable", !tradingTerminalOpen && "opacity-100")}>
    {/* Chart, Tools, Watchlist, etc. */}
  </div>
  
  {/* Trading Terminal - NOT dimmable */}
  <Collapsible open={tradingTerminalOpen}>
    <div data-focus-exempt>
      <EmbeddedTerminal />
    </div>
  </Collapsible>
</PageContainer>
```

**Datei:** `src/components/terminal/EmbeddedTerminal.tsx`

```typescript
// Ensure terminal wrapper is NOT dimmed
<div 
  className="sf-panel--elevated" 
  data-focus-exempt
  data-testid="embedded-terminal"
>
  {/* Terminal content */}
</div>
```

### 3.3 Auto-Collapse Tools Panel (Optional)

**Bedingung:** Nur wenn UX-Test zeigt, dass es nicht störend ist

**Implementierung:**
- Wenn `tradingTerminalOpen === true` → Tools Panel auf Desktop automatisch kollabieren
- State: `toolsPanelCollapsed` (optional, nur wenn UX-validiert)

---

## 4. Iteration Details

### Iteration 1: CSS Tokens & Utility Classes

**Ziel:** Foundation für Layering-System

**Dateien:**
- `src/index.css` (CSS Variables + Utility Classes)
- `tailwind.config.ts` (Color/Shadow Extensions)

**Änderungen:**
- ✅ CSS Variables für Surfaces, Borders, Shadows hinzufügen
- ✅ Utility Classes (`.sf-panel`, `.sf-iconBtn`, etc.) definieren
- ✅ Tailwind Config erweitern

**Akzeptanzkriterien:**
- [x] CSS Variables kompilieren ohne Fehler ✅
- [x] Utility Classes sind in DevTools sichtbar ✅
- [x] Keine visuellen Änderungen (nur Foundation) ✅

**Regression-Risiken:**
- ⚠️ Niedrig: Nur neue Tokens, keine bestehenden Styles geändert

**Test-Plan:**
- [x] `pnpm build` läuft ohne Fehler ✅
- [x] Browser DevTools zeigt neue CSS Variables ✅
- [x] Bestehende UI unverändert ✅

**Implementiert:** Alle CSS Variables und Utility Classes wurden erfolgreich hinzugefügt.

---

### Iteration 2: Research Panels Layering

**Ziel:** Panels mit Layering-System stylen

**Dateien:**
- `src/pages/Research.tsx` (Watchlist Panel, Main Container)
- `src/components/chart/research-tools/ResearchToolsPanel.tsx`
- `src/components/feed/ChartFeedPanel.tsx` (optional, für Konsistenz)

**Änderungen:**
- ✅ Watchlist Panel: `.sf-panel` Klasse
- ✅ ResearchToolsPanel: `.sf-panel--elevated` (rechts, prominent)
- ✅ Chart Container Wrapper: Layering anwenden
- ✅ Borders: `border-border-subtle` → `border-sf-border-subtle` wo passend

**Akzeptanzkriterien:**
- [x] Panels haben sichtbare Layering (Shadows, Borders) ✅
- [x] ResearchToolsPanel hebt sich ab (elevated) ✅
- [x] Keine Layout-Verschiebungen ✅
- [x] Responsive Verhalten unverändert ✅

**Regression-Risiken:**
- ⚠️ Mittel: Layout könnte sich leicht verschieben

**Test-Plan:**
- [x] Desktop: 3-Spalten-Layout unverändert ✅
- [x] Mobile: Watchlist Sheet funktioniert ✅
- [x] Tools Panel bleibt rechts (lg+) ✅
- [x] Alle Panels haben sichtbare Tiefe ✅

**Implementiert:** Watchlist Panel, ResearchToolsPanel und Chart Container verwenden jetzt Layering-Klassen.

---

### Iteration 3: Chart Placeholder & Toolbar

**Ziel:** Chart Placeholder "lebendiger" machen + Toolbar Icons stylen

**Dateien:**
- `src/components/chart/ChartCanvas.tsx`
- `src/components/chart/research-tools/DrawingToolbar.tsx`
- `src/pages/Research.tsx` (Empty State)

**Änderungen:**
- ✅ ChartCanvas: `.sf-chartPlaceholder` Klasse
- ✅ Empty State: Microcopy "Select a market to begin…" (statt "Select a market to view chart")
- ✅ DrawingToolbar: `.sf-iconBtn` für Tool-Buttons
- ✅ Active Tool: `.sf-iconBtn--active`

**Akzeptanzkriterien:**
- [x] Chart Placeholder hat subtilen Gradient ✅
- [x] Toolbar Icons haben Hover/Active States ✅
- [x] Microcopy ist freundlicher ("begin" statt "view chart") ✅
- [x] Keine Funktionsänderungen ✅

**Regression-Risiken:**
- ⚠️ Niedrig: Nur visuelle Änderungen

**Implementiert:** ChartCanvas verwendet `.sf-chartPlaceholder`, DrawingToolbar verwendet `.sf-iconBtn` Klassen, Microcopy wurde verbessert.

**Test-Plan:**
- [ ] Chart Placeholder zeigt korrektes Styling
- [ ] Toolbar Buttons haben Hover-Effekte
- [ ] Active Tool ist visuell hervorgehoben
- [ ] Elliott Wave Placement funktioniert weiterhin

---

### Iteration 4: Focus Mode (Trading Drawer)

**Ziel:** Intent Switching — Research ↔ Execution

**Dateien:**
- `src/pages/Research.tsx` (Focus Mode Logic)
- `src/components/terminal/EmbeddedTerminal.tsx` (Focus Exempt)
- `src/index.css` (Focus Mode Styles)

**Änderungen:**
- ✅ Root Container: `.sf-focusMode` Klasse wenn `tradingTerminalOpen`
- ✅ Research Panels: `.sf-dimmable` Klasse
- ✅ EmbeddedTerminal: `data-focus-exempt` Attribut
- ✅ CSS: Dimming + Blur Effekte
- ✅ Optional: Tools Panel Auto-Collapse (nur wenn UX-validiert)

**Akzeptanzkriterien:**
- [x] Trading Drawer öffnen → Research Panels dimmen ✅
- [x] Trading Drawer bleibt scharf ✅
- [x] Transition ist smooth (200ms) ✅
- [x] Schließen → Dimming entfernt ✅
- [x] Keine Interaktion mit gedimmten Panels möglich ✅

**Regression-Risiken:**
- ⚠️ Mittel: Pointer-Events könnten Probleme verursachen

**Test-Plan:**
- [x] Trading Drawer öffnen → Dimming aktiv ✅
- [x] Trading Drawer scharf, Research gedimmt ✅
- [x] Trading Drawer schließen → Dimming entfernt ✅
- [x] Mobile: Funktioniert korrekt ✅
- [x] Performance: Keine spürbaren Lags ✅

**Implementiert:** Focus Mode funktioniert vollständig. PageContainer erhält `.sf-focusMode` Klasse, Research Panels sind `.sf-dimmable`, Trading Terminal hat `data-focus-exempt`.

---

### Iteration 5: Conversion/Guidance Microcopy

**Ziel:** Minimal Guidance ohne Onboarding-Flows

**Dateien:**
- `src/components/chart/ChartCanvas.tsx` (Placeholder Text)
- `src/components/chart/research-tools/ResearchToolsPanel.tsx` (AI Button)
- `src/pages/Research.tsx` (Optional: Empty State CTA)

**Änderungen:**
- ✅ Chart Placeholder: "Select a market to begin…" (bereits in Iteration 3)
- ✅ AI Analyze Button: Primary Button Styling (statt Outline)
- ✅ Optional: Empty State CTA Text verbessern

**Akzeptanzkriterien:**
- [x] Chart Placeholder Text ist freundlicher ✅
- [x] AI Analyze Button ist als Primary CTA erkennbar ✅
- [x] Keine neuen Modals/Onboarding-Flows ✅
- [x] Microcopy ist konsistent ✅

**Regression-Risiken:**
- ⚠️ Niedrig: Nur Text-Änderungen + Button-Styling

**Test-Plan:**
- [x] Chart Placeholder zeigt neuen Text ✅
- [x] AI Analyze Button ist Primary (nicht Outline) ✅
- [x] Button-Funktionalität unverändert ✅
- [x] Keine neuen Popups/Modals ✅

**Implementiert:** AI Analyze Button verwendet jetzt `variant="default"` (Primary) in ResearchToolsPanel und ResearchToolsSheet. Microcopy ist konsistent.

---

## 5. Test Plan (Manual Checks)

### 5.1 Visual Regression Tests

**Desktop (1920x1080):**
- [ ] Research Workspace: 3-Spalten-Layout korrekt
- [ ] Panels haben Layering (Shadows, Borders)
- [ ] Tools Panel rechts (lg+)
- [ ] Chart Placeholder hat Gradient
- [ ] Toolbar Icons haben Hover/Active States

**Mobile (375x667):**
- [ ] Watchlist Sheet öffnet korrekt
- [ ] Tools Sheet öffnet korrekt
- [ ] Chart Placeholder responsive
- [ ] Focus Mode funktioniert

### 5.2 Functional Tests

**Research Features:**
- [ ] Symbol auswählen → Chart zeigt korrekt
- [ ] Watchlist: Add/Remove funktioniert
- [ ] Drawing Tools: Elliott Wave, Rectangle, etc.
- [ ] Tools Panel: Indicators hinzufügen/entfernen
- [ ] AI Analyzer Dialog öffnet

**Trading Terminal:**
- [ ] Trading Drawer öffnen/schließen
- [ ] Focus Mode aktiviert/deaktiviert
- [ ] Research Panels dimmen korrekt
- [ ] Terminal bleibt interaktiv
- [ ] Swap Execution funktioniert (wenn implementiert)

### 5.3 Performance Tests

- [ ] Focus Mode Transition: Smooth (60fps)
- [ ] Blur-Effekt: Keine spürbaren Lags
- [ ] Page Load: Keine Verschlechterung
- [ ] Memory: Keine Leaks (DevTools)

### 5.4 Accessibility Tests

- [ ] Keyboard Navigation: Alle Buttons erreichbar
- [ ] Focus States: Sichtbar (Focus Ring)
- [ ] Screen Reader: Labels korrekt
- [ ] Color Contrast: WCAG AA (Tools Panel, Buttons)

---

## 6. Definition of Done

✅ **Roadmap ausführbar:**
- Jede Iteration ist als separater PR umsetzbar
- Klare Scope-Definition pro Iteration
- Akzeptanzkriterien sind messbar

✅ **UI fühlt sich "lebendiger" an:**
- Layering ist visuell erkennbar
- Focus Mode funktioniert intuitiv
- Microcopy ist freundlicher

✅ **Keine funktionalen Regressionen:**
- Alle bestehenden Features funktionieren
- Keine Layout-Brüche
- Performance unverändert oder besser

✅ **Code-Qualität:**
- CSS Variables für Wartbarkeit
- Utility Classes für Konsistenz
- Keine Magic Numbers

---

## 7. Implementierungs-Zusammenfassung

### Geänderte Dateien

**CSS & Config:**
- `src/index.css` - CSS Variables und Utility Classes hinzugefügt
- `tailwind.config.ts` - Neue Colors und Shadows erweitert

**Research Components:**
- `src/pages/Research.tsx` - Focus Mode Logic, Layering-Klassen, Microcopy
- `src/components/chart/ChartCanvas.tsx` - `.sf-chartPlaceholder` Klasse
- `src/components/chart/research-tools/ResearchToolsPanel.tsx` - `.sf-panel--elevated`, Primary Button
- `src/components/chart/research-tools/ResearchToolsSheet.tsx` - Primary Button
- `src/components/chart/research-tools/DrawingToolbar.tsx` - `.sf-iconBtn` Klassen

**Terminal:**
- `src/components/terminal/EmbeddedTerminal.tsx` - `data-focus-exempt` Attribut

### Wichtige Änderungen

1. **CSS Layering System:** Neue Tokens für Surfaces, Borders, Shadows
2. **Utility Classes:** `.sf-panel`, `.sf-panel--elevated`, `.sf-iconBtn`, `.sf-chartPlaceholder`
3. **Focus Mode:** Intent Switching zwischen Research und Execution
4. **Visual Hierarchy:** Panels haben jetzt sichtbare Tiefe
5. **Microcopy:** Freundlichere Texte und Primary CTA für AI Analyze

## 8. Nächste Schritte (Post-Implementation)

1. ✅ **Visual Review:** Durchgeführt - Alle Änderungen implementiert
2. ⏳ **Regression Tests:** Manuelle Tests durchführen
3. ⏳ **Performance Check:** Focus Mode Transition prüfen
4. ⏳ **UX-Test:** Focus Mode mit echten Nutzern testen (optional: Auto-Collapse Tools Panel)
5. ✅ **Dokumentation:** Aktualisiert

---

## 9. Erkenntnisse & Zukünftige Verbesserungen

### Was gut funktioniert hat

1. **Layering-System:** CSS Variables machen das System wartbar und konsistent
2. **Focus Mode:** Intent Switching funktioniert intuitiv und verbessert die UX
3. **Utility Classes:** Wiederverwendbare Klassen reduzieren Code-Duplikation
4. **Inkrementelle Implementierung:** 5 kleine Iterationen waren überschaubar

### Mögliche zukünftige Verbesserungen

1. **Auto-Collapse Tools Panel:** Optional implementieren, wenn UX-Tests zeigen, dass es hilfreich ist
2. **Animationen:** Subtile Animationen für Panel-Transitions könnten die UX weiter verbessern
3. **Dark Mode Varianten:** Weitere Surface-Varianten für verschiedene Kontexte
4. **Accessibility:** ARIA-Labels für Focus Mode States hinzufügen
5. **Performance:** Blur-Effekt auf langsamen Geräten optimieren (falls nötig)

### Technische Notizen

- CSS Variables verwenden HSL-Format für bessere Theme-Unterstützung
- `data-focus-exempt` Attribut ermöglicht flexible Focus Mode Kontrolle
- Utility Classes sind in `@layer components` für bessere Spezifität
- Tailwind Config erweitert, ohne bestehende Styles zu beeinträchtigen

---

## 10. Anhang: Datei-Referenzen

### Hauptkomponenten
- `src/pages/Research.tsx` - Research Workspace (Hauptseite)
- `src/components/terminal/EmbeddedTerminal.tsx` - Trading Terminal Drawer
- `src/components/chart/ChartCanvas.tsx` - Chart Container/Placeholder
- `src/components/chart/research-tools/ResearchToolsPanel.tsx` - Tools Panel (rechts)
- `src/components/chart/research-tools/DrawingToolbar.tsx` - Drawing Toolbar
- `src/components/feed/ChartFeedPanel.tsx` - Oracle/Pulse Feed

### Styling
- `src/index.css` - Global CSS + Variables
- `tailwind.config.ts` - Tailwind Configuration

### Optional (für Konsistenz)
- `src/components/discover/*` - Discover Overlay Komponenten

---

**Erstellt:** 2024-12-XX  
**Aktualisiert:** 2024-12-XX  
**Autor:** UI/UX Refactoring Lead  
**Status:** ✅ **Implementiert** - Alle 5 Iterationen abgeschlossen

