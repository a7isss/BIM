import json
import os

def select_footing(Pu_kN, Mu_kNm, col_size_mm, q_all_kPa, type_req="Isolated", library_file="footings_library.json"):
    if not os.path.exists(library_file):
        print(f"Error: Library file {library_file} not found.")
        return None
        
    with open(library_file, 'r') as f:
        library = json.load(f)
        
    # Sort by concrete volume to find the most cost-effective footing
    library.sort(key=lambda x: x["volume_m3"])
    
    for footing in library:
        if footing.get("type", "Isolated") != type_req:
            continue
            
        L_m = footing["L_mm"] / 1000.0
        B_m = footing["B_mm"] / 1000.0
        
        # 1. Check Soil Bearing Capacity
        # q_max = P/A + 6M/(B*L^2)
        q_max = (Pu_kN / footing["area_m2"]) + (6 * Mu_kNm) / (B_m * (L_m**2))
        
        if q_max > q_all_kPa:
            continue # Fails bearing
            
        # 2. Check Shear
        col_data = next((c for c in footing["columns"] if c["col_size_mm"] == col_size_mm), None)
        if not col_data:
            continue # Column size not mapped in library
            
        if type_req == "Strip":
            # For strip, check wide beam shear
            if col_data["phi_Vc1_kN"] < Pu_kN / 2.0: # simplified line load shear proxy
                continue
        else:
            if col_data["phi_Vc2_kN"] < Pu_kN:
                continue # Fails punching shear
            
        # 3. Check Flexure
        cantilever_L = (L_m - (col_size_mm/1000.0)) / 2.0
        Mu_face = q_max * B_m * (cantilever_L**2) / 2.0
        
        selected_tier = None
        for tier in footing["tiers"]:
            if tier["phi_Mn_kNm"] >= Mu_face:
                selected_tier = tier
                break
                
        if not selected_tier:
            continue # Fails flexure even at max tier
            
        return {
            "type": footing["type"],
            "L_mm": footing["L_mm"],
            "B_mm": footing["B_mm"],
            "T_mm": footing["T_mm"],
            "q_max_kPa": round(q_max, 1),
            "tier_level": selected_tier["tier_level"],
            "phi_Vc2_kN": col_data.get("phi_Vc2_kN", 0.0),
            "phi_Mn_kNm": selected_tier["phi_Mn_kNm"],
            "Mu_req_kNm": round(Mu_face, 1)
        }
        
    return None

if __name__ == "__main__":
    Pu_target = 1500.0 # kN
    Mu_target = 150.0 # kNm
    col_size = 300 # mm
    q_all = 200.0 # kPa allowable soil pressure
    type_req = "Combined"
    
    print(f"Searching for optimal {type_req} footing...")
    print(f"Pu = {Pu_target} kN, Mu = {Mu_target} kNm, Col = {col_size}x{col_size} mm, q_all = {q_all} kPa\n")
    
    selected = select_footing(Pu_target, Mu_target, col_size, q_all, type_req=type_req)
    
    if selected:
        print("--- OPTIMAL FOOTING FOUND ---")
        print(f"Type       : {selected['type']}")
        print(f"Size       : {selected['L_mm']} x {selected['B_mm']} mm, Thickness T = {selected['T_mm']} mm")
        print(f"Bearing    : q_max = {selected['q_max_kPa']} kPa (Limit: {q_all} kPa)")
        print(f"Punching Vc: phi*Vc2 = {selected['phi_Vc2_kN']} kN (Required: {Pu_target} kN)")
        print(f"Flexure    : phi*Mn = {selected['phi_Mn_kNm']} kNm (Required: {selected['Mu_req_kNm']} kNm)")
        print(f"Steel Tier : Tier {selected['tier_level']}")
    else:
        print("No Section Available - Upsize Required")
