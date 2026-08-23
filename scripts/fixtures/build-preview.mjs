// Dev-only: builds docs/data.json from the partial real ClickUp fixtures
// gathered during initial setup (some tasks only have status, not full custom
// fields, due to a temporary API rate limit hit while previewing). This is
// NOT used by the production nightly Action — that always pulls live,
// complete data straight from ClickUp's REST API. Safe to delete once the
// dashboard has run for real at least once.
import { readFile, writeFile } from "node:fs/promises";
import { CLIENTS, FIELD_IDS } from "../config.mjs";
import { computeClientMetrics } from "../metrics.mjs";

const LABEL_TO_ID = {
  PAID: "b6c3f40d-6f7a-4bd0-820f-b69bd9f9b026",
  UNPAID: "ccbee68f-a8cc-4342-8e67-e6b3b32cc09a",
  AFFILIATE: "8778f99b-e2d0-4bae-a401-1e76e7fc6dc7",
  GIFTING: "facbe8f4-6a37-429c-901b-7a904dc13075",
};
const OPTIONS = Object.entries(LABEL_TO_ID).map(([label, id]) => ({ id, label }));

function toRawTask(c) {
  return {
    id: c.id,
    name: c.name,
    status: { status: c.status },
    date_updated: c.date_updated ?? null,
    date_created: c.date_created ?? null,
    date_closed: c.date_closed ?? null,
    custom_fields: [
      { id: FIELD_IDS.conversationStart, value: c.conversation_start_date ?? null },
      { id: FIELD_IDS.dealClosed, value: c.deal_closed_date ?? null },
      { id: FIELD_IDS.paidValue, value: c.paid_value ?? null },
      { id: FIELD_IDS.giftedValue, value: c.gifted_value ?? null },
      {
        id: FIELD_IDS.partnershipType,
        value: (c.partnership_types || []).map((l) => LABEL_TO_ID[l]).filter(Boolean),
        type_config: { options: OPTIONS },
      },
    ],
  };
}

async function loadJSON(path) {
  return JSON.parse(await readFile(new URL(path, import.meta.url), "utf8"));
}

// Merges a full {id,name,status} inventory with a partial set of fully
// detailed records (custom fields + dates). Tasks without detail get null
// custom-field values (matches reality: unconfirmed but overwhelmingly
// likely empty, since every checked task in every list had them empty).
function mergeInventory(allTasks, detailed) {
  const detailedById = new Map(detailed.map((t) => [t.id, t]));
  return allTasks.map((t) => detailedById.get(t.id) || { ...t, date_updated: null, date_created: null, date_closed: null, conversation_start_date: null, deal_closed_date: null, paid_value: null, gifted_value: null, partnership_types: [] });
}

async function main() {
  const michele = await loadJSON("./michele.json");
  const vadaliAll = await loadJSON("./vadali_all_tasks.json");
  const vadaliDetailed = await loadJSON("./vadali_detailed_53.json");
  const jordynAll = await loadJSON("./jordyn_all_tasks.json");
  const jordynDetailed = await loadJSON("./jordyn_detailed_51.json");

  const compactByClient = {
    vadali: mergeInventory(vadaliAll, vadaliDetailed),
    jordyn: mergeInventory(jordynAll, jordynDetailed),
    michele: michele.tasks,
  };

  const now = new Date();
  const clients = CLIENTS.map((client) => {
    const compactTasks = compactByClient[client.slug];
    const rawTasks = compactTasks.map(toRawTask);
    return computeClientMetrics(client, rawTasks, now);
  });

  const data = { generatedAt: now.toISOString(), clients, preview: true };
  await writeFile(new URL("../../docs/data.json", import.meta.url), JSON.stringify(data, null, 2));
  console.log("Wrote docs/data.json (preview, partial real data)");
  for (const c of clients) {
    console.log(`  ${c.name}: ${c.totalBrands} brands, ${c.kpis.meetingsCount} meetings+, ${c.funnel.landed} landed`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
