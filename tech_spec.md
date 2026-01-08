# Technical Specification: TradeApp

## Architektur-Überblick

TradeApp folgt einer modernen, modularen Frontend-Architektur mit klarer Trennung zwischen UI-Komponenten, Geschäftslogik und Services.

## Tech Stack

### Core Framework
- **React 18.3.1**: UI-Framework mit Hooks und funktionalen Komponenten
- **TypeScript 5.8.3**: Typsicherheit und bessere Developer Experience
- **Vite 5.4.19**: Build-Tool und Dev-Server mit HMR

### Routing & State Management
- **React Router DOM 6.30.1**: Deklaratives Client-Side Routing
- **TanStack Query 5.83.0**: Server-State Management und Caching
- **React Hook Form 7.61.1**: Formular-Handling mit Validierung
- **Zod 3.25.76**: Schema-Validierung

### UI & Styling
- **Tailwind CSS 3.4.17**: Utility-First CSS Framework
- **shadcn/ui**: Komponenten-Bibliothek basierend auf Radix UI
- **Radix UI**: Accessible, unstyled UI Primitives
- **Lucide React 0.462.0**: Icon-Bibliothek
- **next-themes 0.3.0**: Theme-Management (Dark/Light Mode)
- **tailwindcss-animate**: Animation Utilities

### Charts & Visualisierung
- **Recharts 2.15.4**: Deklarative Chart-Bibliothek
- **Embla Carousel 8.6.0**: Carousel-Komponente

### Development Tools
- **ESLint 9.32.0**: Linting
- **typescript-eslint 8.38.0**: TypeScript ESLint Rules
- **Lovable Tagger 1.1.13**: Custom Development Tool
- **PostCSS 8.5.6**: CSS Transformations
- **Autoprefixer 10.4.21**: CSS Vendor Prefixing

## Projekt-Struktur

```
/workspace
├── src/
│   ├── components/          # React Komponenten
│   │   ├── ui/             # Basis UI-Komponenten (shadcn/ui)
│   │   ├── layout/         # Layout-Komponenten (AppShell, Header, Sidebar)
│   │   ├── dashboard/      # Dashboard-spezifische Komponenten
│   │   ├── journal/        # Journal-Feature-Komponenten
│   │   ├── chart/          # Chart-Feature-Komponenten
│   │   ├── watchlist/      # Watchlist-Komponenten
│   │   ├── oracle/         # Oracle-Feature-Komponenten
│   │   ├── learn/          # Learning-Hub-Komponenten
│   │   ├── alerts/         # Alert-Management-Komponenten
│   │   └── settings/       # Settings-Komponenten
│   │
│   ├── pages/              # Routen-Level Komponenten
│   │   ├── Dashboard.tsx
│   │   ├── Journal.tsx
│   │   ├── Chart.tsx
│   │   ├── Watchlist.tsx
│   │   ├── Oracle.tsx
│   │   ├── Lessons.tsx
│   │   ├── LessonViewer.tsx
│   │   ├── Alerts.tsx
│   │   ├── Settings.tsx
│   │   ├── Handbook.tsx
│   │   └── NotFound.tsx
│   │
│   ├── lib/                # Utility-Funktionen und Helpers
│   │   └── utils.ts        # Allgemeine Utilities (cn, etc.)
│   │
│   ├── services/           # Backend-Integration und API-Calls
│   │   ├── api/           # API-Client-Konfiguration
│   │   ├── auth/          # Authentifizierungs-Services
│   │   ├── trading/       # Trading-bezogene Services
│   │   └── analytics/     # Analytics und Tracking
│   │
│   ├── hooks/             # Custom React Hooks
│   │   ├── use-mobile.tsx # Mobile-Detection Hook
│   │   └── use-toast.ts   # Toast-Notification Hook
│   │
│   ├── config/            # Konfigurationsdateien
│   │   └── navigation.ts  # Navigation-Konfiguration
│   │
│   ├── stubs/             # Mock-Daten für Entwicklung
│   │   ├── fixtures.ts    # Test-Fixtures
│   │   ├── hooks.ts       # Mock-Hooks
│   │   └── pageState.ts   # Page-State Mocks
│   │
│   ├── main.tsx           # App Entry Point
│   ├── App.tsx            # Root Component
│   └── index.css          # Global Styles
│
├── public/                # Statische Assets
├── .github/              # GitHub Actions Workflows
├── playwright/           # E2E Tests (geplant)
├── product_spec.md       # Produkt-Spezifikation
├── tech_spec.md         # Technische Spezifikation (diese Datei)
└── README.md            # Projekt-Dokumentation
```

