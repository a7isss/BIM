import json
import os
from sbc_load_combinations import generate_sbc_combinations
from beam_selector import select_beam
from footing_selector import select_footing
from column_selector import select_column
from slab_selector import select_slab

def run_orchestrator(mock_results_file="resplan_analysis_results.json", assumptions_file="design_assumptions.json", output_file="structural_report.json"):
    print("==================================================")
    print("   SBC SELECTION ORCHESTRATOR")
    print("==================================================\n")
    
    if not os.path.exists(mock_results_file):
        print(f"Error: Could not find {mock_results_file}")
        return
        
    with open(mock_results_file, 'r') as f:
        data = json.load(f)
        
    if not os.path.exists(assumptions_file):
        print(f"Error: Could not find {assumptions_file}")
        return
        
    with open(assumptions_file, 'r') as f:
        assumptions = json.load(f)
        
    q_all = assumptions["materials"]["soil_q_all_kPa"]
        
    elements = data.get("elements", [])
    bill_of_materials = []
    
    for el in elements:
        print(f"Processing Element: {el['id']} ({el['type'].upper()})")
        
        # Slabs don't run through combinations in the same way, we just select them based on span
        if el["type"] == "slab":
            span = el.get("span_m", 4.0)
            req_load = el.get("required_load_kN_m2", 8.0)
            slab_type = el.get("slab_type", "Two-Way Solid Slab")
            selected = select_slab(span, req_load, slab_type=slab_type)
            
            if selected:
                print(f"  -> SUCCESS: Selected {selected['type']} Slab (h={selected['h_mm']} mm)")
                bill_of_materials.append({
                    "id": el['id'],
                    "type": "Slab",
                    "details": f"{slab_type} {selected['h_mm']}mm",
                    "capacity": f"DL: {selected['DL_kN_m2']} kN/m2, phi*Vc: {selected['phi_Vc_kN_per_m']} kN/m",
                    "reinforcement": selected.get("selected_reinforcement", "As per library minimums")
                })
            else:
                print(f"  -> FAILED: No Section Available - Upsize Required")
            print("-" * 50)
            continue
            
        # 1. Run Load Combinations for frame elements
        actions = el.get("actions", {})
        combo_results = generate_sbc_combinations(actions)
        
        Pu = combo_results["Pu"]
        Mu = combo_results["Mu"]
        Vu = combo_results["Vu"]
        
        print(f"  -> Envelope: Pu={Pu:.1f} kN, Mu={Mu:.1f} kNm, Vu={Vu:.1f} kN")
        
        # 2. Select Section based on type
        if el["type"] == "beam":
            shape = el.get("shape_req", "Rectangular")
            selected = select_beam(Mu, Vu, shape_filter=shape)
            
            if selected:
                print(f"  -> SUCCESS: Selected {selected['shape']} {selected['bw_mm']}x{selected['h_mm']} (Tier {selected['tier_level']})")
                bill_of_materials.append({
                    "id": el['id'],
                    "type": "Beam",
                    "details": f"{selected['shape']} {selected['bw_mm']}x{selected['h_mm']}",
                    "capacity": f"phi*Mn={selected['phi_Mn_kNm']} kNm, phi*Vn={selected['phi_Vn_kN']} kN",
                    "reinforcement": f"Tier {selected['tier_level']} (As={selected['As_mm2']} mm2, stirrups @ {selected['stirrup_spacing_mm']} mm)"
                })
            else:
                print(f"  -> FAILED: No Section Available - Upsize Required")
                
        elif el["type"] == "column":
            selected = select_column(Pu, Mu)
            if selected:
                print(f"  -> SUCCESS: Selected Column {selected['b_mm']}x{selected['h_mm']} (Tier {selected['tier_level']})")
                bill_of_materials.append({
                    "id": el['id'],
                    "type": "Column",
                    "details": f"Rectangular {selected['b_mm']}x{selected['h_mm']} mm",
                    "capacity": f"phi*Pn={selected['phi_Pn_kN']} kN, phi*Mn={selected['phi_Mn_kNm']} kNm",
                    "reinforcement": f"Tier {selected['tier_level']} (rho={selected['rho_percent']}%)"
                })
                
                # Automatically size a footing for this column's base reaction!
                print(f"  -> Sizing Footing for Column {el['id']} base reaction...")
                col_size = max(selected['b_mm'], selected['h_mm'])
                footing = select_footing(Pu, Mu, col_size, q_all, type_req="Isolated")
                
                if footing:
                    print(f"    -> SUCCESS: Selected Isolated Footing {footing['L_mm']}x{footing['B_mm']}x{footing['T_mm']} (Tier {footing['tier_level']})")
                    bill_of_materials.append({
                        "id": f"{el['id']}_Base",
                        "type": "Footing",
                        "details": f"{footing['L_mm']}x{footing['B_mm']}x{footing['T_mm']} mm",
                        "capacity": f"q_max={footing['q_max_kPa']} kPa, phi*Vc2={footing['phi_Vc2_kN']} kN, phi*Mn={footing['phi_Mn_kNm']} kNm",
                        "reinforcement": f"Tier {footing['tier_level']}"
                    })
                else:
                    print(f"    -> FAILED: No Footing Section Available - Upsize Required")
            else:
                print(f"  -> FAILED: No Column Section Available - Upsize Required")
                
        print("-" * 50)
        
    print("\n==================================================")
    print("   GROUPING & OPTIMIZATION PASS")
    print("==================================================")
    
    # Dictionaries to map dimensions to design labels
    # Key: size string (e.g. "200x500"), Value: design label (e.g. "B1")
    beam_groups = {}
    col_groups = {}
    footing_groups = {}
    slab_groups = {}
    
    b_counter = 1
    c_counter = 1
    f_counter = 1
    s_counter = 1
    
    final_bom = []
    
    for item in bill_of_materials:
        item_type = item["type"]
        raw_size = item["details"]
        
        design_label = ""
        
        if item_type == "Beam":
            if raw_size not in beam_groups:
                beam_groups[raw_size] = f"B{b_counter}"
                b_counter += 1
            design_label = beam_groups[raw_size]
            
        elif item_type == "Column":
            if raw_size not in col_groups:
                col_groups[raw_size] = f"C{c_counter}"
                c_counter += 1
            design_label = col_groups[raw_size]
            
        elif item_type == "Footing":
            if raw_size not in footing_groups:
                footing_groups[raw_size] = f"F{f_counter}"
                f_counter += 1
            design_label = footing_groups[raw_size]
            
        elif item_type == "Slab":
            if raw_size not in slab_groups:
                slab_groups[raw_size] = f"S{s_counter}"
                s_counter += 1
            design_label = slab_groups[raw_size]
            
        item["design_label"] = design_label
        item["section"] = raw_size
        
        print(f"Assigned {design_label} to {item_type} {item['id']} ({raw_size})")
        
        final_bom.append(item)

    print("\n==================================================")
    print("   FINAL BILL OF MATERIALS (BOM)")
    print("==================================================")
    for item in final_bom:
        print(f"ID  : {item['id']} [{item['type']}] -> {item['design_label']}")
        print(f"Size: {item['details']}")
        print(f"Cap : {item['capacity']}")
        print(f"Rebf: {item['reinforcement']}")
        print("")
        
    # Write the BOM back to structural_report.json so the UI can read it
    if os.path.exists(os.path.dirname(output_file)):
        try:
            with open(output_file, 'r') as f:
                out_data = json.load(f)
        except (json.JSONDecodeError, FileNotFoundError):
            out_data = {"elements": []}
        
        out_data["elements"] = final_bom
        
        with open(output_file, 'w') as f:
            json.dump(out_data, f, indent=4)
        print(f"Successfully exported final grouped BOM to {output_file}")

if __name__ == "__main__":
    run_orchestrator()
