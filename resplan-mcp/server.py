from mcp.server.fastmcp import FastMCP
import json
import math
import uuid
import time
from collections import defaultdict
from typing import List, Dict, Any, Optional

import os
import subprocess
import io
import matplotlib.pyplot as plt
import matplotlib.patches as patches
import matplotlib.lines as mlines
from mcp.server.fastmcp import Image

mcp = FastMCP("ResPlan Drafter")

PROJECT_DIR = 'D:/BIM toolset/Projects/Sample Project'
PROJECT_JSON_PATH = os.path.join(PROJECT_DIR, 'project.json')

def get_nodes_path() -> str:
    with open(PROJECT_JSON_PATH, 'r', encoding='utf-8') as f:
        proj = json.load(f)
    return os.path.join(PROJECT_DIR, proj['files']['nodes'])

def get_settings_path() -> str:
    with open(PROJECT_JSON_PATH, 'r', encoding='utf-8') as f:
        proj = json.load(f)
    return os.path.join(PROJECT_DIR, proj['files']['settings'])

def load_data() -> Dict[str, Any]:
    with open(get_nodes_path(), 'r', encoding='utf-8') as f:
        return json.load(f)

def save_data(data: Dict[str, Any]):
    with open(get_nodes_path(), 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=4)

def get_column(column_id: str) -> str:
    """Retrieve the exact coordinates and details of a specific column."""
    data = load_data()
    elements = data.get('elements', [])
    nodes = {n['id']: n for n in data.get('nodes', [])}
    
    col = next((e for e in elements if e['id'] == column_id and e.get('type') == 'column'), None)
    if not col:
        return f"Column {column_id} not found."
    
    n1 = nodes.get(col['n1'])
    n2 = nodes.get(col['n2'])
    
    res = f"Column ID: {col['id']}\n"
    if n1:
        res += f"Base Node {n1['id']}: (X: {n1['x']}, Y: {n1['y']}, Z: {n1['z']})\n"
    if n2:
        res += f"Top Node {n2['id']}: (X: {n2['x']}, Y: {n2['y']}, Z: {n2['z']})\n"
    
    return res

def move_column(column_id: str, dx: float, dy: float) -> str:
    """Safely nudge a column stack (and all connected grid intersections) by a specific distance, ensuring vertical alignment is maintained."""
    data = load_data()
    elements = data.get('elements', [])
    nodes_list = data.get('nodes', [])
    
    col = next((e for e in elements if e['id'] == column_id and e.get('type') == 'column'), None)
    if not col:
        return f"Column {column_id} not found."
    
    base_node = next((n for n in nodes_list if n['id'] == col['n1']), None)
    if not base_node:
        return f"Base node for column {column_id} not found."
        
    orig_x = base_node['x']
    orig_y = base_node['y']
    
    moved_count = 0
    # Move ALL nodes that share this exact X, Y coordinate (simulating the UI behavior)
    for n in nodes_list:
        if abs(n['x'] - orig_x) < 0.001 and abs(n['y'] - orig_y) < 0.001:
            n['x'] = round(n['x'] + dx, 3)
            n['y'] = round(n['y'] + dy, 3)
            moved_count += 1
            
    save_data(data)
    return f"Moved {moved_count} nodes belonging to stack at ({orig_x}, {orig_y}) by dx={dx}, dy={dy}."

