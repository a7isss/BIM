import json
import os
import sys

try:
    from shapely.geometry import Polygon
    from shapely.ops import unary_union
    HAS_SHAPELY = True
except ImportError:
    HAS_SHAPELY = False
    print("Warning: Shapely is not installed. Advanced geometry checks will be skipped.")

def check_json_files(project_dir):
    project_json = os.path.join(project_dir, 'project.json')
    if not os.path.exists(project_json):
        print(f"Error: {project_json} not found.")
        return None
    
    with open(project_json, 'r', encoding='utf-8') as f:
        proj = json.load(f)
    
    nodes_file = os.path.join(project_dir, proj.get('files', {}).get('nodes'))
    
    if not os.path.exists(nodes_file):
        print(f"Error: Nodes file {nodes_file} not found.")
        return None
    
    with open(nodes_file, 'r', encoding='utf-8') as f:
        data = json.load(f)
        
    return data

def validate_geometry(data):
    nodes = {n['id']: n for n in data.get('nodes', [])}
    
    print("\n--- Geometry Validation Report ---")
    
    if not HAS_SHAPELY:
        print("Install shapely (`pip install shapely`) to run full validation.")
        return

    room_polygons = {}
    valid = True

    # 1. Check for self-intersecting polygons
    print("\n[1] Checking for self-intersecting rooms...")
    for room in data.get('rooms', []):
        room_nodes = room.get('nodes', [])
        if not room_nodes:
            continue
        
        missing_nodes = [nid for nid in room_nodes if nid not in nodes]
        if missing_nodes:
            print(f"  ERROR: Room '{room['id']}' references missing nodes: {missing_nodes}")
            valid = False
            continue

        coords = [(nodes[nid]['x'], nodes[nid]['y']) for nid in room_nodes]
        if len(coords) < 3:
            print(f"  WARNING: Room '{room['id']}' has fewer than 3 nodes.")
            continue
            
        poly = Polygon(coords)
        if not poly.is_valid:
            print(f"  WARNING: Room '{room['id']}' geometry is invalid (likely self-intersecting).")
            valid = False
        else:
            room_polygons[room['id']] = poly
            
    if valid:
        print("  All room geometries are valid.")

    # 2. Check for missing/blank areas inside the bounding box
    print("\n[2] Checking for orphaned / blank spaces...")
    if not room_polygons:
        print("  No valid rooms to analyze.")
        return
        
    all_polys = list(room_polygons.values())
    total_area_poly = unary_union(all_polys)
    
    # We can check the area of the holes in the combined polygon
    # A Polygon in shapely has 'interiors' which are the holes.
    holes_found = False
    if total_area_poly.geom_type == 'Polygon':
        if list(total_area_poly.interiors):
            print("  WARNING: Found an enclosed blank space (hole) in the floor plan!")
            holes_found = True
            for i, interior in enumerate(total_area_poly.interiors):
                hole_poly = Polygon(interior)
                print(f"    - Hole {i+1} Area: {hole_poly.area:.2f} sqm, Centroid: ({hole_poly.centroid.x:.2f}, {hole_poly.centroid.y:.2f})")
                print(f"      (This might be a missing corridor or unassigned space)")
                
    elif total_area_poly.geom_type == 'MultiPolygon':
        for idx, poly in enumerate(total_area_poly.geoms):
            if list(poly.interiors):
                print(f"  WARNING: Found an enclosed blank space (hole) in part {idx+1} of the floor plan!")
                holes_found = True
                for i, interior in enumerate(poly.interiors):
                    hole_poly = Polygon(interior)
                    print(f"    - Hole {i+1} Area: {hole_poly.area:.2f} sqm, Centroid: ({hole_poly.centroid.x:.2f}, {hole_poly.centroid.y:.2f})")

    if not holes_found:
        print("  No completely enclosed blank spaces found.")
        
    print("\n----------------------------------\n")

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--project_dir", default="D:/Revit toolset/Projects/Sample Project")
    args = parser.parse_args()
    
    data = check_json_files(args.project_dir)
    if data:
        validate_geometry(data)
