# User Flow Simulations

**Datum:** 2024-12-19  
**Ziel:** 5 realistische Trader-Szenarien mit Systemverhalten, Bruchstellen und Verbesserungen

---

## 1) Conservative Swing Trader

### Profile
- **Typ:** Langfristiger Investor, geringe Trade-Frequenz
- **Ziel:** Große Positionen (10k+ USDC) mit niedriger Slippage
- **Risikotoleranz:** Niedrig
- **Tools:** Research Tab + Terminal für Execution

### Start
- **Entry Point:** Research Tab (`/research?q=SOL`)
- **Context:** Hat SOL analysiert, möchte 10k USDC → SOL kaufen

### Steps
1. **Research Tab öffnen**
   - Wählt Symbol "SOL" aus Watchlist
   - Chart lädt, analysiert Trends
   - **Expected:** Chart zeigt SOL/USD, Research Tools verfügbar
   - **Risk:** Chart-Loading kann fehlschlagen (kein Error Boundary)

2. **Trading Terminal öffnen (Embedded)**
   - Klickt "Trading Terminal" Collapsible
   - Terminal Drawer öffnet sich
   - **Expected:** Terminal zeigt SOL/USDC Pair (via ResearchTerminalSync)
   - **Risk:** Symbol → Mint Mapping kann fehlschlagen (nur well-known mints)

3. **Wallet verbinden**
   - Klickt Wallet Connect Button
   - Wählt Phantom Wallet
   - **Expected:** Wallet verbindet, Balance wird angezeigt
   - **Risk:** Wallet Disconnect während Execution nicht handled

4. **Order konfigurieren**
   - Side: "Buy"
   - Amount: "10000" (USDC)
   - Slippage: 50bps (default)
   - Priority Fee: Disabled
   - **Expected:** Quote lädt nach 400ms Debounce, zeigt Expected Out
   - **Risk:** Quote kann stale sein (25s TTL), User sieht möglicherweise veraltete Preise

5. **Fee Preview prüfen**
   - Liest Expected Out: ~X SOL
   - Liest Min Out: ~Y SOL (mit Slippage)
   - Liest Fee: 0.65% (free tier)
   - **Expected:** Alle Werte korrekt, Fee rounded down
   - **Risk:** Keine Warnung bei extrem hoher Slippage (>5%)

6. **Swap ausführen**
   - Klickt "Buy" Button
   - Wallet zeigt Transaction Review
   - **Expected:** TX wird signiert, gesendet, confirmed
   - **Risk:** Keine TX Review UI in App (User sieht nur Wallet Review)

7. **Confirmation abwarten**
   - TX Status: "Sending..." → "Confirmed"
   - Toast erscheint mit Explorer Link
   - **Expected:** Success Toast, Explorer Link funktioniert
   - **Risk:** Toast kann übersehen werden, keine persistent Notification

### Expected Behavior
- ✅ Research Symbol → Terminal Pair Sync funktioniert
- ✅ Quote lädt korrekt, zeigt Expected Out
- ✅ Fee Calculation korrekt (round down)
- ✅ Swap Execution erfolgreich
- ✅ Transaction Confirmation mit Explorer Link

### Failure Risks
1. **Symbol → Mint Mapping fehlschlägt** (unbekanntes Symbol)
   - **Impact:** Terminal Pair bleibt leer, User muss manuell wählen
   - **Workaround:** Discover Overlay öffnen, Token auswählen
   - **Severity:** Medium

2. **Quote stale während Execution** (25s TTL überschritten)
   - **Impact:** System holt fresh quote, aber User sieht möglicherweise andere Werte
   - **Workaround:** System handled automatisch (force fetch)
   - **Severity:** Low

3. **Wallet Disconnect während Execution**
   - **Impact:** Execution schlägt fehl, keine automatische Recovery
   - **Workaround:** User muss manuell reconnecten
   - **Severity:** Medium

4. **Transaction Simulation fehlschlägt** (RPC error)
   - **Impact:** System ignoriert Fehler, TX wird trotzdem gesendet
   - **Workaround:** User sieht möglicherweise fehlgeschlagene TX
   - **Severity:** Medium

### Economic Impact
- **Fee:** 0.65% (free tier) = 65 USDC auf 10k Trade
- **Slippage:** 50bps = 50 USDC (max)
- **Total Cost:** ~115 USDC (0.115%)
- **Monetarisierung:** Fee wird korrekt berechnet und angezeigt

### UX Risk
- **Medium:** Keine TX Review UI in App (nur Wallet Review)
- **Medium:** Keine Slippage-Warnung bei extrem hohen Werten
- **Low:** Toast kann übersehen werden