## AppShell Foundation Pattern

### Konzept

Die AppShell Foundation ist das architektonische Grundgerüst der Anwendung. Sie definiert:

1. **Layout-Struktur**: Konsistente Shell für alle Seiten
2. **Navigation**: Zentrale Navigation-Konfiguration
3. **Theme-Management**: Einheitliches Theming
4. **Responsive Breakpoints**: Mobile-First Ansatz

### Komponenten-Hierarchie

```
AppShell (Layout-Container)
├── Sidebar (Desktop Navigation)
│   ├── Logo/Branding
│   ├── Primary Navigation Items
│   ├── Advanced Navigation (Collapsible)
│   └── Footer Info
│
├── Main Content Area
│   ├── Header (Top Bar)
│   │   ├── Mobile Logo
│   │   └── Actions (Notifications, User Menu)
│   │
│   └── Page Content (Outlet für React Router)
│       └── Dynamischer Inhalt je nach Route
│
└── BottomNav (Mobile Navigation)
    └── Subset der Primary Nav Items
```

### Navigation als Konfiguration

Die Navigation wird zentral in `/src/config/navigation.ts` verwaltet:

```typescript
interface NavItem {
  label: string;           // Anzeigename
  path: string;           // Route-Path
  icon: LucideIcon;       // Icon-Komponente
  testId: string;         // Test-ID für E2E-Tests
  activeRoutes?: string[];  // Alternative Routen die als aktiv gelten
}

interface NavGroup {
  label: string;
  testId: string;
  triggerTestId: string;
  icon: LucideIcon;
  items: NavItem[];
  featureFlag?: string;    // Optional: Feature-Flag für Visibility
}
```

**Vorteile:**
- Zentrale Verwaltung aller Routes
- Type-Safety für Navigation-Items
- Feature-Flags für schrittweises Rollout
- Einfaches Testing durch konsistente test-ids
- Separate Konfiguration für Mobile/Desktop/Sidebar

### Responsive Design Strategy

#### Breakpoints
```css
/* Mobile First */
Default: < 768px      (Mobile)
md: 768px - 1024px    (Tablet)
lg: > 1024px          (Desktop)
```

#### Layout-Verhalten
- **Mobile (< 768px)**:
  - Sidebar versteckt
  - Bottom Navigation sichtbar
  - Kompakte Header-Ansicht
  - Touch-optimierte Buttons (min. 44x44px)

- **Desktop (>= 768px)**:
  - Sidebar sichtbar und collapsible
  - Bottom Navigation versteckt
  - Erweiterte Header-Aktionen
  - Hover-States und Tooltips

### State Management Strategy

#### Lokaler State
- **React useState**: Für UI-State (Modals, Dropdowns, etc.)
- **React useReducer**: Für komplexere State-Logik

#### Server State
- **TanStack Query**:
  - Caching von API-Responses
  - Automatisches Refetching
  - Optimistic Updates
  - Error Handling

#### Form State
- **React Hook Form + Zod**:
  - Performante Formular-Validierung
  - Schema-basierte Validierung
  - Type-Safe Forms

#### Global UI State
- **Zustand/Context** (future):
  - Theme Preferences
  - User Preferences
  - Feature Flags

## Services Layer

### API Service Pattern

```typescript
// services/api/client.ts
export const apiClient = {
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
};

// services/journal/api.ts
// Journal v1: Diary/Reflection (no trading fields)
export async function listJournalEntries() {}
export async function createJournalEntry() {}
export async function confirmJournalEntry() {}
export async function archiveJournalEntry() {}
export async function restoreJournalEntry() {}
export async function deleteJournalEntry() {}
```

### Service-Kategorien

