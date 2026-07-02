# Fixing & Expanding the BIM Toolset — Where to Start

> Date: 2026-06-29
> Companion file: `report.md` (full codebase review), `sprints.md` (sprint breakdown)

---

## Guiding Principle

**Fix the foundation before building on it.** The architecture is sound — the library+selector pattern is the right approach. But the implementation has cracks that will propagate if you build on top of them. Fix the load-bearing issues first, then expand.

The order below is prioritized by: (1) safety/correctness, (2) unblocks other work, (3) effort-to-impact ratio.

---

## Starting Point 1: Fix Material Configuration Drift (BLOCKING)

**Why start here:** This is the single source of truth. If materials are wrong, every capacity table, every selection, and every BOM output is suspect. Nothing downstream can be trusted until this is fixed.

**What to do:**
1. Pick one set of materials and make `design_assumptions.json` the authoritative source:
   - `fc = 28 MPa`, `fy = 420 MPa` (current project assumptions) OR `fc = 25 MPa`, `fy = 500 MPa` (global types) — **you decide which is correct for your project**
2. Update `beam_library_generator.py` to read from `design_assumptions.json` (currently hardcodes `fc=28, fy=420`)
3. Update `slab_library_generator.py` to read from `design_assumptions.json` (currently hardcodes `fc=28, gamma_c=24`)
4. Update `simulate_frame3dd_analysis.py` to read wall density, wind pressure, and bay width from assumptions or a new `loads_config.json`
5. Reconcile `structural_types.json` (Global Libraries) with `design_assumptions.json` — they currently disagree
6. Regenerate all library JSON files (`columns_library.json`, `beams_library.json`, `slabs_library.json`, `footings_library.json`) after the fix

**Effort:** Small (1–2 hours of code changes, then regenerate libraries)

---

## Starting Point 2: Fix the MCP Server Path (BLOCKING)

**Why start here:** The MCP server is completely broken — it points to `D:/ResPlan toolset/` (old project name). Every tool fails. This blocks any interactive model editing.

**What to do:**
1. In `resplan-mcp/server.py`, change `PROJECT_DIR` from `'D:/ResPlan toolset/Projects/Sample Project'` to a dynamic path based on the actual repo location
2. Fix the `run_structural_analysis` subprocess path from `'D:/ResPlan toolset/Structural Tools'` to the correct path
3. Fix `get_types` tool — it reads `types` from `resplan_nodes.json` which has no such key. Point it to `resplan_types.json` / `structural_types.json` instead
4. Test each of the 13 tools manually against the live project

**Effort:** Small (1 hour)

---

## Starting Point 3: Add Tests for the Engineering Logic (SAFETY NET)

**Why start here:** Before you fix the slab selector, column moment capacity, or the analysis simulator, you need a safety net. Without tests, you can't verify your fixes are correct. You also can't refactor without fear of regressions.

**What to do:**
1. Set up `pytest` in `/Structural Tools/`
2. Start with the highest-risk, easiest-to-test components:
   - `column_selector.py` — given a known Pu/Mu, does it return the correct section?
   - `beam_selector.py` — given known Mu/Vu, does it return the correct section?
   - `sbc_load_combinations.py` — given known D/L/W actions, are the envelopes correct?
3. Test the ACI formulas directly:
   - Column axial capacity: verify `Pn = 0.80·[0.85·fc·(Ag−As) + fy·As]` against hand-calculated values
   - Beam flexural capacity: verify `phi_Mn` against hand-calculated values for a known section
4. Add a regression test that runs the full `run_e2e_flow.py` pipeline and checks the output structure

**Effort:** Medium (4–6 hours for initial test suite)

---

## Starting Point 4: Fix the Slab Selector (CORRECTNESS)

**Why start here:** The slab selector currently ignores load. This is the most dangerous silent failure in the system — a slab can be selected that fails in shear or flexure, and the user has no warning.

**What to do:**
1. In `slab_selector.py`, add strength checks:
   - Compare `phi_Vc_kN_per_m` (from library) against the shear demand per meter
   - Compare `Mcr_kNm_per_m` (from library) against the moment demand per meter
   - Only select a slab that passes BOTH deflection AND strength checks
2. The moment demand per meter for a slab is approximately `w·L²/8` for simply supported or `w·L²/24` for fixed-end (use the appropriate continuity assumption)
3. Add a utilization ratio to the output so the user can see how close the slab is to capacity
4. Write tests for the fixed selector

**Effort:** Small (2–3 hours)

---

## Starting Point 5: Replace Dummy Column Forces (CORRECTNESS)

**Why start here:** Every column in the analysis output has identical forces. This means the BOM is selecting the same column section for every location, which defeats the purpose of the system.

**What to do:**
1. In `simulate_frame3dd_analysis.py`, fix the tributary area logic so corner columns, edge columns, and interior columns get different loads
2. The tributary area for a column should be based on the actual bay spacing (half the distance to adjacent columns in each direction), not a hardcoded 3.0m bay width
3. Accumulate loads down the building (roof columns carry roof load only; ground floor columns carry all floors above)
4. The `os.makedirs` bug (indented inside the column loop) should be fixed while you're in this file
5. Verify the output has different forces for different columns

**Effort:** Medium (4–6 hours — the tributary area logic is the core of the simulator)

---

## Starting Point 6: Improve Column Moment Capacity (CORRECTNESS)

**Why start here:** The current `Mn ≈ As·fy·0.8h` is an arbitrary proxy. For columns with significant bending (corner columns, moment frames), this is unconservative.

