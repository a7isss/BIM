# Data Models & Schemas

## 1. Architectural Input (`resplan_nodes.json`)
```json
{
    "nodes": [
        {"id": 1, "x": 0.0, "y": 0.0, "z": 0.0, "is_support": true}
    ],
    "elements": [
        {"id": "C1", "type": "column", "n1": 1, "n2": 5},
        {"id": "B1", "type": "beam", "n1": 5, "n2": 6}
    ],
    "slabs": [
        {"id": "S1", "type": "slab", "span_m": 4.0, "nodes": [5, 6, 8, 7]}
    ]
}
```

## 2. Engine Assumptions (`design_assumptions.json`)
```json
{
    "materials": {
        "fc_prime_mpa": 28,
        "fy_mpa": 420
    },
    "loads": {
        "live_load_knm2": 2.0,
        "superimposed_dead_knm2": 2.5
    },
    "soil": {
        "allowable_bearing_kpa": 150.0
    }
}
```

## 3. Structural Output (`resplan_analysis_results.json`)
Contains the verified sections appended to the elements.
```json
{
    "elements": [
        {
            "id": "C1",
            "type": "column",
            "section": "300x300",
            "rho": 0.015,
            "capacity_kn": 1250.0,
            "footing": "1.5x1.5x0.4m"
        }
    ]
}
```
