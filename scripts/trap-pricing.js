/**
 * Axecleft's Traps, Poisons, and Diseases — SRD prices and Craft (trapmaking) DCs for mechanical traps.
 *
 * Pure functions (no Foundry calls), so they can be tested on their own.
 *
 * SRD, Designing a Trap:
 *   - Market price: the SRD sample traps carry it ("Market Price - 2,500 gp" in the actor's notes).
 *   - Otherwise: (modified base cost × CR) + extra costs; base cost 1,000 gp, at least CR × 100 gp
 *     (Table: Cost Modifiers for Mechanical Traps). Poisons and alchemical items are extra costs, ×20 with an automatic reset.
 *   - Craft (trapmaking) DC: CR 1–3 20, CR 4–6 25, CR 7–10 30; +5 for a proximity trigger, +5 for an automatic reset.
 *     The SRD table stops at CR 10; above it the Axecleft extension adds +5 per 3 CR (CR 11–13 35, 14–16 40, 17–19 45, 20 50).
 */

export const normName = (s) => String(s ?? "").toLowerCase().replace(/[’']/g, "'").replace(/[^a-z0-9']+/g, " ").trim();
const plain = (html) => String(html ?? "").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
const num = (s) => Number(String(s).replace(/,/g, ""));

/** The SRD stat line for a trap actor: the generator's own text, or the SRD sample trap's text by name. */
export function trapText(actorData, data, MOD = "traps-and-poisons") {
  const gen = actorData?.flags?.[MOD]?.generated?.text;
  if (gen) return String(gen);
  const n = normName(actorData?.name);
  for (const cr of Object.keys(data ?? {})) {
    const t = (data[cr] ?? []).find((x) => x.srd && normName(x.n) === n);
    if (t) return t.text;
  }
  return null;
}

/** Magic device or spell trap? (The kit and crafting rules are for mechanical traps only.) */
export function isMagicTrap(actorData, text) {
  if (text) {
    const m = text.match(/;\s*(mechanical|magic device|spell)\b/i);
    if (m) return m[1].toLowerCase() !== "mechanical";
  }
  const notes = plain(actorData?.system?.details?.notes?.value);
  return /spell (effect|trigger)|\bXP\b|hire NPC spellcaster|magic device/i.test(notes);
}

/** "Market Price - 2,500 gp" in the notes (SRD sample traps), or null. */
export function marketPrice(actorData) {
  const m = plain(actorData?.system?.details?.notes?.value).match(/Market Price\s*[-:–]\s*([\d,]+)\s*gp/i);
  return m ? num(m[1]) : null;
}

/** SRD Craft (trapmaking) base DC by CR (with the Axecleft extension past CR 10). */
export function baseCraftDc(cr) {
  const c = Math.max(1, Number(cr) || 1);
  if (c <= 3) return 20;
  if (c <= 6) return 25;
  if (c <= 10) return 30;
  return 30 + 5 * Math.ceil((c - 10) / 3);
}

/**
 * Everything the kit and the Craft rules need, from the actor and its stat line.
 * poisonPrices: Map(normName → gp) of the poison consumables (SRD poison prices).
 */
export function trapFacts(actorData, data, { poisonPrices = new Map(), MOD = "traps-and-poisons" } = {}) {
  const d = actorData?.system?.details ?? {};
  const cr = Math.max(0, Number(d.totalCr ?? d.cr) || 0);
  const text = trapText(actorData, data, MOD);
  const notes = plain(d.notes?.value);
  const src = `${text ?? ""} ; ${notes}`;
  const lower = src.toLowerCase();
  const out = {
    name: actorData?.name ?? "Trap", cr, text, mechanical: !isMagicTrap(actorData, text),
    search: Number(d.findDC) || null, disable: Number(d.disarmDC) || null,
    trigger: null, reset: null, bypass: null, reflex: null, attack: null, neverMiss: /never miss/i.test(src),
    poisons: [], diseases: [], assumptions: [],
  };
  if (text) {
    const m = (re) => text.match(re)?.[0] ?? null;
    out.trigger = m(/[a-z ()]*trigger[a-z ()]*/i)?.trim() ?? null;
    out.reset = m(/(no|repair|manual|automatic)[a-z ()]*reset[a-z ()]*/i)?.trim() ?? null;
    out.bypass = m(/(lock|hidden switch|hidden lock)[^;]*bypass[^;]*/i)?.trim() ?? null;
    out.search ??= Number(text.match(/Search DC (\d+)/)?.[1]) || null;
    out.disable ??= Number(text.match(/Disable Device DC (\d+)/)?.[1]) || null;
  }
  if (!out.trigger) {
    const t = notes.match(/^(\w+(?: \(\w+\))?) Trigger/i);
    if (t) out.trigger = `${t[1].toLowerCase()} trigger`;
  }
  if (!out.reset) { out.reset = "manual reset"; out.assumptions.push("reset not given: manual reset assumed"); }
  if (!out.trigger) { out.trigger = "location trigger"; out.assumptions.push("trigger not given: location trigger assumed"); }
  out.reflex = Number(src.match(/DC (\d+) Reflex/)?.[1]) || null;
  const atk = src.match(/Atk ([+-]\d+)/);
  out.attack = atk ? Number(atk[1]) : null;
  for (const p of src.matchAll(/poison(?: gas)? \(([^\[(),]+)/gi)) {
    const key = normName(p[1]).replace(/\bmonstrous /, "").replace(/\bother fumes\b/, "othur fumes").replace(/ poison$/, "");
    if (key && !out.poisons.includes(key)) out.poisons.push(key);
  }
  for (const p of src.matchAll(/disease \(([^\[(),]+)/gi)) {
    const key = normName(p[1]);
    if (key && !out.diseases.includes(key)) out.diseases.push(key);
  }
  out.proximity = /proximity/i.test(out.trigger ?? "");
  out.timed = /timed/i.test(out.trigger ?? "");
  out.autoReset = /automatic/i.test(out.reset ?? "");

  // Craft (trapmaking) DC
  out.craftDc = baseCraftDc(cr) + (out.proximity ? 5 : 0) + (out.autoReset ? 5 : 0);
  out.craftDcNote = `CR ${cr} ${baseCraftDc(cr)}${cr > 10 ? " (Axecleft extension past CR 10)" : ""}${out.proximity ? ", proximity trigger +5" : ""}${out.autoReset ? ", automatic reset +5" : ""}`;

  // Price: the SRD market price when the trap carries one, else the cost table
  const parts = [];
  let base = 1000;
  const add = (label, gp) => { if (gp) { base += gp; parts.push([label, gp]); } };
  if (out.proximity || out.timed) add(out.timed ? "timed trigger" : "proximity trigger", 1000);
  if (/touch \(attached\)|attached/i.test(out.trigger ?? "")) add("touch trigger (attached)", -100);
  if (/^no reset|\bno reset/i.test(out.reset ?? "")) add("no reset", -500);
  else if (/repair/i.test(out.reset ?? "")) add("repair reset", -200);
  else if (out.autoReset && !out.timed) add("automatic reset", 500);
  if (/hidden lock/i.test(out.bypass ?? "")) add("hidden lock bypass", 300);
  else if (/hidden switch/i.test(out.bypass ?? "")) add("hidden switch bypass", 200);
  else if (/\block\b/i.test(out.bypass ?? "")) add("lock bypass", 100);
  const dcCost = (label, dc, up = 200) => { if (!dc || dc === 20) return; add(`${label} ${dc}`, dc < 20 ? -100 * (20 - dc) : up * (dc - 20)); };
  dcCost("Search DC", out.search);
  dcCost("Disable Device DC", out.disable);
  dcCost("Reflex save DC", out.reflex, 300);
  if (out.attack !== null && out.attack !== 10) add(`attack bonus ${out.attack >= 0 ? "+" : ""}${out.attack}`, out.attack < 10 ? -100 * (10 - out.attack) : 200 * (out.attack - 10));
  if (out.neverMiss) add("never miss", 1000);
  const mech = Math.max(base * Math.max(1, cr), Math.max(1, cr) * 100);
  let extras = 0;
  const extraParts = [];
  for (const p of out.poisons) {
    const gp = poisonPrices.get(p) ?? [...poisonPrices.entries()].find(([k]) => k.includes(p) || p.includes(k))?.[1] ?? null;
    if (gp === null) { out.assumptions.push(`no price found for ${p}`); continue; }
    const cost = gp * (out.autoReset ? 20 : 1);
    extras += cost;
    extraParts.push([`${p}${out.autoReset ? " (×20, automatic reset)" : ""}`, cost]);
  }
  if (out.diseases.length) out.assumptions.push("the SRD gives no price for diseases; none added");
  out.formula = { base, parts, mechanical: mech, extras, extraParts, total: mech + extras };
  const market = marketPrice(actorData);
  if (market) {
    // SRD sample traps: the market price is the price; the share for poisons and alchemical items stays an extra cost
    out.price = market;
    out.extras = Math.min(extras, market);
    out.priceSource = "SRD market price";
  } else {
    out.price = mech + extras;
    out.extras = extras;
    out.priceSource = "SRD cost table";
  }
  out.mechanicalPrice = Math.max(0, out.price - out.extras);
  return out;
}
