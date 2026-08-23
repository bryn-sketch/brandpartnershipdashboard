import { readFile } from "node:fs/promises";
import { computeClientMetrics } from "../metrics.mjs";
import { FIELD_IDS } from "../config.mjs";

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
    date_updated: c.date_updated,
    date_created: c.date_created,
    date_closed: c.date_closed,
    custom_fields: [
      { id: FIELD_IDS.conversationStart, value: c.conversation_start_date },
      { id: FIELD_IDS.dealClosed, value: c.deal_closed_date },
      { id: FIELD_IDS.paidValue, value: c.paid_value },
      { id: FIELD_IDS.giftedValue, value: c.gifted_value },
      {
        id: FIELD_IDS.partnershipType,
        value: (c.partnership_types || []).map((l) => LABEL_TO_ID[l]).filter(Boolean),
        type_config: { options: OPTIONS },
      },
    ],
  };
}

const file = process.argv[2];
const fixture = JSON.parse(await readFile(file, "utf8"));
const rawTasks = fixture.tasks.map(toRawTask);
const metrics = computeClientMetrics({ slug: "test", name: fixture.client_name }, rawTasks, new Date("2026-08-23T00:00:00Z"));
console.log(JSON.stringify(metrics, null, 2));