def align_stacks() -> str:
    """Run the automated structural alignment check across the entire project to fix any drifted or ghost nodes."""
    data = load_data()
    nodes = {n['id']: n for n in data.get('nodes', [])}
    elements = data.get('elements', [])
    
    column_stacks = []
    for e in elements:
        if e.get('type') == 'column':
            n1 = nodes.get(e['n1'])
            n2 = nodes.get(e['n2'])
            if n1 and n2:
                column_stacks.append([n1, n2])
                
    # Merge connected segments into stacks
    merged_stacks = []
    for seg in column_stacks:
        added = False
        for stack in merged_stacks:
            if seg[0] in stack or seg[1] in stack:
                if seg[0] not in stack: stack.append(seg[0])
                if seg[1] not in stack: stack.append(seg[1])
                added = True
                break
        if not added:
            merged_stacks.append(seg)
            
    fixed_count = 0
    fixed_stacks = 0
    for stack in merged_stacks:
        # Sort by Z
        stack.sort(key=lambda n: n['z'])
        base_x, base_y = stack[0]['x'], stack[0]['y']
        
        stack_fixed = False
        for n in stack:
            if abs(n['x'] - base_x) > 0.001 or abs(n['y'] - base_y) > 0.001:
                n['x'] = base_x
                n['y'] = base_y
                fixed_count += 1
                stack_fixed = True
        if stack_fixed:
            fixed_stacks += 1
            
    # Also find and snap any ghost nodes (nodes not in col_coords but within 0.5m)
    col_coords = set()
    for e in elements:
        if e.get('type') == 'column':
            n1 = nodes.get(e['n1'])
            if n1: col_coords.add((n1['x'], n1['y']))
            
    snapped = 0
    for n in nodes.values():
        x, y = n['x'], n['y']
        if (x, y) not in col_coords:
            closest_dist = 999
            closest_coord = None
            for cx, cy in col_coords:
                dist = math.sqrt((x - cx)**2 + (y - cy)**2)
                if dist < closest_dist:
                    closest_dist = dist
                    closest_coord = (cx, cy)
            
            if closest_coord and 0 < closest_dist < 0.5:
                n['x'] = closest_coord[0]
                n['y'] = closest_coord[1]
                snapped += 1
                
    save_data(data)
    return f"Fixed {fixed_count} nodes across {fixed_stacks} stacks. Snapped {snapped} ghost nodes to columns."

def add_beam(n1_id: int, n2_id: int, b: float = 0.2, h: float = 0.6) -> str:
    """Connect two existing nodes with a new beam element."""
    data = load_data()
    nodes = {n['id']: n for n in data.get('nodes', [])}
    
    if n1_id not in nodes: return f"Node {n1_id} not found."
    if n2_id not in nodes: return f"Node {n2_id} not found."
    
    n1 = nodes[n1_id]
    n2 = nodes[n2_id]
    
    if abs(n1['z'] - n2['z']) > 0.001:
        return f"Cannot add beam: nodes must be on the same elevation. n1.z={n1['z']}, n2.z={n2['z']}"
        
    new_beam = {
        "id": f"B_{n1['z']}_{n1_id}_{n2_id}_{int(time.time())}",
        "type": "beam",
        "n1": n1_id,
        "n2": n2_id,
        "b": b,
        "h": h
    }
    
    if 'elements' not in data:
        data['elements'] = []
        
    data['elements'].append(new_beam)
    save_data(data)
    
    return f"Successfully added beam {new_beam['id']} from node {n1_id} to {n2_id}."
def rotate_column(column_id: str, new_angle: Optional[float] = None, swap_dimensions: bool = False) -> str:
    """Rotate a column element by setting its angle (in degrees) or swapping its b and h dimensions."""
    data = load_data()
    elements = data.get('elements', [])
    col = next((e for e in elements if e['id'] == column_id and e.get('type') == 'column'), None)
    if not col:
        return f"Column {column_id} not found."
    
    nodes_list = data.get('nodes', [])
    nodes = {n['id']: n for n in nodes_list}
    base_node = nodes.get(col['n1'])
    if not base_node:
        return f"Base node not found."
        
    orig_x, orig_y = base_node['x'], base_node['y']
    
    stack_cols = []
    for e in elements:
        if e.get('type') == 'column':
            n1 = nodes.get(e['n1'])
            if n1 and abs(n1['x'] - orig_x) < 0.001 and abs(n1['y'] - orig_y) < 0.001:
                stack_cols.append(e)
                
    for sc in stack_cols:
        if swap_dimensions:
            sc['b'], sc['h'] = sc.get('h', 0), sc.get('b', 0)
        if new_angle is not None:
            sc['angle'] = new_angle
        
    save_data(data)
    action = "Swapped dimensions" if swap_dimensions else f"Rotated to {new_angle} degrees"
    return f"{action} for {len(stack_cols)} columns in stack at ({orig_x}, {orig_y})."

def rotate_opening(opening_id: str, rotate_90: bool = False, flip_swing: bool = False, flip_hinge: bool = False) -> str:
    """Rotate an opening 90 degrees or flip its swing/hinge direction."""
    data = load_data()
    openings = data.get('openings', [])
    op = next((o for o in openings if o['id'] == opening_id), None)
    if not op:
        return f"Opening {opening_id} not found."
    
    if rotate_90:
        nx = op.get('nx', 1)
        ny = op.get('ny', 0)
        op['nx'] = -ny
        op['ny'] = nx
    if flip_swing:
        op['swing_side'] = op.get('swing_side', 1) * -1
    if flip_hinge:
        op['hinge_side'] = op.get('hinge_side', 1) * -1
        
    save_data(data)
    return f"Successfully updated rotation/swing for opening {opening_id}."

