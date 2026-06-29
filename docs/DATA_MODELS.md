# Data Models & Schemas

## 1. Architectural Input (`resplan_nodes.json`)
```json
{
    "nodes": [
        {"id": "1719500000000", "x": 0.0, "y": 0.0, "z": -1.5, "is_support": true},
        {"id": "1719500000001", "x": 0.0, "y": 0.0, "z": 3.5, "is_support": false},
        {"id": "1719500000002", "x": 0.0, "y": 0.0, "z": 7.0, "is_support": false}
    ],
    "elements": [
        {"id": "1719500000100", "type": "column", "n1": "1719500000000", "n2": "1719500000001"},
        {"id": "1719500000101", "type": "beam", "n1": "1719500000001", "n2": "1719500000003"}
    ],
    "slabs": [
        {"id": "Slab_3.5_room1", "type": "slab", "span_m": 4.0, "z_elevation": 3.5, "bounding_beams": ["1719500000101"]}
    ],
    "footings": [
        {"id": "F_1719500000000", "type": "footing", "node_id": "1719500000000"}
    ]
}
```

## 2. Engine Assumptions (`design_assumptions.json`)
```json
{
    "materials": {
        "concrete_fc_MPa": 28,
        "steel_fy_MPa": 420,
        "concrete_density_kg_m3": 2400
    },
    "loads": {
        "residential_live_kN_m2": 2.0,
        "superimposed_dead_kN_m2": 2.5
    },
    "soil": {
        "allowable_bearing_kPa": 150.0
    }
}
```

## 3. Structural Output (`resplan_analysis_results.json` & `structural_report.json`)
Contains the verified sections appended to the elements.
```json
{
    "elements": [
        {
            "id": "1719500000100",
            "type": "column",
            "type_id": "C3_Tier3",
            "section": "200x300",
            "design_label": "C3",
            "actions": {
                "P_u_kN": 1250.0,
                "M_u_kNm": 45.0
            },
            "utilization": 0.85
        }
    ],
    "footings": [
        {
            "id": "F_1719500000000",
            "type": "footing",
            "type_id": "Iso_1500x1500x400",
            "section": "1500x1500x400",
            "design_label": "F2",
            "actions": {
                "P_service_kN": 850.0
            },
            "utilization": 0.75
        }
    ]
}
```
