import json
import os

def generate_slabs(resplan_file="resplan_nodes.json", output_file="resplan_nodes.json"):
    """
    Detects slabs based on architectural room boundaries and maps them to structural Z-levels.
    """
    if not os.path.exists(resplan_file):
        print(f"Error: Could not find {resplan_file}")
        return
        
    with open(resplan_file, 'r') as f:
        data = json.load(f)
        
    rooms = data.get("rooms", [])
    
    generated_slabs = []
    
    # Map level_id to top Z elevation (where the slab sits)
    # arch_ground -> z=3.5 (Ground floor ceiling)
    # arch_first -> z=7.0 (First floor ceiling / roof)
    level_to_z = {
        "arch_ground": 3.5,
        "arch_first": 7.0
    }
    
    for r in rooms:
        # Skip stairs as they are usually open to below or have a landing not a full slab
        if r.get('type') == 'stairs':
            continue
            
        z = level_to_z.get(r.get('level_id'))
        if z is None:
            continue
            
        coords = r.get("coordinates", [])
        if not coords:
            continue
            
        xs = [c[0] for c in coords]
        ys = [c[1] for c in coords]
        
        min_x, max_x = min(xs), max(xs)
        min_y, max_y = min(ys), max(ys)
        
        Lx = round(max_x - min_x, 2)
        Ly = round(max_y - min_y, 2)
        
        if Lx < 0.5 or Ly < 0.5:
            continue
            
        short_span = min(Lx, Ly)
        long_span = max(Lx, Ly)
        aspect_ratio = long_span / short_span
        
        slab_type = "One-Way Solid Slab" if aspect_ratio > 2.0 else "Two-Way Solid Slab"
        
        # Find bounding beams
        # A beam is bounding if its midpoint is on the perimeter of the room's bounding box
        # or inside the room. For simplicity in our mockup, we just find any beam on the same Z
        # that falls within the Lx/Ly bounding box of the room!
        bounding_beams = []
        # We need the beam data
        # Actually, let's load elements and find beams on this Z
        floor_beams = [e for e in data.get("elements", []) if e.get("type") == "beam" and round(data["nodes"][[n for n, node in enumerate(data["nodes"]) if node["id"] == e["n1"]][0]]["z"], 2) == z]
        
        for b in floor_beams:
            n1 = [n for n in data["nodes"] if n["id"] == b["n1"]][0]
            n2 = [n for n in data["nodes"] if n["id"] == b["n2"]][0]
            bx_min, bx_max = min(n1['x'], n2['x']), max(n1['x'], n2['x'])
            by_min, by_max = min(n1['y'], n2['y']), max(n1['y'], n2['y'])
            # Check overlap with slab bounding box (allow small epsilon)
            eps = 0.1
            if (bx_max >= min_x - eps and bx_min <= max_x + eps) and (by_max >= min_y - eps and by_min <= max_y + eps):
                bounding_beams.append(b['id'])
                
        slab_id = f"Slab_{z}_{r['id']}"
        
        generated_slabs.append({
            "id": slab_id,
            "type": "slab",
            "z_elevation": z,
            "Lx": Lx,
            "Ly": Ly,
            "span_m": short_span,
            "long_span_m": long_span,
            "slab_type": slab_type,
            "room_id": r['id'],
            "bounding_beams": bounding_beams,
            "coordinates": r.get('coordinates', [])
        })
            
    print(f"Generated {len(generated_slabs)} slabs automatically based on rooms.")
    
    data["slabs"] = generated_slabs
    
    with open(output_file, 'w') as f:
        json.dump(data, f, indent=4)
        
    print(f"Successfully saved to {output_file}")

if __name__ == "__main__":
    generate_slabs("../Projects/Sample Project/inputs/resplan_nodes.json", "../Projects/Sample Project/inputs/resplan_nodes.json")