def move_opening(opening_id: str, dx: float, dy: float) -> str:
    """Move an opening (door/window) by a specific distance dx, dy."""
    data = load_data()
    openings = data.get('openings', [])
    
    op = next((o for o in openings if o['id'] == opening_id), None)
    if not op:
        return f"Opening {opening_id} not found."
        
    op['x'] = round(op['x'] + dx, 3)
    op['y'] = round(op['y'] + dy, 3)
    
    save_data(data)
    return f"Moved opening {opening_id} by dx={dx}, dy={dy}."

def remove_opening(opening_id: str) -> str:
    """Remove an opening (door/window) by ID."""
    data = load_data()
    openings = data.get('openings', [])
    original_len = len(openings)
    data['openings'] = [o for o in openings if o.get('id') != opening_id]
    
    if len(data['openings']) == original_len:
        return f"Opening {opening_id} not found."
        
    save_data(data)
    return f"Removed opening {opening_id}."

def change_beam_size(beam_id: str, b: float, h: float) -> str:
    """Change the width (b) and depth (h) of a beam element."""
    data = load_data()
    elements = data.get('elements', [])
    beam = next((e for e in elements if e['id'] == beam_id and e.get('type') == 'beam'), None)
    if not beam:
        return f"Beam {beam_id} not found."
        
    beam['b'] = b
    beam['h'] = h
    save_data(data)
    return f"Updated beam {beam_id} to size {b}x{h}m."

def delete_element(element_id: str) -> str:
    """Delete an element from the model by ID."""
    data = load_data()
    elements = data.get('elements', [])
    original_len = len(elements)
    data['elements'] = [e for e in elements if e.get('id') != element_id]
    
    if len(data['elements']) == original_len:
        return f"Element {element_id} not found."
        
    save_data(data)
    return f"Deleted element {element_id}."

def get_types(category: str) -> str:
    """Get valid type_id strings for a category (walls, doors, windows, rooms)."""
    with open(PROJECT_JSON_PATH, 'r', encoding='utf-8') as f:
        proj = json.load(f)
    
    # Check if 'architectural_types' file path is in project.json, fallback to hardcoded
    types_path = os.path.join(PROJECT_DIR, proj['files'].get('architectural_types', 'inputs/resplan_types.json'))
    
    if not os.path.exists(types_path):
        return f"Types file not found at {types_path}"
        
    with open(types_path, 'r', encoding='utf-8') as f:
        types = json.load(f)
        
    if category not in types:
        return f"Category {category} not found. Valid categories: {list(types.keys())}"
    return json.dumps([t['id'] for t in types[category]], indent=2)

def add_arch_wall(n1_id: int, n2_id: int, type_id: str, level_id: str) -> str:
    """Draft an architectural wall segment perfectly snapped to two existing Node IDs."""
    data = load_data()
    arch = data.setdefault('architecture', [])
    new_id = f"aw_{int(time.time()*1000)}"
    arch.append({
        "id": new_id,
        "type": "wall",
        "type_id": type_id,
        "n1": n1_id,
        "n2": n2_id,
        "level_id": level_id
    })
    save_data(data)
    return f"Created arch_wall {new_id} between nodes {n1_id} and {n2_id} with type {type_id}."

def remove_arch(wall_id: str) -> str:
    """Delete a specific architectural wall segment."""
    data = load_data()
    arch = data.setdefault('architecture', [])
    initial_count = len(arch)
    data['architecture'] = [w for w in arch if w.get('id') != wall_id]
    if len(data['architecture']) == initial_count:
        return f"Wall {wall_id} not found."
    save_data(data)
    return f"Deleted wall {wall_id}."

def add_room_tag(node_ids: list[int], type_id: str, level_id: str) -> str:
    """Explicitly define a room by passing the exact loop of Node IDs that form its boundary."""
    import time
    data = load_data()
    rooms = data.setdefault('rooms', [])
    new_id = f"room_{int(time.time()*1000)}"
    rooms.append({
        "id": new_id,
        "type": type_id,
        "type_id": type_id,
        "nodes": node_ids,
        "level_id": level_id
    })
    save_data(data)
    return f"Created room tag {new_id} with type {type_id} inside {len(node_ids)} nodes."

