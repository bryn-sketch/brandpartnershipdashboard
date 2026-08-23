# Partnership Performance Dashboard

Per-client dashboard pulled nightly from ClickUp's **UL ROSTER** space, where
each client folder's **🤝 PARTNER DEVELOPMENT** list holds one task per brand
being pitched. See `scripts/config.mjs` for the client → ClickUp list mapping.

Each client's ClickUp statuses are read one of two ways, controlled by
whether that client has a `statusBuckets` entry in `scripts/config.mjs`:

- **Bucketed** (current default): the client's ClickUp statuses have been
  renamed to map directly onto dashboard categories — `follow up` / `in
  communication` → Bites, `meetings` → Meetings, and `gifted` / `affiliate`
  / `unpaid` / `paid` → Landed. Any other status (`pending approval`,
  `initial outreach`, `complete`, `passed`, or any other leftover status)
  is excluded from the dashboard entirely — no forward movement, or
  already closed out.
- **Legacy** (fallback for a client without `statusBuckets`): stage order
  + the Partnership Type custom field, per the original pipeline
  (`pending approval → initial outreach → follow up → in communication →
  client meeting booked → gifting secured/affiliate partners → deal
  secured → active partnership → complete`).

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
`scripts/config.mjs`, pointing at that folder's "🤝 PARTNER DEVELOPMENT" list
ID. If that list's statuses have already been renamed to match the bucketed
scheme (see above), add a `statusBuckets` entry too, copying the shape used
for the existing clients — otherwise it falls back to the legacy logic.

## Known data gaps

- **Conversation Start Date** and **Deal Closed Date** drive "new bites by
  month" and the paid-value-by-month trend chart. Where these aren't filled
  in on a brand's task, that brand simply won't show up in those specific
  views (the dashboard says so explicitly rather than faking data) — the
  Bites/Meetings/Landed pipeline counts don't depend on them at all.
- **Paid Value** / **Gifted Value** dollar totals only reflect what's
  actually filled in on each task — a brand with no dollar amount logged
  still counts toward its bucket, just contributes $0.