### Improvement Suggestions
1. **TX Review UI:** Zeige Transaction Details vor Signing (Amount, Fee, Slippage, Route)
2. **Slippage Warning:** Warnung wenn Slippage >5% oder Price Impact >1%
3. **Persistent Notifications:** Transaction Status in Sidebar/Header (nicht nur Toast)
4. **Symbol → Mint Registry:** Erweitere Mapping über well-known mints hinaus

---

## 2) High-Frequency DeFi Degen

### Profile
- **Typ:** Aktiver Trader, viele kleine Trades
- **Ziel:** Schnelle Execution, niedrige Fees
- **Risikotoleranz:** Hoch
- **Tools:** Terminal direkt, Discover für neue Tokens

### Start
- **Entry Point:** Terminal (`/terminal`)
- **Context:** Möchte schnell mehrere kleine Swaps ausführen

### Steps
1. **Terminal öffnen**
   - Navigiert zu `/terminal`
   - Terminal lädt mit Pair Selector
   - **Expected:** Terminal zeigt Pair Selector, Chart Panel, Execution Panel
   - **Risk:** Keine Error Boundary, App kann crashen

2. **Pair auswählen**
   - Wählt "SOL/USDC" aus Pair Selector
   - **Expected:** Pair wird gesetzt, Quote lädt automatisch
   - **Risk:** Pair Selector hat nur 3 hardcoded Pairs (SOL, USDT, mSOL)

3. **Discover Overlay öffnen**
   - Klickt "Discover" Button
   - Overlay öffnet sich
   - **Expected:** Discover zeigt Token List mit Filters
   - **Risk:** Token List kann leer sein (API-Fehler)

4. **Token auswählen**
   - Filtert nach "Not Bonded" Tab
   - Wählt Token mit hoher Liquidity
   - Klickt Token Card
   - **Expected:** Pair wird gesetzt, Overlay schließt, Quote lädt
   - **Risk:** Filter Engine kann Token fälschlicherweise rejecten

5. **Schneller Swap**
   - Amount: "100" USDC
   - Side: "Buy"
   - Klickt "Buy" sofort (ohne Quote zu warten)
   - **Expected:** System wartet auf Quote, dann Execution
   - **Risk:** User kann Button klicken bevor Quote ready ist (disabled state)

6. **Mehrere Swaps hintereinander**
   - Führt 5 Swaps in Folge aus
   - Jeder Swap: 100 USDC → Token
   - **Expected:** Jeder Swap wird einzeln ausgeführt, TX Status wird aktualisiert
   - **Risk:** Race Conditions wenn User zu schnell klickt

7. **Priority Fee aktivieren**
   - Aktiviert Priority Fee für schnelleren TX
   - Setzt 10k microLamports
   - **Expected:** Priority Fee wird in Quote berücksichtigt
   - **Risk:** Keine Warnung bei extrem hohen Priority Fees

### Expected Behavior
- ✅ Discover Deep-Link funktioniert (Token → Terminal Pair)
- ✅ Schnelle Execution möglich
- ✅ Multiple Swaps funktionieren sequenziell
- ✅ Priority Fee wird korrekt angewendet

### Failure Risks
1. **Quote Race Conditions** (User ändert Inputs schnell)
   - **Impact:** Alte Quote kann neue überschreiben
   - **Workaround:** System hat requestId-Sequenzierung, sollte funktionieren
   - **Severity:** Low (gut implementiert)

2. **Token List API Fehler**
   - **Impact:** Discover zeigt leere Liste
   - **Workaround:** User kann Pair manuell wählen
   - **Severity:** Medium

3. **Filter Engine False Positives** (guter Token wird rejected)
   - **Impact:** User sieht Token nicht in Discover
   - **Workaround:** User kann Token manuell über Mint-Adresse wählen (wenn bekannt)
   - **Severity:** Low (Filter ist konservativ)

4. **Transaction Queue Stau** (viele TXs gleichzeitig)
   - **Impact:** TXs können langsam sein oder fehlschlagen
   - **Workaround:** System hat Retry-Logik (maxRetries: 3)
   - **Severity:** Medium

### Economic Impact
- **Fee:** 0.65% × 5 = 3.25 USDC (auf 500 USDC total)
- **Priority Fee:** 10k microLamports × 5 = 0.05 SOL (~$10)
- **Total Cost:** ~13.25 USDC (2.65%)
- **Monetarisierung:** Fees werden korrekt berechnet, aber Priority Fee ist teuer

