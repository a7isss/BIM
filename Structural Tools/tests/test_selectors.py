import pytest
from column_selector import select_column
from beam_selector import select_beam
from footing_selector import select_footing
import os

def test_column_selector():
    lib_path = os.path.join(os.path.dirname(__file__), "..", "columns_library.json")
    col = select_column(1000.0, 50.0, library_file=lib_path)
    assert col is not None
    assert "utilization" in col
    assert col["utilization"] <= 1.0

    col_impossible = select_column(999999.0, 999999.0, library_file=lib_path)
    assert col_impossible is None

def test_column_interaction_selector():
    lib_path = os.path.join(os.path.dirname(__file__), "..", "columns_library.json")
    # Pure axial
    col1 = select_column(1500.0, 0.0, library_file=lib_path)
    assert col1 is not None
    # Pure moment
    col2 = select_column(0.0, 100.0, library_file=lib_path)
    assert col2 is not None

def test_beam_selector():
    lib_path = os.path.join(os.path.dirname(__file__), "..", "beams_library.json")
    beam = select_beam(100.0, 50.0, library_file=lib_path)
    assert beam is not None
    assert beam["phi_Mn_kNm"] >= 100.0
    assert beam["phi_Vn_kN"] >= 50.0

    beam_impossible = select_beam(999999.0, 999999.0, library_file=lib_path)
    assert beam_impossible is None

def test_footing_selector():
    lib_path = os.path.join(os.path.dirname(__file__), "..", "footings_library.json")
    footing = select_footing(500.0, 20.0, 300, 200.0, library_file=lib_path)
    assert footing is not None
    assert footing["q_max_kPa"] <= 200.0
    assert footing["phi_Vc2_kN"] >= 500.0

    footing_impossible = select_footing(999999.0, 999999.0, 300, 200.0, library_file=lib_path)
    assert footing_impossible is None
