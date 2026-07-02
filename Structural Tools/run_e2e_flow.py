import os
import json
import sys
import glob as glob_mod
from geometry_to_frame3dd import build_frame3dd_input
from simulate_frame3dd_analysis import generate_simulated_results
from frame3dd_orchestrator import run_orchestrator

def find_projects(base_dir):
    pattern = os.path.join(base_dir, '*', 'project.json')
    return sorted(glob_mod.glob(pattern))

def main():
    if len(sys.argv) > 1:
        project_arg = sys.argv[1]
        if os.path.isfile(project_arg):
            project_manifest = project_arg
        elif os.path.isdir(project_arg):
            project_manifest = os.path.join(project_arg, 'project.json')
        else:
            print(f"Error: path not found: {project_arg}")
            sys.exit(1)
    else:
        projects = find_projects(os.path.join(os.path.dirname(__file__), '..', 'Projects'))
        if not projects:
            print("Error: No projects found. Usage: python run_e2e_flow.py <project_dir_or_json>")
            sys.exit(1)
        if len(projects) == 1:
            project_manifest = projects[0]
            print(f"Auto-detected project: {project_manifest}")
        else:
            print("Multiple projects found. Specify one:")
            for p in projects:
                print(f"  {p}")
            print("\nUsage: python run_e2e_flow.py <path_to_project.json>")
            sys.exit(1)

    if not os.path.exists(project_manifest):
        print(f"Error: project manifest not found: {project_manifest}")
        sys.exit(1)

    project_dir = os.path.dirname(os.path.abspath(project_manifest))

    with open(project_manifest, 'r', encoding='utf-8') as f:
        proj = json.load(f)

    files = proj.get("files", {})

    def resolve(rel_path, search_dirs=None):
        if not rel_path:
            return None
        # Normalize separators for Windows compat
        def _norm(p):
            return os.path.normpath(p)
        # First try relative to project dir
        candidate = _norm(os.path.join(project_dir, rel_path))
        if os.path.exists(candidate):
            return candidate
        # Fallback: search in Structural Tools dir and project dir
        if search_dirs:
            for d in search_dirs:
                candidate = _norm(os.path.join(d, rel_path))
                if os.path.exists(candidate):
                    return candidate
        # Last fallback: assume relative to Structural Tools
        st_dir = os.path.dirname(__file__)
        candidate = _norm(os.path.join(st_dir, rel_path))
        if os.path.exists(candidate):
            return candidate
        return _norm(os.path.join(project_dir, rel_path))

    search_dirs = [project_dir, os.path.dirname(__file__)]

    nodes_file = resolve(files.get("nodes"), search_dirs)
    assumptions_file = resolve(files.get("design_assumptions"), search_dirs)
    analysis_results_file = resolve(files.get("analysis_results"), search_dirs)
    structural_report_file = resolve(files.get("structural_report"), search_dirs)
    struct_types_file = resolve(files.get("structural_types"), search_dirs)

    # Default structural_types relative to Structural Tools if not in project
    if not struct_types_file or not os.path.exists(struct_types_file):
        st_fallback = os.path.join(os.path.dirname(__file__), 'structural_types.json')
        if os.path.exists(st_fallback):
            struct_types_file = st_fallback

    if not nodes_file or not os.path.exists(nodes_file):
        print(f"Error: nodes file not found: {nodes_file}")
        sys.exit(1)
    if not assumptions_file or not os.path.exists(assumptions_file):
        print(f"Error: design_assumptions file not found: {assumptions_file}")
        sys.exit(1)

    output_dir_3dd = os.path.dirname(__file__)
    model_3dd = os.path.join(output_dir_3dd, "structural_model.3dd")

    print(f"Project: {proj.get('project_name', 'unknown')}")
    print(f"  Nodes: {nodes_file}")
    print(f"  Assumptions: {assumptions_file}")
    print(f"  Structural Types: {struct_types_file or '(none)'}")
    print(f"  Analysis Results: {analysis_results_file}")
    print(f"  Structural Report: {structural_report_file}")
    print()

    print(">>> 1. Extracting Architecture from ResPlan...")
    build_frame3dd_input(nodes_file, model_3dd, structural_types_file=struct_types_file)

    print("\n>>> 2. Simulating Frame3DD Structural Analysis...")
    if analysis_results_file:
        os.makedirs(os.path.dirname(analysis_results_file), exist_ok=True)

    generate_simulated_results(
        resplan_file=nodes_file,
        assumptions_file=assumptions_file,
        output_file=analysis_results_file or "resplan_analysis_results.json",
        struct_types_file=struct_types_file
    )

    print("\n>>> 3. Running SBC Selection Orchestrator...")
    run_orchestrator(
        mock_results_file=analysis_results_file or "resplan_analysis_results.json",
        assumptions_file=assumptions_file,
        output_file=structural_report_file or "structural_report.json"
    )

    print("\nDone! All pipeline steps completed.")

if __name__ == "__main__":
    main()
