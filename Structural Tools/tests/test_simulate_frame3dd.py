import pytest
import json
import os
import sys
import tempfile

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from simulate_frame3dd_analysis import generate_simulated_results

SAMPLE_ASSUMPTIONS = {
    "materials": {"concrete_fc_MPa": 28.0, "steel_fy_MPa": 420.0, "soil_q_all_kPa": 200.0},
    "loads": {"residential_live_load_kN_m2": 2.0, "superimposed_dead_load_kN_m2": 2.5, "wind_pressure_kPa": 0.5},
    "factors": {"phi_flexure": 0.9, "phi_shear": 0.75},
    "analysis": {"default_bay_width_m": 3.0, "wall_thickness_m": 0.2, "wall_density_kN_m3": 18.0},
}

SAMPLE_NODES = [
    {"id": 1, "x": 0.0, "y": 0.0, "z": 0.0, "is_support": True},
    {"id": 2, "x": 5.0, "y": 0.0, "z": 0.0, "is_support": True},
    {"id": 3, "x": 0.0, "y": 4.0, "z": 3.0, "is_support": False},
    {"id": 4, "x": 5.0, "y": 4.0, "z": 3.0, "is_support": False},
]


def _make_data(nodes=None, elements=None, slabs=None):
    return {
        "nodes": nodes or SAMPLE_NODES,
        "elements": elements or [],
        "slabs": slabs or [],
    }


def test_beam_analysis():
    data = _make_data(elements=[
        {"id": "B1", "type": "beam", "n1": 1, "n2": 2},
    ])

    with tempfile.TemporaryDirectory() as tmp:
        node_f = os.path.join(tmp, "nodes.json")
        asm_f = os.path.join(tmp, "assumptions.json")
        out_f = os.path.join(tmp, "results.json")
        with open(node_f, 'w') as f:
            json.dump(data, f)
        with open(asm_f, 'w') as f:
            json.dump(SAMPLE_ASSUMPTIONS, f)

        generate_simulated_results(node_f, asm_f, out_f)

        assert os.path.exists(out_f)
        with open(out_f, 'r') as f:
            res = json.load(f)
        elems = res["elements"]
        beams = [e for e in elems if e["type"] == "beam"]
        assert len(beams) == 1
        assert beams[0]["id"] == "B1"
        assert "actions" in beams[0]
        assert "U" in beams[0]["actions"]


def test_column_analysis():
    data = _make_data(elements=[
        {"id": "C1", "type": "column", "n1": 1, "n2": 3},
    ])

    with tempfile.TemporaryDirectory() as tmp:
        node_f = os.path.join(tmp, "nodes.json")
        asm_f = os.path.join(tmp, "assumptions.json")
        out_f = os.path.join(tmp, "results.json")
        with open(node_f, 'w') as f:
            json.dump(data, f)
        with open(asm_f, 'w') as f:
            json.dump(SAMPLE_ASSUMPTIONS, f)

        generate_simulated_results(node_f, asm_f, out_f)

        with open(out_f, 'r') as f:
            res = json.load(f)
        cols = [e for e in res["elements"] if e["type"] == "column"]
        assert len(cols) == 1
        assert cols[0]["id"] == "C1"
        assert cols[0]["height_m"] == pytest.approx(3.0, rel=0.1)


def test_footing_analysis():
    data = _make_data(elements=[
        {"id": "F1", "type": "footing", "n1": 1},
    ])

    with tempfile.TemporaryDirectory() as tmp:
        node_f = os.path.join(tmp, "nodes.json")
        asm_f = os.path.join(tmp, "assumptions.json")
        out_f = os.path.join(tmp, "results.json")
        with open(node_f, 'w') as f:
            json.dump(data, f)
        with open(asm_f, 'w') as f:
            json.dump(SAMPLE_ASSUMPTIONS, f)

        generate_simulated_results(node_f, asm_f, out_f)

        with open(out_f, 'r') as f:
            res = json.load(f)
        footings = [e for e in res["elements"] if e["type"] == "footing"]
        assert len(footings) == 1
        assert footings[0]["id"] == "F1"
        assert "estimated_B_m" in footings[0]
        assert footings[0]["estimated_B_m"] > 0


