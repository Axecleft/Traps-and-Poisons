/**
 * Axecleft's Traps, Poisons, and Diseases — SRD trap-building rules
 *
 * Rules-based trap templates (poison gas, poisoned/diseased pits, needles,
 * darts, contaminated objects, tainted food/water, tainted water-filled rooms).
 * Every trap's CR is the sum of the SRD "CR Modifiers for Mechanical Traps".
 * Pure JavaScript: no Foundry calls, so it can be tested outside Foundry.
 */

/* SRD poisons. `cr` is the SRD trap CR modifier; values marked * are the
   module's own (the SRD gives none for ingested poisons or drow poison). */
export const POISONS = [
  { key: "black adder venom", item: "Poison, Black Adder Venom", vector: "injury", dc: 11, dmg: "1d6 Con/1d6 Con", cr: 1 },
  { key: "small centipede poison", item: "Poison, Small Centipede Poison", vector: "injury", dc: 11, dmg: "1d2 Dex/1d2 Dex", cr: 1 },
  { key: "bloodroot", item: "Poison, Bloodroot", vector: "injury", dc: 12, dmg: "0/1d4 Con + 1d3 Wis", cr: 1 },
  { key: "drow poison", item: "Poison, Drow Poison", vector: "injury", dc: 13, dmg: "unconsciousness 1 minute/unconsciousness 2d4 hours", cr: 2 }, // *
  { key: "greenblood oil", item: "Poison, Greenblood Oil", vector: "injury", dc: 13, dmg: "1 Con/1d2 Con", cr: 1 },
  { key: "blue whinnis", item: "Poison, Blue Whinnis", vector: "injury", dc: 14, dmg: "1 Con/unconsciousness", cr: 1 },
  { key: "medium spider venom", item: "Poison, Medium Spider Venom", vector: "injury", dc: 14, dmg: "1d4 Str/1d4 Str", cr: 2 },
  { key: "shadow essence", item: "Poison, Shadow Essence", vector: "injury", dc: 17, dmg: "1 Str*/2d6 Str", cr: 3 },
  { key: "wyvern poison", item: "Poison, Wyvern", vector: "injury", dc: 17, dmg: "2d6 Con/2d6 Con", cr: 5 },
  { key: "large scorpion venom", item: "Poison, Large Scorpion Venom", vector: "injury", dc: 18, dmg: "1d6 Str/1d6 Str", cr: 3 },
  { key: "giant wasp poison", item: "Poison, Giant Wasp Poison", vector: "injury", dc: 18, dmg: "1d6 Dex/1d6 Dex", cr: 3 },
  { key: "deathblade", item: "Poison, Deathblade", vector: "injury", dc: 20, dmg: "1d6 Con/2d6 Con", cr: 5 },
  { key: "purple worm poison", item: "Poison, Purple Worm Poison", vector: "injury", dc: 24, dmg: "1d6 Str/2d6 Str", cr: 4 },
  { key: "nitharit", item: "Poison, Nitharit", vector: "contact", dc: 13, dmg: "0/3d6 Con", cr: 4 },
  { key: "sassone leaf residue", item: "Poison, Sassone Leaf Residue", vector: "contact", dc: 16, dmg: "2d12 hp/1d6 Con", cr: 3 },
  { key: "malyss root paste", item: "Poison, Malyss Root Paste", vector: "contact", dc: 16, dmg: "1 Dex/2d4 Dex", cr: 3 },
  { key: "terinav root", item: "Poison, Terinav Root", vector: "contact", dc: 16, dmg: "1d6 Dex/2d6 Dex", cr: 5 },
  { key: "black lotus extract", item: "Poison, Black Lotus Extract", vector: "contact", dc: 20, dmg: "3d6 Con/3d6 Con", cr: 8 },
  { key: "dragon bile", item: "Poison, Dragon Bile", vector: "contact", dc: 26, dmg: "3d6 Str/0", cr: 6 },
  { key: "ungol dust", item: "Poison, Ungol Dust", vector: "inhaled", dc: 15, dmg: "1 Cha/1d6 Cha + 1 Cha*", cr: 3 },
  { key: "insanity mist", item: "Poison, Insanity Mist", vector: "inhaled", dc: 15, dmg: "1d4 Wis/2d6 Wis", cr: 4 },
  { key: "burnt othur fumes", item: "Poison, Burnt Othur Fumes", vector: "inhaled", dc: 18, dmg: "1 Con*/3d6 Con", cr: 6 },
  { key: "striped toadstool", item: "Poison, Striped Toadstool", vector: "ingested", dc: 11, dmg: "1 Wis/2d6 Wis + 1d4 Int", cr: 1 }, // *
  { key: "arsenic", item: "Poison, Arsenic", vector: "ingested", dc: 13, dmg: "1 Con/1d8 Con", cr: 1 }, // *
  { key: "id moss", item: "Poison, Id Moss", vector: "ingested", dc: 14, dmg: "1d4 Int/2d6 Int", cr: 2 }, // *
  { key: "oil of taggit", item: "Poison, Oil of Taggit", vector: "ingested", dc: 15, dmg: "0/unconsciousness", cr: 2 }, // *
  { key: "lich dust", item: "Poison, Lich Dust", vector: "ingested", dc: 17, dmg: "2d6 Str/1d6 Str", cr: 3 }, // *
  { key: "dark reaver powder", item: "Poison, Dark Reaver Powder", vector: "ingested", dc: 18, dmg: "2d6 Con/1d6 Con + 1d6 Str", cr: 4 }, // *
];

