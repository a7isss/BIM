import pickle
import json
import math
import networkx as nx
from shapely.geometry import Polygon

def dist_pt_seg(p, a, b):
    dx = b[0] - a[0]
    dy = b[1] - a[1]
    l2 = dx*dx + dy*dy
    if l2 == 0: return math.hypot(p[0]-a[0], p[1]-a[1]), a
    
    t = max(0, min(1, ((p[0]-a[0])*dx + (p[1]-a[1])*dy) / l2))
    proj = (a[0] + t*dx, a[1] + t*dy)
    return math.hypot(p[0]-proj[0], p[1]-proj[1]), proj

def extract_one_plan(plan, index):
    plan_id = f"plan_{index}"
    total_area = float(plan.get("area", 0.0))
    scale = 1.0
    inner_geom = plan.get("inner")
    
    if inner_geom and not inner_geom.is_empty:
        minx, miny, maxx, maxy = inner_geom.bounds
        pixel_area = inner_geom.area
        if pixel_area > 0 and total_area > 0:
            scale = (total_area / pixel_area) ** 0.5

    G = plan.get("graph")
    raw_rooms = []
    
    if G and isinstance(G, nx.Graph):
        for room_id, attrs in G.nodes(data=True):
            geom = attrs.get("geometry")
            room_type = str(attrs.get("type", "unknown"))
            if geom and not geom.is_empty:
                geom = geom.simplify(3.0)
                polys = [geom] if isinstance(geom, Polygon) else geom.geoms
                for poly in polys:
                    coords = list(poly.exterior.coords)[:-1]
                    scaled = [(p[0]*scale, p[1]*scale) for p in coords]
                    c = poly.centroid
                    raw_rooms.append({
                        'id': str(room_id), 
                        'type': room_type, 
                        'coords': scaled, 
                        'area': round(poly.area * (scale ** 2), 2),
                        'position': {"x": round(c.x * scale, 2), "y": round(c.y * scale, 2)}
                    })

    # Explicitly inject stair polygons as rooms (they are not in the graph)
    stair_geom = plan.get("stair")
    if stair_geom and not stair_geom.is_empty:
        stair_geom = stair_geom.simplify(3.0)
        polys = [stair_geom] if isinstance(stair_geom, Polygon) else stair_geom.geoms
        for idx, poly in enumerate(polys):
            coords = list(poly.exterior.coords)[:-1]
            scaled = [(p[0]*scale, p[1]*scale) for p in coords]
            c = poly.centroid
            raw_rooms.append({
                'id': f'stair_{idx}', 
                'type': 'stair', 
                'coords': scaled, 
                'area': round(poly.area * (scale ** 2), 2),
                'position': {"x": round(c.x * scale, 2), "y": round(c.y * scale, 2)}
            })

    # --- STEP 1: ORTHOGONAL 1D GRID SNAPPING ---
    # To prevent slanted lines, we cluster X coordinates and Y coordinates independently.
    # If a wall is vertical, both its endpoints will share exactly the same X coordinate.
    GRID_TOLERANCE = 0.60 # Cluster coordinates within 60cm of each other

    all_x = []
    all_y = []
    for r in raw_rooms:
        for x, y in r['coords']:
            all_x.append(x)
            all_y.append(y)

    def cluster_coords(coords, tolerance):
        coords.sort()
        clusters = []
        if not coords: return clusters
        current_cluster = [coords[0]]
        for c in coords[1:]:
            if c - current_cluster[-1] <= tolerance:
                current_cluster.append(c)
            else:
                clusters.append(current_cluster)
                current_cluster = [c]
        clusters.append(current_cluster)
        
        # Mapping from original coord to cluster average
        mapping_dict = {}
        for cluster in clusters:
            avg = sum(cluster) / len(cluster)
            for val in cluster:
                mapping_dict[val] = avg
        return mapping_dict

    map_x = cluster_coords(all_x, GRID_TOLERANCE)
    map_y = cluster_coords(all_y, GRID_TOLERANCE)

    rooms = []
    for r in raw_rooms:
        new_coords = []
        for x, y in r['coords']:
            new_coords.append((map_x[x], map_y[y]))
        
        # Remove consecutive duplicates created by collapsing
        clean_coords = [new_coords[0]]
        for p in new_coords[1:]:
            if p != clean_coords[-1]:
                clean_coords.append(p)
        if len(clean_coords) > 1 and clean_coords[0] == clean_coords[-1]:
            clean_coords.pop() # Remove wrap-around duplicate if merged
            
        r['coords'] = clean_coords
        if len(clean_coords) >= 3: # Must remain a valid polygon
            rooms.append(r)


    # --- STEP 2: T-JUNCTION SNAPPING ALGORITHM ---
    THRESHOLD = 0.60
    changed = True
    iterations = 0
    while changed and iterations < 5:
        changed = False
        iterations += 1
        segments = []
        for r_idx, room in enumerate(rooms):
            coords = room['coords']
            n = len(coords)
            for i in range(n):
                segments.append((r_idx, i, coords[i], coords[(i+1)%n]))
                
        for r_idx, room in enumerate(rooms):
            coords = room['coords']
            for i, p in enumerate(coords):
                best_dist = THRESHOLD
                best_proj = None
                best_seg_info = None
                
                for s in segments:
                    sr_idx, si_idx, A, B = s
                    if sr_idx == r_idx and (si_idx == i or si_idx == (i-1)%len(coords)): continue
                    d, proj = dist_pt_seg(p, A, B)
                    if 0.01 < d < best_dist:
                        best_dist = d
                        best_proj = proj
                        best_seg_info = s
                
                if best_proj:
                    coords[i] = best_proj
                    tr_idx, ti_idx, A, B = best_seg_info
                    t_room = rooms[tr_idx]
                    dA = math.hypot(A[0]-best_proj[0], A[1]-best_proj[1])
                    dB = math.hypot(B[0]-best_proj[0], B[1]-best_proj[1])
                    if dA > 0.1 and dB > 0.1:
                        t_coords = t_room['coords']
                        t_coords.insert(ti_idx + 1, best_proj)
                        changed = True
                        break
            if changed: break


    # --- STEP 3: NODE COLLAPSING ---
    nodes_dict = {}
    node_ctr = 0
    def get_node(pt):
        nonlocal node_ctr
        for ept, nid in nodes_dict.items():
            if math.hypot(ept[0]-pt[0], ept[1]-pt[1]) < 0.20: return nid
        nid = f"n_{node_ctr}"
        nodes_dict[pt] = nid
        node_ctr += 1
        return nid
        
    links_set = set()
    rooms_list = []
    
    for room in rooms:
        coords = room['coords']
        n_ids = [get_node(c) for c in coords]
        for i in range(len(n_ids)):
            n1, n2 = n_ids[i], n_ids[(i+1)%len(n_ids)]
            if n1 != n2:
                if n1 > n2: n1, n2 = n2, n1
                links_set.add((n1, n2))
        rooms_list.append({
            "id": room["id"], "type": room["type"], "position": room["position"],
            "area": room["area"], "wall_nodes": n_ids
        })

    nodes_list = []
    id_to_pt = {}
    for (x, y), nid in nodes_dict.items():
        nodes_list.append({"id": nid, "type": "wall_node", "position": {"x": round(x, 2), "y": round(y, 2)}})
        id_to_pt[nid] = (x, y)

    walls_list = []
    for (n1, n2) in links_set:
        walls_list.append({"id": f"wall_{n1}_{n2}", "source": n1, "target": n2, "type": "wall"})

    def extract_holes(geom_key, type_name):
        res = []
        holes_geom = plan.get(geom_key)
        if not holes_geom or holes_geom.is_empty: return res
        polys = [holes_geom] if isinstance(holes_geom, Polygon) else holes_geom.geoms
        
        for idx, poly in enumerate(polys):
            c = poly.centroid
            px, py = c.x * scale, c.y * scale
            minx, miny, maxx, maxy = poly.bounds
            width = max((maxx - minx) * scale, (maxy - miny) * scale)
            
            best_dist = float('inf')
            best_wall = None
            best_ratio = 0.5
            
            for wall in walls_list:
                n1, n2 = wall['source'], wall['target']
                A, B = id_to_pt[n1], id_to_pt[n2]
                d, proj = dist_pt_seg((px, py), A, B)
                
                if d < best_dist:
                    best_dist = d
                    best_wall = wall['id']
                    wall_len = math.hypot(B[0]-A[0], B[1]-A[1])
                    if wall_len > 0:
                        best_ratio = math.hypot(proj[0]-A[0], proj[1]-A[1]) / wall_len
                    else:
                        best_ratio = 0.5

            if best_wall and best_dist < 2.0:
                res.append({
                    "id": f"{type_name}_{idx}",
                    "wall_id": best_wall,
                    "ratio": round(best_ratio, 3),
                    "width": round(width, 2),
                    "type": type_name
                })
        return res

    return {
        "id": plan_id,
        "nodes": nodes_list,
        "links": walls_list,
        "rooms": rooms_list,
        "doors": extract_holes('door', 'door') + extract_holes('front_door', 'front_door'),
        "windows": extract_holes('window', 'window'),
        "metadata": { "total_area_m2": total_area }
    }

print("Loading ResPlan.pkl...")
data = pickle.load(open("32- resplan dataset/ResPlan.pkl", "rb"))
plans = list(data.values()) if isinstance(data, dict) else data

print("Extracting plan 5 with Orthogonal constraints...")
output = extract_one_plan(plans[5], 5)

with open("32- resplan dataset/test_plan_5_ortho.js", "w") as f:
    f.write("window.testPlan = ")
    json.dump(output, f, indent=2)
    f.write(";")

print("Saved cleanly to test_plan_5_ortho.js!")
