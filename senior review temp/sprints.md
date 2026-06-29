# BIM Toolset — Coding Sprint Plan

> Date: 2026-06-29
> Companion files: `report.md` (full review), `roadmap.md` (starting points)
>
> Each sprint is designed as a 1-week cycle with a clear deliverable.
> Sprints are sequential — each builds on the previous one's output.

---

## Sprint 0 — Stabilization & Safety Net

**Goal:** Make the foundation trustworthy enough to build on.

**Deliverable:** All config is centralized, the MCP server works, and the core engineering logic has test coverage.

| Task | Detail | Hours |
|------|--------|-------|
| Centralize material config | Make `design_assumptions.json` the single source of truth. Update `beam_library_generator.py` and `slab_library_generator.py` to read from it instead of hardcoding. Reconcile `structural_types.json` (Global Libraries) with assumptions. | 2 |
| Regenerate all libraries | Re-run all 4 generators (`column_library_generator.py`, `beam_library_generator.py`, `slab_library_generator.py`, `footing_library_generator.py`) with the corrected config. Verify output JSON files. | 1 |
| Fix MCP server paths | Change `PROJECT_DIR` from `D:/Revit toolset/...` to dynamic path. Fix `run_structural_analysis` subprocess path. Fix `get_types` to read from correct file. | 1 |
| Set up pytest | Create `Structural Tools/tests/` directory. Add `conftest.py` with shared fixtures (load design_assumptions, load libraries). Add `pytest.ini` or `pyproject.toml` config. | 1 |
| Write selector tests | Test `column_selector.py`, `beam_selector.py`, `footing_selector.py` with known Pu/Mu/Vu inputs. Assert correct section is returned. Test edge cases (zero load, very high load → None). | 3 |
| Write formula tests | Test ACI formulas directly: column axial capacity, beam flexural capacity, shear capacity, punching shear. Compare against hand-calculated values for a known section. | 3 |
| Write load combination tests | Test `sbc_load_combinations.py` with known D/L/W actions. Assert correct envelope values and governing combination names. | 2 |
| Write pipeline smoke test | Add a test that runs `run_e2e_flow.py` end-to-end and verifies the output JSON structure (slabs, beams, columns exist; no crashes). | 2 |

**Sprint exit criteria:**
- [ ] `design_assumptions.json` is the only place material strengths are defined
- [ ] All 4 library JSON files are regenerated and consistent
- [ ] MCP server can load/save the live project without errors
- [ ] `pytest` passes with ≥ 30 tests covering selectors, formulas, and load combinations
- [ ] Pipeline smoke test runs green

---

## Sprint 1 — Fix the Engineering Logic

**Goal:** Make the structural calculations trustworthy. No silent failures, no ignored parameters, no dummy data.

**Deliverable:** Slab selector checks strength. Column moment capacity uses real ACI logic. Column forces are differentiated by location.

| Task | Detail | Hours |
|------|--------|-------|
| Fix slab selector | Add shear check (`phi_Vc_kN_per_m` vs demand) and flexure check (`Mcr_kNm_per_m` vs demand) to `slab_selector.py`. Only select slabs that pass both deflection AND strength. Add utilization ratio to output. | 3 |
| Write slab selector tests | Test with known span + load combinations. Verify that a slab that fails strength is rejected even if it passes deflection. | 2 |
| Fix column moment capacity | Replace `Mn ≈ As·fy·0.8h` with a proper ACI pure-flexure calculation using strain compatibility (epsilon_t ≥ 0.005 for tension-controlled, phi=0.9). Store both `Pn_axial` and `Mn_flexure` in the library. | 4 |
| Add simplified P-M interaction check | Add a 4-point interaction diagram (pure axial, balanced, pure flexure, tension-controlled transition) to `column_library_generator.py`. Update `column_selector.py` to check that (Pu, Mu) falls inside the diagram. | 6 |
| Write column interaction tests | Test known P-M combinations against the interaction diagram. Verify that a column with high P + high M is rejected when it falls outside the diagram. | 3 |
| Fix `simulate_frame3dd_analysis.py` bugs | Fix `os.makedirs` indentation (move out of column loop). Fix `P_D` minimum clamping inconsistency between axial and moment. | 1 |
| Differentiate column forces | Rewrite tributary area logic: compute actual tributary area per column based on bay spacing (half-distance to adjacent columns in each direction), not hardcoded 3.0m. Corner columns get ¼ bay, edge columns get ½ bay, interior columns get full bay. | 5 |
| Accumulate column loads down building | Roof columns carry roof only. Floor 2 columns carry roof + floor 2. Ground floor columns carry all floors. Implement multi-story load accumulation. | 3 |
| Verify differentiated output | Run the pipeline and verify that different columns have different forces in `resplan_analysis_results.json`. Spot-check 3–4 columns by hand. | 2 |

