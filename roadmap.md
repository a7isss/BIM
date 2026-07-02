# AXES + Next Res UI — Merge Roadmap

## Goal
Merge the AXES app (Three.js 3D + Supabase + Zustand, port 3000) with Next Res UI (D3 2D structural editing, port 5173) into a single unified web-based plan editor with layer management.

## Phase 1 — Cleanup & Prep *(in progress)*

| Task | Status |
|------|--------|
| Write roadmap.md | ✅ |
| Remove dead npm deps (`@sentry/*`, `posthog-js`, `i18next`, `react-router-dom`, `leaflet`, `d3`, `immer`, `@google/genai`, testing libs) | ⬜ |
| Remove `SUPABASE_SERVICE_ROLE_KEY` from `.env` (security risk — leaks in client bundle) | ⬜ |
| Install `@tailwindcss/vite`, create `src/index.css` with `@import "tailwindcss"` | ⬜ |
| Merge Next Res UI's `/api/save_project`, `/api/load_project` middleware into `vite.config.ts` | ⬜ |
| Simplify `index.html` (remove CDN Tailwind, import map, Google Analytics) | ⬜ |
| Verify `npx vite build` passes | ⬜ |

## Phase 2 — File & Store Merge

- Move Next Res UI source files into `axes/src/` tree (resplan, structural, D3 drawing modules)
- Merge Next Res UI's `useResPlanData.tsx` context into `useAxesStore.ts` Zustand store
- Unify save/load API — single set of endpoints that handle both apps' data shapes
- Co-locate shared types, fix import paths

## Phase 3 — UI Integration

- Wire routing between AXES's SplitScreen/Three.js view and Next Res UI's D3 canvas
- Build layer management panel (architectural / structural / plumbing visibility toggles)
- Integrate structural editing tools (draw wall, draw column, draw beam, etc.)
- Integrate print layout and DXF export
- End-to-end test: upload floor plan → run structural analysis → view 3D massing

## Project Structure (target)

```
axes/
├── vite.config.ts          # unified Vite + API middleware
├── src/
│   ├── index.css           # Tailwind v4 import
│   ├── main.tsx            # entry point
│   ├── App.tsx             # root component
│   ├── store/
│   │   └── useAxesStore.ts # single Zustand store (absorbed useResPlanData)
│   ├── components/         # shared UI components
│   ├── editors/            # 2D/3D editing canvases
│   ├── resplan/            # Next Res UI modules (structural tools)
│   └── utils/              # shared utilities
└── public/
```

## Security

- `SUPABASE_SERVICE_ROLE_KEY` removed from `.env` — only `VITE_SUPABASE_ANON_KEY` is safe client-side
- No secrets in client bundle
