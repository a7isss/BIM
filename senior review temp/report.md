# BIM Toolset — Full Codebase Critical Review

> Date: 2026-06-29
> Scope: Entire repository — Structural Tools (Python), Next Res UI (React/TS), resplan-mcp, data layer, docs

---

## 1. Project Overview

The **Next Res Engine & Structural Toolset** is an automated structural engineering suite that translates architectural floor plans into structurally sized, code-compliant (SBC/ACI) models with a standalone web visualizer.

### Stated High-Level Goals
1. **No Guessing** — deterministic selection from pre-computed JSON capacity libraries
2. **Explicit Fallbacks** — hard failure when no section satisfies demand; never invent sections
3. **Decoupled Visualization** — Python engine outputs JSON; React UI renders independently
4. **Single Source of Truth** — `design_assumptions.json` governs all material strengths
5. **SBC/ACI Compliance** — all capacity formulas must follow rigorous code equations
6. **Deliverables** — DXF and PDF export from the UI

### Architecture (3 layers)
- **Input Layer**: `resplan_nodes.json` (geometry) + `design_assumptions.json` (materials/loads)
- **Structural Engine** (Python): Generators pre-compute capacity tables → Selectors do deterministic lookup → Orchestrator ties it together
- **UI Layer** (React/Vite/D3): Reads JSON outputs, renders plan/elevation views, exports DXF/PDF

---

## 2. Layer-by-Layer Analysis

---

### 2.1 Structural Engine (`/Structural Tools`)

#### File Inventory (16 Python files)

| File | Purpose | Architecture Role |
|------|---------|-------------------|
| `beam_library_generator.py` | Pre-computes beam capacity tables (225 sections × 3 tiers) | Generator |
| `beam_selector.py` | Selects lightest beam from library by Mu, Vu | Selector |
| `column_library_generator.py` | Pre-computes column capacities (153 sections × 3 tiers) | Generator |
| `column_selector.py` | Selects lightest column by Pu, Mu | Selector |
| `footing_library_generator.py` | Pre-computes footing capacities (isolated/strip/combined) | Generator |
| `footing_selector.py` | Selects footing by bearing, shear, flexure checks | Selector |
| `slab_generator.py` | Detects slabs from architectural rooms, assigns to Z-levels | Preprocessor |
| `slab_library_generator.py` | Pre-computes slab type capacities (solid/ribbed/waffle) | Generator |
| `slab_selector.py` | Selects slab by span/depth ratio | Selector |
| `sbc_load_combinations.py` | Generates LRFD load combinations per SBC 301/ASCE 7 | Load Engine |
| `simulate_frame3dd_analysis.py` | Approximate analysis: tributary areas, wall loads, wind | Force Generator |
| `geometry_to_frame3dd.py` | Converts node/element graph to .3dd text file | Converter |
| `frame3dd_orchestrator.py` | Runs combinations + selectors, groups into BOM, exports report | Orchestrator |
| `frame3dd_example.py` | Standalone pyframe3dd demo | Unused |
| `validate_geometry.py` | Shapely-based room polygon validation | Utility |
| `run_e2e_flow.py` | End-to-end pipeline runner | Runner |

#### SBC/ACI Formula Compliance

| Formula | Code Location | Correct? | Notes |
|---------|---------------|----------|-------|
| Column axial: `Pn = 0.80·[0.85·fc·(Ag−As) + fy·As]` | `column_library_generator.py` | ✅ YES | Exact match to STRUCTURAL_ASSUMPTIONS.md, φ=0.65 tied |
| beta1: `0.85 − 0.05·(fc−28)/7`, min 0.65 | `beam_library_generator.py` | ✅ YES | Correct ACI 318 formula |
| Beam min steel: `max(0.25·√fc/fy, 1.4/fy)·bw·d` | `beam_library_generator.py` | ✅ YES | Correct ACI 318-19 |
| Beam max steel: `c_max = 0.375·d` (tension-controlled) | `beam_library_generator.py` | ✅ YES | Correct for φ=0.9 |
| Shear: `Vc = 0.17·√fc·bw·d` | Multiple files | ✅ YES | Correct ACI simplified |
| Punching shear: `Vc = 0.33·√fc·bo·d` | `footing_library_generator.py` | ⚠️ PARTIAL | Only uses 1 of 3 ACI limits |
| Modulus of rupture: `fr = 0.62·√fc` | `slab_library_generator.py` | ✅ YES | Correct ACI |
| Load combos: 1.2D+1.6L, 1.4D, 0.9D+1.0W | `sbc_load_combinations.py` | ✅ YES | Matches ASCE 7-16 |
| Column moment: `Mn ≈ As·fy·0.8h` | `column_library_generator.py` | ❌ NO | Arbitrary proxy, not ACI-compliant |
| Slab strength check | `slab_selector.py` | ❌ NO | `required_load_kN_m2` accepted but never used |