### UX Risk
- **High:** Keine Warnung bei extrem hohen Priority Fees
- **Medium:** Pair Selector hat nur 3 Pairs (zu limitiert)
- **Low:** Discover kann leer sein (kein Fallback)

### Improvement Suggestions
1. **Priority Fee Warning:** Warnung wenn Priority Fee >50k microLamports
2. **Pair Selector Enhancement:** Erweitere auf Jupiter Token Registry
3. **Discover Fallback:** Zeige "No tokens found" Message mit Retry Button
4. **Transaction Queue UI:** Zeige Queue-Status wenn mehrere TXs pending

---

## 3) Research-Driven Analyst

### Profile
- **Typ:** Fundamental Analyst, nutzt Research Tools
- **Ziel:** Tiefe Analyse vor Execution
- **Risikotoleranz:** Mittel
- **Tools:** Research Tab mit Tools, Terminal für Execution

### Start
- **Entry Point:** Research Tab (`/research?q=SOL`)
- **Context:** Analysiert SOL Chart, möchte Position eingehen

### Steps
1. **Research Tab öffnen**
   - Wählt Symbol "SOL"
   - Chart lädt
   - **Expected:** Chart zeigt SOL/USD mit Timeframe Selector
   - **Risk:** Chart kann fehlschlagen (kein Error Boundary)

2. **Research Tools nutzen**
   - Aktiviert SMA Indicator (20 Period)
   - Zeichnet Elliott Wave Pattern
   - **Expected:** Indicators werden angezeigt, Drawings gespeichert
   - **Risk:** Drawings können verloren gehen (localStorage, aber kein Sync)

3. **AI TA Analyzer öffnen**
   - Klickt "AI Analyzer" Button
   - Dialog öffnet sich
   - **Expected:** AI analysiert Chart, gibt Insights
   - **Risk:** AI kann fehlschlagen (Backend-Error), keine Error Handling

4. **Trading Terminal öffnen**
   - Klickt "Trading Terminal" Collapsible
   - Terminal Drawer öffnet sich
   - **Expected:** Terminal zeigt SOL/USDC Pair (via ResearchTerminalSync)
   - **Risk:** Symbol → Mint Mapping kann fehlschlagen

5. **Order konfigurieren**
   - Amount: "5000" USDC
   - Slippage: 100bps (höher für größere Trades)
   - **Expected:** Quote lädt, zeigt Expected Out
   - **Risk:** Quote kann stale sein

6. **Execution**
   - Klickt "Buy" Button
   - TX wird signiert und gesendet
   - **Expected:** Success Toast mit Explorer Link
   - **Risk:** Keine TX Review UI in App

### Expected Behavior
- ✅ Research Tools funktionieren (Indicators, Drawings)
- ✅ AI Analyzer gibt Insights
- ✅ Research → Terminal Sync funktioniert
- ✅ Execution erfolgreich

### Failure Risks
1. **AI Analyzer Backend-Fehler**
   - **Impact:** Dialog zeigt Error, keine Insights
   - **Workaround:** User kann manuell analysieren
   - **Severity:** Medium

2. **Drawings verloren** (localStorage clear)
   - **Impact:** User verliert Elliott Wave Patterns
   - **Workaround:** Kein Workaround (localStorage-basiert)
   - **Severity:** Low (nicht kritisch)

3. **Symbol → Mint Mapping fehlschlägt**
   - **Impact:** Terminal Pair bleibt leer
   - **Workaround:** User kann Pair manuell wählen
   - **Severity:** Medium

### Economic Impact
- **Fee:** 0.65% = 32.5 USDC (auf 5k Trade)
- **Slippage:** 100bps = 50 USDC (max)
- **Total Cost:** ~82.5 USDC (0.165%)
- **Monetarisierung:** Fee wird korrekt berechnet

### UX Risk
- **Medium:** AI Analyzer kann fehlschlagen (kein Error Handling)
- **Low:** Drawings können verloren gehen
- **Low:** Keine TX Review UI

### Improvement Suggestions
1. **AI Analyzer Error Handling:** Zeige Error State mit Retry Button
2. **Drawings Sync:** Backend-Sync für Drawings (optional)
3. **TX Review UI:** Zeige Transaction Details vor Signing
4. **Research → Terminal Bidirectional Sync:** Terminal Pair → Research Symbol (optional)

---

## 4) Discover-Only Momentum Trader

### Profile
- **Typ:** Momentum Trader, nutzt nur Discover
- **Ziel:** Schnelle Token-Entdeckung, sofortige Execution
- **Risikotoleranz:** Sehr hoch
- **Tools:** Discover Overlay, Terminal

