# FitMap Dependency Auditing (INFRA-01)

## Scope

Requirement: NFR-SEC-011 (High).

Dependency auditing complements the existing secret scanning,
automated tests and backend container validation.

The CI workflow audits committed dependency resolutions on
pull requests targeting main.

## Blocking policy

| Scope | Blocking condition |
| --- | --- |
| Mobile production | Any reported vulnerability |
| Mobile complete | High or critical vulnerabilities |
| Backend production | Non-zero uv audit exit status |
| Backend complete | Non-zero uv audit exit status |

Low and moderate development-only mobile findings remain visible.
They are not automatically accepted as permanent risks.

Scanner failures are not suppressed. Audit exceptions require
explicit review and documentation.

## Reproducible commands

From the repository root:

```bash
npm audit --package-lock-only --omit=dev --audit-level=info
npm audit --package-lock-only --include=dev --audit-level=high
```

From backend:

```bash
uv audit --locked --no-dev --python-version 3.13 --python-platform linux --no-python-downloads
uv audit --locked --python-version 3.13 --python-platform linux --no-python-downloads
```

The backend CI pins uv 0.13.6, the locally validated version
supporting the experimental audit command.

Existing dependency installation, lint, typing, formatting,
testing and container validation remain in place.

## Security remediation

Audit checkpoint: 2026-11-16.

The backend audit identified GHSA-vvf4-9x63-8xvv in
dnspython 2.9.0, a transitive dependency of email-validator.

Advisory:
https://github.com/rthalley/dnspython/security/advisories/GHSA-vvf4-9x63-8xvv

The lockfile was updated specifically to dnspython 2.9.2.
All other dependency resolutions and the project manifest
were preserved.

The updated environment passed dependency compatibility
checks, Ruff, Pyright and all 1180 backend tests.

## Local audit evidence

| Scope | Before remediation | After remediation |
| --- | --- | --- |
| Mobile production | 0 | 0 |
| Mobile complete | 27 moderate | 27 moderate |
| Backend production | 1 | 0 |
| Backend complete | 1 | 0 |

Backend production and complete audits examined 49 and 62
packages respectively for the selected Linux/Python 3.13 target.

The remaining mobile findings are development-only according
to npm audit classification. See mobile-dependency-security.md
for the previous remediation and residual-risk baseline.

## Maintenance and limitations

- Audit findings are time-dependent.
- No findings does not establish absolute security.
- The backend audit is scoped to Linux and Python 3.13.
- npm production classification is not a bundle composition audit.
- uv audit is experimental and its behavior must be reviewed
  before upgrading the pinned tool version.
- These checks do not scan the container operating system.
- This workflow runs on pull requests; it does not provide
  independent scheduled scanning.
- Do not run automatic forced dependency remediation.

Investigate newly reported vulnerabilities, prefer scoped
compatible updates, and validate changes before integration.

GitHub Actions execution is the final validation of the CI
integration.