#### Critical Issues — Structural Engine

**1. Slab selector ignores load entirely (HIGH)**
`slab_selector.py` accepts `required_load_kN_m2` as a parameter but the function body only checks span/depth ratios for deflection control. Shear capacity (`phi_Vc_kN_per_m`) and cracking moment (`Mcr_kNm_per_m`) exist in the library but are never checked against demand. A slab could be selected that fails in shear or flexure.

**2. Column moment capacity is an arbitrary proxy (HIGH)**
`column_library_generator.py` computes `Mn ≈ As·fy·(0.8·h)` with the comment *"This is a very rough proxy just for the selector logic."* Real column design requires a P-M interaction diagram. A column that passes independent Pu and Mu checks can fail on the interaction diagram. This is unconservative.

**3. Inconsistent configuration loading (HIGH)**
- `column_library_generator.py` → reads `design_assumptions.json` ✅
- `footing_library_generator.py` → reads `design_assumptions.json` ✅
- `beam_library_generator.py` → **hardcodes** `fc=28`, `fy=420` ❌
- `slab_library_generator.py` → **hardcodes** `fc=28`, `gamma_c=24` ❌
- `simulate_frame3dd_analysis.py` → reads some values, **hardcodes** wall density, wind pressure, bay width ❌

Changing `design_assumptions.json` updates some libraries but not others. This is a silent configuration drift risk.

**4. Material strength mismatch between files (HIGH)**
- `design_assumptions.json`: fc=28 MPa, fy=420 MPa
- `structural_types.json` (Global Libraries): fc=25 MPa, fy=500 MPa (B500B)

Capacity tables may have been computed with different materials than the project assumes.

**5. Dummy column analysis data (HIGH)**
Every column in `resplan_analysis_results.json` (both inputs and outputs copies) has identical forces:
- Dead: P=32.5, M=20, V=5
- Live: P=10, M=10, V=2
- Wind: P=0, M=45, V=15
- Utilization: 0.63 (all identical)

A 145-node multi-story building where every column has the same load is placeholder data, not real analysis.

**6. `simulate_frame3dd_analysis.py` is misnamed and full of magic numbers (MEDIUM)**
It's not running Frame3DD FEA — it's a hand-rolled approximate analysis with:
- Wind pressure: 0.5 kPa (hardcoded)
- Bay width: 3.0 m (hardcoded)
- Gravity moment: `w·L²/10` (between simple span L²/8 and fixed-end L²/12)
- Column eccentricity: `max(b,h)·0.05` (5% proxy)
- Wind moment cap: `max(P_D + self_weight, 10)·max(b,h)·0.30` (30% heuristic)

The name implies FEA validation that isn't happening.

**7. `os.makedirs` bug in `simulate_frame3dd_analysis.py` (MEDIUM)**
`os.makedirs(os.path.dirname(output_file), exist_ok=True)` is indented inside the column loop, so it runs once per column instead of once before writing.

**8. `slab_generator.py` reads and writes the same file (MEDIUM)**
Default signature: `generate_slabs(resplan_file="resplan_nodes.json", output_file="resplan_nodes.json")`. If the function crashes mid-write, the input data is corrupted.

**9. Load combination documentation mismatch (LOW)**
`SBC_301_loads_reference.md` states combo 2 is `1.2D + 1.7L + 0.5Lr` but the code uses `1.2D + 1.6L + 0.5Lr`. The code value (1.6) is more current (ASCE 7-16), but the documentation is stale.

**10. No automated tests (CRITICAL)**
Zero test files in the entire project. No pytest, no unittest, no test infrastructure of any kind. For engineering software where errors have safety implications, this is unacceptable.

#### Other Issues
- `footings_library.json` contains floating-point artifacts (`0.22499999999999998`)
- `geometry_to_frame3dd.py` produces a text file, not actual Frame3DD CSV format
- `frame3dd_example.py` and `mock_frame3dd_results.json` are legacy/unused
- `validate_geometry.py` references "Revit toolset" (old project name)
- `slab_generator.py` has an unreadable nested list comprehension for beam filtering (O(n²))
- Hardcoded Z-level mapping in `slab_generator.py`: `{"arch_ground": 3.5, "arch_first": 7.0}`

