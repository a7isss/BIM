# Sprint 4 — Interactive Editing Tools: Final Plan

> Date: 2026-06-29
> Status: APPROVED — ready for implementation
> Prerequisites: Sprint 3 complete (TypeScript types)

---

## 1. Decisions

| # | Question | Decision |
|---|----------|----------|
| 1 | Editing scopes | **Both** — structural scope shows column/beam tools; architectural scope shows wall/door/window tools. Toolbar filters by active scope. |
| 2 | move_column interaction | **Click-to-place (2 clicks).** Must be compatible with MCP `move_column` logic — locate the column cleanly by stack (all nodes at same X,Y), check connected nodes, move the entire stack. |
| 3 | add_column behavior | **Full vertical stack DOWN to footing only, never up.** If user adds a column on the ground floor → creates only that floor's segment. If user adds on the first floor → creates segments from first floor down through ground floor to footing, connecting all intermediate levels. |
| 4 | Delete confirmation | **Instant delete with undo.** Ctrl+Z is the safety net. No dialogs. |
| 5 | Orphaned nodes | **Separate cleanup utility.** Do NOT auto-clean nodes when elements are deleted. Build a standalone "Clean Orphan Nodes" button/utility that removes nodes not referenced by any element. |
| 6 | add_beam constraint | **Strict node-to-node.** Beams connect two explicitly selected nodes. No auto-snap to "nearest" node — the user must click on an existing node. Both UI and MCP must enforce this. This matches professional structural software behavior. |

---

## 2. What to Build

### 2.1 Render EditToolbar

**File to update: `src/components/LayoutCanvas.tsx`**

- Replace `const activeTool = 'select' as EditTool;` with real state: `const [activeTool, setActiveTool] = useState<EditTool>('select');`
- Add `<EditToolbar activeTool={activeTool} setActiveTool={setActiveTool} />` to the JSX inside the canvas container
- Toolbar visible only when scope is `structural` or `architectural` (hidden in plumbing)
- Toolbar shows scope-relevant tools only:
  - Structural: add_column, remove_column, add_beam, remove_beam, move_column, rotate_column
  - Architectural: add_arch_wall, remove_arch, add_door, remove_door, add_window, remove_window
- Cursor changes based on active tool: `select` → grab (pan), `add_*` → crosshair, `remove_*` → pointer, `move_column` → grab

### 2.2 New Utility File

**Create: `src/utils/interactions.ts`**

Pure helper functions (no React, no D3 — testable in isolation):

- **`screenToModel(svgX, svgY, transform, canvasCenter, pxPerMeter)`** — convert SVG coordinates to model meters. This is the inverse of `toPxX`/`toPxY` used in LayoutCanvas.

- **`findNodeAt(nodes, modelX, modelY, tolerance)`** — find a node at exact or near coordinates. For beam placement, tolerance should be small (0.15m). For hit-detection in remove tools, tolerance can be larger (0.3m).

- **`findElementAt(elements, nodes, modelX, modelY, type, tolerance)`** — find nearest element of a given type. For columns: check distance to base/top node positions. For beams: point-to-segment distance.

- **`findColumnStack(nodes, elements, baseX, baseY)`** — return all nodes that share the same (X, Y) coordinate across all Z-levels. This is the stack logic from the MCP server's `move_column` — all nodes at matching X,Y move together.

- **`generateId(prefix)`** — timestamp-based unique ID matching the existing convention (`prefix_<timestamp>`).

- **`getLevelsBelow(levels, currentLevelId)`** — given the active level, return all structural levels below it (including footing level). Used by add_column to know how far down to build the stack.

### 2.3 New Cleanup Utility

**Create: `src/utils/cleanup.ts`**

- **`findOrphanNodes(nodes, elements)`** — return node IDs not referenced by any element's n1/n2/node_id
- **`removeOrphanNodes(nodes, elements)`** — return new nodes array with orphans removed

