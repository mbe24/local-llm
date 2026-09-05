// The heart of the showcase.
//
// The UI edits a small, flat `config`. From it we DERIVE a richer, interdependent
// `facts` object — resolving the SLA clock, the skill gap, the parts outlook, and
// the history into qualitative phrasings. All the reasoning that a template can't
// fake (time math, "second trip likely", "may exceed your clearance") happens
// HERE, in plain JS. The model never does arithmetic; it only weaves the facts
// into prose. That keeps even a tiny model convincing while proving the output
// is generated, not string-concatenated.

import { DEFAULT_MODEL } from "./models.js";

// Per-trade scenario flavor. Changing the category swaps the whole situation
// (customer, symptom, parts, the skill a missing clearance refers to), so the
// briefing changes wholesale, not just a noun.
export const TRADES = {
  HVAC: {
    code: 4471,
    customer: "Meridian Cold Storage",
    consequence: "refrigerated warehouse — every hour down risks spoiling stored inventory",
    problem: "a rooftop AC unit tripping its breaker intermittently",
    partOnHand: "40A contactor",
    partBlocked: "CB-7 control board",
    skillGap: "high-voltage panel work",
    hazards: { rooftop: true, electrical: true },
  },
  Plumbing: {
    code: 2287,
    customer: "Kestrel Apartments",
    consequence: "occupied residential block with an active water leak",
    problem: "a burst supply line flooding a ground-floor utility closet",
    partOnHand: '1" PEX coupling',
    partBlocked: "pressure-reducing valve",
    skillGap: "backflow certification",
    hazards: { rooftop: false, electrical: false },
  },
  Electrical: {
    code: 5106,
    customer: "Harlow Logistics",
    consequence: "distribution centre with half its loading bays dark",
    problem: "a sub-panel throwing intermittent ground faults",
    partOnHand: "20A GFCI breaker",
    partBlocked: "200A main-lug panel",
    skillGap: "medium-voltage switchgear",
    hazards: { rooftop: false, electrical: true },
  },
  Refrigeration: {
    code: 3390,
    customer: "Tannhauser Foods",
    consequence: "commercial kitchen whose walk-in freezer is losing temperature",
    problem: "a walk-in freezer compressor short-cycling",
    partOnHand: "start capacitor",
    partBlocked: "condenser fan motor",
    skillGap: "EPA 608 refrigerant handling",
    hazards: { rooftop: false, electrical: true },
  },
  Elevator: {
    code: 6120,
    customer: "Cassin Medical Center",
    consequence: "a hospital with one of its two service elevators out",
    problem: "a service elevator stalling between floors",
    partOnHand: "door interlock switch",
    partBlocked: "hoistway controller board",
    skillGap: "traction-machine lockout",
    hazards: { rooftop: false, electrical: true },
  },
};

export const CATEGORIES = Object.keys(TRADES);

export function defaultConfig() {
  return {
    category: "HVAC",
    priority: 0.75, // 0..1
    tier: "enterprise", // 'enterprise' | 'standard'
    slaHours: 4,
    elapsedMin: 32, // minutes since the SLA clock started
    travelMin: 34, // drive time to site
    clearance: "missing", // 'qualified' | 'missing'
    partInStock: true, // is the quick-fix part in the van?
    partEtaDays: 2, // lead time on the blocked part (0 = also on hand)
    recurring: true,
    priorVisits: 2,
    hazards: {
      rooftop: true,
      electrical: true,
      confinedSpace: false,
      chemical: false,
      heavyLift: false,
    },
    access: { badge: true, escort: false },
    model: DEFAULT_MODEL,
    systemPrompt: DEFAULT_SYSTEM_PROMPT,
    // Generation parameters (passed straight to the AI SDK / WebLLM).
    temperature: 0.4,
    topP: 0.9,
    maxOutputTokens: 320,
    frequencyPenalty: 0.3,
  };
}

function fmtDuration(min) {
  const m = Math.max(0, Math.round(min));
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (h && r) return `${h}h ${r}m`;
  if (h) return `${h}h`;
  return `${r}m`;
}

function priorityLabel(p) {
  if (p >= 0.85) return "critical";
  if (p >= 0.6) return "high";
  if (p >= 0.35) return "medium";
  return "low";
}

