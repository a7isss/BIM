import os
import json
from geometry_to_frame3dd import build_frame3dd_input
from simulate_frame3dd_analysis import generate_simulated_results
from frame3dd_orchestrator import run_orchestrator

def main():
    project_manifest = "../Projects/Sample Project/project.json"
    project_dir = os.path.dirname(project_manifest)
    
    with open(project_manifest, 'r', encoding='utf-8') as f:
        proj = json.load(f)
        
    files = proj.get("files", {})
    
    def resolve(rel_path):
        return os.path.join(project_dir, rel_path) if rel_path else None
        
    nodes_file = resolve(files.get("nodes"))
    assumptions_file = resolve(files.get("design_assumptions"))
    analysis_results_file = resolve(files.get("analysis_results"))
    structural_report_file = resolve(files.get("structural_report"))
    struct_types_file = resolve(files.get("structural_types"))
    
    print(f"\n>>> 1. Extracting Architecture from ResPlan ({nodes_file})...")
    build_frame3dd_input(nodes_file, "structural_model.3dd")
    
    print("\n>>> 2. Simulating Frame3DD Structural Analysis...")
    # Ensure outputs directory exists
    os.makedirs(os.path.dirname(analysis_results_file), exist_ok=True)
    
    generate_simulated_results(
        resplan_file=nodes_file, 
        assumptions_file=assumptions_file, 
        output_file=analysis_results_file,
        struct_types_file=struct_types_file
    )
    
    print("\n>>> 3. Running SBC Selection Orchestrator...")
    run_orchestrator(
        mock_results_file=analysis_results_file, 
        assumptions_file=assumptions_file,
        output_file=structural_report_file
    )

if __name__ == "__main__":
    main()