---

### 2.2 Next Res UI (`/Next Res UI`)

#### Stack
React 19, TypeScript 6, Vite 8, D3.js 7, Tailwind CSS 4, lucide-react, oxlint

#### File Inventory

| File | Lines | Purpose |
|------|-------|---------|
| `src/main.tsx` | 12 | React entry point |
| `src/App.tsx` | 68 | Root component |
| `src/App.css` | 111 | **DEAD CODE** — Vite template leftover |
| `src/index.css` | 30 | Global styles + print rules |
| `src/hooks/useResPlanData.tsx` | 170 | Context provider, state, undo/redo, API |
| `src/utils/dxfExport.ts` | 79 | DXF string generation and download |
| `src/components/LayoutCanvas.tsx` | 195 | D3 plan view renderer |
| `src/components/ElevationCanvas.tsx` | 180 | D3 elevation view renderer |
| `src/components/LeftPanel.tsx` | 155 | Project info and levels editor |
| `src/components/RightPanel.tsx` | 195 | Properties, export, tools panel |
| `src/components/TypesSchedulePanel.tsx` | 135 | Door/window types schedule modal |
| `src/components/PrintLayout.tsx` | 135 | A3 print layout with title block |
| `src/components/EditToolbar.tsx` | 75 | **NEVER RENDERED** — edit tools toolbar |
| `src/components/drawArchitecture.ts` | 250 | D3 architectural drawing |
| `src/components/drawStructure.ts` | 120 | D3 structural drawing |
| `src/components/drawAxesAndDims.ts` | 220 | D3 grid axes and dimension lines |
| `src/components/StructuralLabels.ts` | 145 | D3 structural element labels |
| `src/components/drawArchitecture.ts` | 250 | D3 architectural drawing (new file) |
| `src/components/drawStructure.ts` | 120 | D3 structural drawing (new file) |

#### Critical Issues — UI

**1. Pervasive `any` typing (HIGH)**
The entire React codebase uses `any` for every domain object:
- `nodes: any[]`, `elements: any[]`, `slabs: any[]`
- `createContext<any>(null)`
- `availableLevels.find((l: any) => ...)`

TypeScript is configured with strict linting rules but the actual code circumvents the type system entirely. This is TypeScript theater — build complexity without safety benefits.

**2. Dev-only backend — no production path (HIGH)**
All data loading/saving goes through a custom Vite dev-server middleware in `vite.config.ts`. Five API endpoints (`/api/save`, `/api/load_project`, etc.) only exist during `vite dev`. A `vite build` output has no backend. The app is fundamentally a development-only tool.

**3. EditToolbar is defined but never rendered (MEDIUM)**
`EditToolbar` is imported in `LayoutCanvas.tsx` but never rendered in JSX. The editing tools (add door, add column, add beam, rotate column, move column) are defined but have no user-facing trigger. The only editing that works is inline wall/opening removal and room type editing.

**4. Incomplete useEffect dependency arrays (MEDIUM)**
`LayoutCanvas.tsx` has a ~180-line render effect with dependency array `[architecture, rooms, openings, nodes, elements, slabs, scope, localFloor, forcedFloor]` but also uses `selectedFloor`, `availableLevels`, `types`, `bom`, `isEditMode`, `activeTool`, `editingRoomId`, `updateState`, `isPrintMode`, `activeTypes` — all missing. The canvas may not re-render when these values change.

**5. DXF export is incomplete (MEDIUM)**
- No HEADER/TABLES/BLOCKS sections — many CAD programs may reject the file
- Column size hardcoded to 0.3×0.3m regardless of actual BOM dimensions
- No architectural elements (walls, doors, windows) exported
- Only structural layers (S-COL, S-BEAM, S-SLAB)

**6. Dead dependencies and code (LOW)**
- `react-to-print` installed but never used (PDF via `window.print()` instead)
- `autoprefixer` and `postcss` unnecessary with Tailwind v4 Vite plugin
- `App.css` is a Vite template leftover with no corresponding JSX
- `calculateBeamSize` in `StructuralLabels.ts` defined but never called

**7. No loading or error states (MEDIUM)**
No loading spinners, no error boundaries, no user-facing error messages. The context provider has no `isLoading` or `error` state. `RightPanel.tsx` uses `alert()` for success messages regardless of whether the save actually succeeded.

