# Design.md — CodeInsight

**Version:** 1.1
**Status:** Locked for MVP build
**Reference:** Alcove-style landing page (warm cream, bold rounded display type, coral highlight, dark pill CTAs, soft depth)
**Traces back to:** PRD.md v1.0, Architecture.md v1.0

---

## 0. Design Plan (Brainstorm Pass)

### Subject Grounding
CodeInsight's real subject is **three disconnected signal types being woven into one story** — code structure, query behavior, runtime logs — reasoned over by Claude. The design should feel *confident and calm*, like a well-instrumented cockpit, not a chaotic dashboard. The reference image's warmth and restraint is the right instinct: this is a tool that gives clarity, so the UI itself shouldn't feel noisy.

### Two Surfaces, One System
- **Marketing/Auth surface** (landing page, sign-in, project-creation empty states): full warm-cream, bold-type, high-personality — matches the reference directly.
- **Application surface** (project dashboard, analyzers, correlation report): same type system and accent language, but on a calmer neutral canvas so React Flow graphs, code snippets, and data tables stay legible. Warmth shows up in accents, cards, and the correlation engine's signature moment — not as a full-bleed background behind dense data.

### Signature Element: "The Thread"
Every analysis produces three colored signal points (Code / Database / Logs). The Correlation Engine's job is to draw a line between them. **The Thread** is a literal, animated connecting line — three softly colored nodes that a warm gradient thread draws between, in real time, as Claude's streamed reasoning arrives. It appears in three places: the marketing hero (static, as an illustration of the product's premise), the correlation loading state (animated, drawing itself), and the finished unified report (as a small persistent motif showing which findings are connected). This is the one place the design is allowed to be bold — everywhere else stays quiet.

### Layout Concept (ASCII)

**Marketing hero (matches reference structure):**
```
┌───────────────────────────────────────────┐
│ ◆ CodeInsight            FAQs   Sign in    │
│                                             │
│        See the story your stack            │
│        isn't telling you ▂▂▂Mac▂▂▂          │  ← highlight block on last word
│                                             │
│     [ Try the demo repo ]  [ Sign up free ] │
│                                             │
│     ┌─────────────────────────────────┐    │
│     │   ● code ─────thread──── ● db   │    │  ← "The Thread" illustration
│     │              \                  │    │
│     │            ● logs                │    │
│     └─────────────────────────────────┘    │
└───────────────────────────────────────────┘
```

**App shell (dashboard):**
```
┌──────────┬──────────────────────────────────┐
│          │  Project: Express.js Audit        │
│  Logo    │  [Code] [Database] [Logs] [Unified]│
│          ├──────────────────────────────────┤
│ Projects │                                    │
│  · proj1 │      (active tab content)          │
│  · proj2 │                                    │
│  · demo  │                                    │
│          │                                    │
│  Account │                                    │
└──────────┴──────────────────────────────────┘
```

### Self-Critique (per frontend-design skill guidance)
The skill flags warm-cream + serif + terracotta as an overused AI default. This design deliberately diverges from that default in three ways even while honoring the brief's explicit reference: (1) the display face is a **bold rounded grotesque, not a serif** — the reference itself uses a rounded sans, and it also ties better to a technical product; (2) the accent is a **pink/coral highlighter block behind text**, not an all-over terracotta wash — used as a spotlight, not a tint; (3) the signature element (The Thread) is derived directly from the product's actual mechanic (correlating three signal types), not a decorative flourish — this is the one place uniqueness lives, everything else stays disciplined and quiet as instructed.

---

## 1. Theme

Two theme contexts, one shared token language:

- **`theme-marketing`** — warm cream canvas, used on landing page, auth screens, empty/onboarding states.
- **`theme-app`** — neutral canvas, used inside the authenticated dashboard where data density matters.

No dark mode in MVP (explicitly deferred — adds a full parallel token pass for limited payoff at this stage; noted in Rules.md as a "don't build" item).

---

## 2. Color Palette

### Core Tokens (shared across both themes)
| Token | Hex | Usage |
|---|---|---|
| `--ink` | `#211F1D` | Primary text, dark pill buttons, headlines |
| `--ink-soft` | `#57534E` | Secondary text, captions |
| `--accent-coral` | `#FF9EB0` | Highlight blocks behind key words, active states, primary emphasis |
| `--accent-coral-deep` | `#F5748C` | Hover/pressed state of coral elements |
| `--thread-purple` | `#6B4CE6` | Signature element gradient start, Code Analyzer accent |
| `--thread-violet` | `#3A2A85` | Signature element gradient end, correlation depth accent |
| `--success` | `#3E9C6E` | Passing/healthy findings |
| `--warning` | `#D98E3B` | Medium severity findings |
| `--critical` | `#D9483E` | High/critical severity findings |

### `theme-marketing` Surface Tokens
| Token | Hex | Usage |
|---|---|---|
| `--surface-bg` | `#FBEEDD` | Full page background |
| `--surface-card` | `#FFF8EE` | Cards, elevated panels |
| `--surface-outline` | `#EDE0CC` | Subtle borders on cream |

### `theme-app` Surface Tokens
| Token | Hex | Usage |
|---|---|---|
| `--surface-bg` | `#F7F6F3` | Dashboard background — warm-tinted neutral, not stark white |
| `--surface-card` | `#FFFFFF` | Cards, panels, code blocks |
| `--surface-sidebar` | `#211F1D` | Sidebar — dark, matches marketing's pill-button ink, anchors the app shell |
| `--surface-outline` | `#E7E4DD` | Table/card borders |

### Analyzer Identity Colors (used consistently for Code/DB/Logs across graphs, tabs, badges)
| Analyzer | Token | Hex |
|---|---|---|
| Code | `--analyzer-code` | `#6B4CE6` (thread-purple) |
| Database | `--analyzer-db` | `#2E9C8F` (teal, new — distinct from purple/coral pair) |
| Logs | `--analyzer-logs` | `#D98E3B` (warning-amber, doubles as "logs = alerts" association) |

Using consistent analyzer colors everywhere (tab underline, graph nodes, badges, The Thread's endpoints) is a **structural device that encodes real meaning** — a user learns "purple = code" once and it holds throughout the whole product.

---

## 3. Typography

| Role | Typeface | Notes |
|---|---|---|
| Display (marketing headlines) | **Instrument Sans**, weight 700 | Variable font, single file, rounded terminals matching the reference's bold friendly-but-confident character. Used large, tight tracking. |
| Body / UI | **Inter**, weights 400/500/600 | Best-in-class screen legibility at small sizes — critical for a dashboard with dense findings text. Variable font, one file covers all weights. |
| Code / Monospace | **JetBrains Mono**, weight 400/500 | Used for query snippets, file paths, log lines — ties directly to the product's subject matter rather than a generic mono choice. |

**Why this pairing is deliberate, not default:** JetBrains Mono specifically (not a generic system-mono) makes the "this is a tool built by and for engineers" statement without needing decorative icons — the type itself carries that signal wherever code/queries/logs appear.

### Type Scale (marketing)
```
display-xl   64px / 700 / -0.02em   → hero headline
display-lg   40px / 700 / -0.01em   → section headers
body-lg      18px / 400             → subheads, intro paragraphs
body         16px / 400             → default copy
```

### Type Scale (app)
```
heading-lg   24px / 600             → page/project titles
heading-md   18px / 600             → card/section headers
body         14px / 400             → default UI text
caption      12px / 500             → labels, metadata, timestamps
code         13px / 400 (mono)      → query/log/snippet display
```

Dashboard type is intentionally smaller and denser than marketing type — this is correct, not a compromise: a findings table showing 20 rows needs restraint, not hero-sized confidence.

---

## 4. Spacing System

8px base unit, standard scale — chosen for predictability across two repos/two AI tools building simultaneously (arbitrary spacing values are where multi-tool builds visibly drift):

```
space-1: 4px    space-2: 8px    space-3: 12px   space-4: 16px
space-5: 24px   space-6: 32px   space-7: 48px   space-8: 64px
```

Rule: card internal padding = `space-4` (app) or `space-5` (marketing). Section vertical rhythm = `space-7`/`space-8` on marketing, `space-5` between dashboard cards.

---

## 5. Border Radius

```
radius-sm: 8px     → badges, small buttons, input fields
radius-md: 14px    → cards, code blocks
radius-lg: 24px    → hero cards, modals
radius-full: 999px → pill buttons (primary CTAs, tab pills) — direct match to reference
```

---

## 6. Components

### Buttons
- **Primary (dark pill):** `--ink` background, white text, `radius-full`, matches reference exactly — used for the single most important action per screen ("Run Analysis," "Sign up free").
- **Secondary (light pill):** `--surface-card` background, `--ink` text, subtle outline — matches reference's "Purchase $16.99" button treatment.
- **Coral highlight button:** reserved for one specific action per flow max — e.g., "Try the demo repo" on marketing. Overuse dilutes the accent's meaning.

### Cards
- `radius-md`, `--surface-card` background, soft shadow (`0 1px 2px rgba(33,31,29,0.04), 0 8px 24px rgba(33,31,29,0.06)`) — no hard borders on `theme-marketing`; thin `--surface-outline` borders on `theme-app` where density needs clearer separation.

### Highlight Text Block
- The reference's signature move (pink block behind "Mac") — replicated as a reusable `<Highlight>` inline component: `background: var(--accent-coral)`, small `radius-sm`, slight negative margin to hug the text. Used sparingly — once per headline, never mid-paragraph.

### Reusable Analysis Components (Shared Across All Analyzers & Correlation)

These four core UI primitives are defined once in `codeinsight-web/src/components/ui/` and reused across all analyzer tabs (Code, Database, Logs) and the Unified Correlation Report view.

#### 1. Severity Badge
- **Variants:** `low`, `medium`, `high`, `critical`.
- **Styling:** Small capsule badge (`radius-full`, `caption` font weight 600, 4px 10px padding).
- **Colors:**
  - `low`: `--success` text (`#3E9C6E`) on soft green background tint (`#EBF5F0`).
  - `medium`: `--warning` text (`#D98E3B`) on soft amber background tint (`#FDF5EB`).
  - `high` / `critical`: `--critical` text (`#D9483E`) on soft red background tint (`#FDF0EF`).

#### 2. Analyzer Badge
- **Variants:** `code`, `database`, `logs`, `correlation`.
- **Styling:** Small tag badge with leading 6px colored dot + `caption` text.
- **Identity Colors:**
  - `code`: `--analyzer-code` (`#6B4CE6`).
  - `database`: `--analyzer-db` (`#2E9C8F`).
  - `logs`: `--analyzer-logs` (`#D98E3B`).
  - `correlation`: gradient dot (`#6B4CE6` $\rightarrow$ `#FF9EB0`).

#### 3. Finding Card
- **Layout:** Reusable `--surface-card` panel with 4px left border accent matching the finding's `severity` color.
- **Header:** Top row containing `Analyzer Badge` (left) and `Severity Badge` (right), followed by finding title (`heading-md`).
- **Body:** Description text (`body` 14px) explaining the root cause or recommendation.
- **Embedded Content:** Houses zero or more `Evidence Block` components displaying exact proof.

#### 4. Evidence Block
- **Layout:** Contained code/data block with `--surface-bg` neutral background, subtle border, and `radius-sm`.
- **Header Line:** Small `caption` label showing file locator (`filePath:lineStart-lineEnd`), query index, or log timestamp.
- **Code Container:** Monospace `JetBrains Mono` (`code` 13px) for syntax-highlighted code snippets, parsed SQL query fragments, or JSON log payloads.
- **Threshold Indicator:** Highlighted marker showing rule thresholds or metrics triggered (e.g. `[Threshold: latency > 1500ms (actual: 1620ms)]`).

### Tabs (Code / Database / Logs / Unified)
- Underline-style, active tab uses its Analyzer Identity Color for the underline; "Unified" tab uses the thread-purple → coral gradient to visually signal "this is where they combine."

---

## 7. Icons

- **Lucide icons** (already available via `lucide-react`, pairs natively with shadcn/ui) — outline style, 1.5px stroke, sized 16/20px depending on context.
- No filled/duotone icon sets — outline-only keeps the interface visually quiet, consistent with the reference's restraint (it uses almost no iconography beyond the Apple logo and chat bubble).

---

## 8. Animation

Per the skill's guidance — spend boldness in one place. That place is **The Thread**.

- **The Thread (correlation loading state):** an SVG path animates drawing itself between the three analyzer nodes as Claude's SSE stream arrives, using `--thread-purple` → `--accent-coral` gradient stroke. This is the one orchestrated animated moment in the product.
- **Everywhere else:** minimal — 150ms ease-out on hover/press states, no scroll-triggered reveals, no decorative motion. `prefers-reduced-motion` respected globally; The Thread degrades to a static connected-nodes illustration when reduced motion is set.
- **No page-load sequences, no staggered card entrances** — a dashboard that re-animates every time you open a project you've seen before reads as slow, not delightful.

---

## 9. Responsive Rules

- **Marketing surface:** fully responsive down to 375px, hero type scales down via `clamp()` rather than fixed breakpoint jumps.
- **App surface:** dashboard is desktop-first (this is a tool used while coding, realistically on a laptop/desktop) — but must degrade gracefully to tablet width (sidebar collapses to icon-only rail below 1024px). Mobile phone width is not a primary target for MVP but must not visually break (single-column stacking of tabs/cards as a floor, not a polished experience).

---

## 10. Accessibility

- Text contrast: `--ink` on `--surface-bg`/`--surface-card` exceeds WCAG AA at all defined type sizes (verify coral-on-cream combinations specifically, as coral is a mid-tone — coral is used as a *background block behind dark text*, never as text color on cream, which keeps this safe by construction).
- All interactive elements have a visible focus ring (`2px solid var(--thread-purple)`, offset 2px) — never rely on browser default outline removal without replacement.
- Severity and analyzer-origin are never color-only signals: severity also uses position (left border) and a text label; analyzer origin also uses the tab/section context, not just the colored dot.
- `prefers-reduced-motion` respected as stated in Section 8.

---

## 11. What This Design Explicitly Avoids

(Useful for Rules.md to reference directly)
- No serif display font (reference and product both call for rounded sans confidence, not editorial seriousness).
- No terracotta/clay accent — coral-pink is the one accent, used as a highlight block, not a wash.
- No dark-mode-first or near-black page backgrounds — warmth is the point.
- No decorative numbered markers (01/02/03) anywhere — findings and phases are not always sequential, and PRD/Phases content should only use numbering where order is genuinely meaningful.
- No stock illustration or 3D renders — The Thread is the only illustrative motif, everywhere else is type, color, and real data.