### Start
- **Entry Point:** Terminal (`/terminal`) → Discover Button
- **Context:** Möchte neue Tokens entdecken und schnell traden

### Steps
1. **Terminal öffnen**
   - Navigiert zu `/terminal`
   - **Expected:** Terminal lädt
   - **Risk:** Keine Error Boundary

2. **Discover öffnen**
   - Klickt "Discover" Button
   - Overlay öffnet sich
   - **Expected:** Discover zeigt Token List
   - **Risk:** Token List kann leer sein

3. **Filter anpassen**
   - Wählt "Not Bonded" Tab
   - Setzt Preset: "bundler_exclusion_gate"
   - Filtert nach Min Liquidity: 10 SOL
   - **Expected:** Token List wird gefiltert
   - **Risk:** Filter kann zu restriktiv sein (keine Tokens)

4. **Token auswählen**
   - Wählt Token mit hohem Score (Ranked Tab)
   - Klickt Token Card
   - **Expected:** Pair wird gesetzt, Overlay schließt, Quote lädt
   - **Risk:** Token kann bereits rug pull haben (Filter ist nicht perfekt)

5. **Schneller Swap**
   - Amount: "500" USDC
   - Side: "Buy"
   - Klickt "Buy" sofort
   - **Expected:** Execution erfolgreich
   - **Risk:** Token kann illiquid sein (Quote kann fehlschlagen)

6. **Mehrere Tokens testen**
   - Wiederholt Steps 3-5 für 3 verschiedene Tokens
   - **Expected:** Jeder Swap funktioniert
   - **Risk:** Rate Limiting kann aktiv werden

### Expected Behavior
- ✅ Discover Filter funktioniert korrekt
- ✅ Token Deep-Link funktioniert
- ✅ Schnelle Execution möglich
- ✅ Multiple Swaps funktionieren

### Failure Risks
1. **Filter zu restriktiv** (keine Tokens gefunden)
   - **Impact:** Discover zeigt leere Liste
   - **Workaround:** User kann Filter lockern
   - **Severity:** Low

2. **Token bereits rug pull** (Filter False Negative)
   - **Impact:** User kauft Token das bereits wertlos ist
   - **Workaround:** Kein Workaround (Filter ist nicht perfekt)
   - **Severity:** High (aber User-Risiko)

3. **Quote fehlschlägt** (Token illiquid)
   - **Impact:** Execution schlägt fehl, User sieht Error
   - **Workaround:** User kann anderes Token wählen
   - **Severity:** Medium

4. **Rate Limiting** (zu viele API calls)
   - **Impact:** Quote API gibt 429 Error
   - **Workaround:** System hat Retry-Logik, aber kann langsam sein
   - **Severity:** Medium

### Economic Impact
- **Fee:** 0.65% × 3 = 9.75 USDC (auf 1500 USDC total)
- **Slippage:** 50bps × 3 = 22.5 USDC (max)
- **Total Cost:** ~32.25 USDC (2.15%)
- **Monetarisierung:** Fees werden korrekt berechnet

### UX Risk
- **High:** Keine Warnung bei riskanten Tokens (Filter ist nicht perfekt)
- **Medium:** Discover kann leer sein
- **Low:** Rate Limiting kann langsam sein

### Improvement Suggestions
1. **Risk Warning:** Zeige Warnung bei neuen Tokens (<24h alt)
2. **Liquidity Check:** Zeige Liquidity-Warnung wenn <50 SOL
3. **Discover Fallback:** Zeige "No tokens found" mit Filter-Suggestions
4. **Rate Limiting UI:** Zeige "Rate limited, please wait" Message

---

## 5) New User (Wallet + First Swap)

### Profile
- **Typ:** Neuer User, erste Erfahrung mit Sparkfined
- **Ziel:** Ersten Swap ausführen
- **Risikotoleranz:** Unbekannt
- **Tools:** Terminal (einfachster Entry Point)

### Start
- **Entry Point:** Terminal (`/terminal`)
- **Context:** Hat noch nie getradet, möchte es ausprobieren

### Steps
1. **Terminal öffnen**
   - Navigiert zu `/terminal`
   - **Expected:** Terminal lädt, zeigt Pair Selector
   - **Risk:** Keine Onboarding-Hilfe

2. **Wallet verbinden**
   - Klickt Wallet Connect Button
   - Wählt Phantom Wallet
   - **Expected:** Wallet verbindet, Balance wird angezeigt
   - **Risk:** User hat möglicherweise kein Wallet installiert

3. **Pair auswählen**
   - Wählt "SOL/USDC" aus Pair Selector
   - **Expected:** Pair wird gesetzt, Quote lädt
   - **Risk:** User versteht möglicherweise nicht was "Pair" bedeutet