/* SRD diseases (mummy rot excluded; it comes from mummies). CR modifiers are the module's own. */
export const DISEASES = [
  { key: "filth fever", item: "Disease, Filth Fever", vector: "injury", dc: 12, inc: "1d3 days", dmg: "1d3 Dex + 1d3 Con", cr: 1 },
  { key: "red ache", item: "Disease, Red Ache", vector: "injury", dc: 15, inc: "1d3 days", dmg: "1d6 Str", cr: 2 },
  { key: "devil chills", item: "Disease, Devil Chills", vector: "injury", dc: 14, inc: "1d4 days", dmg: "1d4 Str", cr: 2 },
  { key: "demon fever", item: "Disease, Demon Fever", vector: "injury", dc: 18, inc: "1 day", dmg: "1d6 Con", cr: 4 },
  { key: "shakes", item: "Disease, Shakes", vector: "contact", dc: 13, inc: "1 day", dmg: "1d8 Dex", cr: 2 },
  { key: "slimy doom", item: "Disease, Slimy Doom", vector: "contact", dc: 14, inc: "1 day", dmg: "1d4 Con", cr: 3 },
  { key: "cackle fever", item: "Disease, Cackle Fever", vector: "inhaled", dc: 16, inc: "1 day", dmg: "1d6 Wis", cr: 2 },
  { key: "mindfire", item: "Disease, Mindfire", vector: "inhaled", dc: 12, inc: "1 day", dmg: "1d4 Int", cr: 1 },
  { key: "blinding sickness", item: "Disease, Blinding Sickness", vector: "ingested", dc: 16, inc: "1d3 days", dmg: "1d4 Str", cr: 2 },
];

export const poisonByKey = (k) => POISONS.find((p) => p.key === String(k).toLowerCase().trim());
export const diseaseByKey = (k) => DISEASES.find((d) => d.key === String(k).toLowerCase().replace(/^the /, "").trim());
export const poisonText = (p) => `${p.key} [${p.vector}, Fort DC ${p.dc}, ${p.dmg}]`;
export const diseaseText = (d) => `${d.key} [${d.vector}, Fort DC ${d.dc}, incubation ${d.inc}, ${d.dmg}]`;

