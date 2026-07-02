import pytest
import os
import subprocess
import json

def _repo_root():
    return os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))

def test_pipeline_smoke():
    cwd = _repo_root()
    sample_project = os.path.abspath(os.path.join(cwd, '..', 'Projects', 'Sample Project', 'project.json'))

    # Ensure sample project has structural elements seeded
    nodes_path = os.path.join(os.path.dirname(sample_project), 'resplan_nodes.json')
    with open(nodes_path, 'r') as f:
        data = json.load(f)

    if not data.get('elements'):
        # Seed minimal structural data for testing
        data['elements'] = [
            {"id": "C1", "type": "column", "n1": data['nodes'][0]['id'], "n2": data['nodes'][3]['id'], "b": 0.3, "h": 0.3},
            {"id": "B1", "type": "beam", "n1": data['nodes'][0]['id'], "n2": data['nodes'][1]['id'], "b": 0.2, "h": 0.5},
        ]
        with open(nodes_path, 'w') as f:
            json.dump(data, f, indent=4)

    result = subprocess.run(
        ['python', 'run_e2e_flow.py', sample_project],
        cwd=cwd,
        capture_output=True,
        text=True
    )

    print("STDOUT:", result.stdout)
    if result.stderr:
        print("STDERR:", result.stderr)

    assert result.returncode == 0, f"Pipeline failed: {result.stderr}"

    project_dir = os.path.dirname(sample_project)
    results_file = os.path.join(project_dir, "output", "resplan_analysis_results.json")
    report_file = os.path.join(project_dir, "output", "structural_report.json")

    assert os.path.exists(results_file), f"Missing: {results_file}"
    assert os.path.exists(report_file), f"Missing: {report_file}"

    # Verify output content
    with open(results_file, 'r') as f:
        r = json.load(f)
    assert len(r.get("elements", [])) > 0

    with open(report_file, 'r') as f:
        rpt = json.load(f)
    assert len(rpt.get("elements", [])) > 0
