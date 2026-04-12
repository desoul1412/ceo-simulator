---
tags: [vercel, deployment, devops, spec]
date: 2026-04-12
status: active
---

# Vercel Project Spec — `vnsir-com`

**Task:** 1.1.4  
**Author:** liam-chen (Project Manager)  
**Date:** 2026-04-12  
**Scope:** Vercel project creation, GitHub repo linkage, environment variable group configuration, and `vercel.json` security headers.

Linked from: [[00-Index]]  
Related: [[VNSIR-Implementation-Spec]], [[Docker-Deployment-Spec]], [[Auth-System-Spec]]

---

## 1. Overview

This spec defines the complete Vercel hosting configuration for **CEO Simulator v3** under the project name `vnsir-com`. It covers:

- Vercel project identity and GitHub repository linkage
- Environment variable groups: `preview` and `production`
- Security response headers baked into `vercel.json`
- SPA rewrite rules for React Router v6

### Why `vnsir-com`?

The project is renamed from the legacy `ceo-simulator-iota` (previous ephemeral deployment) to `vnsir-com` to align with the VNSIR spec codename and provide a stable, identifiable Vercel project slug for all future CI/CD integrations.

---

## 2. Vercel Project Setup

### 2.1 Project Identity

| Field | Value |
|-------|-------|
| **Project Name** | `vnsir-com` |
| **Framework Preset** | Vite |
| **Root Directory** | `/` (repo root) |
| **Build Command** | `npm run build` |
| **Output Directory** | `dist` |
| **Install Command** | `npm ci` (default) |
| **Node.js Version** | 20.x (LTS) |

### 2.2 GitHub Repository Linkage

| Field | Value |
|-------|-------|
| **Git Provider** | GitHub |
| **Repository** | `[org]/ceo-simulator` |
| **Production Branch** | `main` |
| **Preview Branches** | All non-main branches (auto-deploy on push) |
| **Ignored Build Step** | `git diff HEAD^ HEAD --quiet -- . ':(exclude)brain/' ':(exclude)*.md'` |

> **Note:** The `Ignored Build Step` command prevents Vercel from triggering a rebuild when only documentation files in `brain/` or `.md` files are changed. This saves Vercel build minutes on doc-only commits.

#### Conflict Avoidance

- Branches `agent/dev-sharma` have open MRs. Vercel will auto-deploy preview builds for those branches — no action needed.
- Do NOT set the `agent/dev-sharma` branches as the production branch.
- Preview URLs follow the pattern: `vnsir-com-git-{branch-slug}-{org}.vercel.app`

---

## 3. Environment Variable Groups

Vercel supports scoping environment variables to **Production**, **Preview**, and **Development** environments. The following groups must be configured in the Vercel project dashboard under **Settings → Environment Variables**.

### 3.1 Group: `production`

All variables listed with **Environment: Production** scope only. Secrets managed via Vercel's encrypted secret store (not committed to repo).

| Variable | Value / Source | Type |
|----------|---------------|------|
| `VITE_SUPABASE_URL` | `https://qdhengvarelfdtmycnti.supabase.co` | Plain |
| `VITE_SUPABASE_ANON_KEY` | _Supabase project dashboard → API → anon key_ | Secret |
| `SUPABASE_URL` | `https://qdhengvarelfdtmycnti.supabase.co` | Plain |
| `SUPABASE_SERVICE_ROLE_KEY` | _Supabase project dashboard → API → service_role key_ | Secret |
| `ANTHROPIC_API_KEY` | _Anthropic console → API keys_ | Secret |
| `JWT_SECRET` | _Generate: `openssl rand -base64 48`_ | Secret (min 32 chars) |
| `NODE_ENV` | `production` | Plain |
| `VITE_APP_VERSION` | `$VERCEL_GIT_COMMIT_SHA` (first 7 chars via build hook) | Plain |

### 3.2 Group: `preview`

All variables listed with **Environment: Preview** scope. May point to a separate Supabase staging branch or the same project with restricted RLS.

