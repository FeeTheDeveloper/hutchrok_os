# Texas Comptroller Filing Handoff

This handoff prevents Secretary of State record work from being mistaken for a Comptroller franchise-tax update. It is a preparation checklist only and does not authorize Webfile access, signature, transmission, or payment.

## Decide whether a Comptroller handoff is required

Open a separate Comptroller work item when the requested correction concerns a taxpayer account, franchise-tax report, Public Information Report, Ownership Information Report, report year, ownership reporting, or new veteran-owned business qualification. Do not assume that an SOS filing updates every Comptroller field.

For each work item, bind the exact legal entity, taxpayer reference, report type, report year, requested result, and authorized person. Use a distinct browser session and a distinct packet digest from the SOS case.

## PIR and OIR routing

- Corporations, LLCs, limited partnerships, professional associations, and financial institutions generally use the Public Information Report when the current Comptroller rules require it.
- Other taxable entities generally use the Ownership Information Report when the current Comptroller rules require it.
- Each combined-group member may have its own reporting obligation.
- A no-tax-due position does not, by itself, remove a PIR or OIR requirement.
- Qualifying new veteran-owned businesses are listed by the Comptroller as not required to file a PIR or OIR during the initial five-year period.

Do not decide a current filing obligation from this summary alone. Verify the entity type, report year, tax status, and current official instructions.

## Veteran-owned business evidence

Treat veteran materials as restricted. Never commit a DD-214, Veteran Verification Letter, its unique code, Form 05-904 with signatures, or owner identity evidence to Git.

The current Comptroller guidance requires verification of the formation period, 100 percent ownership by qualifying honorably discharged veteran owners, a verification letter for each owner, and Form 05-904. Record the result as one of:

- `VERIFIED_APPLICABLE`
- `VERIFIED_NOT_APPLICABLE`
- `UNRESOLVED`

An SOS fee treatment and a Comptroller franchise-tax treatment are separate determinations. Never infer one from the other.

## Handoff packet

| Required item | Status |
| --- | --- |
| Exact legal entity name verified | `UNRESOLVED` |
| Comptroller taxpayer reference verified | `UNRESOLVED` |
| Report type and report year verified | `UNRESOLVED` |
| Authorized person verified | `UNRESOLVED` |
| Current filed report preserved | `UNRESOLVED` |
| Field change table complete | `UNRESOLVED` |
| Evidence map complete | `UNRESOLVED` |
| Tax effect reviewed by qualified person | `UNRESOLVED` |
| Veteran-owned status, if claimed, verified | `UNRESOLVED` |
| Clean unsigned review copy matches approved draft | `UNRESOLVED` |
| Exact packet digest approved | `NOT_GRANTED` |
| Human signature or certification completed | No |
| Human transmission completed | No |
| Receipt and agency result reconciled | No |

## Official sources checked 2026-10-07

- New veteran-owned businesses and Texas franchise tax: <https://comptroller.texas.gov/taxes/franchise/veteran-business.php>
- PIR and OIR filing requirements: <https://comptroller.texas.gov/taxes/franchise/pir-oir-filing-req.php>
- Texas Comptroller file and pay entry point: <https://comptroller.texas.gov/taxes/file-pay/>

Recheck official instructions for the specific report year immediately before preparation and again before a human submits.
