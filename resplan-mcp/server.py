from mcp.server.fastmcp import FastMCP
import json
import math
import uuid
import time
from collections import defaultdict
from typing import List, Dict, Any, Optional

import os
import subprocess

mcp = FastMCP("ResPlan Drafter")

PROJECT_DIR = 'D:/Revit toolset/Projects/Sample Project'
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

@mcp.tool()
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

@mcp.tool()
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

@mcp.tool()
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

@mcp.tool()
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
@mcp.tool()
def rotate_column(column_id: str, new_angle: float) -> str:
    """Rotate a column element by setting its angle (in degrees)."""
    data = load_data()
    elements = data.get('elements', [])
    col = next((e for e in elements if e['id'] == column_id and e.get('type') == 'column'), None)
    if not col:
        return f"Column {column_id} not found."
    
    # Update angle for ALL columns in the vertical stack to keep them consistent
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
        sc['angle'] = new_angle
        
    save_data(data)
    return f"Rotated {len(stack_cols)} columns in stack at ({orig_x}, {orig_y}) to {new_angle} degrees."

@mcp.tool()
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

@mcp.tool()
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

@mcp.tool()
def get_types(category: str) -> str:
    """Get valid type_id strings for a category (walls, doors, windows, rooms)."""
    data = load_data()
    types = data.get('types', {})
    if category not in types:
        return f"Category {category} not found. Valid categories: {list(types.keys())}"
    return json.dumps([t['id'] for t in types[category]], indent=2)

@mcp.tool()
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

@mcp.tool()
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

@mcp.tool()
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

@mcp.tool()
def get_rooms(level_id: str = None) -> str:
    """Get a list of all rooms, optionally filtered by level."""
    data = load_data()
    rooms = data.get('rooms', [])
    if level_id:
        rooms = [r for r in rooms if r.get('level_id') == level_id]
    return json.dumps(rooms, indent=2)

@mcp.tool()
def add_opening(x: float, y: float, opening_type: str, type_id: str, level_id: str) -> str:
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
        "host_id": closest_wall
    })
    
    save_data(data)
    return f"Created {opening_type} {new_id} snapped to wall {closest_wall} at ({snap_x:.2f}, {snap_y:.2f})."

@mcp.tool()
def run_structural_analysis() -> str:
    """Run the end-to-end structural analysis pipeline (geometry -> Frame3DD -> SBC sizing)."""
    try:
        result = subprocess.run(
            ['python', 'run_e2e_flow.py'],
            cwd='D:/Revit toolset/Structural Tools',
            capture_output=True,
            text=True,
            check=True
        )
        return f"Structural analysis completed successfully.\n\nOutput:\n{result.stdout}"
    except subprocess.CalledProcessError as e:
        return f"Structural analysis failed with exit code {e.returncode}.\n\nError Output:\n{e.stderr}"

@mcp.tool()
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

if __name__ == "__main__":
    mcp.run()
