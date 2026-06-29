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


    node_reactions = {nid: {"D": 0.0, "L": 0.0} for nid in nodes}
    
    # PASS 1: BEAMS
    for el in elements:
        if el["type"] != "beam":
            continue
            
        n1 = nodes[el["n1"]]
        n2 = nodes[el["n2"]]
        length = math.sqrt((n2['x'] - n1['x'])**2 + (n2['y'] - n1['y'])**2 + (n2['z'] - n1['z'])**2)
        
        trib_width = 0.2
        for s in slabs:
            if el["id"] in s.get("bounding_beams", []):
                if s["slab_type"] == "One-Way Solid Slab":
                    trib_width += s["span_m"] / 2.0
                else:
                    trib_width += s["span_m"] / 3.0
                    
        wall_load_kN_m = 0.0
        arch_lvl, walls, openings = get_arch_data(n1['z'])
        
        if arch_lvl and length > 0:
            floor_height = arch_lvl.get("height_m", 3.5)
            beam_depth = 0.6
            wall_height = max(0, floor_height - beam_depth)
            
            bx1, by1, bx2, by2 = n1['x'], n1['y'], n2['x'], n2['y']
            dx = (bx2 - bx1) / length if length > 0 else 0
            dy = (by2 - by1) / length if length > 0 else 0
            
            for w in walls:
                coords = w.get("coordinates", [])
                if len(coords) >= 2:
                    wx1, wy1 = coords[0][0], coords[0][1]
                    wx2, wy2 = coords[1][0], coords[1][1]
                    
                    d1 = point_to_segment_dist(wx1, wy1, bx1, by1, bx2, by2)
                    d2 = point_to_segment_dist(wx2, wy2, bx1, by1, bx2, by2)
                    
                    if d1 < 0.2 and d2 < 0.2:
                        tw1 = (wx1 - bx1)*dx + (wy1 - by1)*dy
                        tw2 = (wx2 - bx1)*dx + (wy2 - by1)*dy
                        overlap_start = max(0, min(tw1, tw2))
                        overlap_end = min(length, max(tw1, tw2))
                        
                        if overlap_end > overlap_start:
                            overlap_len = overlap_end - overlap_start
                            wall_area = overlap_len * wall_height
                            wall_load_kN_m += (wall_area * w_wall_thickness * w_brick_density) / length
        
        # --- Effective Span: find intermediate column nodes on this beam ---
        # A beam may pass through intermediate columns. We need to find all column
        # nodes that lie geometrically on the beam segment so we can size the beam
        # for the WORST column-to-column span, not the full end-to-end length.
        bx1, by1 = n1['x'], n1['y']
        bx2, by2 = n2['x'], n2['y']
        dx_b = (bx2 - bx1) / length if length > 0 else 0
        dy_b = (by2 - by1) / length if length > 0 else 0

        # Collect all column elements that share a node on this beam
        on_beam_t = [0.0]  # parametric t values along beam (t=0 → n1, t=1 → n2)
        for other_el in elements:
            if other_el["type"] != "column":
                continue
            for cnid in [other_el["n1"], other_el["n2"]]:
                if cnid == el["n1"] or cnid == el["n2"]:
                    continue  # already the endpoints
                cn = nodes.get(cnid)
                if cn is None:
                    continue
                # Project column node onto beam axis
                t = ((cn['x'] - bx1) * dx_b + (cn['y'] - by1) * dy_b)
                if t <= 0 or t >= length:
                    continue
                # Check perpendicular distance
                px = bx1 + t * dx_b
                py = by1 + t * dy_b
                perp_dist = math.hypot(cn['x'] - px, cn['y'] - py)
                if perp_dist < 0.25:  # within 25cm tolerance
                    on_beam_t.append(t)

        on_beam_t.append(length)
        on_beam_t = sorted(set(on_beam_t))

        # The effective span for moment sizing = longest gap between adjacent supports
        effective_span = max(on_beam_t[i+1] - on_beam_t[i] for i in range(len(on_beam_t)-1))

        w_D = w_D_area * trib_width + wall_load_kN_m
        w_L = w_L_area * trib_width
        
        # Use effective span for moment (column-to-column worst case)
        M_D = (w_D * effective_span**2) / 10.0
        V_D = (w_D * effective_span) / 2.0
        M_L = (w_L * effective_span**2) / 10.0
        V_L = (w_L * effective_span) / 2.0
        
        M_u = 1.2 * M_D + 1.6 * M_L
        V_u = 1.2 * V_D + 1.6 * V_L
        
        # Distribute reactions to ALL support nodes along the beam (endpoints + intermediate columns)
        # For each span segment, shear goes to its two bounding support nodes
        for i in range(len(on_beam_t) - 1):
            span_len = on_beam_t[i+1] - on_beam_t[i]
            span_V_D = (w_D * span_len) / 2.0
            span_V_L = (w_L * span_len) / 2.0
            
            # Find node IDs for t[i] and t[i+1]
            def node_at_t(t_val):
                if abs(t_val) < 0.01:
                    return el["n1"]
                if abs(t_val - length) < 0.01:
                    return el["n2"]
                # Find the intermediate column node closest to this t
                for other_el2 in elements:
                    if other_el2["type"] != "column":
                        continue
                    for cnid2 in [other_el2["n1"], other_el2["n2"]]:
                        cn2 = nodes.get(cnid2)
                        if cn2 is None:
                            continue
                        t2 = ((cn2['x'] - bx1) * dx_b + (cn2['y'] - by1) * dy_b)
                        if abs(t2 - t_val) < 0.05:
                            px2 = bx1 + t2 * dx_b
                            py2 = by1 + t2 * dy_b
                            if math.hypot(cn2['x'] - px2, cn2['y'] - py2) < 0.25:
                                return cnid2
                return el["n1"]  # fallback

            nid_left = node_at_t(on_beam_t[i])
            nid_right = node_at_t(on_beam_t[i+1])
            
            node_reactions[nid_left]["D"] += span_V_D
            node_reactions[nid_left]["L"] += span_V_L
            node_reactions[nid_right]["D"] += span_V_D
            node_reactions[nid_right]["L"] += span_V_L

        
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
            "effective_span_m": round(effective_span, 2),
            "n_intermediate_supports": len(on_beam_t) - 2,  # exclude endpoints
            "wall_load_kN_m": round(wall_load_kN_m, 2),
            "properties": {"Ax": round(Ax, 5), "Iy": round(Iy, 5), "Iz": round(Iz, 5), "J": round(J, 5)},
            "actions": {
                "D": {"M": round(M_D, 1), "V": round(V_D, 1)},
                "L": {"M": round(M_L, 1), "V": round(V_L, 1)},
                "U": {"M": round(M_u, 1), "V": round(V_u, 1)}
            },
            "utilization": round(max_utilization, 2)
        })

    # PASS 2: COLUMNS
    # Sort columns by highest node Z descending
    cols = [el for el in elements if el["type"] == "column"]
    cols.sort(key=lambda c: max(nodes[c["n1"]]["z"], nodes[c["n2"]]["z"]), reverse=True)
    
    for el in cols:
        n1 = nodes[el["n1"]]
        n2 = nodes[el["n2"]]
        
        top_nid = el["n1"] if n1["z"] > n2["z"] else el["n2"]
        bot_nid = el["n2"] if n1["z"] > n2["z"] else el["n1"]
        
        length = abs(n1["z"] - n2["z"])
        
        # Load from above (beams + higher columns)
        P_D_top = node_reactions[top_nid]["D"]
        P_L_top = node_reactions[top_nid]["L"]
        
        # Column self weight
        t_id = el.get("type_id", "C1")
        t_data = structural_types.get(t_id, {})
        b = t_data.get("b", 0.2)
        h = t_data.get("h", 0.6)
        
        self_weight_D = (b * h * length) * 25.0 # 25 kN/m3 concrete
        
        P_D = P_D_top + self_weight_D
        P_L = P_L_top
        
        # Transfer load to bottom node
        node_reactions[bot_nid]["D"] += P_D
        node_reactions[bot_nid]["L"] += P_L
        
        # Gravity moments: small eccentricity moment from beam reactions (beam-to-column connection)
        # Estimate: assume 5% eccentricity of axial load over column width
        ecc_m = max(b, h) * 0.05
        M_D = P_D * ecc_m
        M_L = P_L * ecc_m

        # Wind moment: storey drift approach — max H/500 drift limit
        # F_wind per storey ≈ 0.5 kPa * tributary bay width * storey height
        trib_facade_m2 = length * 3.0  # 3m bay width
        F_wind_kN = 0.5 * trib_facade_m2  # kN per storey
        # M at base = F * h/2 (point load at mid height, fixed base)
        # Capped at drift: delta = F*h^3/(3EI), M = EI*delta/(h^2/3) ≈ 3*delta_max*EI/h^2
        # Practical cap: wind moment shouldn't exceed 30% of gravity axial * column dimension
        M_W_raw = F_wind_kN * (length / 2.0)
        M_W_cap = max(P_D + self_weight_D, 10.0) * max(b, h) * 0.30
        M_W = min(M_W_raw, M_W_cap)

        # Lateral shear
        V_gravity = (P_D + P_L) * 0.03  # 3% lateral imperfection
        V_wind = F_wind_kN
        
        # Pu minimum: even if no beams route to this node, the column carries its own self-weight
        # plus at least 10 kN tributary (staircase, partition loads, etc.)
        P_D = max(P_D, self_weight_D + 10.0)
        
        P_u = 1.2 * P_D + 1.6 * P_L
        M_u = 1.2 * M_D + 1.6 * M_L + 1.0 * M_W
        V_u = 1.2 * V_gravity + 1.0 * V_wind
        
        caps = t_data.get("capacities", {})
        phi_Pn = 0.65 * caps.get("Pn_nominal_kN", 1000.0)
        phi_Mn = 0.65 * caps.get("Mn_nominal_kNm", 100.0)
        
        utilization_P = P_u / phi_Pn if phi_Pn > 0 else 0
        utilization_M = M_u / phi_Mn if phi_Mn > 0 else 0
        max_utilization = max(utilization_P, utilization_M)
        
        Ax = b * h
        Iy = (b * h**3) / 12.0
        Iz = (h * b**3) / 12.0
        J = b * h * (b**2 + h**2) / 12.0

        results["elements"].append({
            "id": el["id"],
            "type": "column",
            "type_id": t_id,
            "height_m": round(length, 2),
            "properties": {"Ax": round(Ax, 5), "Iy": round(Iy, 5), "Iz": round(Iz, 5), "J": round(J, 5)},
            "actions": {
                "D": {"P": round(P_D, 1), "M": round(M_D, 1), "V": round(V_gravity, 1)},
                "L": {"P": round(P_L, 1), "M": round(M_L, 1), "V": 0.0},
                "W": {"P": 0.0, "M": round(M_W, 1), "V": round(V_wind, 1)},
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