4. **Order konfigurieren**
   - Side: "Buy" (default)
   - Amount: "10" USDC (kleiner Test-Swap)
   - **Expected:** Quote lädt, zeigt Expected Out
   - **Risk:** User versteht möglicherweise nicht was "Expected Out" bedeutet

5. **Fee Preview prüfen**
   - Liest Fee: 0.65%
   - **Expected:** User versteht Fee-Struktur
   - **Risk:** User versteht möglicherweise nicht was "Fee" bedeutet

6. **Swap ausführen**
   - Klickt "Buy" Button
   - Wallet zeigt Transaction Review
   - **Expected:** User signiert TX, Execution erfolgreich
   - **Risk:** User ist möglicherweise verwirrt von Wallet Review (keine App-Review)

7. **Confirmation abwarten**
   - TX Status: "Sending..." → "Confirmed"
   - Toast erscheint
   - **Expected:** User sieht Success Toast
   - **Risk:** User übersieht möglicherweise Toast

### Expected Behavior
- ✅ Terminal lädt korrekt
- ✅ Wallet verbindet
- ✅ Pair wird gesetzt
- ✅ Quote lädt
- ✅ Execution erfolgreich

### Failure Risks
1. **Kein Wallet installiert**
   - **Impact:** User kann nicht traden
   - **Workaround:** Kein Workaround (Wallet erforderlich)
   - **Severity:** High (aber erwartet)

2. **User versteht UI nicht** (keine Onboarding-Hilfe)
   - **Impact:** User ist verwirrt, gibt auf
   - **Workaround:** Kein Workaround
   - **Severity:** High

3. **Transaction Review verwirrend** (nur Wallet Review, keine App-Review)
   - **Impact:** User ist unsicher ob TX sicher ist
   - **Workaround:** Kein Workaround
   - **Severity:** Medium

4. **Toast übersehen** (keine persistent Notification)
   - **Impact:** User weiß nicht ob Swap erfolgreich war
   - **Workaround:** User kann Explorer Link öffnen
   - **Severity:** Low

### Economic Impact
- **Fee:** 0.65% = 0.065 USDC (auf 10 USDC Trade)
- **Slippage:** 50bps = 0.05 USDC (max)
- **Total Cost:** ~0.115 USDC (1.15%)
- **Monetarisierung:** Fee wird korrekt berechnet

### UX Risk
- **High:** Keine Onboarding-Hilfe
- **High:** Keine Wallet-Installation-Hilfe
- **Medium:** Keine TX Review UI in App
- **Low:** Toast kann übersehen werden

### Improvement Suggestions
1. **Onboarding Tour:** Zeige Tooltips für erste Nutzung
2. **Wallet Installation Guide:** Zeige Guide wenn kein Wallet installiert
3. **TX Review UI:** Zeige Transaction Details vor Signing
4. **Success Page:** Zeige Success Page nach Swap (nicht nur Toast)
5. **Help Center:** Link zu Dokumentation/FAQ

---

## Summary: Top 3 Risiken über alle Szenarien

### 1. Error Boundaries fehlen (alle Szenarien)
- **Impact:** App kann crashen bei unhandled errors
- **Severity:** High
- **Blocker:** Yes

### 2. Keine Onboarding-Hilfe (New User)
- **Impact:** Neue User sind verwirrt, geben auf
- **Severity:** High
- **Blocker:** No (aber empfohlen)

### 3. Keine TX Review UI (alle Szenarien)
- **Impact:** User sieht TX Details nur in Wallet, nicht in App
- **Severity:** Medium
- **Blocker:** No (aber empfohlen)

---

## Monetarisierung Insights

### Fee Collection
- ✅ Fees werden korrekt berechnet (round down)
- ✅ Fee Preview zeigt korrekte Werte
- ⚠️ Frontend zeigt immer free tier (Backend könnte anders sein)

### User Behavior
- **Conservative Trader:** Große Trades, niedrige Fees akzeptabel
- **DeFi Degen:** Viele kleine Trades, Priority Fees sind teuer
- **Analyst:** Mittlere Trades, Fees akzeptabel
- **Momentum Trader:** Schnelle Trades, Fees akzeptabel
- **New User:** Kleine Trades, Fees akzeptabel

### Optimization Opportunities
1. **Fee Tier Selection UI:** User kann Tier wählen (höhere Fees = bessere Features)
2. **Priority Fee Warning:** Warnung bei extrem hohen Fees
3. **Volume Discounts:** Niedrigere Fees bei hohem Volumen (future)

