import {
  FIELD_IDS,
  STAGE_ORDER,
  STAGE_LABELS,
  MEETING_MIN_RANK,
  BITE_MIN_RANK,
  LANDED_STATUSES,
  PLACEHOLDER_NAME_PATTERN,
  AGING_DAYS_THRESHOLD,
  AGING_EXCLUDED_STATUSES,
} from "./config.mjs";

const MONTH_LABELS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function findCustomField(task, fieldId) {
  return (task.custom_fields || []).find((f) => f.id === fieldId) || null;
}

function cfNumber(task, fieldId) {
  const f = findCustomField(task, fieldId);
  if (!f || f.value === undefined || f.value === null) return null;
  const n = Number(f.value);
  return Number.isFinite(n) ? n : null;
}

function cfDateMs(task, fieldId) {
  const f = findCustomField(task, fieldId);
  if (!f || f.value === undefined || f.value === null) return null;
  const n = Number(f.value);
  return Number.isFinite(n) ? n : null;
}

function cfLabels(task, fieldId) {
  const f = findCustomField(task, fieldId);
  if (!f || !Array.isArray(f.value) || f.value.length === 0) return [];
  const options = (f.type_config && f.type_config.options) || [];
  const byId = new Map(options.map((o) => [o.id, o.label || o.name]));
  return f.value.map((id) => byId.get(id)).filter(Boolean);
}

function monthKey(ms) {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function isPlaceholder(task) {
  return PLACEHOLDER_NAME_PATTERN.test(task.name || "");
}

// Builds the trailing `count` calendar months, oldest first, ending with `now`'s month.
function trailingMonths(now, count) {
  const months = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    months.push({ key: `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`, label: MONTH_LABELS[d.getUTCMonth()] });
  }
  return months;
}

function enrichTask(t) {
  const status = (t.status && t.status.status ? t.status.status : t.status || "").toLowerCase();
  return {
    id: t.id,
    name: t.name,
    status,
    rank: STAGE_ORDER.indexOf(status),
    dateUpdated: Number(t.date_updated) || null,
    dateCreated: Number(t.date_created) || null,
    conversationStart: cfDateMs(t, FIELD_IDS.conversationStart),
    dealClosed: cfDateMs(t, FIELD_IDS.dealClosed),
    paidValue: cfNumber(t, FIELD_IDS.paidValue) || 0,
    giftedValue: cfNumber(t, FIELD_IDS.giftedValue) || 0,
    partnershipTypes: cfLabels(t, FIELD_IDS.partnershipType),
  };
}

function bitesByMonthTrend(tasks, now, dateOf) {
  const months = trailingMonths(now, 6);
  const byMonth = new Map(months.map((m) => [m.key, 0]));
  let hasData = false;
  for (const t of tasks) {
    const ms = dateOf(t);
    if (!ms) continue;
    hasData = true;
    const key = monthKey(ms);
    if (byMonth.has(key)) byMonth.set(key, byMonth.get(key) + 1);
  }
  const currentKey = months[months.length - 1].key;
  const priorKey = months[months.length - 2].key;
  return {
    thisMonth: byMonth.get(currentKey) || 0,
    priorMonth: byMonth.get(priorKey) || 0,
    hasData,
  };
}

function valueByMonthTrend(tasks, now, dateOf, valueOf) {
  const months = trailingMonths(now, 6);
  const byMonth = new Map(months.map((m) => [m.key, 0]));
  let hasData = false;
  for (const t of tasks) {
    const ms = dateOf(t);
    const value = valueOf(t);
    if (!ms || !value) continue;
    hasData = true;
    const key = monthKey(ms);
    if (byMonth.has(key)) byMonth.set(key, byMonth.get(key) + value);
  }
  return { trend: months.map((m) => ({ label: m.label, value: byMonth.get(m.key) || 0 })), hasData };
}

