# Structural Refinement Plan

Provide a brief description of the problem, any background context, and what the change accomplishes.

## User Review Required

Document anything that requires user review or feedback, for example, breaking changes or significant design decisions. Use GitHub alerts (IMPORTANT/WARNING/CAUTION) to highlight critical items.

## Open Questions

Any clarifying or design questions for the user that will impact the implementation plan. Use GitHub alerts (IMPORTANT/WARNING/CAUTION) to highlight critical items.

## Proposed Changes

### `create_family_types.py`
Add logic to ensure the new structural types exist:
- **Columns**: `200x400mm`
- **Beams**: `200x500mm`
- **Footings**: Ensure isolated rectangular footings can be referenced, usually checking `M_Footing-Rectangular` with dimensions like `1200x1200x400mm`.

### `structure.py`
- Modify column placement logic to select `200x400mm` types.
- Modify beam placement logic to select `200x500mm` types.
- Add logic to place isolated footings (`M_Footing-Rectangular`) at the base of every structural column (typically 2.0m below Level 1). Use `placeFamilyInstance` as it's the robust method for placing isolated footings.

## Verification Plan

Summary of how you will verify that your changes have the desired effects.

### Automated Tests
- N/A

### Manual Verification
- Run the structural generation workflow.
- Inspect the Revit model to ensure beams and columns have the new dimensions.
- Confirm that footings appear at the base of columns.