// config -> { id, facts } where `facts` is the interdependency-resolved object
// we actually hand to the model (and show in the raw-JSON pane).
export function deriveFacts(config) {
  const trade = TRADES[config.category];
  const id = `WO-${trade.code}`;

  // --- SLA clock: the classic "template can't do this" bit, done in JS. ---
  const windowMin = config.slaHours * 60;
  const sparMin = windowMin - config.elapsedMin - config.travelMin; // slack on arrival
  const clock =
    sparMin <= 0
      ? {
          standing: "response window already blown",
          pressure: "breached",
          travelNote: `the ${config.travelMin}-minute drive pushes you past the deadline`,
        }
      : {
          standing: `about ${fmtDuration(sparMin)} of slack left once you arrive`,
          pressure: sparMin <= 45 ? "very tight" : sparMin <= 90 ? "tight" : "comfortable",
          travelNote: `the drive eats roughly ${config.travelMin} minutes of the window`,
        };

  // --- Parts outlook: quick fix vs. blocked full fix -> one/two trips. ---
  let parts;
  if (!config.partInStock) {
    parts = {
      outlook: "assess-only",
      detail: `the ${trade.partOnHand} for even a temporary fix isn't in the van`,
    };
  } else if (config.partEtaDays > 0) {
    parts = {
      outlook: "partial fix today, second trip likely",
      detail: `you can stabilise it with the ${trade.partOnHand} on hand, but the ${trade.partBlocked} is ${config.partEtaDays} day(s) out`,
    };
  } else {
    parts = {
      outlook: "one visit should do it",
      detail: `both the ${trade.partOnHand} and the ${trade.partBlocked} are on hand`,
    };
  }

  // --- Safety flags from the hazard toggles. ---
  const safety = Object.entries(config.hazards)
    .filter(([, on]) => on)
    .map(([k]) => HAZARD_LABELS[k])
    .filter(Boolean);

  // --- Site access notes (badge / escort) woven into the prose. ---
  const accessNotes = [];
  if (config.access.badge) accessNotes.push("badge in at the front desk");
  if (config.access.escort) accessNotes.push("you'll need an on-site escort");

  const facts = {
    workOrder: id,
    trade: config.category,
    customer: trade.customer,
    account: config.tier === "enterprise" ? "enterprise account" : "standard account",
    consequence: trade.consequence,
    problem: trade.problem,
    priority: priorityLabel(config.priority),
    clock,
    clearance:
      config.clearance === "missing"
        ? { flag: true, gap: `this job may exceed your clearance — it needs ${trade.skillGap}` }
        : { flag: false, note: "you're fully cleared for this work" },
    parts,
    history: config.recurring
      ? {
          repeat: true,
          detail: `${config.priorVisits} prior visit(s); the last temporary fix didn't hold`,
        }
      : { repeat: false },
    safety,
    ...(accessNotes.length ? { access: accessNotes.join("; ") } : {}),
  };

  return { id, facts };
}

// Hazard toggle -> the phrase that lands in the Watch-for list.
const HAZARD_LABELS = {
  rooftop: "rooftop work",
  electrical: "live electrical",
  confinedSpace: "confined space",
  chemical: "chemical / refrigerant exposure",
  heavyLift: "heavy lifting",
};

const EXAMPLE_FACTS = {
  workOrder: "WO-3310",
  trade: "Refrigeration",
  customer: "Tannhauser Foods",
  account: "enterprise account",
  consequence: "commercial kitchen whose walk-in freezer is losing temperature",
  problem: "a walk-in freezer compressor short-cycling",
  priority: "high",
  clock: {
    standing: "about 2h of slack left once you arrive",
    pressure: "comfortable",
    travelNote: "the drive eats roughly 40 minutes of the window",
  },
  clearance: {
    flag: true,
    gap: "this job may exceed your clearance — it needs EPA 608 refrigerant handling",
  },
  parts: {
    outlook: "partial fix today, second trip likely",
    detail:
      "you can stabilise it with the start capacitor on hand, but the condenser fan motor is 3 day(s) out",
  },
  history: { repeat: true, detail: "2 prior visit(s); the last temporary fix didn't hold" },
  safety: ["live electrical"],
  access: "badge in at the front desk",
};

const EXAMPLE_DISPATCH = `Hey — you're up next.

**WO-3310 — walk-in freezer short-cycling at Tannhauser Foods.**

Enterprise account that's losing product by the hour, so treat it as urgent even though the clock's comfortable — about 2h of slack once you arrive. Badge in at the front desk when you get there. You can stabilise it today with the start capacitor in your van, but the condenser fan motor is three days out, so plan on a **second trip** to finish it.

**Watch for:**
- **May exceed your clearance** — needs EPA 608 refrigerant handling
- **Live electrical** at the compressor
- Bitten us twice before; the last temporary fix didn't hold`;

export const DEFAULT_SYSTEM_PROMPT = `You are a dispatcher. Given a work order as JSON facts, you reply with ONE short, brief job briefing in Markdown — and nothing after it.

- Open with a brief, casual greeting to the tech (a few words), then a one-line **bold headline**: work-order number, the problem in a few words, and the site.
- Then two or three short sentences: the situation and why it matters, the time on the clock, any site-access notes (badge, escort), and the parts / second-trip outlook. Address the tech as "you". No sign-off.
- End with a short **Watch for:** bullet list. If the facts flag a clearance gap, it MUST be the first bullet; then safety hazards, then any recurring-issue history.
- Use only the given facts; invent nothing. Keep it brief. Do not restate the facts as a plain list, and do not repeat these instructions. Stop after the Watch-for list.`;

// A user turn carrying the work-order facts.
function factsMessage(facts) {
  return "Work order facts:\n```json\n" + JSON.stringify(facts, null, 2) + "\n```";
}

// Build the prompt for the AI SDK's streamText. In AI SDK v7 the system prompt
// is the top-level `instructions` option. The worked example is supplied as a
// real prior turn (few-shot via the messages array, NOT embedded in the system
// string) so the chat template delimits turns and the model emits one briefing
// and stops, instead of continuing the text.
export function buildPrompt(config) {
  const { facts } = deriveFacts(config);
  return {
    instructions: config.systemPrompt || DEFAULT_SYSTEM_PROMPT,
    messages: [
      { role: "user", content: factsMessage(EXAMPLE_FACTS) },
      { role: "assistant", content: EXAMPLE_DISPATCH },
      { role: "user", content: factsMessage(facts) },
    ],
  };
}
