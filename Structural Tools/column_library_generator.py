import json
import os

def generate_column_library(filename="columns_library.json"):
    # Load Assumptions
    assumptions_file = "design_assumptions.json"
    if not os.path.exists(assumptions_file):
        print("Error: assumptions file not found.")
        return
        
    with open(assumptions_file, 'r') as f:
        assumptions = json.load(f)
        
    fc = assumptions["materials"]["concrete_fc_MPa"]
    fy = assumptions["materials"]["steel_fy_MPa"]
    phi_axial = assumptions["factors"]["phi_axial_tied"]
    
    sizes = [200, 250, 300, 350, 400, 450, 500, 550, 600, 650, 700, 750, 800, 850, 900, 950, 1000] # mm
    
    library = []
    
    for b in sizes:
        for h in sizes:
            if b > h:
                continue # keep b <= h convention
                
            Ag = b * h
            
            # Tiers based on reinforcement ratio rho = As / Ag
            rho_tiers = [0.01, 0.02, 0.04]
            
            column = {
                "b_mm": b,
                "h_mm": h,
                "area_m2": Ag / 1e6,
                "tiers": []
            }
            
            for tier_idx, rho in enumerate(rho_tiers):
                As = rho * Ag
                
                # Nominal Axial Capacity for tied columns (ACI/SBC)
                # Pn = 0.80 * [0.85 * fc * (Ag - As) + fy * As]
                Pn_N = 0.80 * (0.85 * fc * (Ag - As) + fy * As)
                
                phi_Pn_kN = (phi_axial * Pn_N) / 1000.0
                
                # Simplified interaction for pure moment (assuming tension controlled failure phi=0.9)
                # This is a very rough proxy just for the selector logic
                # Mn ~ As * fy * (0.8 * h)
                phi_flexure = assumptions["factors"]["phi_flexure"]
                phi_Mn_kNm = (phi_flexure * As * fy * (0.8 * h)) / 1e6
                
                column["tiers"].append({
                    "tier_level": tier_idx + 1,
                    "rho_percent": round(rho * 100, 1),
                    "As_mm2": round(As, 1),
                    "phi_Pn_kN": round(phi_Pn_kN, 1),
                    "phi_Mn_kNm": round(phi_Mn_kNm, 1)
                })
                
            library.append(column)
            
    with open(filename, 'w') as f:
        json.dump(library, f, indent=4)
        
    print(f"Generated column library with {len(library)} sections and saved to {filename}.")

if __name__ == "__main__":
    generate_column_library()