**Add a "Clean Orphan Nodes" button** in the RightPanel (near Save/Reload). Calls `removeOrphanNodes`, pushes to `updateState`, user saves to persist. Shows count: "Removed 12 orphan nodes."

### 2.4 Tool Handlers in LayoutCanvas

All handlers live inside LayoutCanvas's main `useEffect` as D3 event listeners on the SVG. They call `updateState` with modified `nodes`/`elements` arrays.

#### add_column (structural scope)
1. User clicks on canvas at (modelX, modelY)
2. Get the active Z elevation from `selectedFloor`
3. Get all structural levels below the active level (including footing at bottom)
4. Check if a node already exists at (modelX, modelY) on any lower level — if so, reuse it; if not, create new nodes at each level below
5. Create column elements connecting each consecutive pair of nodes from the active level down to footing
6. If no footing node exists at (modelX, modelY, footing_z), create one and mark `is_support: true`
7. Single `updateState` call with all new nodes + elements (one undo step)

Example: User on `arch_first` (z=7.0) with ground at z=3.5 and footing at z=-1.5:
- Creates nodes at (x, y, 7.0), (x, y, 3.5), (x, y, -1.5)
- Creates columns: [7.0→3.5] and [3.5→-1.5]
- Footing node gets `is_support: true`

Example: User on `arch_ground` (z=3.5):
- Creates nodes at (x, y, 3.5), (x, y, -1.5)
- Creates column: [3.5→-1.5]
- Footing node gets `is_support: true`

#### add_beam (structural scope)
1. **First click:** User must click on an existing node (within 0.15m tolerance). If no node found at click position → show red "X" indicator and do nothing. If found → highlight the node with a ring, store as `beamFirstNode`, show preview line to mouse cursor.
2. **Second click:** User must click on another existing node. If no node found → show red "X". If same node as first → ignore. If found → validate both nodes are at the same Z elevation. If Z mismatch → show error indicator, cancel. If valid → create beam element.
3. Beam ID format: `B_{z}_{n1_id}_{n2_id}_{timestamp}` (matching MCP convention)
4. Clear `beamFirstNode` after creation. Stay in add_beam mode for rapid placement.
5. **Preview line:** While waiting for second click, draw a dashed amber line from first node to the mouse position. Update on mousemove.

#### remove_column (structural scope)
1. User clicks on canvas
2. Find the nearest column element (point-to-node distance, tolerance 0.3m)
3. If found → remove ONLY that column element from `elements[]`. Do NOT remove nodes.
4. Stay in remove_column mode for rapid deletion.

#### remove_beam (structural scope)
1. User clicks on canvas
2. Find the nearest beam element (point-to-segment distance, tolerance 0.3m)
3. If found → remove the beam from `elements[]`
4. Stay in mode.

#### move_column (structural scope)
1. **First click:** Find nearest column element (tolerance 0.3m). Identify its base node's (X, Y). Find ALL nodes in the stack (same X, Y across all Z). Store the stack. Highlight all stack nodes with rings.
2. **Preview:** Show ghost circles at the mouse position for all stack nodes (offset by Z differences).
3. **Second click:** Move ALL stack nodes to new (modelX, modelY). Round to 3 decimal places. Single `updateState` call.
4. This matches MCP `move_column` behavior exactly — all nodes at matching X,Y move together.
5. Clear stack selection. Return to select mode (not stay-active — moving is a deliberate action).

#### rotate_column (structural scope)
1. User clicks near a column
2. Find the column element. Get its current `angle` (default 0).
3. Cycle: 0° → 90° → 180° → 270° → 0°
4. Update `angle` on ALL columns in the same stack (same X,Y) — matches MCP `rotate_column` behavior
5. Stay in mode.

