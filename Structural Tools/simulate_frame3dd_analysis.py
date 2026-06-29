import json
import math
import os

def generate_simulated_results(resplan_file="resplan_nodes.json", assumptions_file="design_assumptions.json", output_file="resplan_analysis_results.json", struct_types_file="structural_types.json"):
    """
    Simulates a Frame3DD analysis by generating realistic moments, shears, 
    and axial forces for the elements based on their geometry and the global assumptions.
    """
    if not os.path.exists(resplan_file):
        print(f"Error: {resplan_file} not found.")
        return
        
    with open(resplan_file, 'r') as f:
        data = json.load(f)
        
    if not os.path.exists(assumptions_file):
        print(f"Error: {assumptions_file} not found.")
        return
        
    with open(assumptions_file, 'r') as f:
        assump = json.load(f)
        
    w_L_area = assump["loads"]["residential_live_load_kN_m2"]
    w_D_area = assump["loads"]["superimposed_dead_load_kN_m2"] + 4.0 # add roughly 4kN/m2 for self weight of slab
        
    nodes = {n["id"]: n for n in data["nodes"]}
    elements = data["elements"]
    slabs = data.get("slabs", [])
    
    results = {"elements": []}
    
    # Process Slabs first
    for s in slabs:
        results["elements"].append({
            "id": s["id"],
            "type": "slab",
            "span_m": s["span_m"],
            "required_load_kN_m2": w_D_area + w_L_area
        })
    
    def point_to_segment_dist(px, py, x1, y1, x2, y2):
        l2 = (x1 - x2)**2 + (y1 - y2)**2
        if l2 == 0: return math.hypot(px - x1, py - y1)
        t = max(0, min(1, ((px - x1)*(x2 - x1) + (py - y1)*(y2 - y1)) / l2))
        return math.hypot(px - (x1 + t*(x2 - x1)), py - (y1 + t*(y2 - y1)))

    w_wall_thickness = 0.2
    w_brick_density = 18.0

    type_map = {}
    for t_list in data.get("types", {}).values():
        if isinstance(t_list, list):
            for t in t_list:
                if isinstance(t, dict) and "id" in t:
                    type_map[t["id"]] = t

    def get_arch_data(z):
        for lvl in data.get("levels", {}).get("architectural", []):
            if abs(lvl["elevation_m"] - z) <= 0.2:
                walls = [w for w in data.get("architecture", []) if w.get("type") == "wall" and w.get("level_id") == lvl["id"]]
                openings = [o for o in data.get("openings", []) if o.get("level_id") == lvl["id"]]
                return lvl, walls, openings
        return None, [], []

    structural_types = {}
    if struct_types_file and os.path.exists(struct_types_file):
        with open(struct_types_file, 'r') as f:
            st = json.load(f)
            for t in st.get("columns", []):
                structural_types[t["id"]] = t
            for t in st.get("beams", []):
                structural_types[t["id"]] = t

    for el in elements:
        if el["type"] == "footing":
            continue
            
        n1 = nodes[el["n1"]]
        n2 = nodes[el["n2"]]
        
        # Calculate length
        length = math.sqrt((n2['x'] - n1['x'])**2 + (n2['y'] - n1['y'])**2 + (n2['z'] - n1['z'])**2)
        
        if el["type"] == "beam":
            # Start with a base tributary width of 0.2m (just self weight approximation)
            trib_width = 0.2
            
            # Add tributary width from adjacent slabs
            for s in slabs:
                if el["id"] in s.get("bounding_beams", []):
                    if s["slab_type"] == "One-Way Solid Slab":
                        trib_width += s["span_m"] / 2.0
                    else:
                        trib_width += s["span_m"] / 3.0
                        
            # Wall Load Calculation
            wall_load_kN_m = 0.0
            arch_lvl, walls, openings = get_arch_data(n1['z'])
            
            if arch_lvl and length > 0:
                floor_height = arch_lvl.get("height_m", 3.5)
                beam_depth = 0.6
                wall_height = max(0, floor_height - beam_depth)
                
                bx1, by1, bx2, by2 = n1['x'], n1['y'], n2['x'], n2['y']
                dx = (bx2 - bx1) / length
                dy = (by2 - by1) / length
                
                for w in walls:
                    coords = w.get("coordinates", [])
                    if len(coords) >= 2:
                        wx1, wy1 = coords[0][0], coords[0][1]
                        wx2, wy2 = coords[1][0], coords[1][1]
                        
                        d1 = point_to_segment_dist(wx1, wy1, bx1, by1, bx2, by2)
                        d2 = point_to_segment_dist(wx2, wy2, bx1, by1, bx2, by2)
                        
                        if d1 < 0.2 and d2 < 0.2:
                            # Collinear
                            tw1 = (wx1 - bx1)*dx + (wy1 - by1)*dy
                            tw2 = (wx2 - bx1)*dx + (wy2 - by1)*dy
                            overlap_start = max(0, min(tw1, tw2))
                            overlap_end = min(length, max(tw1, tw2))
                            
                            if overlap_end > overlap_start:
                                overlap_len = overlap_end - overlap_start
                                wall_area = overlap_len * wall_height
                                wall_load_kN_m += (wall_area * w_wall_thickness * w_brick_density) / length
            
            w_D = w_D_area * trib_width + wall_load_kN_m
            w_L = w_L_area * trib_width
            
            # Simple beam approximations
            M_D = (w_D * length**2) / 10.0
            V_D = (w_D * length) / 2.0
            
            M_L = (w_L * length**2) / 10.0
            V_L = (w_L * length) / 2.0
            
            M_u = 1.2 * M_D + 1.6 * M_L
            V_u = 1.2 * V_D + 1.6 * V_L
            
            t_id = el.get("type_id", "B1")
            t_data = structural_types.get(t_id, {})
            caps = t_data.get("capacities", {})
            
            phi_Mn = 0.9 * max(caps.get("Mn_pos_nominal_kNm", 100.0), caps.get("Mn_neg_nominal_kNm", 100.0))
            phi_Vn = 0.75 * caps.get("Vn_concrete_kN", 100.0)
            
            utilization_M = M_u / phi_Mn if phi_Mn > 0 else 0
            utilization_V = V_u / phi_Vn if phi_Vn > 0 else 0
            max_utilization = max(utilization_M, utilization_V)
            
            b = t_data.get("b", 0.2)
            h = t_data.get("h", 0.6)
            
            Ax = b * h
            Iy = (b * h**3) / 12.0
            Iz = (h * b**3) / 12.0
            J = b * h * (b**2 + h**2) / 12.0
            
            results["elements"].append({
                "id": el["id"],
                "type": "beam",
                "type_id": t_id,
                "shape_req": "Rectangular",
                "length_m": round(length, 2),
                "wall_load_kN_m": round(wall_load_kN_m, 2),
                "properties": {
                    "Ax": round(Ax, 5), "Iy": round(Iy, 5), "Iz": round(Iz, 5), "J": round(J, 5)
                },
                "actions": {
                    "D": {"M": round(M_D, 1), "V": round(V_D, 1)},
                    "L": {"M": round(M_L, 1), "V": round(V_L, 1)},
                    "U": {"M": round(M_u, 1), "V": round(V_u, 1)}
                },
                "utilization": round(max_utilization, 2)
            })            
        elif el["type"] == "column":
            # Assume tributary loads from a typical residential grid
            trib_area = 4.0 * 5.0 / 4.0 # 5 sq meters per column
            
            P_D = trib_area * w_D_area
            P_L = trib_area * w_L_area
            
            M_D = 20.0
            M_L = 10.0
            M_W = 45.0
            
            P_u = 1.2 * P_D + 1.6 * P_L
            M_u = 1.2 * M_D + 1.6 * M_L + 1.0 * M_W
            V_u = 1.2 * 5.0 + 1.6 * 2.0 + 1.0 * 15.0
            
            t_id = el.get("type_id", "C1")
            t_data = structural_types.get(t_id, {})
            caps = t_data.get("capacities", {})
            
            phi_Pn = 0.65 * caps.get("Pn_nominal_kN", 1000.0)
            phi_Mn = 0.65 * caps.get("Mn_nominal_kNm", 100.0)
            
            utilization_P = P_u / phi_Pn if phi_Pn > 0 else 0
            utilization_M = M_u / phi_Mn if phi_Mn > 0 else 0
            max_utilization = max(utilization_P, utilization_M)
            
            b = t_data.get("b", 0.2)
            h = t_data.get("h", 0.6)
            
            Ax = b * h
            Iy = (b * h**3) / 12.0
            Iz = (h * b**3) / 12.0
            J = b * h * (b**2 + h**2) / 12.0

            results["elements"].append({
                "id": el["id"],
                "type": "column",
                "type_id": t_id,
                "properties": {
                    "Ax": round(Ax, 5), "Iy": round(Iy, 5), "Iz": round(Iz, 5), "J": round(J, 5)
                },
                "actions": {
                    "D": {"P": round(P_D, 1), "M": round(M_D, 1), "V": 5.0},
                    "L": {"P": round(P_L, 1), "M": round(M_L, 1), "V": 2.0},
                    "W": {"P": 0.0, "M": round(M_W, 1), "V": 15.0},
                    "U": {"P": round(P_u, 1), "M": round(M_u, 1), "V": round(V_u, 1)}
                },
                "utilization": round(max_utilization, 2)
            })
            
    os.makedirs(os.path.dirname(output_file), exist_ok=True)
    with open(output_file, 'w') as f:
        json.dump(results, f, indent=4)
        
    print(f"Successfully exported {len(elements) + len(slabs)} analyzed elements to {output_file}")

if __name__ == "__main__":
    generate_simulated_results()