1. **Journal Services** (`services/journal/`)
   - Journal API + offline queue
   - Chart-Data-Service
   - Watchlist-Service

2. **Analytics Services** (`services/analytics/`)
   - Performance-Analytics
   - Trade-Statistics
   - Learning-Progress-Tracking

3. **AI Services** (`services/ai/`)
   - Oracle-Insights-Generator
   - Pattern-Recognition
   - Recommendation-Engine

4. **Auth Services** (`services/auth/`)
   - Authentication
   - Authorization
   - Session-Management

## Testing Strategy

### Unit Tests (Jest + React Testing Library)
- Komponenten-Tests
- Utility-Funktionen
- Custom Hooks
- Coverage-Target: > 80%

### Integration Tests
- Feature-Flow-Tests
- API-Integration-Tests
- State-Management-Tests

### E2E Tests (Playwright)
- Kritische User-Flows
- Cross-Browser Testing
- Mobile & Desktop Viewport

**Best Practices:**
- ✅ Verwende `data-testid` für stabile Selektoren
- ✅ Nutze `waitFor` statt fixer `waitForTimeout`
- ✅ Teste User-Behavior, nicht Implementation-Details
- ✅ Isoliere Tests voneinander
- ❌ Vermeide fragile CSS-Selektoren

### Test-Struktur

```
/playwright
├── tests/
│   ├── navigation.spec.ts
│   ├── journal.spec.ts
│   ├── dashboard.spec.ts
│   └── settings.spec.ts
├── fixtures/
│   └── test-data.ts
└── playwright.config.ts
```

## CI/CD Pipeline

### GitHub Actions Workflow

```yaml
# .github/workflows/ci.yml
name: CI Pipeline

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - Checkout Code
      - Setup Node.js
      - Install Dependencies
      - Run ESLint
      - Run TypeScript Check

  test:
    runs-on: ubuntu-latest
    steps:
      - Checkout Code
      - Setup Node.js
      - Install Dependencies
      - Run Unit Tests
      - Upload Coverage

  e2e:
    runs-on: ubuntu-latest
    steps:
      - Checkout Code
      - Setup Node.js
      - Install Dependencies
      - Install Playwright
      - Run E2E Tests
      - Upload Test Results

  build:
    runs-on: ubuntu-latest
    needs: [lint, test]
    steps:
      - Checkout Code
      - Setup Node.js
      - Install Dependencies
      - Build Production
      - Upload Build Artifacts
```

### Deployment Strategy

- **Development**: Auto-deploy bei Push zu `develop` Branch
- **Staging**: Auto-deploy bei Push zu `main` Branch
- **Production**: Manual Trigger oder Tag-basiert

### Code Quality Gates

1. **Pre-Commit Hooks** (Husky):
   - Prettier Formatting
   - ESLint Checks
   - TypeScript Compilation

2. **PR Requirements**:
   - Alle Tests müssen passen
   - Code Coverage darf nicht sinken
   - Keine High/Critical Severity Issues
   - Mindestens 1 Approval

3. **Automated Checks**:
   - CodeRabbit AI Review
   - Lighthouse Performance Check
   - Bundle Size Monitoring
   - Dependency Vulnerability Scan

## Performance-Optimierung

### Build-Optimierung
- **Code Splitting**: Route-based Lazy Loading
- **Tree Shaking**: Entfernung ungenutzten Codes
- **Asset Optimization**: Image Compression, SVG Optimization
- **Bundle Analysis**: Regelmäßige Bundle-Size-Checks

### Runtime-Optimierung
- **React.memo**: Für teure Komponenten
- **useMemo/useCallback**: Für teure Berechnungen
- **Virtual Scrolling**: Für lange Listen
- **Debouncing/Throttling**: Für Event-Handler

### Caching-Strategy
- **TanStack Query**: 
  - staleTime: 5 Minuten für statische Daten
  - cacheTime: 30 Minuten
  - Optimistic Updates für besseres UX

- **Service Worker** (PWA):
  - Cache-First für statische Assets
  - Network-First für API-Calls
  - Offline-Fallback

## Security Considerations