/* ---------- SRD CR modifiers ---------- */
const dcMod = (dc) => (dc <= 15 ? -1 : dc <= 24 ? 0 : dc <= 29 ? 1 : 2);
const atkMod = (b) => (b <= 0 ? -2 : b <= 5 ? -1 : b <= 14 ? 0 : b <= 19 ? 1 : b <= 24 ? 2 : 3);
const ONSET = { 1: 3, 2: 2, 3: 1, 4: -1, 5: -1 };
export function avgDice(expr) {
  return String(expr).split("+").reduce((sum, part) => {
    const m = part.trim().match(/^(\d+)d(\d+)$/);
    return sum + (m ? (+m[1] * (+m[2] + 1)) / 2 : +part || 0);
  }, 0);
}
/** +1 per 7 points of average damage, rounded to the nearest multiple of 7 (ties up). */
export const damageMod = (avg) => Math.floor(avg / 7 + 0.5);

/* DC bands: the CR only depends on the band; the exact DC is rolled inside it. */
const DC_BANDS = [[14, 15], [18, 24], [25, 28], [30, 30]];
const PIT_DC_BANDS = [[15, 15], [20, 20], [25, 25], [30, 30]];
const randInt = (lo, hi, rng) => lo + Math.floor(rng() * (hi - lo + 1));
const pickOne = (arr, rng) => arr[Math.floor(rng() * arr.length)];
const roundsText = (n) => `${n} round${n === 1 ? "" : "s"}`;

/* ---------- Template definitions ----------
   Each template lists its choices ("dims"); every combination of choices has a
   CR = sum of the choices' CR modifiers. text() writes the SRD-style stat line. */
const DEPTHS = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
const pitDims = {
  depth: DEPTHS.map((d) => ({ v: d, cr: damageMod(avgDice(`${d / 10}d6`)), label: `${d} ft. deep` })),
  reflex: PIT_DC_BANDS.map(([lo]) => ({ v: lo, cr: dcMod(lo), label: `DC ${lo} Reflex save` })),
  multi: [{ v: false, cr: 0, label: "Single target" }, { v: true, cr: 1, label: "Two adjacent squares" }],
};
const checkDims = {
  search: DC_BANDS.map(([lo, hi]) => ({ v: [lo, hi], cr: dcMod(lo), label: `Search DC ${lo}–${hi}` })),
  disable: DC_BANDS.map(([lo, hi]) => ({ v: [lo, hi], cr: dcMod(lo), label: `Disable Device DC ${lo}–${hi}` })),
};
const agentDim = (list) => list.map((a) => ({ v: a.key, cr: a.cr, label: `${a.key.replace(/\b\w/g, (c) => c.toUpperCase())} (+${a.cr})` }));
const pitText = (c, rng) => {
  const parts = [`DC ${c.reflex} Reflex save avoids`, `${c.depth} ft. deep (${c.depth / 10}d6, fall)`];
  if (c.multi) parts.push("multiple targets (first target in each of two adjacent 5 ft. squares)");
  return parts;
};
const checks = (c, rng) => [`Search DC ${randInt(...c.search, rng)}`, `Disable Device DC ${randInt(...c.disable, rng)}`];
const head = (name, cr, trig, reset) => [`${name}: CR ${cr}`, "mechanical", trig, reset];
const RESETS = ["manual reset", "repair reset"];
const OBJECTS = ["Doorknob", "Drawer Handle", "Lock", "Chest Lid", "Door Handle", "Book Cover", "Goblet Rim", "Lever"];
const byVector = (list, ...v) => list.filter((a) => v.includes(a.vector));