def get_rooms(level_id: str = None) -> str:
    """Get a list of all rooms, optionally filtered by level."""
    data = load_data()
    rooms = data.get('rooms', [])
    if level_id:
        rooms = [r for r in rooms if r.get('level_id') == level_id]
    return json.dumps(rooms, indent=2)

def remove_room(room_id: str) -> str:
    """Delete a specific room."""
    data = load_data()
    rooms = data.setdefault('rooms', [])
    initial_count = len(rooms)
    data['rooms'] = [r for r in rooms if r.get('id') != room_id]
    if len(data['rooms']) == initial_count:
        return f"Room {room_id} not found."
    save_data(data)
    return f"Deleted room {room_id}."

def update_room_tags(room_id: str, tags: list[str]) -> str:
    """Add tags to a specific room."""
    data = load_data()
    rooms = data.get('rooms', [])
    found = False
    for r in rooms:
        if r.get('id') == room_id:
            r['tags'] = tags
            found = True
    if not found: return f"Room {room_id} not found."
    save_data(data)
    return f"Added tags {tags} to room {room_id}."

def visual_snapshot() -> Image:
    """Generate a visual snapshot (PNG) of the current architectural and structural layout. Returns an Image object."""
    data = load_data()
    nodes = {n['id']: n for n in data.get('nodes', [])}
    elements = data.get('elements', [])
    architecture = data.get('architecture', [])
    openings = data.get('openings', [])
    rooms = data.get('rooms', [])
    
    fig, ax = plt.subplots(figsize=(10, 10))
    ax.set_aspect('equal')
    
    # Track min/max for boundaries
    min_x, max_x = float('inf'), float('-inf')
    min_y, max_y = float('inf'), float('-inf')
    
    def update_bounds(x, y):
        nonlocal min_x, max_x, min_y, max_y
        min_x, max_x = min(min_x, x), max(max_x, x)
        min_y, max_y = min(min_y, y), max(max_y, y)
        
    # Draw Rooms
    for room in rooms:
        coords = []
        for nid in room.get('nodes', []):
            n = nodes.get(nid)
            if n:
                coords.append((n['x'], n['y']))
                update_bounds(n['x'], n['y'])
        if len(coords) > 2:
            poly = patches.Polygon(coords, closed=True, facecolor='#f3f4f6', edgecolor='#d1d5db', alpha=0.4)
            ax.add_patch(poly)
            
    # Draw Architectural Walls
    for arch in architecture:
        if arch.get('type') == 'wall':
            n1 = nodes.get(arch.get('n1'))
            n2 = nodes.get(arch.get('n2'))
            if n1 and n2:
                update_bounds(n1['x'], n1['y'])
                update_bounds(n2['x'], n2['y'])
                line = mlines.Line2D([n1['x'], n2['x']], [n1['y'], n2['y']], color='#374151', linewidth=4)
                ax.add_line(line)
                
    # Draw Openings
    for op in openings:
        ox, oy = op['x'], op['y']
        nx, ny = op.get('nx', 1), op.get('ny', 0)
        
        # nx, ny is the vector PARALLEL to the wall
        # In matplotlib, y goes up. The JSON has y going down in UI, but here we just use the raw coordinates.
        w = 0.5
        x1, y1 = ox - nx*w, oy - ny*w
        x2, y2 = ox + nx*w, oy + ny*w
        
        if op.get('type') in ['door', 'front_door']:
            color = '#fb923c'
            hinge_side = op.get('hinge_side', 1)
            swing_side = op.get('swing_side', 1)
            
            hx = x1 if hinge_side == 1 else x2
            hy = y1 if hinge_side == 1 else y2
            lx = x2 if hinge_side == 1 else x1
            ly = y2 if hinge_side == 1 else y1
            
            perpX = -ny * swing_side
            perpY = nx * swing_side
            
            leafLen = math.sqrt((x2 - x1)**2 + (y2 - y1)**2)
            openX = hx + perpX * leafLen
            openY = hy + perpY * leafLen
            
            # Door Leaf
            line = mlines.Line2D([hx, openX], [hy, openY], color=color, linewidth=4)
            ax.add_line(line)
            
            # Arc
            # We want an arc from (lx, ly) to (openX, openY) centered at (hx, hy)
            # matplotlib patches.Arc takes (center_x, center_y), width, height, angle, theta1, theta2
            import numpy as np
            angle_start = np.degrees(np.arctan2(ly - hy, lx - hx))
            angle_end = np.degrees(np.arctan2(openY - hy, openX - hx))
            if swing_side == 1:
                t1, t2 = min(angle_start, angle_end), max(angle_start, angle_end)
                if abs(t2 - t1) > 180: t1, t2 = t2, t1 + 360
            else:
                t1, t2 = min(angle_start, angle_end), max(angle_start, angle_end)
                if abs(t2 - t1) > 180: t1, t2 = t2, t1 + 360
                
            arc = patches.Arc((hx, hy), leafLen*2, leafLen*2, theta1=t1, theta2=t2, color=color, linestyle='--')
            ax.add_patch(arc)
        else:
            color = '#38bdf8'
            line = mlines.Line2D([x1, x2], [y1, y2], color=color, linewidth=6)
            ax.add_line(line)
        
    # Draw Columns
    for e in elements:
        if e.get('type') == 'column':
            n1 = nodes.get(e.get('n1'))
            if n1:
                update_bounds(n1['x'], n1['y'])
                rect = patches.Rectangle((n1['x'] - 0.2, n1['y'] - 0.2), 0.4, 0.4, facecolor='#ef4444', edgecolor='#991b1b')
                ax.add_patch(rect)
                
    # Draw Beams
    for e in elements:
        if e.get('type') == 'beam':
            n1 = nodes.get(e.get('n1'))
            n2 = nodes.get(e.get('n2'))
            if n1 and n2:
                line = mlines.Line2D([n1['x'], n2['x']], [n1['y'], n2['y']], color='#fbbf24', linewidth=2, linestyle='--')
                ax.add_line(line)
                
    if min_x == float('inf'):
        min_x, max_x, min_y, max_y = 0, 10, 0, 10
        
    # Set boundaries with setback 6
    setback_x, setback_y = 6, 6
    ax.set_xlim(min_x - setback_x, max_x + setback_x)
    ax.set_ylim(max_y + setback_y, min_y - setback_y) # Invert Y axis to match UI
    
    ax.set_title("Visual Snapshot")
    ax.grid(True, linestyle=':', color='#9ca3af')
    
    buf = io.BytesIO()
    plt.savefig(buf, format='png', bbox_inches='tight')
    plt.close(fig)
    
    return Image(data=buf.getvalue(), format="png")

