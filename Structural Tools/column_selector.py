import json
import os

def select_column(Pu_kN, Mu_kNm, library_file="columns_library.json"):
    if not os.path.exists(library_file):
        print(f"Error: Library file {library_file} not found.")
        return None
        
    with open(library_file, 'r') as f:
        library = json.load(f)
        
    # Sort by concrete area (cost-effective)
    library.sort(key=lambda x: x["area_m2"])
    
    for column in library:
        for tier in column["tiers"]:
            # Check Axial and simplified Moment capacity
            if tier["phi_Pn_kN"] >= Pu_kN and tier["phi_Mn_kNm"] >= Mu_kNm:
                return {
                    "b_mm": column["b_mm"],
                    "h_mm": column["h_mm"],
                    "tier_level": tier["tier_level"],
                    "rho_percent": tier["rho_percent"],
                    "phi_Pn_kN": tier["phi_Pn_kN"],
                    "phi_Mn_kNm": tier["phi_Mn_kNm"]
                }
                
    return None

if __name__ == "__main__":
    selected = select_column(1200.0, 50.0)
    print(selected)
