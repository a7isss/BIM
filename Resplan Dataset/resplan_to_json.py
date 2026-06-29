import json
import math
import os

def read_frame_layout(file_path):
    columns = []
    beams = []
    with open(file_path, 'r') as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith('#'): continue
            parts = [p.strip() for p in line.split(',')]
            if parts[0] == 'C':
                columns.append((float(parts[1]), float(parts[2])))
            elif parts[0] == 'B':
                beams.append((float(parts[1]), float(parts[2]), float(parts[3]), float(parts[4])))
    return columns, beams

def read_architectural_walls(js_path):
    walls = []
    rooms = []
    openings = []
    try:
        with open(js_path, 'r') as f:
            content = f.read()
        
        start_idx = content.find('{')
        end_idx = content.rfind('}')
        data = json.loads(content[start_idx:end_idx+1])
        
        nodes = {n['id']: n['position'] for n in data.get('nodes', [])}
        for link in data.get('links', []):
            if link.get('type') == 'wall':
                src = nodes.get(link['source'])
                tgt = nodes.get(link['target'])
                if src and tgt:
                    walls.append([
                        [src['x'], src['y']],
                        [tgt['x'], tgt['y']]
                    ])
                    
        for room in data.get('rooms', []):
            perimeter = []
            for nid in room.get('wall_nodes', []):
                pos = nodes.get(nid)
                if pos:
                    perimeter.append([pos['x'], pos['y']])
            if perimeter:
                rooms.append({
                    "id": room.get('id'),
                    "type": room.get('type'),
                    "coordinates": perimeter
                })
                
        def process_openings(item_list, type_name):
            for item in item_list:
                wall_id = item.get('wall_id')
                if not wall_id: continue
                # find wall link
                wall_link = next((l for l in data.get('links', []) if l.get('id') == wall_id), None)
                if not wall_link: continue
                
                src = nodes.get(wall_link['source'])
                tgt = nodes.get(wall_link['target'])
                if src and tgt:
                    ratio = item.get('ratio', 0.5)
                    cx = src['x'] + (tgt['x'] - src['x']) * ratio
                    cy = src['y'] + (tgt['y'] - src['y']) * ratio
                    
                    # calculate dx, dy for orientation
                    dx = tgt['x'] - src['x']
                    dy = tgt['y'] - src['y']
                    length = math.hypot(dx, dy)
                    
                    # normalize
                    if length > 0:
                        nx, ny = dx/length, dy/length
                    else:
                        nx, ny = 1, 0
                        
                    openings.append({
                        "id": item.get('id'),
                        "type": type_name, # "door", "window", "front_door"
                        "x": cx,
                        "y": cy,
                        "nx": nx,
                        "ny": ny,
                        "width": item.get('width', 1.0)
                    })
                    
        process_openings(data.get('doors', []), 'door')
        process_openings(data.get('windows', []), 'window')
        
    except Exception as e:
        print(f"Warning: Could not read architectural walls: {e}")
    return walls, rooms, openings

def generate_resplan_nodes(columns, beams, walls, rooms, openings, height=3.0):
    nodes = []
    elements = []
    
    node_map = {}
    node_id_counter = 1
    
    def get_or_create_node(x, y, z, is_support):
        nonlocal node_id_counter
        key = (round(x, 2), round(y, 2), round(z, 2))
        if key not in node_map:
            nodes.append({"id": node_id_counter, "x": x, "y": y, "z": z, "is_support": is_support})
            node_map[key] = node_id_counter
            node_id_counter += 1
        return node_map[key]
        
    c_idx = 1
    for cx, cy in columns:
        n1 = get_or_create_node(cx, cy, 0.0, True)
        n2 = get_or_create_node(cx, cy, height, False)
        elements.append({"id": f"C{c_idx}", "type": "column", "n1": n1, "n2": n2})
        c_idx += 1
        
    b_idx = 1
    for x1, y1, x2, y2 in beams:
        n1 = get_or_create_node(x1, y1, height, False)
        n2 = get_or_create_node(x2, y2, height, False)
        elements.append({"id": f"B{b_idx}", "type": "beam", "n1": n1, "n2": n2})
        b_idx += 1
        
    architecture = []
    for w in walls:
        architecture.append({
            "type": "wall",
            "coordinates": w
        })
        
    return {
        "architecture": architecture,
        "rooms": rooms,
        "openings": openings,
        "nodes": nodes,
        "elements": elements,
        "slabs": []
    }

def main():
    columns, beams = read_frame_layout('frame_layout.txt')
    walls, rooms, openings = read_architectural_walls('test_plan_5_ortho.js')
    
    resplan_data = generate_resplan_nodes(columns, beams, walls, rooms, openings)
    
    out_path = '../Projects/Sample Project/inputs/resplan_nodes.json'
    with open(out_path, 'w') as f:
        json.dump(resplan_data, f, indent=4)
    print(f"Generated {out_path} with {len(resplan_data['architecture'])} walls, {len(resplan_data['nodes'])} nodes, and {len(resplan_data['elements'])} elements.")

if __name__ == '__main__':
    main()
