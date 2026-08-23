import { writeFile } from "node:fs/promises";
import { CLIENTS } from "./config.mjs";
import { getAllTasks } from "./clickup.mjs";
import { computeClientMetrics } from "./metrics.mjs";

const token = process.env.CLICKUP_API_TOKEN;
if (!token) {
  console.error("Missing CLICKUP_API_TOKEN environment variable.");
  process.exit(1);
}

const now = new Date();

async function main() {
  const clients = [];
  for (const client of CLIENTS) {
    console.log(`Fetching tasks for ${client.name}...`);
    const tasks = await getAllTasks(client.listId, token);
    const metrics = computeClientMetrics(client, tasks, now);
    clients.push(metrics);
    console.log(`  ${tasks.length} tasks fetched, ${metrics.totalBrands} counted after filtering placeholders.`);
  }

  const data = {
    generatedAt: now.toISOString(),
    clients,
  };

  await writeFile(new URL("../docs/data.json", import.meta.url), JSON.stringify(data, null, 2));
  console.log("Wrote docs/data.json");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
