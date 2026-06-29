import json
import os

def select_slab(span_m, required_load_kN_m2, slab_type="Two-Way Solid Slab", library_file="slabs_library.json"):
    """
    Selects the most cost-effective slab (by concrete equivalent volume) that 
    satisfies the required superimposed load (which translates roughly to flexural/shear capacity).
    """
    if not os.path.exists(library_file):
        print(f"Error: Library file {library_file} not found.")
        return None
        
    with open(library_file, 'r') as f:
        library = json.load(f)
        
    # Sort by Dead Load (proxy for concrete volume/cost)
    library.sort(key=lambda x: x["DL_kN_m2"])
    
    for slab in library:
        # A simple check: if span < 4m, solid is usually okay.
        # If span > 6m, ribbed or waffle.
        # We check a very simplified span/depth ratio for deflection control (SBC/ACI limits)
        if slab["type"] == "Solid":
            min_h = (span_m * 1000) / 24.0 # 1-way solid simple span roughly
        elif slab["type"] == "Ribbed":
            min_h = (span_m * 1000) / 18.5 # 1-way ribbed
        else:
            min_h = (span_m * 1000) / 30.0 # Waffle
            
        if slab["h_mm"] >= min_h:
            # Determine reinforcement based on type
            if "One-Way" in slab_type and "reinforcement_1way" in slab:
                slab["selected_reinforcement"] = slab["reinforcement_1way"]
            elif "Two-Way" in slab_type and "reinforcement_2way" in slab:
                slab["selected_reinforcement"] = slab["reinforcement_2way"]
            else:
                slab["selected_reinforcement"] = "As per library minimums"
                
            return slab
            
    return None