**8. Hardcoded project path (MEDIUM)**
Every API endpoint resolves to `../Projects/Sample Project/`. No project selection mechanism. The app can only ever load one project.

**9. No tests (CRITICAL)**
No test files exist anywhere in the frontend.

#### Strengths — UI
- Well-structured component hierarchy with drawing modules decomposed into separate files
- Proper React Context with undo/redo (immutable state transitions)
- D3 rendering properly separated: `drawArchitecture`, `drawStructure`, `drawAxesAndDims`, `StructuralLabels`
- Print layout follows engineering drawing conventions (A3 landscape, title blocks, BOM schedules)
- Elevation view with painter's algorithm depth sorting is solid
- Two-pass wall rendering (hollow wall effect) is a nice architectural visualization touch
- Tailwind CSS 4 used consistently (no inline styles in components)

---

### 2.3 MCP Server (`/resplan-mcp`)

#### Critical Issues

**1. Hardcoded wrong project path (CRITICAL)**
`server.py` line: `PROJECT_DIR = 'D:/Revit toolset/Projects/Sample Project'` — references "Revit toolset" (old project name), not "BIM toolset". Every tool that loads/saves data will fail or operate on the wrong directory.

**2. `run_structural_analysis` points to wrong path (CRITICAL)**
Calls `subprocess.run(['python', 'run_e2e_flow.py'], cwd='D:/Revit toolset/Structural Tools', ...)` — also wrong base directory.

**3. `get_types` tool is broken (MEDIUM)**
Reads `data.get('types', {})` from `resplan_nodes.json`, but that file has no `types` key. Type catalogs live in separate files (`resplan_types.json`, `structural_types.json`). This tool always returns "Category not found."

#### Strengths
- 13 well-structured tools (alignment, snap, beam/column/wall/room/opening operations)
- Column alignment logic (group by X/Y coordinate, handle ghost nodes within 0.5m) is well-designed
- Opening placement (point-to-segment projection, wall snapping) is mathematically correct

---

### 2.4 Data Layer

#### Critical Issues

**1. `project_settings.json` is empty (MEDIUM)**
The file is `{}`. The MCP `update_project_settings` tool and `get_settings_path()` reference it expecting `floor_height_m` and `global_grid_spacing_m`, but reads return `None`.

**2. Duplicate type files (LOW)**
`inputs/resplan_types.json` and `inputs/structural_types.json` are byte-identical copies of the Global Libraries versions.

**3. Coordinate drift (LOW)**
Live model uses `y=12.25` where the dataset baseline uses `y=12.05` — a 20cm shift, likely from manual MCP edits.

**4. Inconsistent node schema (LOW)**
- Node IDs mix two schemes: 13-digit epoch timestamps and shorter integers
- Some nodes have `is_support` (boolean), some don't
- Z-values mix int (`7`) and float (`7.0`, `0.0`)

**5. Empty export directories (LOW)**
`outputs/dxf/` and `outputs/pdf/` have never been populated.

**6. Redundant analysis files (LOW)**
`inputs/resplan_analysis_results.json`, `outputs/resplan_analysis_results.json`, and `outputs/test.json` overlap heavily with minor schema variations.

#### Strengths
- `design_assumptions.json` is well-structured and internally consistent with ACI 318-19
- `structural_types.json` has precise nominal capacities matching ACI formulas
- `SBC_301_loads_reference.md` is an excellent reference document with an honest gap log

---

### 2.5 Documentation

**`DATA_MODELS.md` is stale.** The documented `resplan_nodes.json` schema (simple integer IDs, single-story) matches the dataset baseline but NOT the live model (epoch-timestamp IDs, multi-story, footings). The documented output schema (`section`, `rho`, `capacity_kn`, `footing`) does not match actual output files (`type_id`, `actions`, `utilization`, `design_label`).

**`STRUCTURAL_ASSUMPTIONS.md` is solid.** Authoritative engineering rules with correct formulas, consistent with the code (where the code is correct).

**`project_structure_schema.json` is functional.** The Sample Project conforms structurally, though `project_settings.json` is empty and not listed as required.

---

### 2.6 Dataset Pipeline (`/Resplan Dataset`)

The upstream pipeline (`extract_test_plan_ortho.py` → `generate_full_frame.py` → `resplan_to_json.py`) is well-built:
- Orthogonalization (3-step: grid clustering → T-junction snapping → node collapsing) is sophisticated
- Beam merging (collinear segment consolidation) is correct
- Clean generator with node deduplication via coordinate keys

