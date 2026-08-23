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

// Builds the trailing 6 calendar months, oldest first, ending with `now`'s month.
function trailingMonths(now, count) {
  const months = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    months.push({ key: `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`, label: MONTH_LABELS[d.getUTCMonth()] });
  }
  return months;
}

export function computeClientMetrics(client, rawTasks, now = new Date()) {
  const tasks = rawTasks.filter((t) => !isPlaceholder(t));

  const enriched = tasks.map((t) => {
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
  });

  // ---- Roster / aging ----
  let mostRecentUpdate = null;
  const agingBrands = [];
  for (const t of enriched) {
    if (t.dateUpdated && (!mostRecentUpdate || t.dateUpdated > mostRecentUpdate)) {
      mostRecentUpdate = t.dateUpdated;
    }
    if (!t.dateUpdated || AGING_EXCLUDED_STATUSES.has(t.status)) continue;
    const daysSince = (now.getTime() - t.dateUpdated) / 86400000;
    if (daysSince >= AGING_DAYS_THRESHOLD) {
      agingBrands.push({ name: t.name, status: t.status, daysSince: Math.floor(daysSince) });
    }
  }
  agingBrands.sort((a, b) => b.daysSince - a.daysSince);

  const activeCount = enriched.filter((t) => t.status !== "complete" && t.status !== "passed").length;
  const meetingsCount = enriched.filter((t) => t.rank >= MEETING_MIN_RANK).length;
  const landedCount = enriched.filter((t) => LANDED_STATUSES.has(t.status)).length;

  // ---- Funnel (structural, current pipeline snapshot) ----
  const bitesCount = enriched.filter((t) => t.rank >= BITE_MIN_RANK).length;
  const funnel = { bites: bitesCount, meetings: meetingsCount, landed: landedCount };

  // ---- New bites by month (Conversation Start Date driven) ----
  const months = trailingMonths(now, 6);
  const bitesByMonth = new Map(months.map((m) => [m.key, 0]));
  let bitesHaveData = false;
  for (const t of enriched) {
    if (!t.conversationStart) continue;
    bitesHaveData = true;
    const key = monthKey(t.conversationStart);
    if (bitesByMonth.has(key)) bitesByMonth.set(key, bitesByMonth.get(key) + 1);
  }
  const currentMonthKey = months[months.length - 1].key;
  const priorMonthKey = months[months.length - 2].key;
  const newBitesThisMonth = bitesByMonth.get(currentMonthKey) || 0;
  const newBitesPriorMonth = bitesByMonth.get(priorMonthKey) || 0;

  // ---- Paid value landed by month (Deal Closed Date driven) ----
  const valueByMonth = new Map(months.map((m) => [m.key, 0]));
  let trendHasData = false;
  for (const t of enriched) {
    if (!t.dealClosed || !t.paidValue) continue;
    trendHasData = true;
    const key = monthKey(t.dealClosed);
    if (valueByMonth.has(key)) valueByMonth.set(key, valueByMonth.get(key) + t.paidValue);
  }
  const trend = months.map((m) => ({ label: m.label, value: valueByMonth.get(m.key) || 0 }));

  // ---- Type-driven KPIs (only counts brands with an explicit Partnership Type label) ----
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

  // ---- YTD value landed + avg paid deal (Deal Closed Date driven) ----
  const currentYear = now.getUTCFullYear();
  let ytdValueLanded = 0;
  let ytdPaidDealCount = 0;
  let ytdPaidValueSum = 0;
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
    lastActivityAt: mostRecentUpdate,
    agingBrands,
    isAging: agingBrands.length > 0,
    kpis: {
      meetingsCount,
      newBitesThisMonth,
      newBitesPriorMonth,
      bitesHaveData,
      paidCount,
      paidValueTotal,
      giftedCount,
      giftedValueTotal,
      unpaidCount,
      affiliateCount,
    },
    funnel,
    trend,
    trendHasData,
    ytd: {
      valueLanded: ytdValueLanded,
      avgPaidDeal,
      unpaidOpps: unpaidCount,
    },
    stageLabels: STAGE_LABELS,
  };
}
