import json
import os
import math

def _get_section_props(b, h):
    if b <= 0 or h <= 0:
        b, h = 0.3, 0.3
    Ax = b * h
    Asy = b * h * 0.833
    Asz = b * h * 0.833
    Ixx = b * h * (b**2 + h**2) / 12.0
    Iyy = b * h**3 / 12.0
    Izz = h * b**3 / 12.0
    return {"Ax": round(Ax, 6), "Asy": round(Asy, 6), "Asz": round(Asz, 6),
            "Ixx": round(Ixx, 6), "Iyy": round(Iyy, 6), "Izz": round(Izz, 6)}

def _elem_bh(el, type_map):
    b = el.get("b")
    h = el.get("h")
    if b and h:
        return float(b), float(h)
    tid = el.get("type_id")
    if tid and tid in type_map:
        td = type_map[tid]
        b = td.get("b")
        h = td.get("h")
        if b and h:
            return float(b), float(h)
    defaults = {"column": (0.3, 0.3), "footing": (0.3, 0.3), "beam": (0.2, 0.5)}
    return defaults.get(el.get("type", ""), (0.3, 0.3))

def build_frame3dd_input(resplan_file="resplan_nodes.json", output_file="structural_model.3dd",
                         structural_types_file=None):
    if not os.path.exists(resplan_file):
        print(f"Error: Could not find {resplan_file}")
        return

    with open(resplan_file, 'r') as f:
        data = json.load(f)

    nodes = list(data.get("nodes", []))
    elements = data.get("elements", [])
    slabs = data.get("slabs", [])

    # Load structural types for b/h lookup
    type_map = {}
    if structural_types_file and os.path.exists(structural_types_file):
        with open(structural_types_file, 'r') as f:
            st = json.load(f)
            for cat in st.values():
                if isinstance(cat, list):
                    for t in cat:
                        if isinstance(t, dict) and "id" in t:
                            type_map[t["id"]] = t

    # Ensure slab corner nodes are in the node list
    slab_node_ids = set()
    for s in slabs:
        for nid in s.get("nodes", []):
            slab_node_ids.add(nid)
    existing_ids = {n["id"] for n in nodes}
    for sid in slab_node_ids:
        if sid not in existing_ids:
            nodes.append({"id": sid, "x": 0, "y": 0, "z": 0, "is_support": False})

    # Build node ID mapping (handle both numeric and string IDs)
    node_list = sorted(nodes, key=lambda n: (n.get("z", 0), str(n["id"])))
    id_to_seq = {}
    seq_to_id = {}
    for i, n in enumerate(node_list, 1):
        id_to_seq[n["id"]] = i
        seq_to_id[i] = n["id"]

    # Frame3DD section properties — compute from element b/h
    nominal_E = 25000000000.0
    nominal_G = 9600000000.0
    density = 2400.0

    # Frame elements: beam, column, footing
    # Footings -> short column from footing node to a virtual ground node at same x,y, z=0
    frame_elements = []
    for e in elements:
        etype = e.get("type")
        if etype in ("beam", "column"):
            frame_elements.append(e)
        elif etype == "footing":
            n1_id = e.get("n1") or e.get("node_id")
            if n1_id is None:
                continue
            n1 = None
            for n in node_list:
                if n["id"] == n1_id:
                    n1 = n
                    break
            if n1 is None:
                continue
            # Create a virtual ground node at z=0 directly below the footing node
            ground_id = f"ground_{n1_id}"
            if ground_id not in existing_ids and ground_id not in slab_node_ids:
                node_list.append({"id": ground_id, "x": n1["x"], "y": n1["y"], "z": 0.0, "is_support": True})
                idx = len(node_list)
                id_to_seq[ground_id] = idx
                seq_to_id[idx] = ground_id
            # Replace n2 with ground node
            e_copy = dict(e)
            if "n2" not in e_copy or e_copy.get("n2") is None:
                e_copy["n2"] = ground_id
            if "n1" not in e_copy or e_copy.get("n1") is None:
                e_copy["n1"] = n1_id
            frame_elements.append(e_copy)

    with open(output_file, 'w') as f:
        f.write("Frame3DD Input Generated from ResPlan Dataset\n")
        f.write("==================================================\n\n")

        # 1. NODE DATA
        f.write(f"{len(node_list)}  # Number of Nodes\n")
        f.write("# NodeID   X   Y   Z   r\n")
        for n in node_list:
            seq = id_to_seq[n["id"]]
            f.write(f"{seq}   {n['x']:.3f}   {n['y']:.3f}   {n.get('z', 0):.3f}   0.0\n")

        f.write("\n")

        # 2. REACTION DATA (Supports)
        supports = [n for n in node_list if n.get("is_support")]
        f.write(f"{len(supports)}  # Number of Nodes with Reactions\n")
        f.write("# NodeID   x   y   z   xx   yy   zz (1=fixed, 0=free)\n")
        for s in supports:
            seq = id_to_seq[s["id"]]
            f.write(f"{seq}   1   1   1   1   1   1\n")

        f.write("\n")

        # 3. FRAME ELEMENT DATA
        b, h = 0.3, 0.3
        f.write(f"{len(frame_elements)}  # Number of Frame Elements\n")
        f.write("# ElmID  N1  N2  Ax  Asy  Asz  Ixx  Iyy  Izz  E  G  p  density\n")
        for e in frame_elements:
            b, h = _elem_bh(e, type_map)
            sec = _get_section_props(b, h)

            n1_id = e.get("n1")
            n2_id = e.get("n2")
            if n1_id is None or n2_id is None:
                continue
            n1_seq = id_to_seq.get(n1_id)
            n2_seq = id_to_seq.get(n2_id)
            if n1_seq is None or n2_seq is None:
                continue

            num_id = id_to_seq.get(e["id"]) or (len(frame_elements) + 1)

            f.write(f"{num_id}   {n1_seq}   {n2_seq}   ")
            f.write(f"{sec['Ax']}   {sec['Asy']}   {sec['Asz']}   ")
            f.write(f"{sec['Ixx']}   {sec['Iyy']}   {sec['Izz']}   ")
            f.write(f"{nominal_E}   {nominal_G}   0.0   {density}\n")

    print(f"Successfully processed ResPlan architecture into structural wireframe: {output_file}")
    print(f"  Nodes: {len(node_list)}, Frame Elements: {len(frame_elements)} (columns={sum(1 for e in frame_elements if e.get('type')=='column')}, beams={sum(1 for e in frame_elements if e.get('type')=='beam')}, footings={sum(1 for e in frame_elements if e.get('type')=='footing')})")

if __name__ == "__main__":
    build_frame3dd_input()
