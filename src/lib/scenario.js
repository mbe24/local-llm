// The heart of the showcase.
//
// The UI edits a small, flat `config`. From it we DERIVE a terse, structured
// `facts` data model — enums, numbers, booleans, short labels — NOT prose.
// The reasoning a template can't fake (SLA slack, the second-trip decision,
// the clearance flag) happens HERE, in plain JS, but it emits VALUES, not
// sentences. The MODEL does the real work: turning that data into natural
// language. Rule: values yes, sentences no. And never make the model do
// arithmetic — JS formats durations before they reach it.

import { DEFAULT_MODEL } from "./models.js";

// Per-trade scenario flavor. Changing the category swaps the whole situation
// (customer, symptom, parts, the skill a missing clearance refers to), so the
// briefing changes wholesale, not just a noun. Every field here is terse data:
// short noun phrases and labels, never a full sentence.
export const TRADES = {
  HVAC: {
    code: 4471,
    customer: "Meridian Cold Storage",
    environment: "refrigerated warehouse",
    downtimeImpact: "spoils stored inventory",
    problem: "rooftop AC unit tripping breaker intermittently",
    quickFixPart: "40A contactor",
    fullFixPart: "CB-7 control board",
    requiredSkill: "high-voltage panel",
  },
  Plumbing: {
    code: 2287,
    customer: "Kestrel Apartments",
    environment: "occupied residential block",
    downtimeImpact: "active water leak",
    problem: "burst supply line flooding a utility closet",
    quickFixPart: '1" PEX coupling',
    fullFixPart: "pressure-reducing valve",
    requiredSkill: "backflow certification",
  },
  Electrical: {
    code: 5106,
    customer: "Harlow Logistics",
    environment: "distribution centre",
    downtimeImpact: "half the loading bays dark",
    problem: "sub-panel throwing intermittent ground faults",
    quickFixPart: "20A GFCI breaker",
    fullFixPart: "200A main-lug panel",
    requiredSkill: "medium-voltage switchgear",
  },
  Refrigeration: {
    code: 3390,
    customer: "Tannhauser Foods",
    environment: "commercial kitchen",
    downtimeImpact: "walk-in freezer losing temperature",
    problem: "walk-in freezer compressor short-cycling",
    quickFixPart: "start capacitor",
    fullFixPart: "condenser fan motor",
    requiredSkill: "EPA 608 refrigerant handling",
  },
  Elevator: {
    code: 6120,
    customer: "Cassin Medical Center",
    environment: "hospital",
    downtimeImpact: "one of two service elevators out",
    problem: "service elevator stalling between floors",
    quickFixPart: "door interlock switch",
    fullFixPart: "hoistway controller board",
    requiredSkill: "traction-machine lockout",
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

// config -> { id, facts } where `facts` is a terse structured DATA model (enums,
// numbers, booleans, short labels — never sentences). Shown verbatim in the
// raw-JSON pane and handed to the model, whose job is to voice it as prose.
export function deriveFacts(config) {
  const trade = TRADES[config.category];
  const id = `WO-${trade.code}`;

  // --- SLA clock: the arithmetic is done here; only VALUES escape. ---
  const windowMin = config.slaHours * 60;
  const sparMin = windowMin - config.elapsedMin - config.travelMin; // slack on arrival
  const sla = {
    window_min: windowMin,
    elapsed_min: config.elapsedMin,
    travel_min: config.travelMin,
  };
  if (sparMin <= 0) {
    sla.overdue_by = fmtDuration(-sparMin); // JS formats the duration, not the model
    sla.status = "breached";
  } else {
    sla.slack_on_arrival = fmtDuration(sparMin);
    sla.status = sparMin <= 45 ? "very_tight" : sparMin <= 90 ? "tight" : "comfortable";
  }

  // --- Parts outlook: quick fix vs. blocked full fix -> the decision as an enum. ---
  let outlook;
  if (!config.partInStock) outlook = "assess_only";
  else if (config.partEtaDays > 0) outlook = "second_trip";
  else outlook = "one_visit";

  const parts = {
    quick_fix: { part: trade.quickFixPart, in_van: config.partInStock },
    full_fix: { part: trade.fullFixPart, eta_days: config.partEtaDays },
    outlook,
  };

  // --- Hazards as enum tags. ---
  const hazards = Object.entries(config.hazards)
    .filter(([, on]) => on)
    .map(([k]) => HAZARD_TAGS[k])
    .filter(Boolean);

  const facts = {
    work_order: id,
    trade: config.category.toLowerCase(),
    problem: trade.problem,
    site: {
      customer: trade.customer,
      account: config.tier, // "enterprise" | "standard"
      environment: trade.environment,
      downtime_impact: trade.downtimeImpact,
    },
    priority: priorityLabel(config.priority),
    sla,
    clearance:
      config.clearance === "missing"
        ? { cleared: false, required_skill: trade.requiredSkill }
        : { cleared: true },
    parts,
    history: config.recurring
      ? { recurring: true, prior_visits: config.priorVisits, last_temp_fix_held: false }
      : { recurring: false },
    hazards,
    access: {
      badge: config.access.badge ? "required" : "not_required",
      escort: config.access.escort ? "required" : "not_required",
    },
  };

  return { id, facts };
}

// Hazard toggle -> the enum tag that lands in facts.hazards.
const HAZARD_TAGS = {
  rooftop: "rooftop",
  electrical: "live_electrical",
  confinedSpace: "confined_space",
  chemical: "chemical",
  heavyLift: "heavy_lifting",
};

const EXAMPLE_FACTS = {
  work_order: "WO-3310",
  trade: "refrigeration",
  problem: "walk-in freezer compressor short-cycling",
  site: {
    customer: "Tannhauser Foods",
    account: "enterprise",
    environment: "commercial kitchen",
    downtime_impact: "walk-in freezer losing temperature",
  },
  priority: "high",
  sla: {
    window_min: 240,
    elapsed_min: 30,
    travel_min: 40,
    slack_on_arrival: "2h 50m",
    status: "comfortable",
  },
  clearance: { cleared: false, required_skill: "EPA 608 refrigerant handling" },
  parts: {
    quick_fix: { part: "start capacitor", in_van: true },
    full_fix: { part: "condenser fan motor", eta_days: 3 },
    outlook: "second_trip",
  },
  history: { recurring: true, prior_visits: 2, last_temp_fix_held: false },
  hazards: ["live_electrical"],
  access: { badge: "required", escort: "not_required" },
};

const EXAMPLE_DISPATCH = `Hey — you're up next.

**WO-3310 — walk-in freezer short-cycling at Tannhauser Foods.**

Enterprise account that's losing product by the hour, so treat it as urgent even though the clock's comfortable — about 2h 50m of slack once you arrive. Badge in at the front desk when you get there. You can stabilise it today with the start capacitor in your van, but the condenser fan motor is three days out, so plan on a **second trip** to finish it.

**Watch for:**
- **May exceed your clearance** — needs EPA 608 refrigerant handling
- **Live electrical** at the compressor
- Bitten us twice before; the last temporary fix didn't hold`;

export const DEFAULT_SYSTEM_PROMPT = `You are a dispatcher. You are given a work order as terse structured JSON — enums, numbers, booleans and short labels — and you reply with ONE short, brief job briefing in Markdown, and nothing after it.

Your job is to turn that data into natural spoken language: expand the codes into plain English (e.g. status "comfortable" -> "the clock's comfortable"; outlook "second_trip" -> "plan on a second trip"; hazard "live_electrical" -> "live electrical"; access badge "required" -> "badge in at the desk"). Use the durations exactly as given — do not compute or change any numbers.

- Open with a brief, casual greeting to the tech (a few words), then a one-line **bold headline**: work-order number, the problem in a few words, and the site.
- Then two or three short sentences: the situation and why it matters, the time on the clock, any site-access requirements (badge, escort), and the parts / second-trip outlook. Address the tech as "you". No sign-off.
- End with a short **Watch for:** bullet list. If the tech is not cleared, that MUST be the first bullet; then the hazards, then any recurring-issue history.
- Use only the given facts; invent nothing. Keep it brief. Do not restate the data as a plain list, and do not repeat these instructions. Stop after the Watch-for list.`;

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
