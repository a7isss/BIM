import pytest
from sbc_load_combinations import generate_sbc_combinations

def test_load_combinations():
    actions = {
        "D": {"P": 100.0, "M": 50.0, "V": 10.0},
        "L": {"P": 50.0, "M": 20.0, "V": 5.0},
        "W": {"P": 0.0, "M": 100.0, "V": 20.0}
    }
    
    envelopes = generate_sbc_combinations(actions)
    
    # Combo 2: 1.2D + 1.6L = 1.2(100) + 1.6(50) = 200.0
    assert envelopes["Pu"] == 200.0
    assert envelopes["governing_P_combo"] == "1.2D + 1.6L + 0.5Lr"
    
    # Combo 4: 1.2D + 1.0W + L + 0.5Lr = 1.2(50) + 1.0(100) + 1.0(20) = 180.0
    assert envelopes["Mu"] == 180.0
    assert envelopes["governing_M_combo"] == "1.2D + 1.0W + L + 0.5Lr"
