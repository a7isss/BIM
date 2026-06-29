# SBC 301-2018 Design Loads Reference
> Saudi Building Code — Structural Loading Requirements for Residential Buildings  
> Used by: `simulate_frame3dd_analysis.py`, `sbc_load_combinations.py`, `frame3dd_orchestrator.py`

---

## 1. Gravity Loads — Floor Slabs

### Dead Loads (kN/m²)
| Item | Value (kN/m²) | Notes |
|------|--------------|-------|
| RC Slab self-weight (150mm) | 3.75 | 25 kN/m³ × 0.15m |
| RC Slab self-weight (200mm) | 5.00 | 25 kN/m³ × 0.20m |
| Superimposed Dead (SDL) — floor finish, screed, MEP | **1.50** | Tile + screed + MEP |
| Partition allowance (movable) | **0.75** | SBC 301 §4.3.2 min |
| **Total SDL (use in analysis)** | **2.25** | SDL + Partitions |

### Live Loads — SBC 301 Table 4-1 (kN/m²)
| Space | LL (kN/m²) |
|-------|-----------|
| Bedrooms / private rooms | **2.0** |
| Living rooms, lounges | **2.0** |
| Kitchens | **3.0** |
| Bathrooms | **2.0** |
| Corridors, stairs (above ground floor) | **4.0** |
| Roof (non-accessible) | **1.0** |
| Roof garden / accessible roof | **4.8** |
| Balconies | **4.0** |
| Garage (private residential) | **2.5** |

---

## 2. Gravity Loads — Roof Slab

| Item | Value (kN/m²) |
|------|--------------|
| Roof self-weight (RC 150mm) | 3.75 |
| Waterproofing + insulation + screed | **1.50** |
| Roof live load (non-accessible) | **1.00** |
| Roof garden (if applicable) | **4.80** |

---

## 3. Wall Loads on Beams

| Wall Type | Density (kN/m³) | Thickness (m) | Height factor |
|-----------|----------------|---------------|---------------|
| Hollow block masonry | 14.0 | 0.20 | Full storey - beam depth |
| Solid brick masonry | 18.0 | 0.20 | Full storey - beam depth |
| Lightweight block | 10.0 | 0.15 | Full storey - beam depth |

**Formula:**  
`w_wall = density × thickness × effective_wall_height (kN/m)`  
Effective wall height = `floor_height - beam_depth` (no double-counting of beam self-weight)

---

## 4. Load Combinations — SBC 301-2018 §2.3 (Strength Design / LRFD)

| Combo | Formula | Controls |
|-------|---------|---------|
| 1 | `1.4D` | Self-weight only |
| 2 | `1.2D + 1.7L + 0.5Lr` | Gravity dominant |
| 3 | `1.2D + 1.6Lr + (L or 0.5W)` | Roof + gravity |
| **4** | **`1.2D + 1.0W + L + 0.5Lr`** | **Wind + gravity (governs MWFRS)** |
| 5 | `1.2D + 1.0E + L` | Seismic |
| 6 | `0.9D + 1.0W` | Uplift check |
| 7 | `0.9D + 1.0E` | Seismic uplift |

> **Current implementation:** Using combos 1, 2, and 4. Seismic (E) not yet implemented.

---

## 5. Wind Loads — SBC 301 Chapter 26-27 (ASCE 7-based)

### CRITICAL: What gets wind loads and what does NOT

| Element | Wind Load Applied? | How |
|---------|-------------------|-----|
| External wall panels / cladding | YES | Component and cladding pressure |
| Roof slab / beams | YES | Uplift and drag |
| MWFRS (shear walls, moment frames) | YES | Lateral force from diaphragm |
| **Internal floor beams** | **NO** | Not a direct wind surface — gravity only |
| **Internal floor slabs** | **NO** | Acts as diaphragm, not a wind surface |
| **Columns** | Lateral only | Wind transferred via floor diaphragms per storey |

### Wind Moment on Columns — Correct Approach

Wind moment must come from **storey shear** allocated from MWFRS, not direct surface pressure:

```
V_storey_wind = q_z × Cd × A_tributary_facade   [kN per storey]
M_column_wind = V_storey_wind × h_storey / n_columns_in_line
```

Where:
- `q_z` = design wind pressure (kPa) — see table below
- `Cd` = 1.3 for solid rectangular building faces
- `A_tributary_facade` = storey_height × bay_tributary_width
- `n_columns_in_line` = columns sharing lateral load in that frame line

### Design Wind Pressures — Riyadh (SBC 301, Exposure Category C, V=40 m/s)
| Height Zone | q_z (kPa) |
|-------------|-----------|
| 0–9m | **0.51** |
| 9–15m | **0.58** |
| 15–25m | **0.73** |

> For 2-storey residential (max ~8m to roof): Use q_z = 0.51 kPa

---

## 6. Seismic Loads — SBC 301 Chapter 11 (Not Yet Implemented)

> Riyadh is Seismic Zone 1 (low to moderate).
> Ss ≈ 0.15g, S1 ≈ 0.06g — wind typically governs over seismic for low-rise residential.

---

## 7. Soil / Footing

| Parameter | Value | Source |
|-----------|-------|--------|
| Allowable bearing pressure q_all | **150 kPa** | Default for sandy soil (Riyadh plains) |
| Concrete density | 25 kN/m³ | |
| Soil density (backfill) | 18 kN/m³ | |

---

## 8. Material Strengths (Used in Selector Libraries)

| Material | Value |
|----------|-------|
| Concrete compressive strength f'c | **28 MPa** (C28) |
| Rebar yield strength fy | **420 MPa** (Grade 60) |
| Min steel ratio rho_min (beams) | 0.0033 |
| Max steel ratio rho_max (beams) | 0.0181 |
| Min reinforcement ratio rho_min (columns) | 0.01 |
| Max reinforcement ratio rho_max (columns) | 0.08 |

---

## 9. Current Simulator vs. SBC — Gap Log

| Item | Current Code | SBC Correct | Action |
|------|-------------|-------------|--------|
| Floor live load | 2.0 kN/m² flat | Per space type Table 4-1 | TODO: Use room-type LL |
| SDL | 2.0 kN/m² | 2.25 kN/m² (incl. partitions) | Minor update |
| Load combo beams | 1.2D + 1.6L | Correct for gravity | OK |
| Wind on columns | Capped at 30% gravity×h | Should use storey shear | TODO: Implement MWFRS allocation |
| Wind on beams | Not applied | Correct — gravity only | OK |
| Wind on slabs | Not applied | Correct — gravity only | OK |
| Seismic | Not implemented | Low priority — Riyadh Zone 1 | Future |

---

*Reference: SBC 301-2018 (Load & Forces), aligned with ASCE 7-16*
*Last updated: 2026-06-29*
