import json
import os

def build_frame3dd_input(resplan_file="resplan_nodes.json", output_file="structural_model.3dd"):
    """
    Parses an architectural node-element graph and builds the structural wireframe
    for Frame3DD analysis, assigning nominal section properties.
    """
    if not os.path.exists(resplan_file):
        print(f"Error: Could not find {resplan_file}")
        return
        
    with open(resplan_file, 'r') as f:
        data = json.load(f)
        
    nodes = data.get("nodes", [])
    elements = data.get("elements", [])
    
    # Define nominal material & section properties for initial analysis
    # Frame3DD needs Area (Ax), Inertias (Ixx, Iyy, Izz), Young's Modulus (E), Shear Modulus (G), Density (p)
    # These are nominal values for stiffness distribution before member selection.
    nominal_E = 25000000000.0 # N/m2 for Concrete
    nominal_G =  9600000000.0 # N/m2
    density = 2400.0 # kg/m3
    
    # Let's say:
    # 1: Column (e.g., 400x400)
    # 2: Beam (e.g., 200x500)
    sections = {
        "column": {"id": 1, "Ax": 0.16, "Asy": 0.133, "Asz": 0.133, "Ixx": 0.00426, "Iyy": 0.00213, "Izz": 0.00213},
        "beam":   {"id": 2, "Ax": 0.10, "Asy": 0.083, "Asz": 0.083, "Ixx": 0.00312, "Iyy": 0.00208, "Izz": 0.00033}
    }
    
    with open(output_file, 'w') as f:
        f.write("Frame3DD Input Generated from ResPlan Dataset\n")
        f.write("==================================================\n\n")
        
        # 1. NODE DATA
        f.write(f"{len(nodes)}  # Number of Nodes\n")
        f.write("# NodeID   X   Y   Z   r\n")
        for n in nodes:
            # radius r for joint size, 0 is point node
            f.write(f"{n['id']}   {n['x']:.3f}   {n['y']:.3f}   {n['z']:.3f}   0.0\n")
            
        f.write("\n")
        
        # 2. REACTION DATA (Supports)
        supports = [n for n in nodes if n.get("is_support")]
        f.write(f"{len(supports)}  # Number of Nodes with Reactions\n")
        f.write("# NodeID   x   y   z   xx   yy   zz (1=fixed, 0=free)\n")
        for s in supports:
            # Fully fixed supports for columns at foundation
            f.write(f"{s['id']}   1   1   1   1   1   1\n")
            
        f.write("\n")
        
        # 3. FRAME ELEMENT DATA
        # Filter out non-frame elements like footings
        frame_elements = [e for e in elements if e.get("type") in ["beam", "column"]]
        
        f.write(f"{len(frame_elements)}  # Number of Frame Elements\n")
        f.write("# ElmID  N1  N2  Ax  Asy  Asz  Ixx  Iyy  Izz  E  G  p  density\n")
        for e in frame_elements:
            etype = e.get("type", "beam")
            sec = sections.get(etype, sections["beam"])
            
            num_id = e['id']
            
            f.write(f"{num_id}   {e['n1']}   {e['n2']}   ")
            f.write(f"{sec['Ax']}   {sec['Asy']}   {sec['Asz']}   ")
            f.write(f"{sec['Ixx']}   {sec['Iyy']}   {sec['Izz']}   ")
            f.write(f"{nominal_E}   {nominal_G}   0.0   {density}\n")
            
    print(f"Successfully processed ResPlan architecture into structural wireframe: {output_file}")

if __name__ == "__main__":
    build_frame3dd_input()