**Issue:** The pipeline generates a single-story model (z=0 to z=3.0), but the live `inputs/resplan_nodes.json` is a multi-story model (z=−1.5 to z=7.0, 4 levels) — the live model was heavily extended after generation, likely by MCP tools, creating schema inconsistencies.

---

## 3. Goal-by-Goal Scorecard

| Stated Goal | Verdict | Why |
|---|---|---|
| **Deterministic selection, no guessing** | ⚠️ Partial | Selectors are genuinely deterministic lookups. But forces feeding them come from approximate analysis with magic numbers. |
| **SBC/ACI formula compliance** | ⚠️ Partial | Axial column, beam flexure, shear, load combos are correct. Column moment is an arbitrary proxy. Slab selector ignores load. Punching shear uses 1 of 3 ACI limits. |
| **Explicit fallbacks / hard failures** | ✅ Yes | Selectors return `None` when no section satisfies demand. Orchestrator labels "No Section Available." Strongest part of the design. |
| **Decoupled visualization** | ⚠️ Partial | React UI is separate from Python — good. But only works in `vite dev` mode. No production backend. |
| **Single source of truth for materials** | ❌ No | Half the generators read `design_assumptions.json`, the other half hardcode values. Material mismatch between assumptions (fc=28) and global types (fc=25). |
| **No AI hallucinations in calculations** | ✅ Mostly | Formulas are hardcoded and correct where correct. No ML/AI in capacity calculation. |
| **DXF/PDF deliverables** | ⚠️ Partial | DXF is incomplete (no HEADER/TABLES, hardcoded column sizes). PDF print layout is well done. Export dirs are empty. |

---

## 4. Assessment of the Developer

### The Good — Engineer First, Programmer Second

The developer clearly understands structural engineering. The ACI formulas are correct where they matter most. The **library+selector architecture** is a genuinely smart design pattern — pre-computing capacity tables and doing pure lookups is both safer and more transparent than calculating on the fly. This is the right instinct for engineering software.

The React UI shows solid D3 skills — two-pass wall rendering, painter's algorithm for elevations, structural grid bubbles, and print layout with title blocks all demonstrate understanding of architectural drawing conventions.

The gap log in `SBC_301_loads_reference.md` honestly documenting discrepancies shows intellectual integrity.

### The Bad — Chronic Inconsistency and Unfinished Work

1. **No tests. Zero.** For engineering software with safety implications, this is unacceptable.
2. **Pervasive `any` typing.** TypeScript is configured with strict rules but the code circumvents the type system entirely.
3. **Configuration drift is built into the design.** Half the generators read config, the other half hardcode the same values.
4. **Dead code everywhere.** Features built and abandoned without cleanup (EditToolbar, react-to-print, calculateBeamSize, App.css).
5. **The MCP server is broken.** Hardcodes the wrong project directory. Was never tested against the current project.
6. **The slab selector is incomplete.** Accepts a load parameter and ignores it.
7. **`simulate_frame3dd_analysis.py` is misnamed.** It's approximate analysis, not FEA.

### The Ugly — Red Flags About Process

- **Column analysis data is dummy.** Every column has identical forces and utilization=0.63. Placeholder data presented as analysis output.
- **`slab_generator.py` reads and writes the same file by default.** Basic data safety mistake.
- **`os.makedirs` bug** — indented inside the column loop, never noticed because `exist_ok=True` masks it.
- **Documentation is stale.** Schemas don't match the live data. README says "Never modify standard material strengths in a script" but beam and slab generators do exactly that.
- **Single git commit.** "Initial commit of full structural pipeline and React UI." No incremental history, no code review, no iteration visible.

---

## 5. Bottom Line

**The architecture is sound. The implementation is not yet trustworthy.**

The foundation — library+selector pattern, deterministic lookup, decoupled layers — is the right approach. But the system cannot currently be relied upon for real engineering work because:

1. Slab selection ignores strength
2. Column moment capacity is a rough proxy, not a real interaction diagram
3. All column forces are identical placeholder values
4. Material strengths are inconsistent between components
5. Nothing is tested
6. The MCP server points to the wrong directory and was never tested
7. There is no production deployment path for the UI

The project needs a disciplined cleanup pass before it can be trusted, followed by targeted expansion of the incomplete engineering logic.