function computeAging(tasks, now, isTrackable) {
  let mostRecentUpdate = null;
  const agingBrands = [];
  for (const t of tasks) {
    if (t.dateUpdated && (!mostRecentUpdate || t.dateUpdated > mostRecentUpdate)) {
      mostRecentUpdate = t.dateUpdated;
    }
    if (!t.dateUpdated || !isTrackable(t)) continue;
    const daysSince = (now.getTime() - t.dateUpdated) / 86400000;
    if (daysSince >= AGING_DAYS_THRESHOLD) {
      agingBrands.push({ name: t.name, status: t.status, daysSince: Math.floor(daysSince) });
    }
  }
  agingBrands.sort((a, b) => b.daysSince - a.daysSince);
  return { mostRecentUpdate, agingBrands };
}

// New-style: client's ClickUp statuses were renamed to map directly onto
// dashboard categories. Any status not listed in any bucket (e.g. "pending
// approval", "initial outreach", "complete", "passed") is excluded from the
// dashboard entirely — it represents no forward movement or is a closed-out
// legacy record, per Bryn's direction on the Vadali list.
function computeBucketedMetrics(client, enriched, now) {
  const buckets = client.statusBuckets;
  const inBucket = (name) => enriched.filter((t) => buckets[name].includes(t.status));

  const bitesTasks = inBucket("bites");
  const meetingsTasks = inBucket("meetings");
  const giftedTasks = inBucket("gifted");
  const affiliateTasks = inBucket("affiliate");
  const unpaidTasks = inBucket("unpaid");
  const paidTasks = inBucket("paid");
  const landedTasks = [...giftedTasks, ...affiliateTasks, ...unpaidTasks, ...paidTasks];
  const trackedTasks = [...bitesTasks, ...meetingsTasks, ...landedTasks];

  const statusCounts = {};
  for (const t of enriched) statusCounts[t.status] = (statusCounts[t.status] || 0) + 1;

  // Only bites/meetings are still "in play" and need an aging flag — landed
  // deals are resolved, and everything else is already excluded.
  const inProgressIds = new Set([...bitesTasks, ...meetingsTasks].map((t) => t.id));
  const { mostRecentUpdate, agingBrands } = computeAging(enriched, now, (t) => inProgressIds.has(t.id));

  const bites = bitesByMonthTrend(bitesTasks, now, (t) => t.conversationStart);
  const giftedValueTotal = giftedTasks.reduce((sum, t) => sum + t.giftedValue, 0);
  const paidValueTotal = paidTasks.reduce((sum, t) => sum + t.paidValue, 0);

  const { trend, hasData: trendHasData } = valueByMonthTrend(paidTasks, now, (t) => t.dealClosed, (t) => t.paidValue);

  const currentYear = now.getUTCFullYear();
  const ytdPaid = paidTasks.filter((t) => t.dealClosed && new Date(t.dealClosed).getUTCFullYear() === currentYear);
  const ytdGifted = giftedTasks.filter((t) => t.dealClosed && new Date(t.dealClosed).getUTCFullYear() === currentYear);
  const ytdValueLanded = ytdPaid.reduce((s, t) => s + t.paidValue, 0) + ytdGifted.reduce((s, t) => s + t.giftedValue, 0);
  const avgPaidDeal = ytdPaid.length > 0 ? ytdPaid.reduce((s, t) => s + t.paidValue, 0) / ytdPaid.length : 0;

  return {
    slug: client.slug,
    name: client.name,
    totalBrands: trackedTasks.length,
    activeCount: bitesTasks.length + meetingsTasks.length,
    statusCounts,
    lastActivityAt: mostRecentUpdate,
    agingBrands,
    isAging: agingBrands.length > 0,
    kpis: {
      meetingsCount: meetingsTasks.length,
      newBitesThisMonth: bites.thisMonth,
      newBitesPriorMonth: bites.priorMonth,
      bitesHaveData: bites.hasData,
      paidCount: paidTasks.length,
      paidValueTotal,
      giftedCount: giftedTasks.length,
      giftedValueTotal,
      unpaidCount: unpaidTasks.length,
      affiliateCount: affiliateTasks.length,
    },
    funnel: { bites: bitesTasks.length, meetings: meetingsTasks.length, landed: landedTasks.length },
    trend,
    trendHasData,
    ytd: { valueLanded: ytdValueLanded, avgPaidDeal, unpaidOpps: unpaidTasks.length },
    stageLabels: STAGE_LABELS,
  };
}

