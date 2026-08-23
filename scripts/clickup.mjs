import { CLICKUP_API } from "./config.mjs";

async function clickupGet(path, token) {
  const res = await fetch(`${CLICKUP_API}${path}`, {
    headers: { Authorization: token },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`ClickUp API ${res.status} on ${path}: ${body}`);
  }
  return res.json();
}

// Fetches every task in a list, including closed ones, with custom fields
// inlined (ClickUp's task endpoint includes custom_fields by default).
export async function getAllTasks(listId, token) {
  const tasks = [];
  let page = 0;
  for (;;) {
    const data = await clickupGet(
      `/list/${listId}/task?include_closed=true&subtasks=true&page=${page}`,
      token,
    );
    const batch = data.tasks || [];
    tasks.push(...batch);
    if (batch.length < 100) break;
    page += 1;
  }
  return tasks;
}
