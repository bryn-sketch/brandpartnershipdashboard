export const CLICKUP_API = "https://api.clickup.com/api/v2";

// One entry per client folder in the "UL ROSTER" ClickUp space. Each folder's
// "🤝 PARTNER DEVELOPMENT" list holds one task per brand being pitched.
export const CLIENTS = [
  {
    slug: "vadali",
    name: "Dr. Sirisha Vadali, Vadali MD",
    folderId: "90117930542",
    listId: "901113694845",
  },
  {
    slug: "jordyn",
    name: "Jordyn Koveleski Gorman, Eat Play Say",
    folderId: "90116406037",
    listId: "901112785638",
  },
  {
    slug: "michele",
    name: "Michele Williams, HomeCareCoaching",
    folderId: "90118081829",
    listId: "901114006454",
  },
];

// Custom field IDs, shared across all "PARTNER DEVELOPMENT" lists.
export const FIELD_IDS = {
  conversationStart: "c726262e-f8c3-41b0-82dd-16ee5e757ef2",
  dealClosed: "f7e4cc2a-ae02-4336-b36c-5559eedb8201",
  paidValue: "2ff5cfa9-6c4e-4b3c-bbbe-1b18248e847c",
  giftedValue: "4c355692-440a-4d74-8c34-a9d9d7a1b124",
  partnershipType: "8cde1916-1096-40f2-b087-5b096226cad1",
};

// Canonical pipeline order, low to high. "passed" is a terminal drop-out and
// deliberately excluded from forward progression so it never counts as
// "reached" a later stage. "client deals" only appears in some lists (an
// extra one-off status) and is treated as the same tier as "deal secured".
export const STAGE_ORDER = [
  "pending approval",
  "initial outreach",
  "follow up",
  "in communication",
  "client meeting booked",
  "gifting secured",
  "affiliate partners",
  "client deals",
  "deal secured",
  "active partnership",
  "complete",
];

export const STAGE_LABELS = {
  "pending approval": "Pending Approval",
  "initial outreach": "Initial Outreach",
  "follow up": "Follow Up",
  "in communication": "In Communication",
  "client meeting booked": "Client Meeting Booked",
  "gifting secured": "Sending Product",
  "affiliate partners": "Current Affiliate Partner",
  "client deals": "Client Deals",
  "deal secured": "Deal Secured",
  "active partnership": "Active Partnership",
  "complete": "Campaign Completed",
  "passed": "Passed",
};

export const MEETING_MIN_RANK = STAGE_ORDER.indexOf("client meeting booked");
export const BITE_MIN_RANK = STAGE_ORDER.indexOf("initial outreach");
export const LANDED_STATUSES = new Set([
  "gifting secured",
  "affiliate partners",
  "client deals",
  "deal secured",
  "active partnership",
  "complete",
]);

export const PLACEHOLDER_NAME_PATTERN = /^\s*\[.*\]\s*$/;

export const AGING_DAYS_THRESHOLD = 21;
// Brands that are done (won or lost) don't need an aging flag even if untouched since.
export const AGING_EXCLUDED_STATUSES = new Set(["complete", "passed"]);