// Legacy: pipeline-stage order + Partnership Type label, for clients whose
// ClickUp statuses haven't been migrated to the direct-bucket scheme yet.
function computeLegacyMetrics(client, enriched, now) {
  const statusCounts = {};
  for (const t of enriched) statusCounts[t.status] = (statusCounts[t.status] || 0) + 1;

  const { mostRecentUpdate, agingBrands } = computeAging(enriched, now, (t) => !AGING_EXCLUDED_STATUSES.has(t.status));

  const activeCount = enriched.filter((t) => t.status !== "complete" && t.status !== "passed").length;
  const meetingsCount = enriched.filter((t) => t.rank >= MEETING_MIN_RANK).length;
  const landedCount = enriched.filter((t) => LANDED_STATUSES.has(t.status)).length;
  const bitesCount = enriched.filter((t) => t.rank >= BITE_MIN_RANK).length;

  const bites = bitesByMonthTrend(enriched, now, (t) => t.conversationStart);

  let paidCount = 0, paidValueTotal = 0;
  let giftedCount = 0, giftedValueTotal = 0;
  let unpaidCount = 0;
  let affiliateCount = 0;
  for (const t of enriched) {
    if (t.partnershipTypes.includes("PAID")) { paidCount += 1; paidValueTotal += t.paidValue; }
    if (t.partnershipTypes.includes("GIFTING")) { giftedCount += 1; giftedValueTotal += t.giftedValue; }
    if (t.partnershipTypes.includes("UNPAID")) unpaidCount += 1;
    if (t.partnershipTypes.includes("AFFILIATE")) affiliateCount += 1;
  }

  const { trend, hasData: trendHasData } = valueByMonthTrend(enriched, now, (t) => t.dealClosed, (t) => t.paidValue);

  const currentYear = now.getUTCFullYear();
  let ytdValueLanded = 0, ytdPaidDealCount = 0, ytdPaidValueSum = 0;
  for (const t of enriched) {
    if (!t.dealClosed || new Date(t.dealClosed).getUTCFullYear() !== currentYear) continue;
    ytdValueLanded += t.paidValue + t.giftedValue;
    if (t.partnershipTypes.includes("PAID") && t.paidValue > 0) {
      ytdPaidDealCount += 1;
      ytdPaidValueSum += t.paidValue;
    }
  }
  const avgPaidDeal = ytdPaidDealCount > 0 ? ytdPaidValueSum / ytdPaidDealCount : 0;

  return {
    slug: client.slug,
    name: client.name,
    totalBrands: enriched.length,
    activeCount,
    statusCounts,
    lastActivityAt: mostRecentUpdate,
    agingBrands,
    isAging: agingBrands.length > 0,
    kpis: {
      meetingsCount,
      newBitesThisMonth: bites.thisMonth,
      newBitesPriorMonth: bites.priorMonth,
      bitesHaveData: bites.hasData,
      paidCount,
      paidValueTotal,
      giftedCount,
      giftedValueTotal,
      unpaidCount,
      affiliateCount,
    },
    funnel: { bites: bitesCount, meetings: meetingsCount, landed: landedCount },
    trend,
    trendHasData,
    ytd: { valueLanded: ytdValueLanded, avgPaidDeal, unpaidOpps: unpaidCount },
    stageLabels: STAGE_LABELS,
  };
}

export function computeClientMetrics(client, rawTasks, now = new Date()) {
  const enriched = rawTasks.filter((t) => !isPlaceholder(t)).map(enrichTask);
  return client.statusBuckets
    ? computeBucketedMetrics(client, enriched, now)
    : computeLegacyMetrics(client, enriched, now);
}
