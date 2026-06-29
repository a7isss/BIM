import json
import math

def calculate_beta1(fc):
    if fc <= 28:
        return 0.85
    beta = 0.85 - 0.05 * ((fc - 28) / 7.0)
    return max(beta, 0.65)

def generate_beam_library(filename="beams_library.json"):
    fc = 28.0 # MPa
    fy = 420.0 # MPa
    fyt = 420.0 # Stirrup yield strength, MPa
    Av = 157.0 # 2 legs of 10mm bar
    hf = 150.0 # Standard slab thickness in mm for flanged beams
    
    widths = [200, 250, 300, 400, 500] # web widths bw in mm
    depths = [300, 350, 400, 450, 500, 550, 600, 650, 700, 750, 800, 850, 900, 950, 1000] # mm
    shapes = ["Rectangular", "T-Beam", "L-Beam"]
    
    phi_flexure = 0.9 # Tension controlled
    phi_shear = 0.75
    
    beta1 = calculate_beta1(fc)
    
    library = []
    
    for shape in shapes:
        for bw in widths:
            for h in depths:
                if h <= bw:
                    continue # Practical beam dimensions only (h > bw)
                    
                d = h - 50.0 # mm (effective depth)
                
                # Determine flange geometry based on shape
                if shape == "Rectangular":
                    bf = bw
                    current_hf = 0.0
                elif shape == "T-Beam":
                    bf = bw + 12 * hf
                    current_hf = hf
                elif shape == "L-Beam":
                    bf = bw + 6 * hf
                    current_hf = hf
                
                # Minimum reinforcement based on web width
                As_min = max((0.25 * math.sqrt(fc)) / fy, 1.4 / fy) * bw * d
                
                # Maximum reinforcement (tension controlled, strain >= 0.005)
                c_max = 0.375 * d
                a_max = beta1 * c_max
                
                if shape == "Rectangular" or a_max <= current_hf:
                    Cc_max = 0.85 * fc * a_max * bf
                else:
                    Ccw = 0.85 * fc * a_max * bw
                    Ccf = 0.85 * fc * current_hf * (bf - bw)
                    Cc_max = Ccw + Ccf
                    
                As_max = Cc_max / fy
                
                # Tier parameters (using As directly instead of rho to simplify flanged logic)
                tiers = [
                    {"tier": 1, "As": As_min, "s_factor": 2.0},
                    {"tier": 2, "As": max(0.5 * As_max, As_min * 1.1), "s_factor": 3.0},
                    {"tier": 3, "As": As_max, "s_factor": 4.0}
                ]
                
                section_data = {
                    "shape": shape,
                    "bw_mm": bw,
                    "b_mm": bw, # backward compatibility for selector
                    "bf_mm": bf,
                    "h_mm": h,
                    "hf_mm": current_hf,
                    "d_mm": d,
                    "fc_MPa": fc,
                    "fy_MPa": fy,
                    "area_mm2": bw * h + (bf - bw) * current_hf if shape != "Rectangular" else bw * h,
                    "tiers": []
                }
                
                for tier in tiers:
                    As = tier["As"]
                    s = d / tier["s_factor"] # Stirrup spacing
                    
                    # Check min spacing limit to avoid unbuildable congestion
                    if s < 50:
                        s = 50.0
                        
                    # Ensure maximum spacing limits per code (d/2 or 600mm)
                    s = min(s, d/2, 600.0)
                    
                    # Flexural Capacity Mn
                    # First assume a <= hf
                    a = (As * fy) / (0.85 * fc * bf)
                    
                    if shape == "Rectangular" or a <= current_hf:
                        Mn_Nmm = As * fy * (d - a / 2.0)
                    else:
                        # a > hf (true flanged section behavior)
                        Cf = 0.85 * fc * (bf - bw) * current_hf
                        Asf = Cf / fy
                        Asw = As - Asf
                        
                        a_w = (Asw * fy) / (0.85 * fc * bw)
                        Mnf = Asf * fy * (d - current_hf / 2.0)
                        Mnw = Asw * fy * (d - a_w / 2.0)
                        Mn_Nmm = Mnf + Mnw
                        
                    phi_Mn_kNm = (phi_flexure * Mn_Nmm) / 1e6
                    
                    # Shear Capacity Vn (using bw)
                    Vc_N = 0.17 * 1.0 * math.sqrt(fc) * bw * d
                    Vs_N = (Av * fyt * d) / s
                    
                    Vs_max = 0.66 * math.sqrt(fc) * bw * d
                    if Vs_N > Vs_max:
                        Vs_N = Vs_max # Capped by concrete crushing limit
                    
                    Vn_N = Vc_N + Vs_N
                    phi_Vn_kN = (phi_shear * Vn_N) / 1000.0
                    
                    tier_data = {
                        "tier_level": tier["tier"],
                        "rho_web_percent": round((As / (bw * d)) * 100, 3),
                        "As_mm2": round(As, 1),
                        "stirrup_spacing_mm": round(s, 0),
                        "phi_Mn_kNm": round(phi_Mn_kNm, 1),
                        "phi_Vn_kN": round(phi_Vn_kN, 1)
                    }
                    section_data["tiers"].append(tier_data)
                    
                library.append(section_data)
            
    # Save library to JSON
    with open(filename, 'w') as f:
        json.dump(library, f, indent=4)
        
    print(f"Generated beam library with {len(library)} sections and saved to {filename}.")

if __name__ == "__main__":
    generate_beam_library()
