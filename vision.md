# BIM Toolset — Final Project Vision

> Date: 2026-06-29
> Companion files: `report.md` (review), `roadmap.md` (starting points), `sprints.md` (execution plan)

---

## 1. What This Project Is

A **deterministic structural engineering pipeline** that takes an architectural floor plan and produces a fully sized, code-compliant structural model — with zero guesswork in the calculation path.

It is not a drawing tool. It is not a FEA solver. It is a **translation engine**: architectural intent → structural sizing → construction deliverables.

The system enforces one principle above all others: **every capacity number is looked up from a pre-computed, formula-verified table — never calculated on the fly, never estimated, never guessed.**

---

## 2. Who Uses It

| User | What They Do |
|------|-------------|
| **Structural engineer** | Inputs architectural geometry, reviews the BOM, overrides sections if needed, exports deliverables |
| **Architect / planner** | Views the structural overlay on the architectural plan, checks column/wall conflicts, adjusts layout |
| **Draftsman** | Exports DXF to AutoCAD/BricsCAD/LibreCAD, prints PDF schedules, produces construction documents |
| **Reviewer / AH** (authority having jurisdiction) | Opens the PDF report, verifies SBC compliance, checks utilization ratios and design labels |

---

## 3. What It Should Be Capable Of

### 3.1 Input — Architectural to Structural Translation

**Accept:**
- Architectural floor plans as JSON (nodes, walls, rooms, openings)
- Multi-story buildings (ground + N floors, configurable floor heights)
- Project-level settings (materials, loads, code version, soil bearing)

**Automatically generate:**
- Structural column grid from wall intersection nodes
- Beam lines along wall segments (merged collinear spans)
- Slab panels from enclosed room boundaries
- Footing placements at every column base
- Vertical column stacks across all floors (footing → ground → floor 1 → floor N)

**Allow manual editing:**
- Add/remove/move columns, beams, walls, doors, windows from the UI
- Rotate columns, change beam sizes, adjust slab boundaries
- Edit room types and tags
- All edits are undoable/redoable and persist on save

### 3.2 Analysis — Real Forces, Not Approximations

**Run actual FEA** (via Frame3DD/pyframe3dd):
- Build a full 3D structural model (nodes, elements, restraints, section properties)
- Apply load cases:
  - Dead load (self-weight + SDL + wall loads)
  - Live load (per SBC 301 occupancy categories)
  - Wind load (per ASCE 7, direction-dependent)
  - Seismic load (per SBC 301, if applicable)
- Solve for member forces: axial (P), shear (Vy, Vz), moment (My, Mz) for every element
- Produce force envelopes per SBC 301 / ASCE 7 LRFD combinations

**Fallback mode:**
- If FEA is unavailable, use the approximate analysis simulator (clearly labeled as "preliminary" in the output)
- The approximate mode uses tributary areas, not identical placeholder forces

**Output:**
- Per-element forces (different for every column/beam — corner vs. edge vs. interior)
- Per-element utilization ratios (demand / capacity)
- Governing load combination for each element (for traceability)

### 3.3 Sizing — Deterministic Selection

**Columns:**
- Select from pre-computed library (200×200 through 1000×1000, rho 1%–4%)
- Check against a **P-M interaction diagram** (not independent P and M checks)
- Return the lightest section that passes: axial, flexure, and interaction
- Hard-fail with "No Section Available — Upsize Required" if nothing works

**Beams:**
- Select from pre-computed library (rectangular, T-beam, L-beam; 5 widths × 15 depths × 3 tiers)
- Check flexural capacity (phi_Mn ≥ Mu) and shear capacity (phi_Vn ≥ Vu)
- Return the lightest section with the minimum reinforcement tier

**Slabs:**
- Select from pre-computed library (solid, ribbed, waffle)
- Check **both** deflection (span/depth ratio) **and** strength (shear + flexure)
- Return the thinnest section that passes all three checks