**Sprint exit criteria:**
- [ ] Slab selector rejects slabs that fail shear or flexure (even if they pass deflection)
- [ ] Column moment capacity uses strain compatibility, not an arbitrary proxy
- [ ] Column selector checks P-M interaction diagram
- [ ] Column forces in the analysis output are differentiated by location (not all identical)
- [ ] All new logic has tests
- [ ] `pytest` passes with ≥ 50 tests

---

## Sprint 2 — Dead Code Cleanup & Documentation Sync

**Goal:** Remove everything that doesn't work. Update everything that's stale.

**Deliverable:** No dead code, no stale docs, no broken references.

| Task | Detail | Hours |
|------|--------|-------|
| Delete dead frontend code | Remove `App.css` (Vite template leftover). Remove `calculateBeamSize` from `StructuralLabels.ts`. Remove `react-to-print` from `package.json`. Remove `autoprefixer` and `postcss` from dev deps (unnecessary with Tailwind v4). | 1 |
| Delete dead Python files | Remove `frame3dd_example.py` (standalone demo). Remove `mock_frame3dd_results.json` (legacy test file). | 0.5 |
| Fix `validate_geometry.py` path | Change hardcoded "Revit toolset" path to "BIM toolset" or make it dynamic. | 0.5 |
| Remove dead ID-parsing in `geometry_to_frame3dd.py` | Remove the `replace('C', '').replace('B', '')` dead code. | 0.5 |
| Clean up redundant data files | Remove `outputs/test.json` (redundant with analysis results). Remove duplicate type files in `inputs/` (they're identical to Global Libraries). | 0.5 |
| Fix `slab_generator.py` default paths | Change default `output_file` to be different from `resplan_file` (prevent data corruption). Use a temp file + rename pattern. | 1 |
| Update `DATA_MODELS.md` | Rewrite schemas to match the live model: epoch-timestamp IDs, multi-story (z=−1.5 to 7.0), footings, `is_support` field, output schema with `type_id`/`actions`/`utilization`/`design_label`. | 2 |
| Update `SBC_301_loads_reference.md` | Fix combo 2 to `1.2D + 1.6L + 0.5Lr` (matching code). Fix SDL value to 2.5 kN/m² (matching assumptions). Update gap log. | 1 |
| Update `index.html` title | Change "next-res-ui" to "Next Res Engine — Structural Visualizer" or similar. | 0.5 |
| Document the Vite middleware API | Add a `docs/API.md` describing the 5 endpoints, their request/response formats, and the dev-only limitation. | 2 |
| Clean up floating-point artifacts | Round volume values in `footing_library_generator.py` to match the rounding already applied to capacity values. | 0.5 |

**Sprint exit criteria:**
- [ ] No unused imports, unused dependencies, or dead code
- [ ] No file references "Revit toolset"
- [ ] `DATA_MODELS.md` schemas match live data
- [ ] `SBC_301_loads_reference.md` matches code
- [ ] `slab_generator.py` cannot corrupt its input file
- [ ] `npm run build` succeeds without warnings about unused deps
- [ ] `pytest` still passes (no regressions from cleanup)

---

## Sprint 3 — TypeScript Types & UI Foundation

**Goal:** Give the frontend real types so future UI work is type-checked.

**Deliverable:** All domain objects are typed. Context is typed. No `any` in the codebase.

| Task | Detail | Hours |
|------|--------|-------|
| Create `src/types.ts` | Define interfaces: `Node`, `Element`, `Slab`, `Wall`, `Opening`, `Room`, `Level`, `DoorType`, `WindowType`, `WallType`, `RoomType`, `Types`, `ResPlanData`, `ResPlanContextType`, `Scope`, `EditTool`, `StructuralReport`, `BOM`, `ProjectInfo`, `Settings`. | 3 |
| Type the context provider | Update `useResPlanData.tsx`: replace `createContext<any>(null)` with `createContext<ResPlanContextType | null>(null)`. Update the hook to throw if context is null (instead of returning dummy object). Add `isLoading` and `error` state. | 3 |
| Type all components | Update `LayoutCanvas`, `ElevationCanvas`, `LeftPanel`, `RightPanel`, `TypesSchedulePanel`, `PrintLayout`, `EditToolbar` to use the new types. Fix all type errors that surface. | 4 |
| Type the drawing modules | Update `drawArchitecture.ts`, `drawStructure.ts`, `drawAxesAndDims.ts`, `StructuralLabels.ts` to use typed parameters instead of `any`. | 3 |
| Type the DXF export | Update `dxfExport.ts` to use `Node[]`, `Element[]`, `Slab[]` instead of `any`. | 1 |
| Fix useEffect dependency arrays | Audit all `useEffect` hooks. Add missing dependencies. Extract logic into `useCallback` or `useMemo` where needed to prevent infinite re-renders. | 3 |
| Remove duplicate constants | Consolidate `roomNames` (defined in both `LayoutCanvas.tsx` and `drawArchitecture.ts`) into a shared `src/constants.ts`. Consolidate `pxPerMeter` into a shared constant or config. | 1 |
| Run `tsc --noEmit` | Fix all type errors. Ensure zero errors before proceeding. | 2 |

**Sprint exit criteria:**
- [ ] `tsc --noEmit` passes with zero errors
- [ ] No `any` types anywhere in `src/`
- [ ] Context throws on null instead of returning dummy
- [ ] Loading and error states are available in context
- [ ] No duplicate constant definitions
- [ ] All `useEffect` dependency arrays are complete
- [ ] `pytest` still passes (Python untouched)

---

## Sprint 4 — Interactive Editing Tools

**Goal:** Connect the EditToolbar and make the UI a real editing tool, not just a viewer.

**Deliverable:** Users can add/remove columns, beams, walls, doors, windows, and room tags from the UI.

| Task | Detail | Hours |
|------|--------|-------|
| Render EditToolbar | Add `<EditToolbar>` to the `LayoutCanvas.tsx` JSX (it's imported but never rendered). Position it as a floating toolbar. | 1 |
| Wire activeTool state | Connect `activeTool` to toolbar buttons. Show visual feedback (hover, active state). | 1 |
| Add column tool | Click on canvas → convert pixel to model coordinates → add node at (x, y, activeZ) → add column element connecting to the node below → update state. | 3 |
| Add beam tool | Click first node (highlight) → click second node → create beam element between them at activeZ → update state. | 3 |
| Remove element tool | Click on element → confirm deletion → remove from state. Handle connected elements (removing a column should offer to remove connected beams). | 3 |
| Move column tool | Drag column node → update x/y coordinates in state → snap to grid (optional). Update connected beam endpoints. | 3 |
| Add wall tool (architectural scope) | Click two points → create wall between them. Use active wall type from LeftPanel. | 2 |
| Add opening tool | Click on wall → project point to wall line → place door/window at nearest position. Use active opening type. | 3 |
| Remove wall/opening tool | Click on wall or opening → remove from state. Handle cascading (removing a wall removes its openings). | 2 |
| Save indicator | Add a "unsaved changes" indicator (dot in header). Disable save button when no changes. Show success/error toast instead of `alert()`. | 2 |
| Write UI tests | Add Vitest. Test that tools change state correctly. Test undo/redo after tool actions. | 4 |

**Sprint exit criteria:**
- [ ] EditToolbar is visible and all tools are clickable
- [ ] Add/remove column, beam, wall, opening all work and persist on save
- [ ] Move column updates connected beams
- [ ] Undo/redo works after all tool actions
- [ ] Save shows proper feedback (not `alert()`)
- [ ] Vitest passes with UI interaction tests
- [ ] `pytest` still passes

---

## Sprint 5 — DXF Export & Real FEA

**Goal:** Deliverables are production-ready. Analysis uses real FEA, not approximations.

**Deliverable:** Complete DXF files. Real Frame3DD analysis integrated into the pipeline.

| Task | Detail | Hours |
|------|--------|-------|
| Fix DXF header/tables | Add proper DXF HEADER section with `$ACADVER` (R12). Add TABLES section with LAYER definitions (S-COL, S-BEAM, S-SLAB, A-WALL, A-DOOR, A-WIN). Add BLOCKS section. | 3 |
| Add architectural DXF export | Export walls as LINE entities, doors/windows as ARC/LINE entities, rooms as TEXT labels. Add A-WALL, A-DOOR, A-WIN layers. | 4 |
| Use real column sizes in DXF | Read column dimensions from BOM/structural report instead of hardcoded 0.3×0.3m. | 1 |
| Add DXF validation | Write a test that generates a DXF and validates it can be parsed (use `dxf-parser` or similar). | 2 |
| Integrate pyframe3dd into pipeline | Replace `geometry_to_frame3dd.py` output with proper Frame3DD CSV format via `pyframe3dd`. Build the model: nodes, elements, reactions, sections, load cases. | 6 |
| Run real FEA | Call `pyframe3dd` to solve the model. Extract member forces (axial, shear My, shear Vz, moment My, moment Mz) for each element. | 4 |
| Feed FEA results into selectors | Replace `simulate_frame3dd_analysis.py` output with FEA results in the same JSON schema. Run through `sbc_load_combinations.py` → selectors → BOM. | 3 |
| Compare FEA vs. approximate | Run both the old simulator and the new FEA. Compare forces. Document the differences. Keep the simulator as a fallback. | 3 |
| Write FEA integration tests | Test that FEA produces different forces for different elements. Test that the pipeline produces a valid BOM from FEA results. | 3 |

**Sprint exit criteria:**
- [ ] DXF files open correctly in AutoCAD / LibreCAD / BricsCAD
- [ ] DXF includes both structural and architectural elements
- [ ] Column sizes in DXF match the BOM
- [ ] `pyframe3dd` runs and produces member forces
- [ ] FEA forces replace the approximate simulator in the pipeline
- [ ] FEA forces are differentiated by location (not all identical)
- [ ] BOM output is generated from FEA results
- [ ] All tests pass (Python + Vitest)

---

## Sprint 6 — Production Backend & Project Management

**Goal:** The app works outside of `vite dev`. Multiple projects are supported.

**Deliverable:** Standone backend server. Project selection UI. Deployable build.

| Task | Detail | Hours |
|------|--------|-------|
| Extract API to standalone server | Move the 5 endpoints from `vite.config.ts` into an Express or Fastify server (`server/index.ts`). Add proper error responses, file size limits, input validation. | 4 |
| Add project list endpoint | `GET /api/projects` → scan `Projects/` directory, return list of projects with metadata from `project.json`. | 2 |
| Add project selection UI | Add a project selector dropdown or modal in the header. Fetch project list on mount. Switch projects by calling `load_project` with a different path. | 3 |
| Add project creation | `POST /api/projects/create` → create new project directory from template, initialize `project.json`, empty inputs, empty outputs. | 3 |
| Update Vite proxy | Configure `vite.config.ts` to proxy `/api/*` to the standalone server during development. | 1 |
| Add loading/error states | Add a global loading spinner during data fetches. Add error boundary with user-friendly error messages. Replace all `alert()` calls with toast notifications. | 3 |
| Build production bundle | Run `npm run build`, verify the output works with the standalone server (no dev middleware). Test deployment. | 2 |
| Write backend tests | Test all API endpoints with supertest. Test project creation, loading, saving. Test error cases (missing files, invalid JSON). | 4 |
| Update documentation | Update `README.md` with production setup instructions. Document the backend API in `docs/API.md`. | 2 |

**Sprint exit criteria:**
- [ ] Standalone backend server runs independently of Vite
- [ ] Project selector works — can switch between projects
- [ ] New projects can be created from the UI
- [ ] `npm run build` + `node server` works as a production deployment
- [ ] No `alert()` calls in the codebase
- [ ] Loading and error states work
- [ ] Backend tests pass
- [ ] All other tests still pass

---

## Sprint Summary

| Sprint | Theme | Effort | Depends On |
|--------|-------|--------|------------|
| 0 | Stabilization & Safety Net | ~15h | — |
| 1 | Fix Engineering Logic | ~29h | Sprint 0 |
| 2 | Dead Code Cleanup & Docs | ~12h | Sprint 0 |
| 3 | TypeScript Types & UI Foundation | ~20h | Sprint 2 |
| 4 | Interactive Editing Tools | ~27h | Sprint 3 |
| 5 | DXF Export & Real FEA | ~29h | Sprint 1 |
| 6 | Production Backend & Project Mgmt | ~24h | Sprint 3 |

**Total estimated effort:** ~156 hours

### Parallelization Notes

- **Sprint 0** must be done first — everything depends on it.
- **Sprints 1 and 2** can run in parallel (engineering fixes vs. cleanup — different files, no conflicts).
- **Sprint 3** depends on Sprint 2 (dead code removed before typing).
- **Sprint 4** depends on Sprint 3 (types needed before building features).
- **Sprint 5** depends on Sprint 1 (engineering logic fixed before FEA integration).
- **Sprint 6** depends on Sprint 3 (types needed for backend) but can run in parallel with Sprint 4 or 5.

```
Sprint 0
  ├── Sprint 1 ────── Sprint 5
  └── Sprint 2 ── Sprint 3 ── Sprint 4
                       └──────── Sprint 6
```