def add_opening(x: float, y: float, opening_type: str, type_id: str, level_id: str, swing_side: int = 1, hinge_side: int = 1) -> str:
    """Add a door or window perfectly snapped to the nearest architectural wall. opening_type must be 'door' or 'window'."""
    import time
    data = load_data()
    nodes = data.get('nodes', [])
    arch = data.get('architecture', [])
    openings = data.setdefault('openings', [])
    
    # Find nearest wall
    min_dist = 9999
    closest_wall = None
    snap_x = x
    snap_y = y
    nx = 0
    ny = 1
    
    for w in arch:
        if w.get('type') != 'wall' or w.get('level_id') != level_id:
            continue
        if 'n1' not in w or 'n2' not in w:
            continue
            
        n1 = next((n for n in nodes if n['id'] == w['n1']), None)
        n2 = next((n for n in nodes if n['id'] == w['n2']), None)
        if not n1 or not n2:
            continue
            
        x1, y1 = n1['x'], n1['y']
        x2, y2 = n2['x'], n2['y']
        
        # Distance to segment
        l2 = (x2 - x1)**2 + (y2 - y1)**2
        if l2 == 0: continue
        
        t = max(0, min(1, ((x - x1) * (x2 - x1) + (y - y1) * (y2 - y1)) / l2))
        proj_x = x1 + t * (x2 - x1)
        proj_y = y1 + t * (y2 - y1)
        
        dist = math.sqrt((x - proj_x)**2 + (y - proj_y)**2)
        if dist < min_dist:
            min_dist = dist
            closest_wall = w['id']
            snap_x = proj_x
            snap_y = proj_y
            
            # Normal calculation
            A = x - x1
            B = y - y1
            C = x2 - x1
            D = y2 - y1
            dot = A * C + B * D
            proj_len = dot / l2
            px = x1 + proj_len * C
            py = y1 + proj_len * D
            
            vx = x - px
            vy = y - py
            length = math.sqrt(vx*vx + vy*vy)
            # Fix: normals should be PARALLEL to the wall for Next Res UI rendering
            C = x2 - x1
            D = y2 - y1
            l_val = math.sqrt(l2)
            if l_val > 0.0001:
                nx = C / l_val
                ny = D / l_val
            else:
                nx = 1
                ny = 0
                
    if not closest_wall or min_dist > 2.0:
        return f"Failed to add {opening_type}. No wall found within 2 meters of ({x}, {y}) on level {level_id}."
        
    # Get level Z
    levels = {l['id']: l['elevation_m'] for cat in data.get('levels', {}).values() for l in cat}
    lvl_z = levels.get(level_id, 0.0)
    
    # Get height/sill
    types = data.get('types', {})
    arr = types.get('windows', []) if opening_type == 'window' else types.get('doors', [])
    t_data = next((t for t in arr if t['id'] == type_id), None)
    
    height = t_data['height'] if t_data and 'height' in t_data else (2.1 if opening_type == 'door' else 1.2)
    sill = t_data['sill_height'] if t_data and 'sill_height' in t_data else (0.0 if opening_type == 'door' else 0.9)
    
    new_id = f"{opening_type}_{int(time.time()*1000)}"
    openings.append({
        "id": new_id,
        "type": opening_type,
        "type_id": type_id,
        "x": snap_x,
        "y": snap_y,
        "z": lvl_z + sill,
        "nx": nx,
        "ny": ny,
        "height": height,
        "level_id": level_id,
        "host_id": closest_wall,
        "swing_side": swing_side,
        "hinge_side": hinge_side
    })
    
    save_data(data)
    return f"Created {opening_type} {new_id} snapped to wall {closest_wall} at ({snap_x:.2f}, {snap_y:.2f})."