| Variable | Value / Source | Type |
|----------|---------------|------|
| `VITE_SUPABASE_URL` | `https://qdhengvarelfdtmycnti.supabase.co` | Plain |
| `VITE_SUPABASE_ANON_KEY` | _Same anon key (safe for preview — RLS enforced)_ | Secret |
| `SUPABASE_URL` | `https://qdhengvarelfdtmycnti.supabase.co` | Plain |
| `SUPABASE_SERVICE_ROLE_KEY` | _Preview-scoped service role (or same if no staging branch)_ | Secret |
| `ANTHROPIC_API_KEY` | _Separate lower-quota preview key recommended_ | Secret |
| `JWT_SECRET` | _Different secret from production_ | Secret |
| `NODE_ENV` | `preview` | Plain |
| `VITE_APP_VERSION` | `preview-$VERCEL_GIT_COMMIT_SHA` | Plain |

### 3.3 Group: `development` (Local)

Not configured in Vercel dashboard. Developers copy `.env.example` to `.env.local` for local Vite dev server.

| Variable | Source |
|----------|--------|
| `VITE_SUPABASE_URL` | `.env.local` (gitignored) |
| `VITE_SUPABASE_ANON_KEY` | `.env.local` (gitignored) |
| `ANTHROPIC_API_KEY` | `.env.local` (gitignored) |

> **Security Rule:** `VITE_*` prefixed variables are embedded into the client bundle at build time. **Never** put service role keys, JWT secrets, or private API keys with a `VITE_` prefix. Server-only secrets (without `VITE_`) are only available in Vercel serverless functions / Express server — not in the browser bundle.

---

## 4. Security Headers

The following HTTP response headers are applied via `vercel.json` to **all routes** (`source: "/(.*)"`) to harden the application against common web vulnerabilities.

### 4.1 Header Definitions

| Header | Value | Protection |
|--------|-------|------------|
| `X-Frame-Options` | `DENY` | Prevents clickjacking — blocks the app from being embedded in any `<iframe>` |
| `X-Content-Type-Options` | `nosniff` | Prevents MIME-type sniffing — browser must respect declared `Content-Type` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Limits referrer information sent on cross-origin requests to origin only |

### 4.2 `vercel.json` — Full Configuration

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "name": "vnsir-com",
  "framework": "vite",
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "rewrites": [
    { "source": "/api/:path*", "destination": "/api/:path*" },
    { "source": "/(.*)", "destination": "/index.html" }
  ],
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "X-Frame-Options",
          "value": "DENY"
        },
        {
          "key": "X-Content-Type-Options",
          "value": "nosniff"
        },
        {
          "key": "Referrer-Policy",
          "value": "strict-origin-when-cross-origin"
        }
      ]
    }
  ]
}
```

### 4.3 Recommended Future Headers (Not Yet Applied)

These headers are listed for future hardening — not in scope for Task 1.1.4 but should be added before public launch:

| Header | Recommended Value | Reason |
|--------|------------------|--------|
| `Content-Security-Policy` | TBD — requires full inventory of CDN domains | Prevents XSS by restricting resource origins |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=()` | Disables browser APIs not used by the app |
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains` | Enforces HTTPS — Vercel handles this automatically, but explicit header adds clarity |
| `X-DNS-Prefetch-Control` | `off` | Prevents DNS prefetch leaking navigation patterns |

> **Note:** CSP is intentionally deferred — the Pixel Art / HUD UI uses inline styles and canvas elements that require a carefully tuned CSP policy. Implement after the UI stabilizes (see [[VNSIR-Implementation-Spec]] for page inventory).

---

## 5. SPA Routing (Rewrites)

React Router v6 requires server-side catch-all routing so direct URL access (e.g., `/company/123/board`) returns `index.html` instead of a 404.

```json
"rewrites": [
  { "source": "/api/:path*", "destination": "/api/:path*" },
  { "source": "/(.*)", "destination": "/index.html" }
]
```

| Rule | Behavior |
|------|----------|
| `/api/:path*` → `/api/:path*` | API calls are NOT rewritten — they pass through to Vercel serverless functions or Express origin |
| `/(.*)` → `/index.html` | All other paths return the SPA shell; React Router handles client-side routing |

> **Rule Order:** The `/api/:path*` rewrite must appear **before** the catch-all `/(.*)` rule. Vercel evaluates rewrites in order — if the catch-all comes first, API requests would be served `index.html` instead of the Express handler.

---

## 6. Deployment Workflow

### 6.1 Production Deploy

```
push to main
  └─► Vercel CI triggers
       ├── npm ci
       ├── npm run build (Vite — injects VITE_* env vars from "production" group)
       ├── deploy dist/ to Vercel Edge Network
       └── apply vercel.json headers + rewrites
           └─► https://vnsir-com.vercel.app (or custom domain)
