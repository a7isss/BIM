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
                
                # 1. Pure Axial
                Pn_max_N = 0.80 * (0.85 * fc * (Ag - As) + fy * As)
                phi_Pn_max_kN = (phi_axial * Pn_max_N) / 1000.0
                
                d = h - 50.0 # 50mm cover to centroid
                d_prime = 50.0
                As_face = As / 2.0
                
                # 2. Balanced Point (eps_t = 0.0021)
                cb = 600.0 / (600.0 + fy) * d
                ab = 0.85 * cb
                Cc_b = 0.85 * fc * ab * b
                Ts_b = As_face * fy
                eps_s_prime_b = 0.003 * (cb - d_prime) / cb if cb > 0 else 0
                fs_prime_b = min(fy, max(-fy, eps_s_prime_b * 200000.0))
                Cs_b = As_face * (fs_prime_b - 0.85 * fc)
                Pn_b = Cc_b + Cs_b - Ts_b
                Mn_b = Cc_b * (h/2.0 - ab/2.0) + Cs_b * (h/2.0 - d_prime) + Ts_b * (d - h/2.0)
                phi_Pn_b_kN = (phi_axial * Pn_b) / 1000.0
                phi_Mn_b_kNm = (phi_axial * Mn_b) / 1e6
                
                # 3. Tension-Controlled Point (eps_t = 0.005)
                ct = 0.375 * d
                at = 0.85 * ct
                Cc_t = 0.85 * fc * at * b
                Ts_t = As_face * fy
                eps_s_prime_t = 0.003 * (ct - d_prime) / ct if ct > 0 else 0
                fs_prime_t = min(fy, max(-fy, eps_s_prime_t * 200000.0))
                Cs_t = As_face * (fs_prime_t - 0.85 * fc)
                Pn_t = Cc_t + Cs_t - Ts_t
                Mn_t = Cc_t * (h/2.0 - at/2.0) + Cs_t * (h/2.0 - d_prime) + Ts_t * (d - h/2.0)
                phi_Pn_t_kN = (0.90 * Pn_t) / 1000.0
                phi_Mn_t_kNm = (0.90 * Mn_t) / 1e6
                
                # 4. Pure Flexure (P = 0)
                # Ignoring compression steel for simplicity
                a_f = (As_face * fy) / (0.85 * fc * b)
                Mn_f = As_face * fy * (d - a_f / 2.0)
                phi_Mn_f_kNm = (0.90 * Mn_f) / 1e6
                
                pm_points = [
                    {"P": round(phi_Pn_max_kN, 1), "M": 0.0},
                    {"P": round(phi_Pn_b_kN, 1), "M": round(phi_Mn_b_kNm, 1)},
                    {"P": round(phi_Pn_t_kN, 1), "M": round(phi_Mn_t_kNm, 1)},
                    {"P": 0.0, "M": round(phi_Mn_f_kNm, 1)}
                ]
                
                column["tiers"].append({
                    "tier_level": tier_idx + 1,
                    "rho_percent": round(rho * 100, 1),
                    "As_mm2": round(As, 1),
                    "phi_Pn_kN": round(phi_Pn_max_kN, 1), # Max axial
                    "phi_Mn_kNm": round(phi_Mn_f_kNm, 1), # Pure flexure
                    "pm_diagram": pm_points
                })
                
            library.append(column)
            
    with open(filename, 'w') as f:
        json.dump(library, f, indent=4)
        
    print(f"Generated column library with {len(library)} sections and saved to {filename}.")

if __name__ == "__main__":
    generate_column_library()
