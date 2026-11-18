# Navigate: Go-Live Checklist

Tick every item before onboarding paying customers. Items marked **PENDING** are known gaps in the product today, not just configuration.

## 1. Infrastructure

- [ ] Hosting chosen for the backend and frontend (container platform, VM, or the provided `docker-compose.yml`).
- [ ] Docker images build cleanly (`docker compose build`). The Docker files were written but not run during preparation, so do a full dry run in staging first.
- [ ] A staging environment mirrors production (same images, separate database, `BILLING_MODE` and keys for staging).
- [ ] HTTPS terminates in front of the app with a valid certificate and automatic renewal; HTTP redirects to HTTPS.
- [ ] Domain and DNS configured; `APP_URL` and `CORS_ORIGINS` use the final https address.
- [ ] `TRUST_PROXY` equals the number of proxy hops in front of the API (Compose sets `1` for its nginx; add one per extra load balancer or CDN).
- [ ] Proxy and load balancer timeouts are at least 120 seconds on `/api` (AI generation can take up to about a minute) and allow 12 MB request bodies (syllabus uploads).
- [ ] Load balancer health checks use `/api/health` (liveness) and `/api/ready` (database connected).
- [ ] If running more than one backend instance: rate limits and the AI recommendation cache are per process today, so add a shared store (for example Redis) or run a single instance. Uploaded files live on the local disk, so use shared storage or a single instance.
- [ ] CI is green on the release commit (`.github/workflows/ci.yml`: backend tests and frontend lint + build).

## 2. Security

- [ ] `JWT_SECRET` is a unique random string of at least 32 characters, generated per environment and stored in a secrets manager. The placeholder in `.env.example` is long enough to pass the length check, so make sure it was replaced.
- [ ] `REFRESH_TOKEN_SECRET` is set to a different random value.
- [ ] MongoDB is not reachable from the internet, requires authentication and uses TLS.
- [ ] `backend/.env` is never committed or baked into an image (it is excluded by `.gitignore` and `.dockerignore`).
- [ ] Demo data and demo accounts (`npm run seed`, password `Navigate123`) are not loaded in production, or are removed before launch.
- [ ] Review the first-run owner account process: anyone can create a workspace by registering, so decide whether open sign-up is acceptable.
- [ ] Dependencies reviewed (`npm audit` in backend, frontend and ai_services) and a patching routine agreed.
- [ ] Security headers verified on the live site; consider adding a Content-Security-Policy at the proxy (the API currently disables helmet's CSP).
- [ ] Penetration test or independent security review considered for institutional customers.

## 3. Configuration

- [ ] `NODE_ENV=production`.
- [ ] `MONGO_URI` points to the production cluster (required; there is no fallback in production).
- [ ] `BILLING_MODE` is set on purpose: `contact-sales` while payments are not integrated.
- [ ] Rate limit overrides reviewed (`RATE_LIMIT_AUTH_MAX`, `RATE_LIMIT_GENERAL_MAX`, `RATE_LIMIT_AI_MAX`); schools behind one NAT address share the per-IP limits, so raise them if a whole campus sits behind one IP.
- [ ] `LOG_LEVEL` set (`info` is a good default) and logs shipped somewhere searchable.
- [ ] Plan limits in `backend/config/plans.js` and prices on the pricing page match the commercial offer.

## 4. AI provider

- [ ] A **paid** Gemini API key is set in `GEMINI_API_KEY`. The free tier allows only about 5 requests per minute and is slow, which pushes features onto template fallbacks.
- [ ] `GEMINI_MODEL` names a currently available model (retired models are skipped automatically, but check the provider's deprecation notices).
- [ ] Spend alerts and quotas configured with the AI provider; the plans' monthly AI generation limits are checked against expected cost per generation.
- [ ] Data-sharing terms of the AI provider reviewed, since syllabus text and student weak-topic names are sent to it.
- [ ] Optional: `HUGGINGFACE_API_KEY` set if embedding-based similarity is wanted.

## 5. Data and backups

- [ ] Automated MongoDB backups with point-in-time recovery, stored in a separate account or region.
- [ ] A restore has been tested end to end and the recovery time is written down.
- [ ] Retention agreed: notifications are deleted after 90 days and audit-log entries after 365 days (built in); decide the retention for submissions and accounts.
- [ ] Process for deleting a student's or an institution's data on request (there is no self-service export or delete in the product yet).
- [ ] Indexes confirmed on the production database after first start.

## 6. Monitoring and operations

- [ ] Uptime monitoring on the public URL and on `/api/ready`.
- [ ] Alerts for error rate, latency, container restarts, database connections and disk space.
- [ ] Central log search using the request ID (`x-request-id`) that appears in each response and log line.
- [ ] Error tracking for the frontend and backend considered (none is built in).
- [ ] On-call owner, incident process and status-page plan agreed.
- [ ] Deployment and rollback steps written down and rehearsed in staging.

## 7. Legal and compliance

These are considerations to take to qualified legal advice; Navigate makes no compliance claims.

- [ ] Privacy policy published and linked from the sign-up page.
- [ ] Terms of service / customer agreement published.
- [ ] Data processing agreement (DPA) template ready for institutional customers.
- [ ] Student data: assess FERPA (US) and GDPR / UK GDPR (EU/UK) obligations, children's-data rules (for example COPPA) if under-18 students are possible, and local data-residency requirements.
- [ ] List of sub-processors (hosting, database, AI provider, email provider) published and kept current.
- [ ] Cookie and local-storage notice reviewed (the app stores session tokens and preferences in the browser).
- [ ] Camera use during proctored exams: consent text reviewed (the camera preview is not recorded or uploaded).
- [ ] Accessibility conformance (for example WCAG 2.1 AA) reviewed if customers require it; no formal audit has been done.

## 8. Support

- [ ] Support email address or help desk and response-time targets defined.
- [ ] Support team trained with [docs/FEATURES.md](FEATURES.md) and the demo workspace.
- [ ] Known limitations (end of FEATURES.md) shared with sales so nothing unsupported is promised.
- [ ] Customer onboarding plan: first workspace set-up, invite links, course join codes, a pilot course.
- [ ] Feedback and bug-report channel inside or alongside the product.

## 9. Pending product work (must be decided before charging customers)

- [ ] **PENDING: Payments (for example Stripe).** Billing is demo only: no card payment, invoices, tax or webhooks. Until integrated, run with `BILLING_MODE=contact-sales` and invoice manually.
- [ ] **PENDING: Email provider.** Password-reset and other emails are only written to the server log. The `SMTP_*` variables in `.env.example` are placeholders; nothing sends mail yet. Without it, "forgot password" cannot work for real users in production.
- [ ] **PENDING: Single sign-on** (Google, Microsoft, SAML) if institutional customers require it.
- [ ] Logo upload and fuller branding if the Enterprise plan will advertise custom branding.
- [ ] Self-service data export and account deletion.

## 10. Final pre-launch pass

- [ ] Run the full backend test suite against staging data and click through the main flows: create a workspace, invite an instructor, create a course, build and publish an assessment, take it as a student, grade it, release results, view analytics and the learning path.
- [ ] Test a proctored exam on the browsers and devices your customers use (full screen, camera permission).
- [ ] Load test a realistic exam: many students starting and autosaving at once.
- [ ] Verify a password reset end to end with the real email provider.
- [ ] Confirm backups ran and monitoring alerts reach a human.
