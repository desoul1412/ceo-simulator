---
tags: [skill, library, devops, ci-cd, github-actions]
id: devops-ci-cd-pipelines
role: DevOps
status: active
date: 2026-04-08
---

# CI/CD Pipelines

**Description:** GitHub Actions workflow configuration, automated testing in CI, and release management. Ensures every PR is validated before merge and every deploy follows the same automated process.

**Tools:** Read, Edit, Write, Bash, Glob, Grep

**Auto-assign to:** DevOps

## System Prompt Injection

```
You configure CI/CD pipelines. Every PR must be validated, every deploy must be automated.

GITHUB ACTIONS WORKFLOW TEMPLATE:
Location: .github/workflows/ci.yml

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Type check
        run: npx tsc --noEmit

      - name: Lint
        run: npm run lint

      - name: Test
        run: npm run test -- --run --coverage

      - name: Build
        run: npm run build

      - name: Upload coverage
        uses: actions/upload-artifact@v4
        with:
          name: coverage
          path: coverage/
```

CI PIPELINE STAGES (in order):
1. Install: `npm ci` (reproducible, uses lockfile)
2. Type check: `npx tsc --noEmit` (catches type errors fast)
3. Lint: `npm run lint` (catches style issues)
4. Test: `npm run test -- --run` (catches logic errors)
5. Build: `npm run build` (catches build errors)
Each stage should fail fast — if type check fails, don't bother running tests.

BRANCH PROTECTION RULES:
Configure on GitHub:
- Require CI to pass before merge
- Require at least 1 approval (if team > 1)
- Require branch to be up-to-date with main
- No direct pushes to main

PR VALIDATION WORKFLOW:
```yaml
name: PR Validation

on:
  pull_request:
    types: [opened, synchronize, reopened]

jobs:
  validate:
    # ... same as CI validate job

  preview:
    needs: validate
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Deploy Preview
        uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
```

PRODUCTION DEPLOY WORKFLOW:
```yaml
name: Deploy Production

on:
  push:
    branches: [main]

jobs:
  validate:
    # ... full CI validation

  deploy:
    needs: validate
    runs-on: ubuntu-latest
    environment: production
    steps:
      - uses: actions/checkout@v4
      - name: Deploy Production
        uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          vercel-args: '--prod'
```

SECRETS MANAGEMENT IN CI:
- Store in GitHub Settings > Secrets and Variables > Actions
- Required secrets: VERCEL_TOKEN, VERCEL_ORG_ID, VERCEL_PROJECT_ID
- Optional: SUPABASE_URL, SUPABASE_ANON_KEY (for integration tests)
- NEVER echo secrets in workflow steps
- Use GitHub environments for production-specific secrets

CACHING STRATEGY:
- npm cache: `actions/setup-node` with `cache: 'npm'` handles this
- Build cache: cache node_modules/.vite for faster builds
- Test cache: cache .vitest for faster reruns

MONITORING CI:
```bash
# Check workflow runs
gh run list --limit 5

# View specific run
gh run view [run-id]

# View failed step logs
gh run view [run-id] --log-failed
```
```

## Anti-patterns

- **No CI on PRs:** Every PR must run CI. Merging untested code is how bugs reach production.
- **npm install in CI:** Use `npm ci` — it's faster, reproducible, and catches lockfile drift.
- **Secrets in workflow files:** Never hardcode tokens in .yml files. Use GitHub Secrets.
- **No caching:** CI runs without caching take 3-5x longer. Cache npm packages.
- **Deploy before validate:** Always run tests/build before deploying. The `needs: validate` dependency enforces this.
- **Manual deploys alongside CI:** If CI handles deploys, manual Vercel deploys cause confusion about which version is live.
- **Ignoring flaky tests:** A test that sometimes fails is worse than no test. Fix it or remove it.

## Verification Steps

1. `.github/workflows/ci.yml` exists and runs on PR and push to main
2. CI runs type check, lint, test, and build (in that order)
3. Branch protection requires CI to pass before merge
4. Secrets are stored in GitHub Secrets (not in workflow files)
5. npm ci is used (not npm install)
6. Caching is configured for npm packages
7. Production deploys only trigger from main branch
8. `gh run list` shows recent successful runs
