# Next Res Engine & Structural Toolset

Welcome to the **Next Res** architecture, an automated structural engineering suite and standalone visualizer designed to strictly adhere to the Saudi Building Code (SBC).

This ecosystem translates raw architectural layouts into fully realized, mathematically verified, and deterministic structural models—without ever relying on AI "hallucinations" for critical engineering calculations.

## 🏗️ Core Philosophy
1. **No Guessing**: The system performs deterministic selection based on standard JSON libraries. It calculates required capacities (e.g. $\phi P_n$ for columns, shear for slabs) and explicitly looks up the lightest viable, pre-defined section.
2. **Explicit Fallbacks**: If no section in the standard library satisfies the load requirements, the engine throws a hard failure (`No Section Available - Upsize Required`). It will **never** invent custom reinforcement patterns or dimensions on the fly.
3. **Decoupled Visualization**: Structural sizing runs entirely isolated from visualization software, outputting agnostic JSON files. A standalone Web UI handles the rendering, plotting, and DXF/PDF deliverables.

---

## 📁 System Architecture

The project is split into three primary layers:

### 1. The Inputs (Data Layer)
- **`resplan_nodes.json`**: The architectural floor plan representation (nodes, beam spans, column locations).
- **`design_assumptions.json`**: The central source of truth for all materials ($f'_c$, $f_y$), structural densities, and live/dead loads.

### 2. The Engine (`/Structural Tools`)
A Python-based structural analysis and section selection suite.
- **`column_library_generator.py`**: Pre-calculates standard column capacities for 300x300, 200x400, etc., with reinforcement tiers (1% - 4% ratios), storing them in a `column_library.json`.
- **`column_selector.py`**: Given an axial load, searches the library for the most optimal tier.
- **`slab_selector.py`**: Determines if a span requires a solid slab or ribbed slab based on SBC depth heuristics.
- **`frame3dd_orchestrator.py`**: Ingests forces, calculates load combinations, and delegates to the selectors.
- **`run_e2e_flow.py`**: The master orchestration script. Runs the entire pipeline and outputs the finalized BOM.

### 3. The Visualizer (`/Next Res UI`)
A Vite + React application that renders the outputs directly in the browser.
- **Multi-Scope Overlays**: Toggle between `Architectural`, `Structural`, and `Plumbing` views.
- **Deliverables**: 
  - **DXF Export**: Dynamically generates R12 DXF files containing precise entities (S-COL, S-BEAM, S-SLAB).
  - **PDF Export**: Hidden CSS `@media print` rules seamlessly export the Structural Bill of Materials (BOM) schedules directly to PDF via the browser.

---

## 🚀 Getting Started

### 1. Run the Structural Pipeline
To evaluate the layout, size the members, and generate the final JSON schedules:
```bash
cd "Structural Tools"
python run_e2e_flow.py
```

### 2. Launch the Visualizer
To view the generated results and export deliverables:
```bash
cd "Next Res UI"
npm install
npm run dev
```

---

## 🔒 Anti-Hallucination Boundaries
Any AI agents working within this repository **MUST** adhere to the following strict boundaries:
- **Never modify standard material strengths** in a script. Always fetch from `design_assumptions.json`.
- **Never estimate capacities**. Capacity calculation functions must follow rigorous SBC/ACI formulas (e.g. $0.65 \times 0.80 [0.85 f'_c (A_g - A_{st}) + f_y A_{st}]$).
- **Visualization must remain lightweight**. Do not introduce heavyweight 3D WebGL renderers unless explicitly requested; rely on D3/Canvas for standard 2D mapping.
