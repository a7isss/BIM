# Architecture Overview

The Next Res Engine is divided into decoupled components to ensure stability, determinism, and easy visualization.

## 1. Input Layer
- **Architectural JSON**: Nodes, Beam Spans, Column locations (`resplan_nodes.json`).
- **Assumptions JSON**: Material strengths, unit weights, slab depths (`design_assumptions.json`).

## 2. Structural Engine (Python)
- **Generators**: Pre-calculates tables of valid sections (`column_library_generator.py`).
- **Selectors**: Maps loads to the lightest valid section from the tables without estimating (`column_selector.py`, `slab_selector.py`).
- **Orchestrator**: Ties inputs, runs load combinations, and produces BOM (`frame3dd_orchestrator.py`, `run_e2e_flow.py`).

## 3. UI Layer (React/Vite)
- **Standalone App**: `Next Res UI` fetches the JSON outputs natively.
- **D3 Renderer**: Maps node coordinates and renders overlay schemas (Architectural, Structural).
- **Export Pipeline**: Native DXF strings and `@media print` CSS for PDF schedules.