export const RULE_TEMPLATES = [
  {
    n: "Poison Gas Trap",
    dims: { agent: agentDim(byVector(POISONS, "inhaled")), onset: [1, 2, 3, 4].map((o) => ({ v: o, cr: ONSET[o], label: `Onset delay ${roundsText(o)}` })), ...checkDims },
    text: (c, cr, rng) => [...head("Poison Gas Trap", cr, "location trigger", pickOne(RESETS, rng)),
      `poison gas (${poisonText(poisonByKey(c.agent))})`, "multiple targets (all targets in a 10 ft. by 10 ft. room)", "never miss", `onset delay (${roundsText(c.onset)})`, ...checks(c, rng)],
  },
  {
    n: "Spore Cloud Trap",
    dims: { agent: agentDim(byVector(DISEASES, "inhaled")), onset: [1, 2, 3, 4].map((o) => ({ v: o, cr: ONSET[o], label: `Onset delay ${roundsText(o)}` })), ...checkDims },
    text: (c, cr, rng) => [...head("Spore Cloud Trap", cr, "location trigger", pickOne(RESETS, rng)),
      `disease (${diseaseText(diseaseByKey(c.agent))})`, "multiple targets (all targets in a 10 ft. by 10 ft. room)", "never miss", `onset delay (${roundsText(c.onset)})`, ...checks(c, rng)],
  },
  {
    n: "Gas-Filled Pit Trap",
    dims: { ...pitDims, agent: agentDim(byVector(POISONS, "inhaled")), onset: [1, 2, 3].map((o) => ({ v: o, cr: ONSET[o], label: `Onset delay ${roundsText(o)}` })), ...checkDims },
    text: (c, cr, rng) => [...head("Gas-Filled Pit Trap", cr, "location trigger", "manual reset"), ...pitText(c, rng),
      `poison gas (${poisonText(poisonByKey(c.agent))})`, "never miss", `onset delay (${roundsText(c.onset)})`, ...checks(c, rng)],
  },
  {
    n: "Poisoned Spiked Pit Trap",
    dims: { ...pitDims, agent: agentDim(byVector(POISONS, "injury", "contact")), spikes: [{ v: true, cr: 1, label: "Pit spikes (+1)" }], ...checkDims },
    text: (c, cr, rng) => [...head("Poisoned Spiked Pit Trap", cr, "location trigger", pickOne(RESETS, rng)), ...pitText(c, rng),
      `pit spikes (Atk +10 melee, 1d4 spikes per target for 1d4+${Math.min(5, c.depth / 10)} plus poison each)`, `poison (${poisonText(poisonByKey(c.agent))})`, ...checks(c, rng)],
  },
  {
    n: "Diseased Spiked Pit Trap",
    dims: { ...pitDims, agent: agentDim(byVector(DISEASES, "injury")), spikes: [{ v: true, cr: 1, label: "Pit spikes (+1)" }], ...checkDims },
    text: (c, cr, rng) => [...head("Diseased Spiked Pit Trap", cr, "location trigger", pickOne(RESETS, rng)), ...pitText(c, rng),
      `pit spikes (Atk +10 melee, 1d4 spikes per target for 1d4+${Math.min(5, c.depth / 10)} plus disease each)`, `disease (${diseaseText(diseaseByKey(c.agent))})`, ...checks(c, rng)],
  },
  {
    n: "Envenomed Needle Trap",
    dims: { agent: agentDim(byVector(POISONS, "injury", "contact")), atk: [8, 10, 12, 15, 17, 20].map((b) => ({ v: b, cr: atkMod(b), label: `Atk +${b}` })), ...checkDims },
    text: (c, cr, rng) => [...head("Envenomed Needle Trap", cr, "touch trigger", "manual reset"),
      `Atk +${c.atk} melee (1 plus poison, needle)`, `poison (${poisonText(poisonByKey(c.agent))})`, ...checks(c, rng)],
  },
  {
    n: "Diseased Needle Trap",
    dims: { agent: agentDim(byVector(DISEASES, "injury")), atk: [8, 10, 12, 15, 17, 20].map((b) => ({ v: b, cr: atkMod(b), label: `Atk +${b}` })), ...checkDims },
    text: (c, cr, rng) => [...head("Diseased Needle Trap", cr, "touch trigger", "manual reset"),
      `Atk +${c.atk} melee (1 plus disease, needle)`, `disease (${diseaseText(diseaseByKey(c.agent))})`, ...checks(c, rng)],
  },
  {
    n: "Envenomed Dart Trap",
    dims: { agent: agentDim(byVector(POISONS, "injury", "contact")), atk: [8, 10, 12, 15, 18].map((b) => ({ v: b, cr: atkMod(b), label: `Atk +${b}` })),
      bonus: [0, 1, 2, 4].map((k) => ({ v: k, cr: damageMod(2.5 + k), label: `Damage 1d4${k ? "+" + k : ""}` })),
      multi: [{ v: false, cr: 0, label: "Single target" }, { v: true, cr: 1, label: "1 dart per target in a 10 ft. by 10 ft. area" }], ...checkDims },
    text: (c, cr, rng) => [...head("Envenomed Dart Trap", cr, "location trigger", "manual reset"),
      `Atk +${c.atk} ranged (1d4${c.bonus ? "+" + c.bonus : ""} plus poison, dart)`, `poison (${poisonText(poisonByKey(c.agent))})`,
      ...(c.multi ? ["multiple targets (1 dart per target in a 10 ft. by 10 ft. area)"] : []), ...checks(c, rng)],
  },
  {
    n: "Diseased Dart Trap",
    dims: { agent: agentDim(byVector(DISEASES, "injury")), atk: [8, 10, 12, 15, 18].map((b) => ({ v: b, cr: atkMod(b), label: `Atk +${b}` })),
      bonus: [0, 1, 2, 4].map((k) => ({ v: k, cr: damageMod(2.5 + k), label: `Damage 1d4${k ? "+" + k : ""}` })),
      multi: [{ v: false, cr: 0, label: "Single target" }, { v: true, cr: 1, label: "1 dart per target in a 10 ft. by 10 ft. area" }], ...checkDims },
    text: (c, cr, rng) => [...head("Diseased Dart Trap", cr, "location trigger", "manual reset"),
      `Atk +${c.atk} ranged (1d4${c.bonus ? "+" + c.bonus : ""} plus disease, dart)`, `disease (${diseaseText(diseaseByKey(c.agent))})`,
      ...(c.multi ? ["multiple targets (1 dart per target in a 10 ft. by 10 ft. area)"] : []), ...checks(c, rng)],
  },
  {
    n: "Poisoned Object",
    dims: { agent: agentDim(byVector(POISONS, "contact")), ...checkDims },
    name: (rng) => `${pickOne(OBJECTS, rng)} Smeared with Contact Poison`,
    text: (c, cr, rng, name) => [...head(name, cr, "touch trigger (attached)", pickOne(["manual reset", "no reset"], rng)),
      `contact poison (${poisonText(poisonByKey(c.agent))})`, ...checks(c, rng)],
  },
  {
    n: "Contaminated Object",
    dims: { agent: agentDim(byVector(DISEASES, "contact")), ...checkDims },
    name: (rng) => `Contaminated ${pickOne(OBJECTS, rng)}`,
    text: (c, cr, rng, name) => [...head(name, cr, "touch trigger (attached)", pickOne(["manual reset", "no reset"], rng)),
      `disease (${diseaseText(diseaseByKey(c.agent))})`, ...checks(c, rng)],
  },
  {
    n: "Tainted Food or Water",
    dims: { agent: [...agentDim(byVector(POISONS, "ingested")), ...agentDim(byVector(DISEASES, "ingested"))], ...checkDims },
    name: (rng) => pickOne(["Tainted Water", "Tainted Food", "Tainted Wine", "Tainted Well"], rng),
    text: (c, cr, rng, name) => [...head(name, cr, "touch trigger (ingested)", "no reset"),
      poisonByKey(c.agent) ? `ingested poison (${poisonText(poisonByKey(c.agent))})` : `disease (${diseaseText(diseaseByKey(c.agent))})`, ...checks(c, rng)],
  },
  {
    // SRD Water-Filled Room (CR 4 or CR 7 version) with an ingested poison or disease in the water.
    n: "Tainted Water-Filled Room",
    base: { 4: "Water-Filled Room@4", 7: "Water-Filled Room@7" },
    dims: { room: [{ v: 4, cr: 4, label: "Water-Filled Room (SRD CR 4)" }, { v: 7, cr: 7, label: "Water-Filled Room (SRD CR 7)" }],
      agent: [...agentDim(byVector(POISONS, "ingested")), ...agentDim(byVector(DISEASES, "ingested"))] },
  },
];

