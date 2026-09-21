# Public data policy

The website is a public representation of a private travel-operations project. It publishes only planning data that is useful for understanding the route and methodology.

## Public
- country and segment sequence
- planned dates
- transport modes and corridors
- modeled costs
- readiness / alert classifications
- visa and health planning classifications
- alternatives and methodological notes
- source URLs and verification dates

## Private by design
- PNR / ticket references
- actual payment and account data
- passport details
- private insurance identifiers
- personal contact information
- secure document paths
- card/bank limits and liquidity

The public data file must be regenerated from a sanitized export, never copied wholesale from the private operations workbook.


## Traveller Context

The optional Traveller Context stores only planning preferences needed to avoid a one-country viewpoint: passport country, residence country, interface language, preferred currency, origin, party counts and a reduced-mobility preference. The current static implementation stores this only in the browser's local storage and does not publish it in route data.

Never request or persist passport numbers, exact home addresses, booking references, payment details, identity-document scans or similar secrets in Traveller Context.
