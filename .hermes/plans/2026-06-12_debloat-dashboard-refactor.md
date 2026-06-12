# intervieHire Dashboard Debloat & Refactor Plan

> **For Hermes:** Use incremental-editing skill for all changes. Execute phase by phase, verifying build after each phase.

**Goal:** Shrink 11K-line `dashboard.js` + 17K-line CSS into modular feature files. Remove dead Vite-era artifacts and duplicate theme variants. Each dashboard feature (Job Description, Resume Analysis, Analytics, Team, etc.) becomes its own file loaded as a separate tab.

**Architecture:** Keep existing vanilla JS approach (no React rewrite — out of scope) but split `src/dashboard.js` into `src/dashboard/` feature modules. Keep only `dashboard-crystal` theme, delete the other two CSS + HTML variants. Remove `vite` from dependencies and dead assets.

**Tech Stack:** Next.js 16 (shell only), vanilla JS modules, CSS (crystal theme), Three.js, GSAP

---

## Phase 1: Clean Dead Weight (no functionality change)

### Task 1.1: Remove Vite dependency and dead assets
- **File:** `package.json:12` — remove `"vite": "^8.0.12"` from devDependencies
- **File:** `src/assets/vite.svg` — delete entire file
- **Run:** `npm install` (or just leave lockfile — it won't affect runtime)

### Task 1.2: Delete unused CSS themes
- Delete `src/dashboard.css` (4,016 lines — default theme, not used)
- Delete `src/dashboard-glass.css` (3,148 lines — glass theme, not used)
- Keep only `src/dashboard-crystal.css` (rename to `src/dashboard.css` for clarity)

### Task 1.3: Delete unused HTML generation files
- Delete `src/html/dashboard.js` (1,235 lines — default theme HTML)
- Delete `src/html/dashboard-glass.js` (1,242 lines — glass theme HTML)
- Keep only `src/html/dashboard-crystal.js` → rename to `src/html/dashboard.js`

### Task 1.4: Fix imports after renames
- **File:** `app/dashboard/page.js` — update import from `../../src/html/dashboard-crystal` to `../../src/html/dashboard`
- Update CSS import path if hardcoded (check `src/html/dashboard-crystal.js` for CSS link)

**Verify:** `npm run build` should succeed. If it doesn't, fix import paths.

---

## Phase 2: Split `src/dashboard.js` into Feature Modules

Current structure of `dashboard.js` (11,256 lines):

| Lines | Feature | New File |
|---|---|---|
| 1-88 | THREE.js + animation frame management | `src/dashboard/core.js` |
| 89-155 | SoundEngine class | `src/dashboard/sound.js` |
| 156-995 | AppState (mock data) | `src/dashboard/state.js` |
| 996-1139 | CandidateVettingDetails | `src/dashboard/data.js` |
| 1140-1311 | renderJobCards | `src/dashboard/jobs.js` |
| 1312-1364 | renderJobListView | `src/dashboard/jobs.js` |
| 1365-1377 | updateJobsCounters | `src/dashboard/jobs.js` |
| 1378-1579 | renderAnalyticsTable | `src/dashboard/analytics.js` |
| 1581-1747 | renderTeamTable | `src/dashboard/team.js` |
| 1748-1759 | updateTeamCounters | `src/dashboard/team.js` |
| 1761-1836 | Date range utilities | `src/dashboard/utils.js` |
| 1837-6936 | Tab navigation, drawers, modals, search, 3D scenes | `src/dashboard/ui.js` + `src/dashboard/three.js` |
| 6937-7165 | Resume text extraction + identity parsing | `src/dashboard/resume-parser.js` |
| 7167-7269 | Manual queue intake | `src/dashboard/queue.js` |
| 7271-7314 | addCandidateToAppState | `src/dashboard/candidates.js` |
| 7316-7349 | Toast notifications | `src/dashboard/ui.js` |
| 7351-7500 | Kanban drag-and-drop + column customization | `src/dashboard/kanban.js` |
| 7502-8200 | Resume analysis + bulk analysis | `src/dashboard/resume-analysis.js` |
| 8201-8271 | Resume criteria editing | `src/dashboard/resume-analysis.js` |
| 8272-8316 | Schedule modal | `src/dashboard/scheduling.js` |
| 8318-8422 | Filter dropdowns | `src/dashboard/filters.js` |
| 8423-11256 | Job detail panes (pipeline stages) | `src/dashboard/pipeline.js` |

### Task 2.1: Create `src/dashboard/` directory structure
```
src/dashboard/
  index.js          — re-exports initDashboardPage, orchestrates everything
  core.js           — THREE.js setup, animation frames, cleanup
  sound.js          — SoundEngine class
  state.js          — AppState object
  data.js           — CandidateVettingDetails, mock data
  jobs.js           — renderJobCards, renderJobListView, job counters, job kebab actions
  analytics.js      — renderAnalyticsTable
  team.js           — renderTeamTable, team counters
  utils.js          — date parsing, generateJobId, shared helpers
  ui.js             — tab navigation, drawers, modals, global search, command palette, toast
  three.js          — 3D background scenes, funnel visualization
  resume-parser.js  — resume text extraction, identity parsing, normalization
  queue.js          — manual candidate queue intake
  candidates.js     — candidate CRUD, addCandidateToAppState
  kanban.js         — drag-and-drop, column customization
  resume-analysis.js — runResumeAnalysis, bulk analysis, criteria editing, result rendering
  scheduling.js     — schedule modal
  filters.js        — filter dropdowns, stage filters
  pipeline.js       — job detail panes, stage rendering
```

### Task 2.2: Extract `core.js` (lines 1-88)
Move THREE.js initialization, animation frame tracking, MutationObserver proxy, document/window proxies.

### Task 2.3: Extract `sound.js` (lines 89-155)
Move SoundEngine class. Remove duplicate from `src/main.js` (or keep main.js's version and import from there).

### Task 2.4: Extract `state.js` (lines 156-995)
Move AppState object. This is the biggest single block — ~840 lines of hardcoded mock data.

### Task 2.5: Extract `data.js` (lines 996-1139)
Move CandidateVettingDetails.

### Task 2.6: Extract `jobs.js` (lines 1140-1377)
Move renderJobCards, renderJobListView, updateJobsCounters, and all job-kebab handlers.

### Task 2.7: Extract `analytics.js` (lines 1378-1579)
Move renderAnalyticsTable.

### Task 2.8: Extract `team.js` (lines 1581-1759)
Move renderTeamTable, updateTeamCounters.

### Task 2.9: Extract `utils.js` (lines 1761-1836 + 987-994)
Move date parsing, generateJobId, filterCandidatesByDateRange, getDateRangeBounds.

### Task 2.10: Extract `ui.js` (tab nav, drawers, modals, search, command palette, toast)
Lines 1837-6936 contain: tab navigation, settings drawers, job description drawer, global search, command palette (Cmd+K), toast notifications, and various UI event handlers. This is ~5100 lines — may need further splitting later.

### Task 2.11: Extract `three.js` (3D scenes)
Find and move all THREE.js scene creation, background rendering, funnel visualization.

### Task 2.12: Extract `resume-parser.js` (lines 6937-7165)
Move resume text extraction, identity parsing, email/phone/linkedin extraction, name normalization.

### Task 2.13: Extract `queue.js` (lines 7167-7269)
Move manual queue intake logic.

### Task 2.14: Extract `candidates.js` (lines 7271-7314)
Move addCandidateToAppState.

### Task 2.15: Extract `kanban.js` (lines 7351-7500)
Move kanban drag-and-drop, column customization dropdowns.

### Task 2.16: Extract `resume-analysis.js` (lines 7502-8271)
Move runResumeAnalysis, bulk analysis, criteria editing, result rendering, synthetic resume generation.

### Task 2.17: Extract `scheduling.js` (lines 8272-8316)
Move schedule modal.

### Task 2.18: Extract `filters.js` (lines 8318-8422)
Move filter dropdowns, stage filter logic.

### Task 2.19: Extract `pipeline.js` (lines 8423-11256)
Move job detail panes, stage rendering (resume/screening/functional panes), candidate list rendering per stage.

### Task 2.20: Create `src/dashboard/index.js`
Re-export a single `initDashboardPage()` function that imports and wires all modules together. Each module exports its init function, and index.js calls them in order.

**Verify after each extraction:** `npm run build` must succeed. If any module breaks, fix the import/export before moving to the next.

---

## Phase 3: Multi-Tab Architecture

Each feature becomes a tab in the dashboard, and each tab's code lives in its own file:

| Tab | Module | What it does |
|---|---|---|
| Jobs | `jobs.js` | Job cards grid + list view |
| Analytics | `analytics.js` | Analytics table with filters |
| Team | `team.js` | Team management table |
| Resume Analysis | `resume-analysis.js` | Per-candidate resume analysis |
| Pipeline | `pipeline.js` | Full hiring pipeline view |
| Settings | Part of `ui.js` | Drawers for settings, profile, billing |

### Task 3.1: Ensure tab switching lazy-loads modules
Currently all code runs at `initDashboardPage()`. Refactor tab switching so each tab's JS only initializes when that tab is first opened. Use dynamic `import()` or a module registry pattern.

### Task 3.2: Clean up global function pollution
Functions like `openJobDescriptionDrawer`, `handleJobKebab`, `openCandidateReport` are attached to `window` or called via inline `onclick` in HTML strings. Move to a centralized event delegation system in `ui.js`.

---

## Phase 4: CSS Debloat

### Task 4.1: Remove unused CSS rules
- Many CSS rules in `dashboard-crystal.css` target classes that no longer exist in the HTML (from deleted themes)
- Run build and check for unused CSS

### Task 4.2: Split CSS by component (optional, can defer)
If the CSS file remains >5K lines after deduplication, split into:
- `src/css/tokens.css` — design tokens (CSS custom properties)
- `src/css/layout.css` — grid, sidebar, header
- `src/css/components.css` — cards, buttons, tables, modals
- `src/css/animations.css` — keyframes, transitions

---

## Phase 5: Verify & Clean Up

### Task 5.1: Build verification
```bash
npm run build
```
Must succeed with zero errors.

### Task 5.2: Remove duplicate SoundEngine
`src/main.js` has its own SoundEngine (lines 8-153). The dashboard should import from `src/dashboard/sound.js` instead.

### Task 5.3: Remove `playwright` if unused
`playwright` is 500MB+. Check if actually used anywhere beyond `package.json`. If not, remove.

### Task 5.4: Final pygount comparison
Run pygount before/after to show line count reduction.

---

## Risks & Tradeoffs

- **Risk:** Splitting a monolithic vanilla JS file into ES modules may break implicit dependencies (variables shared through closure scope). **Mitigation:** Each extraction preserves the closure by passing shared state explicitly.
- **Risk:** Inline `onclick` handlers in HTML strings reference global functions. **Mitigation:** Phase 3.2 addresses this with event delegation.
- **Tradeoff:** Not converting to React components. This keeps the scope manageable but means the app stays as vanilla JS in a Next.js shell. A full React rewrite would be a separate project.
- **Tradeoff:** Lazy-loading tabs may have a slight delay on first click vs everything being pre-loaded. Acceptable for this scale.

---

## Summary

| Metric | Before | After (target) |
|---|---|---|
| `dashboard.js` | 11,256 lines, 1 file | ~15 files, max ~2K lines each |
| CSS files | 4 files, ~17K lines | 1 file, ~6-8K lines (or 4 component files) |
| HTML gen files | 3 files, ~4.3K lines | 1 file, ~1.8K lines |
| Dead deps | vite, vite.svg, playwright(?) | 0 |
| Duplicate code | SoundEngine in 2 files | SoundEngine in 1 file |