```

### 6.2 Preview Deploy

```
push to any branch (e.g. agent/dev-sharma)
  └─► Vercel CI triggers
       ├── npm ci
       ├── npm run build (Vite — injects VITE_* env vars from "preview" group)
       ├── deploy dist/ to Vercel Edge Network
       └─► https://vnsir-com-git-{branch-slug}-{org}.vercel.app
```

### 6.3 Manual Deploy (Emergency)

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy to production from local
vercel --prod --token=$VERCEL_TOKEN

# Deploy preview from local
vercel --token=$VERCEL_TOKEN
```

---

## 7. Acceptance Criteria

| ID | Criterion | Pass Condition |
|----|-----------|----------------|
| VP-01 | Project name is `vnsir-com` | Vercel dashboard shows project named `vnsir-com` |
| VP-02 | GitHub repo linked | Vercel project connected to `[org]/ceo-simulator` repo |
| VP-03 | Production branch is `main` | Pushes to `main` trigger production deployment |
| VP-04 | Preview deployments active | Pushes to any branch (including `agent/dev-sharma`) trigger preview builds |
| VP-05 | `production` env group configured | All 8 production variables are set in Vercel dashboard with correct scoping |
| VP-06 | `preview` env group configured | All 8 preview variables are set with `preview` scope; different secrets from production |
| VP-07 | `X-Frame-Options: DENY` header | `curl -I https://vnsir-com.vercel.app` returns `x-frame-options: DENY` |
| VP-08 | `X-Content-Type-Options: nosniff` header | `curl -I` returns `x-content-type-options: nosniff` |
| VP-09 | `Referrer-Policy` header | `curl -I` returns `referrer-policy: strict-origin-when-cross-origin` |
| VP-10 | SPA routing works | Direct navigation to `/company/abc/board` returns 200 with `index.html` (no 404) |
| VP-11 | API routes NOT rewritten | `GET /api/health` returns JSON, not `index.html` |
| VP-12 | `VITE_*` secrets not in bundle | `grep -r "service_role" dist/` returns no matches |
| VP-13 | Build succeeds on clean clone | `npm ci && npm run build` exits 0 with no env var errors |
| VP-14 | Ignored build step working | A commit touching only `brain/*.md` files does NOT trigger a Vercel rebuild |

---

## 8. Operator Runbook

### Rotating a Secret

1. Generate new secret value
2. Go to Vercel Dashboard → `vnsir-com` → Settings → Environment Variables
3. Edit the target variable, update value, save
4. Trigger a redeployment: Vercel Dashboard → Deployments → `…` → Redeploy

### Adding a New Environment Variable

1. Add to `.env.example` with a placeholder value and comment
2. Add to Vercel dashboard for both `preview` and `production` scopes
3. Update this spec (Section 3) with the new variable
4. If `VITE_*` prefixed: verify it does not contain a secret before adding

### Verifying Headers in Production

```bash
curl -sI https://vnsir-com.vercel.app | grep -E "x-frame|x-content|referrer"
# Expected output:
# x-frame-options: DENY
# x-content-type-options: nosniff
# referrer-policy: strict-origin-when-cross-origin
```

---

## 9. Open Questions

| ID | Question | Owner | Status |
|----|----------|-------|--------|
| OQ-01 | Should `vnsir-com.vercel.app` be mapped to a custom domain (e.g., `app.ceo-simulator.com`)? | CEO | OPEN |
| OQ-02 | Does the `agent/dev-sharma` preview branch need its own separate env vars (e.g., a dedicated Supabase branch)? | dev-sharma | OPEN — currently shares same Supabase project |
| OQ-03 | Should Content-Security-Policy be implemented before public launch or post-v1? | liam-chen | OPEN — recommended pre-launch |

---

## 10. Change Log (Spec)

| Version | Date | Author | Change |
|---------|------|--------|--------|
| 1.0 | 2026-04-12 | liam-chen | Initial spec — Vercel project setup, env var groups, security headers, acceptance criteria |
