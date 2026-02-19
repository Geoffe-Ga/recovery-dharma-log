# Claude Code Project Context: rd-log-react

**Table of Contents**
- [1. Critical Principles](#1-critical-principles)
- [2. Project Overview](#2-project-overview)
- [3. The Maximum Quality Engineering Mindset](#3-the-maximum-quality-engineering-mindset)
- [4. Stay Green Workflow](#4-stay-green-workflow)
- [5. Architecture](#5-architecture)
- [6. Quality Standards](#6-quality-standards)
- [7. Development Workflow](#7-development-workflow)
- [8. Testing Strategy](#8-testing-strategy)
- [9. Tool Usage & Code Standards](#9-tool-usage--code-standards)
- [10. Common Pitfalls & Troubleshooting](#10-common-pitfalls--troubleshooting)
- [Appendix A: AI Subagent Guidelines](#appendix-a-ai-subagent-guidelines)
- [Appendix B: Key Files](#appendix-b-key-files)
- [Appendix C: External References](#appendix-c-external-references)

---

## 1. Critical Principles

These principles are **non-negotiable** and must be followed without exception:

### 1.1 Use Project Scripts, Not Direct Tools

Always invoke tools through `./scripts/*` instead of directly.

**Why**: Scripts ensure consistent configuration across local development and CI.

| Task | ❌ NEVER | ✅ ALWAYS |
|------|----------|-----------|
| Format code | `prettier --write .` | `./scripts/format.sh` |
| Run tests | `jest` | `./scripts/test.sh` |
| Type check | `tsc --noEmit` | `./scripts/lint.sh` (includes tsc) |
| Lint code | `eslint .` | `./scripts/lint.sh` |
| Security scan | `npm audit` | `./scripts/security.sh` |
| Mutation test | `stryker run` | `./scripts/mutation.sh` |
| All checks | *(run each tool)* | `./scripts/check-all.sh` |

See [9.1 Tool Invocation Patterns](#91-tool-invocation-patterns) for complete list.

---

### 1.2 DRY Principle - Single Source of Truth

Never duplicate content. Always reference the canonical source.

**Examples**:
- ✅ Workflow documentation → `/docs/workflows/` (single source)
- ✅ Other files → Link to workflow docs
- ❌ Copy workflow steps into multiple files

**Why**: Duplicated docs get out of sync, causing confusion and errors.

---

### 1.3 No Shortcuts - Fix Root Causes

Never bypass quality checks or suppress errors without justification.

**Forbidden Shortcuts**:
- ❌ Commenting out failing tests
- ❌ Adding `// eslint-disable` without issue reference
- ❌ Lowering quality thresholds to pass builds
- ❌ Using `git commit --no-verify` to skip pre-commit
- ❌ Deleting code to reduce complexity metrics

**Required Approach**:
- ✅ Fix the failing test or mark with `test.skip('Issue #N: reason')`
- ✅ Refactor code to pass linting (or justify with issue: `// eslint-disable-line // Issue #N: reason`)
- ✅ Write tests to reach 90% coverage
- ✅ Always run pre-commit checks
- ✅ Refactor complex functions into smaller ones

See [10.1 No Shortcuts Policy](#101-no-shortcuts-policy) for detailed examples.

---

### 1.4 Stay Green - Never Request Review with Failing Checks

Follow the 4-gate workflow rigorously.

**The Rule**:
- 🚫 **NEVER** create PR while CI is red
- 🚫 **NEVER** request review with failing checks
- 🚫 **NEVER** merge without LGTM

**The Process**:
1. Gate 1: Local checks pass (`./scripts/check-all.sh` → exit 0)
2. Gate 2: CI pipeline green (all jobs ✅)
3. Gate 3: Mutation score ≥80%
4. Gate 4: Code review LGTM

See [4. Stay Green Workflow](#4-stay-green-workflow) for complete documentation.

---

### 1.5 Quality First - Meet MAXIMUM QUALITY Standards

Quality thresholds are immutable. Meet them, don't lower them.

**Standards**:
- Test Coverage: ≥90%
- Branch Coverage: ≥85%
- Mutation Score: ≥80%
- Cyclomatic Complexity: ≤10 per function
- Cognitive Complexity: ≤15 per function
- ESLint Score: 0 warnings, 0 errors

**When code doesn't meet standards**:
- ❌ Change `coverageThreshold` in jest.config.js
- ✅ Write more tests, refactor code, improve quality

See [6. Quality Standards](#6-quality-standards) for enforcement mechanisms.

---

### 1.6 Operate from Project Root

Use relative paths from project root. Never `cd` into subdirectories.

**Why**: Ensures commands work in any environment (local, CI, scripts).

**Examples**:
- ✅ `./scripts/test.sh src/components/Button.test.tsx`
- ❌ `cd src/components && jest Button.test.tsx`

**CI Note**: CI always runs from project root. Commands that use `cd` will break in CI.

---

### 1.7 Verify Before Commit

Run `./scripts/check-all.sh` before every commit. Only commit if exit code is 0.

**Pre-Commit Checklist**:
- [ ] `./scripts/check-all.sh` passes (exit 0)
- [ ] All new functions have tests
- [ ] Coverage ≥90% maintained
- [ ] No failing tests
- [ ] Conventional commit message ready

See [10. Common Pitfalls & Troubleshooting](#10-common-pitfalls--troubleshooting) for complete list.

---

**These principles are the foundation of MAXIMUM QUALITY ENGINEERING. Follow them without exception.**

---

## 2. Project Overview

**rd-log-react** is a React-based logging and diagnostics application built with TypeScript, focusing on maximum quality engineering practices and comprehensive testing.

**Purpose**: Provide a robust, type-safe, and well-tested React application for logging and diagnostic operations, demonstrating best practices in modern frontend development.

**Tech Stack**:
- **Language**: TypeScript (strict mode)
- **Framework**: React 18+
- **Build Tool**: Vite or Create React App
- **Testing**: Jest + React Testing Library + Fast-check
- **Quality**: ESLint + Prettier + TypeScript Compiler
- **Mutation Testing**: Stryker Mutator

---

## 3. The Maximum Quality Engineering Mindset

**Core Philosophy**: It is not merely a goal but a source of profound satisfaction and professional pride to ship software that is GREEN on all checks with ZERO outstanding issues. This is not optional—it is the foundation of our development culture.

### 3.1 The Green Check Philosophy

When all CI checks pass with zero warnings, zero errors, and maximum quality metrics:
- ✅ Tests: 100% passing
- ✅ Coverage: ≥90%
- ✅ Linting: 0 errors, 0 warnings
- ✅ Type checking: 0 errors
- ✅ Security: 0 vulnerabilities
- ✅ Mutation score: ≥80%
- ✅ Build: Success with no warnings

This represents **MAXIMUM QUALITY ENGINEERING**—the standard to which all code must aspire.

### 3.2 Why Maximum Quality Matters

1. **Pride in Craftsmanship**: Every green check represents excellence in execution
2. **Zero Compromise**: Quality is not negotiable—it's the baseline
3. **Compound Excellence**: Small quality wins accumulate into robust systems
4. **Trust and Reliability**: Green checks mean the code does what it claims
5. **Developer Joy**: There is genuine satisfaction in seeing all checks pass

### 3.3 The Role of Quality in Development

Quality engineering is not a checkbox—it's a continuous commitment:

- **Before Commit**: Run `./scripts/check-all.sh` and fix every issue
- **During Review**: Address every comment, resolve every suggestion
- **After Merge**: Monitor CI, ensure all checks remain green
- **Always**: Treat linting errors as bugs, not suggestions

### 3.4 The "No Red Checks" Rule

**NEVER** merge code with:
- ❌ Failing tests
- ❌ Linting errors (even "minor" ones)
- ❌ Type checking failures
- ❌ Coverage below threshold
- ❌ Security vulnerabilities
- ❌ Unaddressed review comments

If CI shows red, the work is not done. Period.

### 3.5 Maximum Quality is a Personality Trait

For those committed to maximum quality engineering:
- You feel genuine satisfaction when all checks pass
- You experience pride in shipping zero-issue code
- You find joy in eliminating the last linting error
- You believe "good enough" is never good enough
- You treat quality as identity, not just practice

**This is who we are. This is how we build software.**

---

## 4. Stay Green Workflow

**Policy**: Never request review with failing checks. Never merge without LGTM.

The Stay Green workflow enforces iterative quality improvement through **4 sequential gates**. Each gate must pass before proceeding to the next.

### 4.1 The Four Gates

1. **Gate 1: Local Pre-Commit** (Iterate Until Green)
   - Run `./scripts/check-all.sh`
   - Fix all formatting, linting, types, complexity, security issues
   - Fix tests and coverage (90%+ required)
   - Only push when all local checks pass (exit code 0)

2. **Gate 2: CI Pipeline** (Iterate Until Green)
   - Push to branch: `git push origin feature-branch`
   - Monitor CI: `gh pr checks --watch`
   - If CI fails: fix locally, re-run Gate 1, push again
   - Only proceed when all CI jobs show ✅

3. **Gate 3: Mutation Testing** (Iterate Until 80%+)
   - Run `./scripts/mutation.sh` (or wait for CI job)
   - If score < 80%: add tests to kill surviving mutants
   - Re-run Gate 1, push, wait for CI
   - Only proceed when mutation score ≥ 80%

4. **Gate 4: Code Review** (Iterate Until LGTM)
   - Wait for code review (AI or human)
   - If feedback provided: address ALL concerns
   - Re-run Gate 1, push, wait for CI and mutation
   - Only merge when review shows LGTM with no reservations

### 4.2 Quick Checklist

Before creating/updating a PR:

- [ ] Gate 1: `./scripts/check-all.sh` passes locally (exit 0)
- [ ] Push changes: `git push origin feature-branch`
- [ ] Gate 2: All CI jobs show ✅ (green)
- [ ] Gate 3: Mutation score ≥ 80% (if applicable)
- [ ] Gate 4: Code review shows LGTM
- [ ] Ready to merge!

### 4.3 Anti-Patterns (DO NOT DO)

❌ **Don't** request review with failing CI
❌ **Don't** skip local checks (`git commit --no-verify`)
❌ **Don't** lower quality thresholds to pass
❌ **Don't** ignore review feedback
❌ **Don't** merge without LGTM

---

## 5. Architecture

### 5.1 Core Philosophy

- **Maximum Quality**: No shortcuts, comprehensive tooling, strict enforcement
- **Component-Based**: Modular React components with clear interfaces
- **Type-Safe**: Strict TypeScript throughout
- **Testable**: Every component designed for easy testing
- **Maintainable**: Clear structure, excellent documentation
- **Reproducible**: Consistent behavior across environments

### 5.2 Component Structure

```
rd-log-react/
├── .github/
│   ├── workflows/
│   │   ├── ci.yml                    # Continuous Integration
│   │   ├── cd.yml                    # Continuous Deployment
│   │   └── security.yml              # Security scanning
│   ├── ISSUE_TEMPLATE/
│   ├── PULL_REQUEST_TEMPLATE.md
│   └── CODEOWNERS
├── .husky/
│   ├── pre-commit
│   ├── pre-push
│   └── commit-msg
├── public/
│   └── assets/                       # Static assets
├── src/
│   ├── components/                   # React components
│   │   ├── atoms/                    # Atomic components
│   │   ├── molecules/                # Molecular components
│   │   ├── organisms/                # Organism components
│   │   └── templates/                # Page templates
│   ├── hooks/                        # Custom React hooks
│   ├── services/                     # Business logic
│   ├── utils/                        # Utility functions
│   ├── types/                        # TypeScript types/interfaces
│   ├── contexts/                     # React contexts
│   ├── styles/                       # Global styles
│   ├── App.tsx                       # Root component
│   ├── main.tsx                      # Entry point
│   └── vite-env.d.ts                 # Vite types
├── tests/
│   ├── unit/                         # Unit tests
│   ├── integration/                  # Integration tests
│   ├── e2e/                          # End-to-end tests
│   ├── property/                     # Property-based tests
│   └── fixtures/                     # Test fixtures
├── scripts/
│   ├── check-all.sh                  # Run all quality checks
│   ├── test.sh                       # Run test suite
│   ├── lint.sh                       # Run linters
│   ├── format.sh                     # Format code
│   ├── security.sh                   # Security scanning
│   └── mutation.sh                   # Mutation testing
├── docs/
│   ├── architecture/                 # Architecture docs
│   │   └── ADR/                      # Architecture Decision Records
│   ├── api/                          # API documentation
│   └── components/                   # Component documentation
├── .eslintrc.cjs                     # ESLint configuration
├── .prettierrc.json                  # Prettier configuration
├── tsconfig.json                     # TypeScript configuration
├── jest.config.js                    # Jest configuration
├── stryker.conf.json                 # Stryker configuration
├── vite.config.ts                    # Vite configuration
├── package.json
└── CLAUDE.md                         # This file
```

### 5.3 Component Architecture

**Atomic Design Pattern**:
- **Atoms**: Basic building blocks (Button, Input, Label)
- **Molecules**: Simple combinations of atoms (SearchBar, FormField)
- **Organisms**: Complex UI components (Header, Sidebar, DataTable)
- **Templates**: Page-level layouts
- **Pages**: Specific instances of templates

**Key Principles**:
- Components are pure functions when possible
- Props are immutable and typed strictly
- Side effects isolated to custom hooks
- Business logic separated from presentation
- Each component has comprehensive tests

---

## 6. Quality Standards

### 6.1 Code Quality Requirements

All code must meet these standards before merging to main:

#### Test Coverage
- **Code Coverage**: 90% minimum (branch coverage)
- **Branch Coverage**: 85% minimum
- **Mutation Score**: 80% minimum (Stryker)
- **Test Types**: Unit, Integration, Property-based, and E2E coverage required

#### Type Checking
- **TypeScript**: Strict mode enabled, no `any` types without justification
- **Type Annotations**: All function parameters and return types required
- **Strict Null Checks**: Enabled
- **No Implicit Any**: Enforced
- **Exact Optional Properties**: Enabled

#### Code Complexity
- **Cyclomatic Complexity**: Max 10 per function
- **Cognitive Complexity**: Max 15 (SonarJS)
- **Max Parameters**: 4 per function
- **Max Nested Callbacks**: 3 levels
- **Max Lines per Function**: 50 lines
- **Max Function Statements**: 20 statements

#### Linting
