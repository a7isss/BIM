import json
import math
import os

def generate_simulated_results(resplan_file="resplan_nodes.json", assumptions_file="design_assumptions.json", output_file="resplan_analysis_results.json", struct_types_file="structural_types.json"):
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
    w_D_area = assump["loads"]["superimposed_dead_load_kN_m2"] + 4.0

    analysis_assump = assump.get("analysis", {})
    materials = assump.get("materials", {})
    w_wall_thickness = analysis_assump.get("wall_thickness_m", materials.get("wall_thickness_m", 0.2))
    w_brick_density = analysis_assump.get("wall_density_kN_m3", materials.get("wall_density_kN_m3", 18.0))
    w_wind_pressure = assump.get("loads", {}).get("wind_pressure_kPa", 0.5)
    default_bay_width = analysis_assump.get("default_bay_width_m", 3.0)
    q_all = assump.get("materials", {}).get("soil_q_all_kPa", 200.0)

    nodes = {n["id"]: n for n in data["nodes"]}
    elements = data.get("elements", [])
    slabs = data.get("slabs", [])

    results = {"elements": []}

    def _default_span(s):
        return s.get("span_m", 4.0)

    # Process Slabs first
    for s in slabs:
        span = _default_span(s)
        req_load = w_D_area + w_L_area
        slab_type = s.get("slab_type", "Two-Way Solid Slab")
        results["elements"].append({
            "id": s["id"],
            "type": "slab",
            "span_m": span,
            "slab_type": slab_type,
            "required_load_kN_m2": req_load
        })

    def point_to_segment_dist(px, py, x1, y1, x2, y2):
        l2 = (x1 - x2)**2 + (y1 - y2)**2
        if l2 == 0: return math.hypot(px - x1, py - y1)
        t = max(0, min(1, ((px - x1)*(x2 - x1) + (py - y1)*(y2 - y1)) / l2))
        return math.hypot(px - (x1 + t*(x2 - x1)), py - (y1 + t*(y2 - y1)))

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

        n1 = nodes.get(el["n1"])
        n2 = nodes.get(el["n2"])
        if n1 is None or n2 is None:
            continue
        length = math.sqrt((n2['x'] - n1['x'])**2 + (n2['y'] - n1['y'])**2 + (n2['z'] - n1['z'])**2)
        if length <= 0:
            continue

        trib_width = 0.2
        for s in slabs:
            if el["id"] in s.get("bounding_beams", []):
                span = _default_span(s)
                if s.get("slab_type") == "One-Way Solid Slab":
                    trib_width += span / 2.0
                else:
                    trib_width += span / 3.0

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

        bx1, by1 = n1['x'], n1['y']
        bx2, by2 = n2['x'], n2['y']
        dx_b = (bx2 - bx1) / length if length > 0 else 0
        dy_b = (by2 - by1) / length if length > 0 else 0

        on_beam_t = [0.0]
        for other_el in elements:
            if other_el["type"] != "column":
                continue
            for cnid in [other_el["n1"], other_el["n2"]]:
                if cnid == el["n1"] or cnid == el["n2"]:
                    continue
                cn = nodes.get(cnid)
                if cn is None:
                    continue
                t = ((cn['x'] - bx1) * dx_b + (cn['y'] - by1) * dy_b)
                if t <= 0 or t >= length:
                    continue
                px = bx1 + t * dx_b
                py = by1 + t * dy_b
                perp_dist = math.hypot(cn['x'] - px, cn['y'] - py)
                if perp_dist < 0.25:
                    on_beam_t.append(t)

        on_beam_t.append(length)
        on_beam_t = sorted(set(on_beam_t))

        effective_span = max(on_beam_t[i+1] - on_beam_t[i] for i in range(len(on_beam_t)-1))

        w_D = w_D_area * trib_width + wall_load_kN_m
        w_L = w_L_area * trib_width

        M_D = (w_D * effective_span**2) / 10.0
        V_D = (w_D * effective_span) / 2.0
        M_L = (w_L * effective_span**2) / 10.0
        V_L = (w_L * effective_span) / 2.0

        M_u = 1.2 * M_D + 1.6 * M_L
        V_u = 1.2 * V_D + 1.6 * V_L

        for i in range(len(on_beam_t) - 1):
            span_len = on_beam_t[i+1] - on_beam_t[i]
            span_V_D = (w_D * span_len) / 2.0
            span_V_L = (w_L * span_len) / 2.0

            def node_at_t(t_val):
                if abs(t_val) < 0.01:
                    return el["n1"]
                if abs(t_val - length) < 0.01:
                    return el["n2"]
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
                return el["n1"]

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
            "n_intermediate_supports": len(on_beam_t) - 2,
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
    cols = [el for el in elements if el["type"] == "column"]
    cols.sort(key=lambda c: max(nodes.get(c["n1"], {}).get("z", 0), nodes.get(c["n2"], {}).get("z", 0)), reverse=True)

    for el in cols:
        n1 = nodes.get(el["n1"])
        n2 = nodes.get(el["n2"])
        if n1 is None or n2 is None:
            continue

        top_nid = el["n1"] if n1["z"] > n2["z"] else el["n2"]
        bot_nid = el["n2"] if n1["z"] > n2["z"] else el["n1"]

        length = abs(n1["z"] - n2["z"])
        if length <= 0:
            length = 3.0

        P_D_top = node_reactions.get(top_nid, {}).get("D", 0.0)
        P_L_top = node_reactions.get(top_nid, {}).get("L", 0.0)

        t_id = el.get("type_id", "C1")
        t_data = structural_types.get(t_id, {})
        b = t_data.get("b", 0.3)
        h = t_data.get("h", 0.3)

        self_weight_D = (b * h * length) * 25.0

        P_D_raw = P_D_top + self_weight_D
        P_D = max(P_D_raw, self_weight_D + 10.0)
        P_L = P_L_top

        if bot_nid in node_reactions:
            node_reactions[bot_nid]["D"] += P_D_raw
            node_reactions[bot_nid]["L"] += P_L

        ecc_m = max(b, h) * 0.05
        M_D = P_D * ecc_m
        M_L = P_L * ecc_m

        col_trib_width = 0.0
        cx, cy, cz = nodes[top_nid]['x'], nodes[top_nid]['y'], nodes[top_nid]['z']
        for b_el in elements:
            if b_el["type"] == "beam":
                bn1, bn2 = nodes.get(b_el["n1"]), nodes.get(b_el["n2"])
                if bn1 is None or bn2 is None:
                    continue
                if abs(bn1['z'] - cz) < 0.2:
                    dist = point_to_segment_dist(cx, cy, bn1['x'], bn1['y'], bn2['x'], bn2['y'])
                    if dist < 0.25:
                        beam_len = math.hypot(bn2['x'] - bn1['x'], bn2['y'] - bn1['y'])
                        col_trib_width += beam_len / 4.0

        if col_trib_width < 0.1:
            col_trib_width = default_bay_width

        trib_facade_m2 = length * col_trib_width
        F_wind_kN = w_wind_pressure * trib_facade_m2

        M_W_raw = F_wind_kN * (length / 2.0)
        M_W_cap = max(P_D, 10.0) * max(b, h) * 0.30
        M_W = min(M_W_raw, M_W_cap)

        V_gravity = (P_D + P_L) * 0.03
        V_wind = F_wind_kN

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

    # PASS 3: FOOTINGS
    for el in elements:
        if el["type"] != "footing":
            continue

        nid = el.get("n1") or el.get("node_id")
        if nid is None:
            continue
        n = nodes.get(nid)
        if n is None:
            continue

        # Axial load from node reactions (carried down from column above)
        P_D = node_reactions.get(nid, {}).get("D", 0.0)
        P_L = node_reactions.get(nid, {}).get("L", 0.0)

        # Self-weight of footing (estimate ~5% of axial load)
        self_weight_D = max(P_D * 0.05, 5.0)
        P_D_total = P_D + self_weight_D

        # Footing plan area needed (D + L)
        P_service = P_D_total + P_L
        area_req = P_service / q_all if q_all > 0 else 1.0

        # Assume square footing
        B = math.sqrt(area_req)

        t_id = el.get("type_id", "F1")
        t_data = structural_types.get(t_id, {})
        b = t_data.get("b", 0.3)
        h = t_data.get("h", 0.3)

        P_u = 1.2 * P_D_total + 1.6 * P_L
        M_u = P_u * max(b, h) * 0.10
        V_u = P_u / 2.0

        results["elements"].append({
            "id": el["id"],
            "type": "footing",
            "type_id": t_id,
            "node_id": nid,
            "axial_D_kN": round(P_D_total, 1),
            "axial_L_kN": round(P_L, 1),
            "required_area_m2": round(area_req, 2),
            "estimated_B_m": round(B, 2),
            "actions": {
                "D": {"P": round(P_D_total, 1), "M": 0.0, "V": 0.0},
                "L": {"P": round(P_L, 1), "M": 0.0, "V": 0.0},
                "U": {"P": round(P_u, 1), "M": round(M_u, 1), "V": round(V_u, 1)}
            },
            "utilization": round(P_u / (q_all * area_req), 2) if area_req > 0 else 0
        })

    os.makedirs(os.path.dirname(output_file), exist_ok=True)
    with open(output_file, 'w') as f:
        json.dump(results, f, indent=4)

    total = len(elements) + len(slabs)
    print(f"Successfully exported {total} analyzed elements to {output_file}")
    print(f"  Beams: {sum(1 for el in elements if el['type']=='beam')}, "
          f"Columns: {sum(1 for el in elements if el['type']=='column')}, "
          f"Footings: {sum(1 for el in elements if el['type']=='footing')}, "
          f"Slabs: {len(slabs)}")

if __name__ == "__main__":
    generate_simulated_results()
