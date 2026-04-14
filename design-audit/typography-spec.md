# Typography Spec (Reusable)

## Baseline

- Font family: `var(--font-apple)`
- Unit display in docs: `px (rem)` for every text token.
- Scope: all app text, including modal/drawer/expandable content.

## Canonical Roles

1. `typo-section-heading`: `40px (2.5rem) / 600 / 1.10`
2. `typo-title-heading`: `28px (1.75rem) / 700 / 1.14`
3. `typo-card-title-bold`: `21px (1.313rem) / 700 / 1.19`
4. `typo-card-title`: `21px (1.313rem) / 400 / 1.19`
5. `typo-body`: `17px (1.063rem) / 400 / 1.47`
6. `typo-body-emphasis`: `17px (1.063rem) / 600 / 1.24`
7. `typo-link`: `14px (0.875rem) / 400 / 1.43`
8. `typo-micro`: `12px (0.75rem) / 400 / 1.33`

## Governance

- New UI must use semantic classes first.
- Raw `text-[xxpx]` is allowed only during migration.
- Audit page marks out-of-system sizes as `待收敛`.
- Converge by batch instead of full rewrite in one pass.