#### add_arch_wall (architectural scope)
1. **First click:** Must click on an existing node (0.15m tolerance). If no node → red "X". If found → highlight, store as wall start, show preview line.
2. **Second click:** Must click on another existing node. If found → create wall element between them.
3. Wall uses `activeTypes.wall` for type_id. Level = `selectedFloor`.
4. Wall ID: `aw_{timestamp}` (matching MCP convention)

#### add_door / add_window (architectural scope)
1. User clicks on canvas
2. Find nearest wall (point-to-segment distance, tolerance 2.0m — matching MCP)
3. Project click point onto wall line → snap position
4. Compute normal vector parallel to wall (matching MCP convention)
5. Create opening at snapped position with active type from `activeTypes`
6. Opening ID: `{type}_{timestamp}` (matching MCP convention)

#### remove_arch / remove_door / remove_window (architectural scope)
1. Find nearest wall/opening to click (tolerance 0.3m)
2. Remove from respective array
3. Stay in mode

### 2.5 Visual Feedback

All feedback is drawn as D3 elements on the SVG, cleared on each re-render:

| Feedback | When | Visual |
|----------|------|--------|
| Selected node ring | `beamFirstNode` set | Amber circle (r=20px) around node |
| Preview line | `beamFirstNode` set + mouse moving | Dashed amber line to mouse position |
| Snap indicator | Mouse near a node (within 0.15m) | Green circle (r=12px) at node position |
| Error indicator | Click missed a node (beam/wall tools) | Red "X" at click position, fades after 1s |
| Hover highlight | `remove_*` tool active + mouse over element | Element turns red |
| Stack highlight | `move_column` first click done | All stack nodes get amber rings |
| Move ghost | `move_column` preview | Ghost circles at mouse position for all Z-levels |

### 2.6 Cancel / Escape

- `Escape` key cancels any in-progress operation: clears `beamFirstNode`, `previewPos`, `moveStack`, etc.
- Switching tools (clicking another tool button) also cancels in-progress state
- Clicking `select` tool cancels everything and returns to neutral

### 2.7 Interaction State

New state in LayoutCanvas:

```typescript
const [activeTool, setActiveTool] = useState<EditTool>('select');
const [beamFirstNode, setBeamFirstNode] = useState<Node | null>(null);
const [wallFirstNode, setWallFirstNode] = useState<Node | null>(null);
const [moveStack, setMoveStack] = useState<Node[] | null>(null);
const [previewPos, setPreviewPos] = useState<{ x: number; y: number } | null>(null);
const [errorPos, setErrorPos] = useState<{ x: number; y: number } | null>(null);
```

The main render `useEffect` depends on all of these so the canvas re-renders when interaction state changes.

### 2.8 MCP Server Update

**File to update: `resplan-mcp/server.py`**

Update `add_beam` to enforce node-to-node constraint:
- The current MCP `add_beam` already requires `n1_id` and `n2_id` — this is correct
- Add validation: both nodes must exist, must be at same Z elevation (already checked)
- No changes needed to MCP for beams — it's already node-to-node

Update `add_column` equivalent in MCP (if it exists) or add one:
- The MCP server currently does not have an `add_column` tool. Add one that mirrors the UI behavior: takes (x, y, level_id) and creates the full vertical stack down to footing.

### 2.9 Tests

**Create: `src/utils/__tests__/interactions.test.ts`**
- `screenToModel` — verify inverse transform
- `findNodeAt` — verify exact match and tolerance behavior
- `findElementAt` — verify column (point-to-node) and beam (point-to-segment) detection
- `findColumnStack` — verify it groups all nodes at same X,Y across Z-levels
- `getLevelsBelow` — verify it returns levels below the active one including footing

**Create: `src/utils/__tests__/cleanup.test.ts`**
- `findOrphanNodes` — verify it finds unreferenced nodes
- `removeOrphanNodes` — verify it removes orphans and keeps referenced nodes

---

## 3. Files to Create / Update