**Footings:**
- Select from pre-computed library (isolated, strip, combined)
- Check soil bearing, one-way shear, two-way (punching) shear, and flexure
- Auto-size based on column base reaction and allowable soil pressure

**Configuration:**
- All material strengths (`fc`, `fy`, `E`, density) come from one file: `design_assumptions.json`
- Changing that file and regenerating libraries updates all capacities
- No hardcoded material values anywhere in the codebase

### 3.4 Visualization — Interactive and Production-Ready

**Plan view:**
- D3-rendered SVG with zoom/pan
- Three toggleable scopes: Architectural, Structural, Plumbing
- Structural grid (bubble labels A/B/C, 1/2/3) with dimension lines in millimeters
- Element labels showing design label + section size (e.g., "C1 [400×400]", "B3 [200×500]")
- Utilization color-coding (green < 0.7, amber 0.7–0.9, red > 0.9)

**Elevation view:**
- 2D projection from selectable angle (front/back/left/right)
- Walls, windows, doors rendered with depth sorting
- Level guide lines with elevation dimensions

**Print / PDF:**
- A3 landscape sheets with engineering title blocks
- One sheet per floor level
- Structural BOM schedule tables (columns, beams, footings, slabs)
- Code-compliance summary (utilization ratios, governing combinations)
- Direct browser print — no external tools needed

**DXF export:**
- R12-compatible DXF with proper HEADER, TABLES, and BLOCKS sections
- Both structural (S-COL, S-BEAM, S-SLAB) and architectural (A-WALL, A-DOOR, A-WIN) layers
- Column sizes pulled from the BOM (not hardcoded)
- Opens in AutoCAD, BricsCAD, LibreCAD without errors

### 3.5 Project Management

**Multiple projects:**
- List all projects in the `Projects/` directory
- Switch between projects from the UI
- Create new projects from a template
- Each project is self-contained: `inputs/` + `outputs/` + `project.json`

**Version control friendly:**
- All inputs and outputs are JSON (diffable, mergeable)
- No binary files except generated DXF/PDF
- Clean `.gitignore` — no `node_modules`, `__pycache__`, or temp files tracked

### 3.6 Integration

**CAD (DXF):**
- Import architectural DXF files (walls, doors, windows) and convert to the node/element JSON model
- Export structural DXF with proper layers (S-COL, S-BEAM, S-SLAB, A-WALL, A-DOOR, A-WIN)
- Round-trip: CAD → BIM Toolset → sizing → CAD

**Standalone:**
- Runs entirely offline — no cloud, no API keys, no external services
- Python engine and React UI are fully decoupled (JSON over HTTP in dev, or file-based in production)

---

## 4. What the End State Looks Like

### 4.1 Repository Structure

```
BIM toolset/
├── Structural Tools/
│   ├── generators/           # Library generators (column, beam, slab, footing)
│   ├── selectors/            # Deterministic selectors (column, beam, slab, footing)
│   ├── analysis/             # FEA runner + load combinations + force extraction
│   ├── orchestrator.py       # Ties analysis → combinations → selectors → BOM
│   ├── run_e2e_flow.py       # Pipeline runner
│   ├── tests/                # pytest suite (formulas, selectors, pipeline, FEA)
│   └── design_assumptions.json  # Single source of truth for materials/loads
│
├── Next Res UI/
│   ├── src/
│   │   ├── types.ts          # All domain types (no `any` anywhere)
│   │   ├── constants.ts      # Shared constants (room names, colors, scales)
│   │   ├── hooks/            # Context provider with loading/error states
│   │   ├── components/       # Canvas, panels, toolbars, print layout
│   │   ├── drawing/          # D3 modules (architecture, structure, axes, labels)
│   │   └── utils/            # DXF export, coordinate transforms
│   ├── tests/                # Vitest suite (UI interactions, state, exports)
│   └── vite.config.ts        # Clean — no API middleware
│
├── server/                   # Standalone backend (Express/Fastify)
│   ├── index.ts              # API endpoints (load, save, projects, create)
│   └── tests/                # API tests
│
├── resplan-mcp/
│   └── server.py             # MCP server (CAD/DXF import-export bridge, paths fixed)
│
├── Global Libraries/
│   ├── architectural.json    # Wall, door, window, room types
│   └── structural_types.json # Material + section type definitions
│
├── Projects/
│   └── Sample Project/
│       ├── project.json      # Project manifest
│       ├── inputs/           # resplan_nodes.json, design_assumptions.json, settings
│       └── outputs/          # analysis_results, structural_report, dxf/, pdf/
│
├── docs/
│   ├── ARCHITECTURE.md
│   ├── DATA_MODELS.md        # Up-to-date schemas matching live data
│   ├── STRUCTURAL_ASSUMPTIONS.md
│   ├── API.md                # Backend API documentation
│   └── project_structure_schema.json
│
├── report.md                 # This codebase review
├── roadmap.md                # Starting points
├── sprints.md                # Sprint plan
└── vision.md                 # This file
```

