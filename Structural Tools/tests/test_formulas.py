import pytest
import math

def test_column_axial_capacity(columns_library, design_assumptions):
    fc = design_assumptions["materials"]["concrete_fc_MPa"]
    fy = design_assumptions["materials"]["steel_fy_MPa"]
    phi = design_assumptions["factors"]["phi_axial_tied"]
    
    col = columns_library[0]
    tier = col["tiers"][0]
    
    b = col["b_mm"]
    h = col["h_mm"]
    Ag = b * h
    As = tier["As_mm2"]
    
    Pn_N = 0.80 * (0.85 * fc * (Ag - As) + fy * As)
    expected_phi_Pn_kN = round((phi * Pn_N) / 1000.0, 1)
    
    assert tier["phi_Pn_kN"] == expected_phi_Pn_kN

def test_slab_shear_capacity(slabs_library, design_assumptions):
    fc = design_assumptions["materials"]["concrete_fc_MPa"]
    phi_shear = design_assumptions["factors"]["phi_shear"]
    
    slab = slabs_library[0]
    h = slab["h_mm"]
    d = h - 25.0
    
    Vc_N = 0.17 * math.sqrt(fc) * 1000.0 * d
    expected_phi_Vc_kN = round((phi_shear * Vc_N) / 1000.0, 1)
    
    assert slab["phi_Vc_kN_per_m"] == expected_phi_Vc_kN

def test_slab_flexure_capacity(slabs_library, design_assumptions):
    fc = design_assumptions["materials"]["concrete_fc_MPa"]
    
    slab = slabs_library[0]
    h = slab["h_mm"]
    
    fr = 0.62 * math.sqrt(fc) # MPa
    Ig = (1000.0 * h**3) / 12.0
    yt = h / 2.0
    Mcr_Nmm = (fr * Ig) / yt
    expected_Mcr_kNm = round(Mcr_Nmm / 1e6, 1)
    
    assert slab["Mcr_kNm_per_m"] == expected_Mcr_kNm