| File | Action | Purpose |
|------|--------|---------|
| `src/utils/interactions.ts` | **CREATE** | Coordinate conversion, node/element hit detection, stack finding, level lookup, ID generation |
| `src/utils/cleanup.ts` | **CREATE** | Orphan node detection and removal |
| `src/components/LayoutCanvas.tsx` | **UPDATE** | Wire activeTool state, render EditToolbar, add click handlers, visual feedback, interaction state |
| `src/components/EditToolbar.tsx` | **UPDATE** | Filter tools by scope (structural vs architectural) |
| `src/components/RightPanel.tsx` | **UPDATE** | Add "Clean Orphan Nodes" button |
| `src/utils/__tests__/interactions.test.ts` | **CREATE** | Unit tests for interaction utilities |
| `src/utils/__tests__/cleanup.test.ts` | **CREATE** | Unit tests for cleanup utilities |
| `resplan-mcp/server.py` | **UPDATE** | Add `add_column` tool mirroring UI behavior (full stack down to footing) |

---

## 4. Implementation Order

```
1. Create interactions.ts (coordinate conversion + helpers)     → 2h
2. Create cleanup.ts (orphan node utilities)                     → 1h
3. Render EditToolbar + wire activeTool state in LayoutCanvas   → 1h
4. Add click overlay + coordinate conversion in LayoutCanvas    → 1h
5. Implement add_column (full stack down to footing)            → 3h
6. Implement add_beam (strict node-to-node, 2 clicks)           → 3h
7. Implement remove_column + remove_beam                        → 2h
8. Implement move_column (click-to-place, stack move)           → 2h
9. Implement rotate_column (cycle 0/90/180/270)                 → 1h
10. Implement architectural tools (wall, door, window)          → 3h
11. Add visual feedback (preview, snap, hover, error)           → 2h
12. Add "Clean Orphan Nodes" button in RightPanel               → 1h
13. Update MCP server (add_column tool)                         → 1h
14. Write tests                                                 → 4h
```

**Total: ~27 hours**

Steps 1–6 deliver the core structural editing workflow (add/remove columns and beams). Steps 7–9 add the remaining structural tools. Step 10 adds architectural editing. Steps 11–14 are polish and testing.

---

## 5. Key Constraints for the Coder

1. **Beams are ALWAYS node-to-node.** No auto-snap to "nearest" node. The user must click on an existing node. If no node is found at the click position (within 0.15m), show an error indicator and do nothing. This applies to both the UI and the MCP server.

2. **Columns build DOWN only.** When adding a column at level N, create column segments from level N down through every level below to footing. Never create columns above the active level. If nodes already exist at (x, y) on lower levels, reuse them.

3. **Move = stack move.** Moving a column moves ALL nodes at the same (X, Y) across all Z-levels. This is the same logic as the MCP `move_column` tool. Check connected elements — beams connected to stack nodes will visually update because they reference node IDs.

4. **Single updateState per operation.** Each tool action (add column, add beam, remove element, move stack) must be a single `updateState` call so it creates one undo step. Batch all new nodes + elements into one call.

5. **No auto-save.** Changes persist only when the user clicks Save. The undo system (Ctrl+Z) handles mistakes.

6. **Orphan nodes are not auto-cleaned.** Deleting an element leaves its nodes in place. A separate "Clean Orphan Nodes" utility handles cleanup explicitly.

7. **Match existing ID conventions.** Node IDs: `N_{timestamp}` or epoch timestamp. Column IDs: `C_{n1_id}_{n2_id}` or `C_{timestamp}`. Beam IDs: `B_{z}_{n1_id}_{n2_id}_{timestamp}`. Wall IDs: `aw_{timestamp}`. Opening IDs: `{type}_{timestamp}`.

8. **Scope filtering.** The EditToolbar shows only tools relevant to the active scope. Structural scope = column/beam tools. Architectural scope = wall/door/window tools. The `select` and `save` buttons are always visible.
