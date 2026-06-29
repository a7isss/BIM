import json
import os

def select_beam(Mu_kNm, Vu_kN, shape_filter=None, library_file="beams_library.json"):
    """
    Selects the optimal beam section based on Mu and Vu.
    Optionally filter by shape_filter (e.g., "Rectangular", "T-Beam", "L-Beam").
    """
    if not os.path.exists(library_file):
        print(f"Error: Library file {library_file} not found.")
        return None
        
    with open(library_file, 'r') as f:
        library = json.load(f)
        
    # Sort library by cross-sectional area to ensure cost-effective concrete selection
    library.sort(key=lambda x: x["area_mm2"])
    
    for section in library:
        if shape_filter and section.get("shape") != shape_filter:
            continue
            
        # Tiers are already ordered 1 to 3 in generation, so tier 1 (lowest steel cost) is checked first
        for tier in section["tiers"]:
            if tier["phi_Mn_kNm"] >= Mu_kNm and tier["phi_Vn_kN"] >= Vu_kN:
                return {
                    "shape": section.get("shape", "Rectangular"),
                    "bw_mm": section.get("bw_mm", section.get("b_mm")),
                    "bf_mm": section.get("bf_mm", section.get("b_mm")),
                    "h_mm": section["h_mm"],
                    "hf_mm": section.get("hf_mm", 0.0),
                    "tier_level": tier["tier_level"],
                    "phi_Mn_kNm": tier["phi_Mn_kNm"],
                    "phi_Vn_kN": tier["phi_Vn_kN"],
                    "As_mm2": tier["As_mm2"],
                    "stirrup_spacing_mm": tier["stirrup_spacing_mm"]
                }
                
    return None

if __name__ == "__main__":
    Mu_target = 350.0 # kNm (increased to test T-beams better)
    Vu_target = 120.0 # kN
    shape_req = "T-Beam"
    
    print(f"Searching for optimal {shape_req} section for Mu = {Mu_target} kNm and Vu = {Vu_target} kN...\n")
    
    selected = select_beam(Mu_target, Vu_target, shape_filter=shape_req)
    
    if selected:
        print("--- OPTIMAL SECTION FOUND ---")
        print(f"Shape        : {selected['shape']}")
        print(f"Section Size : Web bw = {selected['bw_mm']} mm, Flange bf = {selected['bf_mm']} mm, Total Depth h = {selected['h_mm']} mm")
        print(f"Slab Thk     : hf = {selected['hf_mm']} mm")
        print(f"Tier Level   : Tier {selected['tier_level']}")
        print(f"Capacity     : phi*Mn = {selected['phi_Mn_kNm']} kNm, phi*Vn = {selected['phi_Vn_kN']} kN")
        print(f"Reinforcement: As = {selected['As_mm2']} mm2")
        print(f"Stirrups     : s = {selected['stirrup_spacing_mm']} mm")
    else:
        print("No Section Available - Upsize Required")
