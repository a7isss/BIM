import pytest
import json
import os
import sys
import tempfile

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from geometry_to_frame3dd import build_frame3dd_input, _get_section_props, _elem_bh

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


def test_get_section_props_default():
    sec = _get_section_props(0.3, 0.3)
    assert sec["Ax"] == pytest.approx(0.09)
    assert sec["Iyy"] > 0
    assert sec["Izz"] > 0


def test_get_section_props_zero_fallback():
    sec = _get_section_props(0, 0)
    assert sec["Ax"] == pytest.approx(0.09)


def test_elem_bh_from_element():
    el = {"type": "column", "b": 0.4, "h": 0.6}
    b, h = _elem_bh(el, {})
    assert (b, h) == (0.4, 0.6)


def test_elem_bh_from_type_map():
    el = {"type": "column", "type_id": "C1"}
    tm = {"C1": {"b": 0.5, "h": 0.5}}
    b, h = _elem_bh(el, tm)
    assert (b, h) == (0.5, 0.5)


def test_elem_bh_default():
    el = {"type": "beam"}
    b, h = _elem_bh(el, {})
    assert (b, h) == (0.2, 0.5)


def test_elem_bh_default_column():
    el = {"type": "column"}
    b, h = _elem_bh(el, {})
    assert (b, h) == (0.3, 0.3)


def test_elem_bh_default_footing():
    el = {"type": "footing"}
    b, h = _elem_bh(el, {})
    assert (b, h) == (0.3, 0.3)


def test_build_columns_and_beams():
    data = _make_data(elements=[
        {"id": "C1", "type": "column", "n1": 1, "n2": 3, "b": 0.3, "h": 0.3},
        {"id": "B1", "type": "beam", "n1": 3, "n2": 4, "b": 0.2, "h": 0.5},
    ])

    with tempfile.TemporaryDirectory() as tmp:
        inp = os.path.join(tmp, "nodes.json")
        out = os.path.join(tmp, "model.3dd")
        with open(inp, 'w') as f:
            json.dump(data, f)

        build_frame3dd_input(inp, out)

        assert os.path.exists(out)
        with open(out, 'r') as f:
            content = f.read()

        assert "2  # Number of Frame Elements" in content
        assert "4  # Number of Nodes" in content
        assert "0.09" in content or "0.09" in content  # Ax for column 0.3x0.3


def test_build_with_footing():
    data = _make_data(elements=[
        {"id": "F1", "type": "footing", "n1": 1, "b": 0.3, "h": 0.3},
    ])

    with tempfile.TemporaryDirectory() as tmp:
        inp = os.path.join(tmp, "nodes.json")
        out = os.path.join(tmp, "model.3dd")
        with open(inp, 'w') as f:
            json.dump(data, f)

        build_frame3dd_input(inp, out)

        with open(out, 'r') as f:
            content = f.read()

        # Footing should create a frame element + virtual ground node
        # 4 original nodes + 1 virtual ground = 5 nodes, 1 frame element
        assert "1  # Number of Frame Elements" in content
        assert "5  # Number of Nodes" in content

        # Verify the virtual ground node exists at z=0 with same x,y as node 1
        assert "0.000   0.000   0.000" in content


def test_build_with_slab_nodes():
    data = _make_data(
        nodes=[
            {"id": "N1", "x": 0, "y": 0, "z": 0, "is_support": False},
            {"id": "N2", "x": 5, "y": 0, "z": 0, "is_support": False},
        ],
        elements=[
            {"id": "B1", "type": "beam", "n1": "N1", "n2": "N2", "b": 0.2, "h": 0.5},
        ],
        slabs=[
            {"id": "S1", "nodes": ["N1", "N2", "N3", "N4"]},
        ]
    )

    with tempfile.TemporaryDirectory() as tmp:
        inp = os.path.join(tmp, "nodes.json")
        out = os.path.join(tmp, "model.3dd")
        with open(inp, 'w') as f:
            json.dump(data, f)

        build_frame3dd_input(inp, out)

        with open(out, 'r') as f:
            content = f.read()

        # Should have N1, N2 (original) + N3, N4 (auto-added from slab)
        assert "4  # Number of Nodes" in content


def test_string_node_ids():
    data = _make_data(
        nodes=[
            {"id": "node_a", "x": 0, "y": 0, "z": 0, "is_support": True},
            {"id": "node_b", "x": 5, "y": 0, "z": 0, "is_support": True},
        ],
        elements=[
            {"id": "COL1", "type": "column", "n1": "node_a", "n2": "node_b", "b": 0.3, "h": 0.3},
        ]
    )

    with tempfile.TemporaryDirectory() as tmp:
        inp = os.path.join(tmp, "nodes.json")
        out = os.path.join(tmp, "model.3dd")
        with open(inp, 'w') as f:
            json.dump(data, f)

        build_frame3dd_input(inp, out)

        with open(out, 'r') as f:
            content = f.read()

        # Should use sequential IDs (1, 2, etc.) not string IDs
        assert "1  # Number of Frame Elements" in content


def test_missing_resplan_file(capsys):
    with tempfile.TemporaryDirectory() as tmp:
        inp = os.path.join(tmp, "nope.json")
        out = os.path.join(tmp, "model.3dd")
        build_frame3dd_input(inp, out)
        captured = capsys.readouterr()
        assert "Error" in captured.out