### 4.2 Technology Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| Structural engine | Python 3 | Numerical computing, pyframe3dd, shapely |
| Frontend | React 19 + TypeScript (strict) + D3.js | Interactive SVG, type safety |
| Build | Vite | Fast HMR, optimized production builds |
| Styling | Tailwind CSS 4 | Utility-first, consistent design system |
| Backend | Express or Fastify (Node.js/TS) | Shared language with frontend, simple |
| MCP server | Python (FastMCP) | CAD/DXF import-export bridge |
| Testing | pytest (Python) + Vitest (UI) + supertest (API) | Full-stack coverage |
| Linting | oxlint (frontend) + ruff (Python) | Fast, modern |

### 4.3 Quality Bar

| Metric | Target |
|--------|--------|
| Python test coverage | ≥ 80% on selectors, formulas, load combinations, orchestrator |
| UI test coverage | ≥ 70% on components, hooks, and export utilities |
| TypeScript strictness | Zero `any` types. `tsc --noEmit` passes clean. |
| Python linting | `ruff check .` passes with zero warnings |
| UI linting | `oxlint .` passes with zero warnings |
| DXF validation | Generated files open in AutoCAD/LibreCAD/BricsCAD without repair |
| FEA validation | FEA forces match hand-calculated values for a simple test frame (within 5%) |
| SBC compliance | Every capacity formula documented with ACI/SBC clause reference |
| Documentation | All schemas in `DATA_MODELS.md` match live data. README has setup + usage instructions. |

---

## 5. What It Is NOT

- **Not a general-purpose FEA solver.** It sizes specific element types (columns, beams, slabs, footings) for RC buildings. No steel, no timber, no shells.
- **Not a 3D modeler.** It produces 2D plans, elevations, and schedules. 3D modeling is handled in separate CAD software.
- **Not an AI tool.** No machine learning, no optimization heuristics, no "intelligent" guessing. Every decision is deterministic and traceable.
- **Not a replacement for engineering judgment.** It's a preliminary sizing tool that produces a code-compliant starting point. The engineer reviews, overrides, and signs off.

---

## 6. Success Definition

The project is done when:

1. **An architect draws a floor plan** (in the UI or imported from a DXF file)
2. **The engineer clicks "Run Analysis"** and gets real FEA forces per element
3. **The system sizes every column, beam, slab, and footing** — deterministically, from pre-computed tables, with P-M interaction checks
4. **The engineer reviews the BOM** — every element shows its section, utilization ratio, and governing load combination
5. **The draftsman exports DXF** — opens in AutoCAD, layers are clean, sizes are correct
6. **The reviewer prints the PDF** — A3 sheets with title blocks, BOM schedules, utilization summary
7. **Everything is traceable** — from architectural input to final section, every number can be followed back to a formula, a library entry, and a code clause

**No guessing. No hallucinations. No untraceable numbers. Just deterministic engineering.**