### Frontend Security
- **XSS Prevention**: React's built-in escaping
- **CSRF Protection**: Token-based (zukünftig)
- **Content Security Policy**: Strikte CSP Headers
- **Dependency Audits**: Regelmäßige `npm audit`

### API Security (zukünftig)
- **Authentication**: JWT-based
- **Authorization**: Role-based Access Control (RBAC)
- **Rate Limiting**: Pro User/IP
- **Input Validation**: Zod-Schemas auf Backend

### Data Protection
- **Keine sensitiven Daten im LocalStorage**
- **HTTPS Only**
- **GDPR-Compliance**:
  - Daten-Export-Funktion
  - Daten-Löschung auf Anfrage
  - Cookie Consent

## Accessibility (a11y)

### Standards
- WCAG 2.1 Level AA Konformität
- Semantic HTML
- ARIA Labels wo nötig
- Keyboard Navigation

### Testing
- Automated: axe-core, Lighthouse
- Manual: Screen Reader Testing (NVDA, JAWS)
- User Testing mit Menschen mit Behinderungen

### Best Practices
- ✅ Fokus-Management in Modals
- ✅ Skip-to-Content Links
- ✅ Ausreichende Farbkontraste (4.5:1)
- ✅ Alternativtexte für alle Bilder
- ✅ Tastatur-Shortcuts dokumentieren

## Monitoring & Observability

### Error Tracking
- **Sentry** (oder ähnlich):
  - Frontend Error Tracking
  - Performance Monitoring
  - Release Tracking

### Analytics
- **Plausible/Fathom** (Privacy-First):
  - Page Views
  - User Flows
  - Feature Adoption
  - Keine personenbezogenen Daten

### Performance Monitoring
- **Web Vitals**:
  - LCP (Largest Contentful Paint) < 2.5s
  - FID (First Input Delay) < 100ms
  - CLS (Cumulative Layout Shift) < 0.1

## Development Workflow

### Branch Strategy (Git Flow)

```
main (Production)
├── develop (Integration)
    ├── feature/dashboard-kpis
    ├── feature/journal-export
    ├── bugfix/sidebar-collapse
    └── hotfix/critical-bug
```

### Commit Convention

```
<type>(<scope>): <subject>

Types:
- feat: Neue Features
- fix: Bugfixes
- docs: Dokumentation
- style: Formatierung
- refactor: Code-Umstrukturierung
- test: Tests
- chore: Build-Prozess, Dependencies

Beispiele:
feat(journal): Add export to PDF functionality
fix(sidebar): Fix collapse animation glitch
docs(readme): Update installation instructions
```

### Code Review Checklist

- [ ] Code folgt Style Guide
- [ ] Tests sind vorhanden und passen
- [ ] Keine Console.logs im Production Code
- [ ] Performance-Impact berücksichtigt
- [ ] Accessibility geprüft
- [ ] Mobile Responsiveness getestet
- [ ] Dokumentation aktualisiert
- [ ] Breaking Changes dokumentiert

## Environment Variables

```bash
# .env.example
VITE_API_URL=http://localhost:3000/api
VITE_ENABLE_DEV_NAV=false
VITE_ENABLE_ANALYTICS=false
VITE_SENTRY_DSN=
VITE_APP_VERSION=0.1.0
```

## Skalierbarkeit & Zukunftssicherheit

### Geplante Erweiterungen

1. **Backend Integration**:
   - REST API oder GraphQL
   - PostgreSQL Datenbank
   - Redis für Caching

2. **Real-time Features**:
   - WebSocket-Integration für Live-Daten
   - Server-Sent Events für Notifications

3. **Mobile Apps**:
   - React Native Code-Sharing
   - Native Features (Push Notifications, etc.)

4. **Microservices** (bei Bedarf):
   - Separate Services für Analytics, AI, Trading-Data
   - Event-Driven Architecture

### Tech Debt Management

- Regelmäßige Dependency Updates
- Refactoring-Sprints alle 2 Monate
- Performance-Audits vor jedem Major Release
- Dokumentation als Teil der Definition of Done

## Anhänge

- API Documentation (Swagger/OpenAPI)
- Component Storybook
- Design System Documentation
- Deployment Runbooks