/* ---------- Enumerating combinations by CR ---------- */
const comboCache = new Map();
export function combos(T) {
  if (comboCache.has(T.n)) return comboCache.get(T.n);
  const keys = Object.keys(T.dims);
  const out = [];
  const walk = (i, pick, cr) => {
    if (i === keys.length) { out.push({ pick: { ...pick }, cr: Math.max(1, cr) }); return; }
    for (const opt of T.dims[keys[i]]) { pick[keys[i]] = opt.v; walk(i + 1, pick, cr + opt.cr); }
  };
  walk(0, {}, 0);
  comboCache.set(T.n, out);
  return out;
}
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/** Rule templates that can be built at a CR. */
export function ruleTemplatesAt(cr) { return RULE_TEMPLATES.filter((T) => combos(T).some((c) => c.cr === cr)); }

/**
 * Roll a rule-template trap. `custom` may fix any dimension ({agent: "deathblade", depth: 40, ...});
 * the rest are chosen so the CR matches `cr` (or comes as close as possible).
 * Returns {name, cr, text, rule: true, base?: {name, cr, agentText}}.
 */
export function rollRuleTrap(T, cr, { rng = Math.random, custom = {}, srdText = null } = {}) {
  let pool = combos(T);
  for (const [k, v] of Object.entries(custom ?? {})) {
    if (!(k in T.dims) || v === "" || v === null || v === undefined) continue;
    const opt = T.dims[k].find((o) => String(Array.isArray(o.v) ? o.v[0] : o.v) === String(v));
    if (opt) pool = pool.filter((c) => same(c.pick[k], opt.v));
  }
  if (!pool.length) throw new Error(`No ${T.n} matches those choices`);
  const best = Math.min(...pool.map((c) => Math.abs(c.cr - cr)));
  const near = pool.filter((c) => Math.abs(c.cr - cr) === best);
  const choice = near[Math.floor(rng() * near.length)];
  const finalCr = choice.cr;
  const c = choice.pick;
  if (T.base) {
    const agent = poisonByKey(c.agent) ? `ingested poison (${poisonText(poisonByKey(c.agent))})` : `disease (${diseaseText(diseaseByKey(c.agent))})`;
    const baseKey = T.base[c.room];
    const base = (srdText?.[baseKey] ?? `Water-Filled Room: CR ${c.room}; mechanical; location trigger; manual reset; multiple targets (all targets in a 10 ft. by 10 ft. room); never miss; liquid; Search DC 20; Disable Device DC 20`);
    const parts = base.replace(/\s+/g, " ").split(";").map((s) => s.trim());
    parts[0] = `Tainted Water-Filled Room: CR ${finalCr}`;
    const si = parts.findIndex((p) => p.startsWith("Search DC"));
    parts.splice(si < 0 ? parts.length : si, 0, agent);
    return { name: "Tainted Water-Filled Room", cr: finalCr, text: parts.join("; "), rule: true, base: { key: baseKey, agentText: agent } };
  }
  const name = T.name ? T.name(rng) : T.n;
  return { name, cr: finalCr, text: T.text(c, finalCr, rng, name).join("; "), rule: true };
}

/** Balanced poison swap: injury/contact poisons within ±1 CR of the original. */
export function balancedPoisons(originalKey) {
  const o = poisonByKey(originalKey);
  const pool = byVector(POISONS, "injury", "contact");
  return o ? pool.filter((p) => Math.abs(p.cr - o.cr) <= 1) : pool;
}
