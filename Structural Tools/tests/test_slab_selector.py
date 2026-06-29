import pytest
import os
from slab_selector import select_slab

def test_slab_selector_strength():
    lib_path = os.path.join(os.path.dirname(__file__), "..", "slabs_library.json")
    
    # Normal demand (say 4m span, 10 kN/m2 load)
    slab_normal = select_slab(4.0, 10.0, library_file=lib_path)
    assert slab_normal is not None
    assert "utilization" in slab_normal
    assert slab_normal["utilization"] <= 1.0
    
    # Extreme demand (say 4m span, 1000 kN/m2 load) 
    # This will pass the simple span/depth deflection check for some slabs,
    # but must fail the new strength checks for all slabs.
    slab_fail_strength = select_slab(4.0, 1000.0, library_file=lib_path)
    assert slab_fail_strength is None
