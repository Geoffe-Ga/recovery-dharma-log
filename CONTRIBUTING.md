# Contributing to rd-log

Thank you for considering a contribution. rd-log is a small tool built to
support Recovery Dharma sanghas, and it gets better every time someone from
the community shares their time, code, or feedback.

> **Not affiliated with Recovery Dharma Global.** rd-log is an independent,
> community-built tool. It is not operated, endorsed, maintained, or
> reviewed by Recovery Dharma Global (RDG), the RDG Board of Directors, or
> any local sangha. "Recovery Dharma" is referenced only to describe the
> tradition this software is built to serve.

Before anything else, please read and agree to our
[Code of Conduct](./CODE_OF_CONDUCT.md). This project is offered in the
spirit of the Recovery Dharma tradition, and we ask contributors to carry
that spirit — mindfulness, compassion, forgiveness, and generosity — into
every issue, pull request, and review.

## Ways to Contribute

You don't have to write code to help.

- **Report a bug.** If something is broken or confusing, open an issue
  describing what you expected and what happened. Screenshots help.
- **Suggest a feature.** Especially welcome: ideas that come from your
  sangha's actual practice. Describe the meeting problem first, the feature
  second.
- **Improve the docs.** READMEs, inline comments, and this file can always
  be clearer. Small doc PRs are very welcome.
- **Write code.** Bug fixes, features, tests, refactors — all welcome.
- **Help other contributors.** Reviewing PRs, answering questions in issues,
  and triaging reports is as valuable as writing code.
- **Practice Dana directly.** If rd-log helps your sangha, the most
  meaningful thank-you is to [support Recovery Dharma
  Global](https://recoverydharma.org/) or your local sangha — not this
  project.

## A Note on Sensitive Material

This project serves a recovery community. Please do not include real
sangha members' names, recovery details, or any identifying information in
issues, PRs, commits, screenshots, or test fixtures. If you are reporting a
bug that involves real data, scrub it first.

If you find a security issue (especially anything that could expose user
data), please **do not** open a public issue. Email Geoff directly or use
GitHub's private vulnerability reporting on the repository.

## Development Workflow

rd-log follows a **Stay Green** workflow: every commit should leave the tree
green. The full engineering standards are documented in
[`CLAUDE.md`](./CLAUDE.md); the short version is below.

### 1. Fork and branch

```bash
git clone https://github.com/<you>/recovery-dharma-log.git
cd recovery-dharma-log
git checkout -b your-feature-branch
```

Use descriptive branch names (`fix/rotation-off-by-one`,
`feat/csv-export`, etc.).

### 2. Set up your environment

See [`README.md`](./README.md) and the subproject READMEs in
[`frontend/`](./frontend/README.md) and [`backend/`](./backend/README.md).

Install pre-commit hooks — this catches most issues before CI does:

```bash
pre-commit install
```

### 3. Make your change

A few guidelines drawn from the project's
[`CLAUDE.md`](./CLAUDE.md):

- **Use the project scripts**, not the underlying tools directly.
  `./scripts/check-all.sh` runs everything; individual scripts exist for
  each step.
- **No shortcuts.** Don't disable tests, don't lower thresholds, don't
  `--no-verify` commits. If a check is wrong, fix the check properly.
- **DRY.** Link to canonical docs instead of copying content between files.
- **Operate from the project root.** Don't `cd` into subdirectories in
  scripts or commands — CI runs from the root.

### 4. Test

All changes need tests. The standards are:

- Line coverage **≥ 90%**
- Branch coverage **≥ 85%**
- Mutation score **≥ 80%** (where Stryker/mutmut is applicable)
- Cyclomatic complexity **≤ 10** per function

Run the full suite before pushing:

```bash
./scripts/check-all.sh
```

Only push when this exits `0`.

### 5. Commit

We use [Conventional Commits](https://www.conventionalcommits.org/):

```
feat(meetings): add attendance-count override
fix(rotation): don't skip speakers after manual override
docs(readme): clarify self-hosting instructions
```

Write commit messages that explain **why**, not just **what**.

### 6. Open a pull request

- Fill out the PR template.
- Describe the change, the motivation, and how you tested it.
- Link any related issues.
- Ensure CI is green **before** requesting review.

PRs with failing CI will not be reviewed until they are green — this is the
Stay Green policy, and it applies to everyone including maintainers.

### 7. Review

- Expect feedback. It is not personal; it is practice.
- Address all comments. If you disagree, say so and discuss — silent dismissal
  isn't the way.
- Maintainers merge when CI is green, reviews are LGTM, and the contributor
  is satisfied.

## Style

- **TypeScript**: strict mode, no `any` without a written justification.
- **Python**: typed, `ruff`-clean, `mypy`-clean.
- **Formatting**: Prettier (frontend), Black + isort (backend). Run
  `./scripts/format.sh` before committing.
- **Comments**: explain *why*, not *what*. If the code needs a comment to
  explain what it's doing, consider renaming something instead.

## What Won't Be Merged

To keep the project healthy and aligned with its purpose, a few kinds of
change won't be accepted:

- Features that collect, sell, or expose sangha members' personal data.
- Ads, tracking, or monetization of the hosted instance.
- Anything that makes the app harder for a sangha to self-host for free.
- Changes that break the Stay Green workflow or silence quality checks
  without a documented, justified reason.

## License of Contributions

By submitting a contribution, you agree that your contribution is released
under the same [MIT License](./LICENSE) as the rest of the project.

## Thank You

Every issue opened, every test added, every typo fixed is Dana to the next
sangha that uses this tool. Thank you for practicing with us.
