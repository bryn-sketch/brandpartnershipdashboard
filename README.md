# Partnership Performance Dashboard

Per-client dashboard pulled nightly from ClickUp's **UL ROSTER** space, where
each client folder's **🤝 PARTNER DEVELOPMENT** list holds one task per brand
being pitched. See `scripts/config.mjs` for the client → ClickUp list mapping
and the pipeline-stage taxonomy.

## One-time setup

1. **Add the ClickUp API token as a repo secret.**
   Go to Settings → Secrets and variables → Actions → New repository secret,
   name it `CLICKUP_API_TOKEN`, and paste your ClickUp personal API token
   (Settings → Apps in ClickUp). Never commit this token to the repo.

2. **Turn on GitHub Pages.**
   Go to Settings → Pages → Source → "GitHub Actions". The
   `update-dashboard` workflow deploys the `docs/` folder there.

3. **Run the workflow once manually** (Actions → Update partnership
   dashboard → Run workflow) to do the first data pull and deploy.

After that it refreshes itself nightly at 09:00 UTC (`.github/workflows/update-dashboard.yml`),
pulling fresh data from ClickUp, rebuilding `docs/data.json`, committing it,
and redeploying the Pages site.

## Local development

```
CLICKUP_API_TOKEN=pk_your_token node scripts/build-data.mjs
python3 -m http.server -d docs 8080   # then open localhost:8080
```

## Adding another client

Add a `{ slug, name, folderId, listId }` entry to `CLIENTS` in
`scripts/config.mjs`, pointing at that folder's "🤝 PARTNER DEVELOPMENT" list ID.

## Known data gaps (as of initial build)

Several fields this dashboard depends on were only recently added to ClickUp
and aren't backfilled on older brand tasks yet:

- **Conversation Start Date** and **Deal Closed Date** — until these are
  filled in, "new bites by month" and the paid-value trend chart will show
  as empty/zero (the dashboard says so explicitly rather than faking data).
- **Partnership Type** (Paid/Gifted/Affiliate/Unpaid label) — until set,
  a brand won't count toward the Paid/Gifted/Affiliate/Unpaid tiles even if
  it has a dollar value or is in a "won" status.
- The pipeline-stage funnel (Bites → Meetings → Landed) and the "at a
  glance" roster don't depend on those fields — they use ClickUp's status
  and last-updated timestamp directly, so they're accurate today.
