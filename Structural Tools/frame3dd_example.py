import pyframe3dd
import numpy as np
import os

def run_simple_frame_analysis():
    print("Setting up Frame3DD Analysis Engine...")
    
    # Define Nodes (x, y, z in meters)
    nodes = pyframe3dd.NodeData(
        np.array([1, 2, 3]), # Node IDs
        np.array([0.0, 0.0, 4.0]), # X
        np.array([0.0, 0.0, 0.0]), # Y
        np.array([0.0, 3.0, 3.0]), # Z
        np.array([0.0, 0.0, 0.0])  # r (radius, 0 if not needed)
    )
    
    # Boundary Conditions (1 = fixed, 0 = free)
    # Fix the base (Node 1)
    reactions = pyframe3dd.ReactionData(
        np.array([1]), # Node ID
        np.array([1]), # x
        np.array([1]), # y
        np.array([1]), # z
        np.array([1]), # xx
        np.array([1]), # yy
        np.array([1])  # zz
    )
    
    # Material and Section Properties (300x600 Rectangular Beam)
    b, h = 0.3, 0.6
    A = b * h
    Iyy = (b * h**3) / 12
    Izz = (h * b**3) / 12
    Jxx = Iyy + Izz
    E_concrete = 25e9
    G_concrete = 10e9
    rho = 2400
    
    elements = pyframe3dd.ElementData(
        np.array([1, 2]), # Element IDs
        np.array([1, 2]), # Node 1
        np.array([2, 3]), # Node 2
        np.array([A, A]), # Area
        np.array([A*5/6, A*5/6]), # Asy
        np.array([A*5/6, A*5/6]), # Asz
        np.array([Jxx, Jxx]), # Jxx
        np.array([Iyy, Iyy]), # Iyy
        np.array([Izz, Izz]), # Izz
        np.array([E_concrete, E_concrete]), # E
        np.array([G_concrete, G_concrete]), # G
        np.array([0.0, 0.0]), # roll
        np.array([rho, rho])  # density
    )
    
    # Point Loads (e.g. Gravity load on Node 3)
    load = pyframe3dd.StaticLoadCase(
        np.array([3]), # Node ID
        np.array([0.0]), # Fx
        np.array([0.0]), # Fy
        np.array([-50000.0]), # Fz (-50 kN)
        np.array([0.0]), # Mxx
        np.array([0.0]), # Myy
        np.array([0.0])  # Mzz
    )
    
    # Frame object
    frame = pyframe3dd.Frame(nodes, reactions, elements, [1], [load])
    
    print("Writing Frame3DD input file and running...")
    input_file = os.path.join(os.path.dirname(__file__), "concrete_frame.csv")
    frame.write(input_file)
    
    out = frame.run()
    print("\n--- RESULTS ---")
    print("Displacement at Node 3 (Z-axis):", out.node.dz[2], "meters")
    print("Bending Moment at Base (Iyy):", out.reaction.Mxx[0], "N-m")

if __name__ == "__main__":
    try:
        run_simple_frame_analysis()
    except Exception as e:
        print("Analysis failed:", e)
