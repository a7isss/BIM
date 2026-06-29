import json
import math

import os

def generate_slab_library(filename="slabs_library.json"):
    assumptions_file = "design_assumptions.json"
    if not os.path.exists(assumptions_file):
        print("Error: assumptions file not found.")
        return
        
    with open(assumptions_file, 'r') as f:
        assumptions = json.load(f)
        
    fc = assumptions["materials"]["concrete_fc_MPa"]
    fy = assumptions["materials"]["steel_fy_MPa"]
    # Convert from kg/m3 to kN/m3 exactly (1 kgf = 9.80665 N, so * 9.81 / 1000)
    gamma_c = assumptions["materials"]["concrete_density_kg_m3"] * 9.81 / 1000.0
    gamma_block = 10.0 # kN/m3 (Hollow block equivalent density, kept as hardcoded since it's not in assumptions)
    
    library = []
    
    # 1. Solid Slabs
    thicknesses = [150, 200, 250, 300] # mm
    
    for h in thicknesses:
        h_m = h / 1000.0
        d = h - 25.0 # Assuming 20mm cover + half bar
        
        DL = h_m * gamma_c
        
        # Vc per 1m width (b = 1000mm)
        Vc_N = 0.17 * math.sqrt(fc) * 1000.0 * d
        phi_Vc_kN = (0.75 * Vc_N) / 1000.0
        
        # Cracking moment Mcr per 1m width
        fr = 0.62 * math.sqrt(fc) # MPa
        Ig = (1000.0 * h**3) / 12.0
        yt = h / 2.0
        Mcr_Nmm = (fr * Ig) / yt
        Mcr_kNm = Mcr_Nmm / 1e6
        
        # Flexural capacity based on minimum steel As_min = 0.0018 * b * h
        As_min = 0.0018 * 1000.0 * h
        a_solid = (As_min * fy) / (0.85 * fc * 1000.0)
        Mn_solid_Nmm = As_min * fy * (d - a_solid / 2.0)
        phi_Mn_kNm = 0.9 * Mn_solid_Nmm / 1e6
        
        # Minimum reinforcement assuming Grade 420 steel
        # Very simplified representation for the library mesh
        if h <= 150:
            reinf_1w = "T10 @ 200mm Main, T10 @ 200mm Shrinkage"
            reinf_2w = "T10 @ 200mm B.W."
        elif h <= 200:
            reinf_1w = "T12 @ 200mm Main, T10 @ 200mm Shrinkage"
            reinf_2w = "T12 @ 200mm B.W."
        elif h <= 250:
            reinf_1w = "T12 @ 150mm Main, T10 @ 200mm Shrinkage"
            reinf_2w = "T12 @ 150mm B.W."
        else:
            reinf_1w = "T14 @ 150mm Main, T12 @ 200mm Shrinkage"
            reinf_2w = "T14 @ 150mm B.W."
            
        library.append({
            "type": "Solid",
            "h_mm": h,
            "DL_kN_m2": round(DL, 2),
            "phi_Vc_kN_per_m": round(phi_Vc_kN, 1),
            "Mcr_kNm_per_m": round(Mcr_kNm, 1),
            "phi_Mn_kNm_per_m": round(phi_Mn_kNm, 1),
            "reinforcement_1way": reinf_1w,
            "reinforcement_2way": reinf_2w
        })
        
    # 2. Ribbed (1-Way Hollow Block) & Waffle (2-Way)
    block_depths = [200, 250, 300] # mm
    toppings = [50, 75] # mm
    bw = 150 # mm (rib width)
    s = 500 # mm (spacing center to center)
    
    for hb in block_depths:
        for tf in toppings:
            h = hb + tf
            d = h - 30.0 # Cover + stirrup + bar
            
            hb_m = hb / 1000.0
            tf_m = tf / 1000.0
            bw_m = bw / 1000.0
            s_m = s / 1000.0
            
            # Ribbed (1-Way Hollow Block)
            conc_vol_1w = tf_m + hb_m * (bw_m / s_m)
            block_vol_1w = hb_m * ((s_m - bw_m) / s_m)
            DL_1w = conc_vol_1w * gamma_c + block_vol_1w * gamma_block
            
            # Vc per rib
            Vc_rib_N = 0.17 * math.sqrt(fc) * bw * d
            phi_Vc_rib_kN = (0.75 * Vc_rib_N) / 1000.0
            phi_Vc_1w_kN_per_m = phi_Vc_rib_kN * (1.0 / s_m)
            
            reinf_1w = "2xT16 B.W. per rib, T8 @ 200mm Topping"
            
            # Flexural capacity per rib for 2xT16
            As_rib = 2.0 * math.pi * (16.0 / 2.0)**2
            a_rib = (As_rib * fy) / (0.85 * fc * s) # Assumes NA in flange
            Mn_rib_Nmm = As_rib * fy * (d - a_rib / 2.0)
            phi_Mn_rib_kNm = 0.9 * Mn_rib_Nmm / 1e6
            phi_Mn_kNm_per_m = phi_Mn_rib_kNm * (1000.0 / s)
            
            # For 1-way ribbed, bending is mostly in one direction
            library.append({
                "type": "Ribbed",
                "h_mm": h,
                "block_depth_mm": hb,
                "topping_mm": tf,
                "rib_width_mm": bw,
                "rib_spacing_mm": s,
                "DL_kN_m2": round(DL_1w, 2),
                "phi_Vc_kN_per_m": round(phi_Vc_1w_kN_per_m, 1),
                "phi_Mn_kNm_per_m": round(phi_Mn_kNm_per_m, 1),
                "reinforcement_1way": reinf_1w
            })
            
            # Waffle (2-Way)
            conc_vol_2w = tf_m + hb_m * ((2 * bw_m * s_m - bw_m**2) / (s_m**2))
            block_vol_2w = hb_m * (((s_m - bw_m)**2) / (s_m**2))
            DL_2w = conc_vol_2w * gamma_c + block_vol_2w * gamma_block
            
            phi_Vc_2w_kN_per_m = phi_Vc_rib_kN * (1.0 / s_m) # similar shear capacity along each axis
            
            reinf_2w = "2xT16 B.W. per rib each way, T8 @ 200mm Topping"
            
            library.append({
                "type": "Waffle",
                "h_mm": h,
                "block_depth_mm": hb,
                "topping_mm": tf,
                "rib_width_mm": bw,
                "rib_spacing_mm": s,
                "DL_kN_m2": round(DL_2w, 2),
                "phi_Vc_kN_per_m": round(phi_Vc_2w_kN_per_m, 1),
                "phi_Mn_kNm_per_m": round(phi_Mn_kNm_per_m, 1),
                "reinforcement_2way": reinf_2w
            })
            
    with open(filename, 'w') as f:
        json.dump(library, f, indent=4)
        
    print(f"Generated slab library with {len(library)} sections and saved to {filename}.")

if __name__ == "__main__":
    generate_slab_library()
