import pytest
import os
import subprocess

def test_pipeline_smoke():
    cwd = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
    result = subprocess.run(
        ['python', 'run_e2e_flow.py'],
        cwd=cwd,
        capture_output=True,
        text=True
    )
    
    print("STDOUT:", result.stdout)
    print("STDERR:", result.stderr)
    
    assert result.returncode == 0
    
    project_dir = os.path.abspath(os.path.join(cwd, '..', 'Projects', 'Sample Project'))
    results_file = os.path.join(project_dir, "outputs", "resplan_analysis_results.json")
    report_file = os.path.join(project_dir, "outputs", "structural_report.json")
    
    assert os.path.exists(results_file)
    assert os.path.exists(report_file)