def run_structural_analysis() -> str:
    """Run the end-to-end structural analysis pipeline (geometry -> Frame3DD -> SBC sizing)."""
    try:
        result = subprocess.run(
            ['python', 'run_e2e_flow.py'],
            cwd='D:/BIM toolset/Structural Tools',
            capture_output=True,
            text=True,
            check=True
        )
        return f"Structural analysis completed successfully.\n\nOutput:\n{result.stdout}"
    except subprocess.CalledProcessError as e:
        return f"Structural analysis failed with exit code {e.returncode}.\n\nError Output:\n{e.stderr}"

def update_project_settings(key: str, value: float) -> str:
    """Update a specific numeric key in the project settings (e.g. floor_height_m, global_grid_spacing_m)."""
    path = get_settings_path()
    try:
        with open(path, 'r', encoding='utf-8') as f:
            settings = json.load(f)
        
        old_val = settings.get(key)
        settings[key] = value
        
        with open(path, 'w', encoding='utf-8') as f:
            json.dump(settings, f, indent=4)
            
        return f"Updated setting '{key}' from {old_val} to {value}."
    except Exception as e:
        return f"Failed to update project settings: {str(e)}"



def add_wall(x1: float, y1: float, x2: float, y2: float, type_id: str, level_id: str) -> str:
    """Add a new architectural wall by coordinates. Automatically snaps to or creates nodes."""
    import time
    data = load_data()
    nodes = data.setdefault('nodes', [])
    
    def get_or_create_node(x, y):
        for n in nodes:
            if abs(n['x'] - x) < 0.1 and abs(n['y'] - y) < 0.1:
                return n['id']
        nid = max([int(n['id']) for n in nodes] + [0]) + 1
        nodes.append({'id': nid, 'x': x, 'y': y})
        return nid
        
    n1_id = get_or_create_node(x1, y1)
    n2_id = get_or_create_node(x2, y2)
    
    if n1_id == n2_id:
        return "Wall start and end nodes are identical."
        
    arch = data.setdefault('architecture', [])
    new_id = f"aw_{int(time.time()*1000)}"
    arch.append({
        "id": new_id,
        "type": "wall",
        "type_id": type_id,
        "n1": n1_id,
        "n2": n2_id,
        "level_id": level_id
    })
    save_data(data)
    return f"Created wall {new_id} between nodes {n1_id} and {n2_id}."