**What to do:**
1. Option A (simpler): Compute a proper ACI moment capacity for pure bending (axial = 0) using strain compatibility. This gives the maximum moment capacity. Then check `Mu ≤ phi_Mn_max` as an upper bound. This is conservative but not a full interaction diagram.
2. Option B (better): Generate a simplified P-M interaction diagram with at least 4 points:
   - Pure axial (Pu_max at M=0)
   - Balanced point
   - Pure flexure (M_max at P=0)
   - Tension-controlled transition
   Then check that (Pu, Mu) falls inside the diagram.
3. Update `column_library_generator.py` to store the interaction points
4. Update `column_selector.py` to check the interaction diagram
5. Write tests with known P-M combinations

**Effort:** Medium-Large (Option A: 3–4 hours, Option B: 8–12 hours)

---

## Starting Point 7: TypeScript Domain Types (FOUNDATION FOR UI WORK)

**Why start here:** The entire React codebase uses `any` for everything. Before adding features to the UI, you need types so that changes are type-checked.

**What to do:**
1. Create `src/types.ts` with interfaces for all domain objects:
   ```typescript
   interface Node { id: string | number; x: number; y: number; z: number; is_support?: boolean }
   interface Element { id: string; type: 'beam' | 'column' | 'footing'; n1: string; n2: string; ... }
   interface Slab { id: string; nodes: string[]; type_id?: string; span_m?: number; ... }
   interface Wall { id: string; n1: string; n2: string; type_id: string; thickness: number }
   interface Opening { id: string; wall_id: string; type: 'door' | 'window'; ... }
   interface Room { id: string; nodes: string[]; type: string; label: string }
   interface Level { id: string; elevation_m: number; height_m: number }
   interface Types { doors: DoorType[]; windows: WindowType[]; walls: WallType[]; rooms: RoomType[] }
   ```
2. Update `useResPlanData.tsx` to use these types
3. Fix the context type: `createContext<ResPlanContextType>(null)` instead of `any`
4. Propagate types through all components
5. Fix any type errors that surface

**Effort:** Medium (4–6 hours — mostly mechanical, but will reveal hidden bugs)

---

## Starting Point 8: Fix the EditToolbar and Connect Editing Tools (FEATURE)

**Why start here:** The editing tools (add/remove columns, beams, walls, doors, windows) are defined but never rendered. Connecting them unlocks interactive model editing from the UI.

**What to do:**
1. Render `EditToolbar` in `LayoutCanvas.tsx` (it's imported but never included in JSX)
2. Wire `activeTool` state to the toolbar buttons
3. Implement canvas click handlers for each tool:
   - `add_column`: click on canvas → add column node at clicked coordinate
   - `add_beam`: click two nodes → create beam between them
   - `remove_column`/`remove_beam`: click element → delete it
   - `move_column`: drag column → update coordinates
   - `rotate_column`: click column → rotate orientation
4. Add visual feedback (hover states, preview lines for beam placement)
5. Test each tool end-to-end (edit → save → reload → verify persistence)

**Effort:** Large (8–12 hours — this is a full feature, not a fix)

---

## Starting Point 9: Real FEA Integration (ADVANCED)

**Why start here:** The current "simulate" analysis is approximate. For production use, you need real FEA results.

**What to do:**
1. Integrate `pyframe3dd` (already installed, used in `frame3dd_example.py`) into the main pipeline
2. Replace `simulate_frame3dd_analysis.py` with a proper FEA runner:
   - Build the Frame3DD input model from `resplan_nodes.json` (nodes, elements, reactions, sections)
   - Apply load cases (dead, live, wind) as Frame3DD load cases
   - Run the analysis
   - Extract member forces (axial, shear, moment) from the Frame3DD output
3. Feed the real forces into `sbc_load_combinations.py` → selectors → BOM
4. Compare FEA results vs. the approximate simulator to validate the approximate method (useful as a fallback)

**Effort:** Large (12–20 hours — depends on pyframe3dd maturity and Frame3DD setup complexity)

---

## Starting Point 10: Production Backend for UI (ADVANCED)

**Why start here:** The Vite dev-server middleware is dev-only. For deployment, you need a real backend.

**What to do:**
1. Extract the API endpoints from `vite.config.ts` into a standalone Express/Fastify server
2. Add project selection (list projects, switch between them)
3. Add proper error responses (not just `console.error`)
4. Add file size limits on save
5. Consider authentication if deployed beyond local use
6. Update the Vite proxy config to point to the standalone server

**Effort:** Medium-Large (6–10 hours)

---

## Priority Order Summary

| Priority | Starting Point | Type | Effort |
|----------|---------------|------|--------|
| 1 | Fix material configuration drift | Blocking | Small |
| 2 | Fix MCP server path | Blocking | Small |
| 3 | Add tests for engineering logic | Safety net | Medium |
| 4 | Fix slab selector | Correctness | Small |
| 5 | Replace dummy column forces | Correctness | Medium |
| 6 | Improve column moment capacity | Correctness | Medium-Large |
| 7 | TypeScript domain types | Foundation | Medium |
| 8 | Connect EditToolbar | Feature | Large |
| 9 | Real FEA integration | Advanced | Large |
| 10 | Production backend | Advanced | Medium-Large |

**Rule of thumb:** Items 1–3 must be done before any new feature work. Items 4–6 make the engineering trustworthy. Items 7–10 expand the system's capability.
