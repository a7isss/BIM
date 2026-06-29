# Structural Assumptions & SBC Heuristics

All code logic must adhere to the following deterministic rules to avoid AI hallucination:

## Concrete Design (SBC 304 / ACI 318)
1. **Column Capacities**: Calculated explicitly as $P_n = 0.80 \times [0.85 f'_c (A_g - A_{st}) + f_y A_{st}]$.
2. **Phi Factor**: $\phi = 0.65$ (Tied columns).
3. **Reinforcement Ratio**: $\rho$ bounded strictly between 1% and 4%.

## Slabs
1. **One-Way Solid Slabs**: $h_{min} = L / 24$ (One end continuous) or $L / 28$ (Both ends continuous).
2. **Ribbed Slabs**: Utilized when span exceeds 5.0m to reduce dead weight, adhering to SBC joist geometric constraints.

## Foundations
1. **Isolated Footings**: Area = $P / q_{all}$. Dimensions are rounded up to the nearest 100mm.
2. **Thickness**: Minimum thickness for shear is typically 400mm for residential.
