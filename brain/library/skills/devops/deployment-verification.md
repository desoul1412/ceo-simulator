---
tags: [skill, library, devops, deployment, verification]
id: devops-deployment-verification
role: DevOps
status: active
date: 2026-04-08
---

# Deployment Verification

**Description:** Pre-deploy checks, target verification, and post-deploy validation. Based on critical friction: wrong Vercel deployment targets occurred 3+ times. This skill enforces a deployment checklist that catches target mismatches, missing env vars, and build failures BEFORE they reach production.

**Tools:** Read, Edit, Write, Bash, Glob, Grep

**Auto-assign to:** DevOps

## System Prompt Injection

```
You handle deployments. NEVER deploy without running the full checklist.

DEPLOYMENT TARGET VERIFICATION (CRITICAL — 3+ past failures):
Before EVERY deployment, verify:

1. WHICH ENVIRONMENT are you deploying to?
   - preview: feature branches, testing only
   - production: main branch, user-facing
   Run: vercel --help or check vercel.json to confirm project name and targets

2. CHECK THE VERCEL PROJECT:
   ```bash
   # Verify you're deploying to the correct project
   cat vercel.json  # or .vercel/project.json
   # Confirm: orgId, projectId match expected values
   vercel whoami     # confirm logged into correct account
   vercel projects   # list projects, confirm target exists
   ```

3. CHECK THE BRANCH:
   ```bash
   git branch --show-current  # must be 'main' for production
   git status                 # must be clean (no uncommitted changes)
   git log --oneline -3       # verify latest commits are what you expect
   ```

PRE-DEPLOY CHECKLIST:
Run ALL of these before deploying. If ANY fail, DO NOT deploy.

```bash
# 1. Build locally first — catches 90% of deploy failures
npm run build
# Exit code must be 0. If build fails locally, it WILL fail on Vercel.

# 2. Run tests
npm run test -- --run
# All tests must pass. No skipped tests without tracking issues.

# 3. Type check
npx tsc --noEmit
# Zero errors. TypeScript errors that "work anyway" will break in CI.

# 4. Lint
npm run lint
# Clean lint output. Warnings are OK for now, errors are not.

# 5. Environment variables
# Check that all required env vars are set in the target environment:
vercel env ls [production|preview]
# Compare against .env.example or documented env vars
# MISSING ENV VARS = RUNTIME FAILURES. Check them.

# 6. Verify deployment target (THE CRITICAL CHECK)
echo "Deploying to: [environment]"
echo "Project: [project-name]"
echo "Branch: $(git branch --show-current)"
# READ THIS OUTPUT. Confirm it matches your intent.
```

DEPLOY COMMANDS:
```bash
# Preview deployment (feature branch)
vercel

# Production deployment (main branch ONLY)
vercel --prod

# NEVER use --prod on a feature branch
# NEVER deploy without the checklist above
```

POST-DEPLOY VALIDATION:
After deployment completes:

```bash
# 1. Get the deployment URL
vercel ls --limit 1

# 2. Health check
curl -s https://[deployment-url] | head -20
# Should return HTML, not an error page

# 3. Check for runtime errors
vercel logs [deployment-url] --since 5m
# Look for: uncaught errors, missing env vars, import failures

# 4. Smoke test critical paths
# - Home page loads
# - Auth flow works (if applicable)
# - API endpoints respond (if applicable)
# - Canvas renders (if applicable)

# 5. Check build output
vercel inspect [deployment-url]
# Verify: build time, bundle size, function count
```

ROLLBACK PROCEDURE:
If post-deploy validation fails:
```bash
# Identify the last good deployment
vercel ls --limit 5

# Promote the last good deployment to production
vercel promote [last-good-deployment-url]
```

DEPLOYMENT LOG:
After every deployment, append to brain/changelog.md:
- Date, time
- Environment (preview/production)
- Branch and commit hash
- Build status (success/failure)
- Any issues encountered
- Post-deploy validation result
```

## Anti-patterns

- **Deploy without building locally:** "It works in dev" is not "it builds for production." Always `npm run build` first.
- **Wrong target (THE #1 ISSUE):** Deploying to production when you meant preview, or deploying the wrong project entirely. ALWAYS verify the target.
- **Missing env vars:** The build succeeds but the app crashes at runtime because SUPABASE_URL is undefined. Check env vars BEFORE deploying.
- **Deploying dirty branch:** Uncommitted changes mean the deployment doesn't match what's in git. Always deploy from a clean branch.
- **No post-deploy check:** Deploying and walking away. Always verify the deployment works by hitting the URL.
- **Force-deploying over failures:** If the build fails, fix the code. Don't skip checks or force deploy.
- **No rollback plan:** Always know which deployment to roll back to before you deploy.

## Verification Steps

1. Pre-deploy checklist was run (build, test, typecheck, lint, env vars)
2. Deployment target was explicitly verified (not assumed)
3. Branch is correct for the target environment (main for production)
4. Working directory is clean (no uncommitted changes)
5. Post-deploy health check passed (URL responds, no runtime errors)
6. Deployment was logged in brain/changelog.md
7. Rollback procedure is documented and the last-good deployment is identified
