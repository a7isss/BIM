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
            pm_points = tier.get("pm_diagram", [])
            
            # Simple check if Pu exceeds max axial
            if Pu_kN > tier["phi_Pn_kN"]:
                continue
                
            # If Mu is zero, and Pu is fine, we are good
            if Mu_kNm == 0 and Pu_kN <= tier["phi_Pn_kN"]:
                capacity_found = True
                pm_capacity_M = 0
            else:
                # Interpolate PM diagram to find capacity M for given P
                # The points are ordered by decreasing P
                capacity_found = False
                pm_capacity_M = 0.0
                for i in range(len(pm_points) - 1):
                    p1, m1 = pm_points[i]["P"], pm_points[i]["M"]
                    p2, m2 = pm_points[i+1]["P"], pm_points[i+1]["M"]
                    
                    if p2 <= Pu_kN <= p1:
                        # Linear interpolation
                        ratio = (Pu_kN - p2) / (p1 - p2) if p1 != p2 else 0
                        pm_capacity_M = m2 + ratio * (m1 - m2)
                        if Mu_kNm <= pm_capacity_M:
                            capacity_found = True
                        break
                        
                # Handle tension region (P < 0) - fail if Pu < 0
                if Pu_kN < 0:
                    capacity_found = False
            
            if capacity_found:
                utilization = max(Pu_kN / tier["phi_Pn_kN"] if tier["phi_Pn_kN"] else 0,
                                  Mu_kNm / pm_capacity_M if pm_capacity_M else 0)
                                  
                return {
                    "b_mm": column["b_mm"],
                    "h_mm": column["h_mm"],
                    "tier_level": tier["tier_level"],
                    "rho_percent": tier["rho_percent"],
                    "phi_Pn_kN": tier["phi_Pn_kN"],
                    "phi_Mn_kNm": tier["phi_Mn_kNm"],
                    "utilization": round(utilization, 2)
                }
                
    return None

if __name__ == "__main__":
    selected = select_column(1200.0, 50.0)
    print(selected)
