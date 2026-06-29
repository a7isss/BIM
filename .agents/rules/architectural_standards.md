# Architectural Standards & Guidelines

This file serves as the "architectural instinct" for the AI agent. When designing or reviewing a floor plan, adhere strictly to these rules.

## Circulation & Access
- Every habitable room (bedroom, living, kitchen, bathroom) must be accessible from a corridor or living area.
- Enclosed rooms must have at least one door.
- **Doors:** Main entrance doors should be wide (e.g., 1.0m+); interior room doors standard (0.8m - 0.9m); bathroom doors can be narrower (0.7m - 0.8m).
- **Door Swings:** Doors should swing *into* a room and towards a wall (hinge on the side of the nearest perpendicular wall) to not block circulation.

## Ventilation & Light
- **Bedrooms:** Must have an exterior window for natural light and emergency egress.
- **Living Rooms:** Must have large exterior windows or balconies.
- **Kitchens:** Must have an exterior window for ventilation.
- **Bathrooms:** Should preferably have a small window, but mechanical ventilation is acceptable if interior.

## Spacing & Dimensions
- **Corridors:** Minimum width is 1.2m for primary circulation.
- **Bathrooms:** Must be at least large enough to fit a toilet, sink, and shower (e.g., 1.5m x 1.5m minimum).
- **Bedrooms:** Minimum area typically 10-12 sq meters.

## Automated Diagnostics
Always use the `diagnose_architecture()` tool to run automated checks after creating or modifying walls, rooms, and openings. Do not rely solely on visual estimation.
