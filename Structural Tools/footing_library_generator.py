import json
import math
import os

def generate_footing_library(filename="footings_library.json"):
    # Load Assumptions
    assumptions_file = "design_assumptions.json"
    if not os.path.exists(assumptions_file):
        print("Error: assumptions file not found.")
        return
        
    with open(assumptions_file, 'r') as f:
        assumptions = json.load(f)
        
    fc = assumptions["materials"]["concrete_fc_MPa"]
    fy = assumptions["materials"]["steel_fy_MPa"]
    phi_flexure = assumptions["factors"]["phi_flexure"]
    phi_shear = assumptions["factors"]["phi_shear"]
    
    lengths = [1000, 1500, 2000, 2500, 3000, 3500, 4000, 5000, 6000] # mm
    widths = [500, 1000, 1500, 2000, 2500, 3000, 3500, 4000] # mm
    thicknesses = [300, 400, 500, 600, 700, 800, 1000] # mm
    column_sizes = [300, 400, 500, 600] # Square columns mm
    
    library = []
    
    footing_types = ["Isolated", "Strip", "Combined"]
    
    for ftype in footing_types:
        for L in lengths:
            for B in widths:
                
                # Filter logical dimensions based on type
                if ftype == "Isolated" and (B > L or L > 4000):
                    continue
                if ftype == "Strip":
                    if L != 1000: # Strip is per 1m run
                        continue
                    if B > 2500:
                        continue
                if ftype == "Combined":
                    if L < 3000 or L < B:
                        continue
                        
                for T in thicknesses:
                    d = T - 75.0 # 75mm clear cover for earth contact
                    
                    if d <= 50:
                        continue # Not practical
                        
                    footing = {
                        "type": ftype,
                        "L_mm": L,
                        "B_mm": B,
                        "T_mm": T,
                        "d_mm": d,
                        "area_m2": round((L/1000.0) * (B/1000.0), 2),
                        "volume_m3": round((L/1000.0) * (B/1000.0) * (T/1000.0), 3),
                        "columns": [],
                        "tiers": []
                    }
                    
                    # Punching Shear & One-Way Shear for different column sizes
                    for c in column_sizes:
                        # One-way shear capacity (taking critical section across width B)
                        Vc1_N = 0.17 * math.sqrt(fc) * B * d
                        phi_Vc1_kN = (phi_shear * Vc1_N) / 1000.0
                        
                        if ftype == "Strip":
                            # No punching shear for pure strip (wall load)
                            phi_Vc2_kN = 0.0
                        else:
                            # Two-way (Punching) shear capacity
                            bo = 4 * (c + d) # Critical perimeter at d/2 from column face
                            Vc2_N = 0.33 * math.sqrt(fc) * bo * d
                            phi_Vc2_kN = (phi_shear * Vc2_N) / 1000.0
                        
                        footing["columns"].append({
                            "col_size_mm": c,
                            "phi_Vc1_kN": round(phi_Vc1_kN, 1),
                            "phi_Vc2_kN": round(phi_Vc2_kN, 1)
                        })
                        
                    # Flexural Capacity (Longitudinal, along L or transverse for Strip)
                    rho_min = 0.0018
                    As_1 = rho_min * B * T # Shrinkage steel uses gross area
                    As_2 = 0.004 * B * d
                    
                    for tier_idx, As in enumerate([As_1, As_2]):
                        a = (As * fy) / (0.85 * fc * B)
                        Mn_Nmm = As * fy * (d - a/2.0)
                        phi_Mn_kNm = (phi_flexure * Mn_Nmm) / 1e6
                        
                        footing["tiers"].append({
                            "tier_level": tier_idx + 1,
                            "As_mm2": round(As, 1),
                            "phi_Mn_kNm": round(phi_Mn_kNm, 1)
                        })
                        
                    library.append(footing)
                
    with open(filename, 'w') as f:
        json.dump(library, f, indent=4)
        
    print(f"Generated footing library with {len(library)} sections and saved to {filename}.")

if __name__ == "__main__":
    generate_footing_library()
