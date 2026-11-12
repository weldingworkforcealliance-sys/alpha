# Level I Project Matrix - Standalone Tower

This build expands the standalone AWS SENSE Tower using the Level I practical position requirements in the supplied AWS guide.

## Welding projects loaded

The tower now contains **79 welding-position projects** across these Level I process/material tracks:

- SMAW - carbon steel
  - Fillet: 1F, 2F, 3F, 4F
  - Groove: 1G, 2G, 3G, 4G
- GMAW-S - carbon steel
  - Fillet: 1F, 2F, 3F, 4F
  - Groove: 1G, 2G, 3G, 4G
- GMAW Spray - carbon steel
  - Fillet: 1F, 2F
  - Groove: 1G
- FCAW-G - carbon steel
  - Fillet: 1F, 2F, 3F, 4F
  - Groove: 1G, 2G, 3G, 4G
- FCAW-S - carbon steel
  - Fillet: 1F, 2F, 3F, 4F
  - Groove: 1G, 2G, 3G, 4G
- GTAW - carbon steel
  - Fillet: 1F, 2F, 3F, 4F
  - Groove: 1G, 2G, 3G, 4G
- GTAW - austenitic stainless steel
  - Fillet: 1F, 2F, 3F
  - Groove: 1G, 2G, 3G, 4G
- GTAW - aluminum
  - Fillet: 1F, 2F
  - Groove: 1G

## PCCC groove qualification split

For the standalone PCCC qualification workflow, every source-supported groove position is represented twice:

1. **Backing**
2. **No Backing**

This Backing / No Backing split is a PCCC tracking structure requested for the grade/qualification tower. It should not be presented as if AWS itself defines every one of these position records as a separate official SENSE certification test.

The official AWS Level I performance-test records remain preserved separately in the tower.

## Cutting project shells

The build also lists seven Level I cutting project shells derived from the Level I practical competencies:

- OFC straight square-edge cutting
- OFC shape square-edge cutting
- OFC straight bevel-edge cutting
- OFC scarfing / gouging
- PAC straight square-edge cutting
- PAC shape square-edge cutting
- CAC-A scarfing / gouging

These are not yet assigned the five-category weld rubric because that rubric is specific to weld quality. A separate cutting rubric should be approved before numeric grading is enabled.

## Gradebook usability safeguard

The class gradebook no longer tries to show every Level I project as a column.

When an instructor is grading one project group, the overview shows only its sibling positions. Example:

SMAW -> Groove -> Backing

shows:

1G | 2G | 3G | 4G

This keeps the accelerated-class workflow usable instead of turning the gradebook into a horizontal geological era.