def test_slab_with_default_span():
    data = _make_data(slabs=[
        {"id": "S1", "type": "slab"},
    ])

    with tempfile.TemporaryDirectory() as tmp:
        node_f = os.path.join(tmp, "nodes.json")
        asm_f = os.path.join(tmp, "assumptions.json")
        out_f = os.path.join(tmp, "results.json")
        with open(node_f, 'w') as f:
            json.dump(data, f)
        with open(asm_f, 'w') as f:
            json.dump(SAMPLE_ASSUMPTIONS, f)

        generate_simulated_results(node_f, asm_f, out_f)

        with open(out_f, 'r') as f:
            res = json.load(f)
        slabs_out = [e for e in res["elements"] if e["type"] == "slab"]
        assert len(slabs_out) == 1
        # Should default to 4.0 when span_m missing
        assert slabs_out[0]["span_m"] == 4.0
        assert slabs_out[0]["required_load_kN_m2"] > 0


def test_slab_with_explicit_span():
    data = _make_data(slabs=[
        {"id": "S2", "type": "slab", "span_m": 6.0},
    ])

    with tempfile.TemporaryDirectory() as tmp:
        node_f = os.path.join(tmp, "nodes.json")
        asm_f = os.path.join(tmp, "assumptions.json")
        out_f = os.path.join(tmp, "results.json")
        with open(node_f, 'w') as f:
            json.dump(data, f)
        with open(asm_f, 'w') as f:
            json.dump(SAMPLE_ASSUMPTIONS, f)

        generate_simulated_results(node_f, asm_f, out_f)

        with open(out_f, 'r') as f:
            res = json.load(f)
        slabs_out = [e for e in res["elements"] if e["type"] == "slab"]
        assert slabs_out[0]["span_m"] == 6.0


def test_full_pipeline_integration():
    data = _make_data(
        elements=[
            {"id": "C1", "type": "column", "n1": 1, "n2": 3},
            {"id": "C2", "type": "column", "n1": 2, "n2": 4},
            {"id": "B1", "type": "beam", "n1": 3, "n2": 4},
        ],
        slabs=[
            {"id": "S1", "type": "slab", "span_m": 4.0, "nodes": [3, 4, 2, 1]},
        ]
    )

    with tempfile.TemporaryDirectory() as tmp:
        node_f = os.path.join(tmp, "nodes.json")
        asm_f = os.path.join(tmp, "assumptions.json")
        out_f = os.path.join(tmp, "results.json")
        with open(node_f, 'w') as f:
            json.dump(data, f)
        with open(asm_f, 'w') as f:
            json.dump(SAMPLE_ASSUMPTIONS, f)

        generate_simulated_results(node_f, asm_f, out_f)

        with open(out_f, 'r') as f:
            res = json.load(f)

        types = {e["type"] for e in res["elements"]}
        assert "beam" in types
        assert "column" in types
        assert "slab" in types

        beams = [e for e in res["elements"] if e["type"] == "beam"]
        cols = [e for e in res["elements"] if e["type"] == "column"]
        slabs_out = [e for e in res["elements"] if e["type"] == "slab"]
        assert len(beams) >= 1
        assert len(cols) >= 1
        assert len(slabs_out) >= 1


def test_missing_nodes_file(capsys):
    with tempfile.TemporaryDirectory() as tmp:
        generate_simulated_results(
            resplan_file=os.path.join(tmp, "nope.json"),
            assumptions_file=os.path.join(tmp, "nope.json"),
            output_file=os.path.join(tmp, "out.json"),
        )
        captured = capsys.readouterr()
        assert "Error" in captured.out


def test_missing_assumptions_file(capsys):
    with tempfile.TemporaryDirectory() as tmp:
        node_f = os.path.join(tmp, "nodes.json")
        with open(node_f, 'w') as f:
            json.dump(_make_data(), f)
        generate_simulated_results(
            resplan_file=node_f,
            assumptions_file=os.path.join(tmp, "nope.json"),
            output_file=os.path.join(tmp, "out.json"),
        )
        captured = capsys.readouterr()
        assert "Error" in captured.out
