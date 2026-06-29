import pytest
import json
import os
import sys

# Add the Structural Tools directory to sys.path so tests can import from it
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

@pytest.fixture(scope="session")
def design_assumptions():
    assumptions_file = os.path.join(os.path.dirname(__file__), "..", "design_assumptions.json")
    with open(assumptions_file, 'r') as f:
        return json.load(f)

@pytest.fixture(scope="session")
def columns_library():
    lib_file = os.path.join(os.path.dirname(__file__), "..", "columns_library.json")
    with open(lib_file, 'r') as f:
        return json.load(f)

@pytest.fixture(scope="session")
def beams_library():
    lib_file = os.path.join(os.path.dirname(__file__), "..", "beams_library.json")
    with open(lib_file, 'r') as f:
        return json.load(f)

@pytest.fixture(scope="session")
def slabs_library():
    lib_file = os.path.join(os.path.dirname(__file__), "..", "slabs_library.json")
    with open(lib_file, 'r') as f:
        return json.load(f)

@pytest.fixture(scope="session")
def footings_library():
    lib_file = os.path.join(os.path.dirname(__file__), "..", "footings_library.json")
    with open(lib_file, 'r') as f:
        return json.load(f)