def split_arch_wall(wall_id: str, x: float, y: float) -> str:
    """Split an existing architectural wall by injecting a new node at exactly (x, y)."""
    import time
    data = load_data()
    arch = data.get('architecture', [])
    nodes = data.get('nodes', [])
    
    wall = next((w for w in arch if w['id'] == wall_id and w.get('type') == 'wall'), None)
    if not wall:
        return f"Wall {wall_id} not found."
        
    # Create the new node
    nid = max([int(n['id']) for n in nodes] + [0]) + 1
    nodes.append({'id': nid, 'x': x, 'y': y})
    
    # Create the new wall spanning from new node to old n2
    new_id = f"aw_{int(time.time()*1000)}"
    new_wall = dict(wall)
    new_wall['id'] = new_id
    new_wall['n1'] = nid
    
    # Update old wall to end at new node
    wall['n2'] = nid
    
    arch.append(new_wall)
    save_data(data)
    return f"Split wall {wall_id} at ({x}, {y}) into {wall_id} and {new_id}."

def move_arch_node(node_id: int, dx: float, dy: float) -> str:
    """Move a specific architectural node, automatically updating all connected walls."""
    data = load_data()
    nodes = data.get('nodes', [])
    
    node = next((n for n in nodes if n['id'] == node_id), None)
    if not node:
        return f"Node {node_id} not found."
        
    node['x'] += dx
    node['y'] += dy
    
    save_data(data)
    return f"Moved node {node_id} by ({dx}, {dy})."

def remove_arch_node(node_id: int) -> str:
    """Remove a node. If exactly 2 collinear walls use it, they merge. Otherwise, connected walls are removed."""
    data = load_data()
    nodes = data.get('nodes', [])
    arch = data.get('architecture', [])
    import time
    
    node = next((n for n in nodes if n['id'] == node_id), None)
    if not node:
        return f"Node {node_id} not found."
        
    connected_walls = [w for w in arch if w.get('type') == 'wall' and (w['n1'] == node_id or w['n2'] == node_id)]
    
    # Remove the node
    data['nodes'] = [n for n in nodes if n['id'] != node_id]
    
    # Remove connected walls
    data['architecture'] = [w for w in arch if w not in connected_walls]
    
    # Smart merge if exactly 2 walls with same type
    if len(connected_walls) == 2 and connected_walls[0].get('type_id') == connected_walls[1].get('type_id'):
        w1, w2 = connected_walls[0], connected_walls[1]
        other_n1 = w1['n2'] if w1['n1'] == node_id else w1['n1']
        other_n2 = w2['n2'] if w2['n1'] == node_id else w2['n1']
        
        merged_wall = dict(w1)
        merged_wall['id'] = f"aw_{int(time.time()*1000)}"
        merged_wall['n1'] = other_n1
        merged_wall['n2'] = other_n2
        data['architecture'].append(merged_wall)
        
        save_data(data)
        return f"Removed node {node_id} and merged walls {w1['id']} and {w2['id']}."
        
    save_data(data)
    return f"Removed node {node_id} and deleted {len(connected_walls)} connected walls."


def move_wall(wall_id: str, dx: float, dy: float) -> str:
    """Move an entire architectural wall segment by shifting its nodes."""
    data = load_data()
    arch = data.get('architecture', [])
    nodes = data.get('nodes', [])
    
    wall = next((w for w in arch if w['id'] == wall_id and w.get('type') == 'wall'), None)
    if not wall:
        return f"Wall {wall_id} not found."
        
    n1 = next((n for n in nodes if n['id'] == wall['n1']), None)
    n2 = next((n for n in nodes if n['id'] == wall['n2']), None)
    
    if n1:
        n1['x'] += dx
        n1['y'] += dy
    if n2:
        n2['x'] += dx
        n2['y'] += dy
        
    save_data(data)
    return f"Moved wall {wall_id} by ({dx}, {dy})."

def get_architectural_summary(level_id: str) -> str:
    """Get a highly readable text summary of all architectural elements on a floor level."""
    data = load_data()
    nodes = {n['id']: n for n in data.get('nodes', [])}
    arch = [a for a in data.get('architecture', []) if a.get('level_id') == level_id and a.get('type') == 'wall']
    openings = [o for o in data.get('openings', []) if o.get('level_id') == level_id]
    rooms = [r for r in data.get('rooms', []) if r.get('level_id') == level_id]
    
    lines = [f"Architectural Summary for {level_id}"]
    lines.append("=" * 40)
    
    lines.append(f"\nWALLS ({len(arch)}):")
    for a in arch:
        n1 = nodes.get(a['n1'], {'x':0, 'y':0})
        n2 = nodes.get(a['n2'], {'x':0, 'y':0})
        lines.append(f" - {a['id']} [{a.get('type_id')}]: ({n1['x']:.2f}, {n1['y']:.2f}) to ({n2['x']:.2f}, {n2['y']:.2f})")
        
    lines.append(f"\nOPENINGS ({len(openings)}):")
    for o in openings:
        lines.append(f" - {o['id']} [{o.get('type_id')}]: at ({o['x']:.2f}, {o['y']:.2f})")
        
    lines.append(f"\nROOMS ({len(rooms)}):")
    for r in rooms:
        lines.append(f" - {r['id']} [{r.get('type_id')}]: {len(r.get('nodes', []))} corners")
        
    return "\n".join(lines)

def diagnose_architecture(level_id: str = None) -> str:
    """Run diagnostics on the architectural layout to find missing doors, windows, and overlapping walls."""
    data = load_data()
    rooms = data.get('rooms', [])
    openings = data.get('openings', [])
    arch = data.get('architecture', [])
    nodes = {n['id']: n for n in data.get('nodes', [])}
    
    if level_id:
        rooms = [r for r in rooms if r.get('level_id') == level_id]
        openings = [o for o in openings if o.get('level_id') == level_id]
        arch = [a for a in arch if a.get('level_id') == level_id and a.get('type') == 'wall']
        
    warnings = []
    import shapely.geometry as geom
    
    for room in rooms:
        coords = []
        for nid in room.get('nodes', []):
            n = nodes.get(nid)
            if n: coords.append((n['x'], n['y']))
        if len(coords) < 3: continue
        
        poly = geom.Polygon(coords)
        has_door = False
        has_window = False
        
        for op in openings:
            pt = geom.Point(op['x'], op['y'])
            if poly.exterior.distance(pt) < 0.2:
                if op.get('type') in ['door', 'front_door']: has_door = True
                if op.get('type') == 'window': has_window = True
                
        rtype = room.get('type_id', room.get('type', 'room'))
        
        if not has_door and rtype not in ['balcony']:
            warnings.append(f"Room {room['id']} ({rtype}) has no doors!")
            
        if not has_window and rtype in ['bedroom', 'living', 'kitchen']:
            warnings.append(f"Room {room['id']} ({rtype}) has no exterior window!")
            
    for a in arch:
        n1 = nodes.get(a.get('n1'))
        n2 = nodes.get(a.get('n2'))
        if not n1 or not n2: continue
        length = ((n2['x'] - n1['x'])**2 + (n2['y'] - n1['y'])**2)**0.5
        if length < 0.1:
            warnings.append(f"Wall {a['id']} is extremely short ({length:.2f}m) - possible artifact.")
            
    if not warnings:
        return "All checks passed! Architecture looks clean."
    return "\n".join(warnings)


@mcp.tool()
def execute_resplan_action(action: str, parameters_json: str = "{}") -> Any:
    """
    Execute a Resplan architectural action.
    Available actions:
    - get_active_project
    - create_project
    - create_level
    - get_levels
    - add_arch_wall
    - get_arch_walls
    - move_arch_wall
    - remove_arch
    - add_opening
    - move_opening
    - rotate_opening
    - remove_opening
    - extract_plan_lines
    - diagnose_architecture
    - visual_snapshot
    - split_arch_wall
    - move_arch_node
    - remove_arch_node
    """
    import json
    kwargs = json.loads(parameters_json)
    
    # Map the action string to the global function with the same name
    if action in globals() and callable(globals()[action]):
        func = globals()[action]
        # Call the function with the unpacked kwargs
        result = func(**kwargs)
        # If it returns an Image object, just return it directly or stringify it if we need to
        # Note: MCP Image objects might need special handling, but usually the MCP server handles it.
        # Actually, let's just return the result. If it's an Image, it might fail JSON serialization if returned as string.
        # Wait, the signature says `-> str`. Let's just return the raw object and let type hints be `Any` or let fastmcp handle it.
        # FastMCP can return Image objects if the signature allows. Let's fix the signature to `-> Any`.
        return result
    else:
        return f"Error: Action '{action}' not found."


if __name__ == "__main__":
    mcp.run()