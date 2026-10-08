/**
 * Axecleft's Traps, Poisons, and Diseases — Random Trap Generator
 *
 * Generates random room traps by Challenge Rating (CR 1–20) using the same trap
 * templates and value ranges as the d20srd.org Random Generator, then builds a
 * ready-to-use D35E trap actor from this module's own compendium items.
 *
 * GM access: the "Random Trap" button in the Actors sidebar, or a macro:
 *   game.modules.get("traps-and-poisons").api.openGenerator();
 */

import { RULE_TEMPLATES, ruleTemplatesAt, rollRuleTrap, POISONS as SRD_POISONS, poisonByKey, diseaseByKey, poisonText, balancedPoisons } from "./trap-rules.js";
export { RULE_TEMPLATES };

const MOD = "traps-and-poisons";
const DATA_PATH = `modules/${MOD}/data/trap-generator-data.json`;
const PACK = (name) => `${MOD}.${name}`;
const BASE_ACTOR = `Compendium.${MOD}.traps.Actor.HVLK5LdlRKK8zK5u`; // Basic Arrow Trap
const FOLDER_NAME = "Random Traps";

/* -------------------------------------------- */
/*  Data and random rolling (no Foundry needed) */
/* -------------------------------------------- */

let DATA = null;
export function setData(d) { DATA = d; }
async function loadData() {
  if (!DATA) DATA = await (await fetch(DATA_PATH)).json();
  return DATA;
}

/** The generator's data (website templates and SRD sample trap texts), loaded once. */
export async function trapData() { return loadData(); }

/** Weighted pick from {value: weight} or [{w, ...}] */
function pickWeighted(entries, rng = Math.random) {
  const list = Array.isArray(entries) ? entries.map((e) => [e, e.w]) : Object.entries(entries);
  const total = list.reduce((a, [, w]) => a + w, 0);
  let r = rng() * total;
  for (const [v, w] of list) { if ((r -= w) < 0) return v; }
  return list[list.length - 1][0];
}

/** List the templates available at a CR. */
export function templatesFor(cr, { includeRules = true } = {}) {
  const site = (DATA?.[cr] ?? []).map((t) => ({ name: t.n, srd: !!t.srd }));
  const rules = includeRules ? ruleTemplatesAt(cr).map((T) => ({ name: T.n, srd: false, rule: true })) : [];
  return [...site, ...rules];
}

/** SRD text and actor of the base traps that rule templates build on (e.g. Water-Filled Room). */
function srdBases() {
  const out = {};
  for (const cr of Object.keys(DATA ?? {})) for (const t of DATA[cr]) if (t.srd) out[`${t.n}@${cr}`] = { text: t.text, uuid: t.uuid };
  return out;
}

/** Website templates plus the module's rule templates available at a CR, with pick weights. */
function poolFor(cr, includeSrd, includeRules) {
  let site = DATA[cr] ?? [];
  if (!includeSrd) site = site.filter((t) => !t.srd);
  const gen = (DATA[cr] ?? []).filter((t) => !t.srd).map((t) => t.w).sort((a, b) => a - b);
  const w = gen.length ? gen[Math.floor(gen.length / 2)] : 100; // a rule template is as common as a typical website template
  const rules = includeRules ? ruleTemplatesAt(cr).map((T) => ({ n: T.n, w, rule: T })) : [];
  return [...site, ...rules];
}

/**
 * Roll one trap at the given CR. Returns {name, cr, text, srd, uuid}.
 * Each slot (trigger, damage, DCs, ...) is rolled independently from the
 * observed options, so every combination the website can produce is possible.
 */
export function rollTrap(cr, { name = null, includeSrd = true, includeRules = true, rng = Math.random, custom = null } = {}) {
  if (!DATA[cr]) throw new Error(`No trap data for CR ${cr}`);
  const ruleByName = name && RULE_TEMPLATES.find((T) => T.n === name);
  const pool = poolFor(cr, includeSrd, includeRules);
  const T = ruleByName ? { n: name, rule: ruleByName } : name ? pool.find((t) => t.n === name) : pickWeighted(pool, rng);
  if (!T) throw new Error(`No trap named "${name}" at CR ${cr}`);
  if (T.srd) return { name: T.n, cr, text: T.text, srd: true, uuid: T.uuid };
  if (T.rule) {
    const bases = srdBases();
    const r = rollRuleTrap(T.rule, cr, { rng, custom: custom?.rule, srdText: Object.fromEntries(Object.entries(bases).map(([k, v]) => [k, v.text])) });
    if (r.base) r.base.uuid = bases[r.base.key]?.uuid;
    return { ...r, srd: false };
  }

  // `custom` holds GM-chosen values; anything blank is rolled as normal.
  const c = custom ?? {};
  const set = (v) => v !== undefined && v !== null && String(v).trim() !== "";
  const choose = (key, map) => (set(c[key]) ? String(c[key]).trim() : pickWeighted(map, rng));

  const parts = [`${T.n}: CR ${cr}`, choose("type", T.type), choose("trig", T.trig)];
  const effects = [];
  let duration = null;
  T.groups.forEach((g, gi) => {
    const go = c.groups?.[gi] ?? {};
    if (!set(go.alt) && !set(go.poison) && rng() >= g.p) return;
    if (g.g === "poison") {
      // Balanced swap: any injury/contact SRD poison within ±1 CR of the website's poison (or the GM's pick).
      const orig = ((pickWeighted(g.alts, rng).s.match(/poison \(([^\[)]+?)\s*[\[)]/) ?? [])[1] ?? "").toLowerCase().replace("malyass", "malyss");
      const p = set(go.poison) ? poisonByKey(go.poison) : (() => { const opts = balancedPoisons(orig); return opts[Math.floor(rng() * opts.length)]; })();
      if (p) { effects.push(`poison (${poisonText(p)})`); return; }
    }
    const ai = set(go.alt) ? Number(go.alt) : g.alts.indexOf(pickWeighted(g.alts, rng));
    const alt = g.alts[ai];
    let i = 0;
    const txt = alt.s.replace(/#/g, () => {
      const v = go.slots?.[`${ai}.${i}`];
      const out = set(v) ? String(v).trim() : pickWeighted(alt.v[i], rng);
      i++;
      return out;
    });
    if (g.g === "duration") duration = txt; else effects.push(txt);
  });
  if (duration) parts.push(duration);
  parts.push(choose("reset", T.reset));
  if (Object.keys(T.byp).length) parts.push(choose("byp", T.byp));
  parts.push(...effects);
  parts.push(`Search DC ${choose("search", T.search)}`, `Disable Device DC ${choose("disable", T.disable)}`);
  let text = parts.join("; ");
  if (T.notes?.length) text += `; Note: ${T.notes[Math.floor(rng() * T.notes.length)]}`;
  return { name: T.n, cr, text, srd: false };
}

/** Find a template by name at a CR (null if missing). */
export function templateFor(cr, name) { return DATA?.[cr]?.find((t) => t.n === name) ?? null; }

const esc = (v) => String(v).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const valueSort = (a, b) => (parseFloat(a.replace(/^[^\d-]*/, "")) - parseFloat(b.replace(/^[^\d-]*/, ""))) || a.localeCompare(b);

/**
 * HTML for the "Customize" window: the trap's stat line with a fill-in box for
 * every variable value. Boxes suggest the observed values but accept anything.
 */
/** Customize form for a rules-built (poison/disease) template: one choice per dimension. */
export function ruleCustomizerContent(cr, R) {
  const LABELS = { agent: "Poison / disease", room: "Base trap", depth: "Pit depth", reflex: "Reflex save", multi: "Targets", spikes: "Spikes",
    onset: "Onset delay", atk: "Attack bonus", bonus: "Damage", search: "Search DC", disable: "Disable Device DC" };
  const sign = (n) => (n >= 0 ? `+${n}` : `${n}`);
  let html = `<div class="tp-custom">
    <p class="hint">Each choice shows its SRD CR modifier. Leave a choice on Random and the generator fills it in so the trap comes as close to CR ${cr} as it can; the final CR is the sum of the modifiers.</p>
    <fieldset><legend>${esc(R.n)}</legend>`;
  for (const [k, opts] of Object.entries(R.dims)) {
    if (opts.length < 2) continue;
    html += `<div class="form-group"><label>${LABELS[k] ?? cap(k)}</label><select name="rule.${k}"><option value="">Random</option>${
      opts.map((o) => `<option value="${esc(Array.isArray(o.v) ? o.v[0] : o.v)}">${esc(o.label.replace(/ \(\+\d+\)$/, ""))} (CR ${sign(o.cr)})</option>`).join("")}</select></div>`;
  }
  return html + `</fieldset></div>`;
}

export function customizerContent(cr, T) {
  const lists = [];
  const datalist = (id, values) => { lists.push(`<datalist id="${id}">${values.map((v) => `<option value="${esc(v)}"></option>`).join("")}</datalist>`); return id; };
  const select = (name, label, map) => {
    const keys = Object.keys(map ?? {});
    if (!keys.length) return "";
    return `<div class="form-group"><label>${label}</label><select name="${name}"><option value="">Random</option>${keys.sort(valueSort).map((k) => `<option value="${esc(k)}">${esc(k)}</option>`).join("")}</select></div>`;
  };
  const box = (name, values) => {
    const id = datalist(`tp-dl-${name.replace(/\W/g, "-")}`, values.sort(valueSort));
    const hint = values.length === 1 ? values[0] : `${values[0]}–${values[values.length - 1]}`;
    return `<input type="text" class="tp-slot" name="${name}" list="${id}" placeholder="${esc(hint)}" title="Suggested: ${esc(values.join(", "))}. Leave blank to roll.">`;
  };
  let html = `<style>
      .tp-custom .tp-slot { width: 5.5em; display: inline-block; margin: 0 2px; }
      .tp-custom .tp-line { line-height: 2.2; margin: 2px 0 6px; }
      .tp-custom fieldset { margin: 6px 0; }
      .tp-custom .tp-alt.tp-hidden { display: none; }
    </style>
    <div class="tp-custom">
    <p class="hint">Leave anything blank to roll it randomly. Boxes suggest the values the generator uses, but you can type any value.</p>
    <fieldset><legend>Trap</legend>
      ${select("type", "Type", T.type)}${select("trig", "Trigger", T.trig)}${select("reset", "Reset", T.reset)}${select("byp", "Bypass", T.byp)}
      <div class="form-group"><label>Search DC</label>${box("search", Object.keys(T.search))}</div>
      <div class="form-group"><label>Disable Device DC</label>${box("disable", Object.keys(T.disable))}</div>
    </fieldset>`;
  T.groups.forEach((g, gi) => {
    const legend = g.g === "duration" ? "Duration" : g.g === "poison" ? "Poison" : "Effect";
    html += `<fieldset><legend>${legend}</legend>`;
    if (g.g === "poison") {
      const opts = SRD_POISONS.filter((p) => p.vector === "injury" || p.vector === "contact")
        .map((p) => `<option value="${esc(p.key)}">${esc(cap(p.key))} (${p.vector}, DC ${p.dc}, CR +${p.cr})</option>`).join("");
      html += `<div class="form-group"><label>Poison</label><select name="g${gi}.poison"><option value="">Random (similar strength)</option>${opts}</select></div>`;
      html += `</fieldset>`;
      return;
    }
    if (g.alts.length > 1) {
      html += `<div class="form-group"><label>Choose</label><select name="g${gi}.alt" class="tp-alt-select" data-group="${gi}"><option value="">Random</option>${
        g.alts.map((a, ai) => `<option value="${ai}">${esc(a.s.replace(/#/g, "…"))}</option>`).join("")}</select></div>`;
    }
    g.alts.forEach((a, ai) => {
      let j = 0;
      const line = esc(a.s).replace(/#/g, () => { const k = j++; return box(`g${gi}.a${ai}.s${k}`, Object.keys(a.v[k] ?? {})); });
      html += `<div class="tp-alt tp-line" data-group="${gi}" data-alt="${ai}">${line}</div>`;
    });
    html += `</fieldset>`;
  });
  return html + lists.join("") + "</div>";
}

/** Read the Customize form into the `custom` object rollTrap() understands. */
export function readCustomForm(entries) {
  const custom = { groups: {} };
  for (const [k, v] of entries) {
    if (String(v).trim() === "") continue;
    let m;
    if ((m = k.match(/^rule\.(\w+)$/))) (custom.rule ??= {})[m[1]] = v;
    else if ((m = k.match(/^g(\d+)\.poison$/))) (custom.groups[m[1]] ??= {}).poison = v;
    else if ((m = k.match(/^g(\d+)\.alt$/))) (custom.groups[m[1]] ??= {}).alt = v;
    else if ((m = k.match(/^g(\d+)\.a(\d+)\.s(\d+)$/))) ((custom.groups[m[1]] ??= {}).slots ??= {})[`${m[2]}.${m[3]}`] = v;
    else custom[k] = v;
  }
  return custom;
}

async function openCustomizer(opts) {
  const pool = poolFor(opts.cr, false, opts.includeRules !== false);
  const picked = opts.trap ? (pool.find((t) => t.n === opts.trap) ?? templateFor(opts.cr, opts.trap)) : pickWeighted(pool);
  const R = picked?.rule ?? null;
  const T = R ? null : picked;
  if (T?.srd) {
    ui.notifications.info(`${T.n} is an SRD sample trap with fixed stats, so it can't be customized. Generating it as-is.`);
    return generate(opts);
  }
  const { DialogV2 } = foundry.applications.api;
  const toggle = (root) => {
    root.querySelectorAll("select.tp-alt-select").forEach((sel) => {
      const apply = () => root.querySelectorAll(`.tp-alt[data-group="${sel.dataset.group}"]`).forEach((div) =>
        div.classList.toggle("tp-hidden", sel.value !== "" && div.dataset.alt !== sel.value));
      sel.addEventListener("change", apply); apply();
    });
  };
  const custom = await DialogV2.wait({
    window: { title: `Customize: ${picked.n} (CR ${opts.cr})`, icon: "fas fa-sliders" },
    position: { width: R ? 480 : 620 },
    content: R ? ruleCustomizerContent(opts.cr, R) : customizerContent(opts.cr, T),
    rejectClose: false,
    render: (event, dialog) => {
      const root = (dialog ?? event?.target)?.element ?? document;
      toggle(root);
      // Suggestion lists that scroll and stay on screen (Axecleft's Tools 7; the browser's own popup doesn't scroll in Foundry)
      (globalThis.AxecleftTools?.enhanceDatalists ?? globalThis.AxecleftTreasure?.enhanceDatalists)?.(root);
    },
    buttons: [{
      action: "create", label: opts.createActors ? "Create Trap" : "Post to Chat", icon: "fas fa-dice-d20", default: true,
      callback: (event, button) => readCustomForm(new FormData(button.form).entries()),
    }, { action: "cancel", label: "Cancel" }],
  });
  if (!custom || custom === "cancel") return;
  return generate({ ...opts, trap: picked.n, custom });
}

/* -------------------------------------------- */
/*  Parsing a trap stat line into components    */
/* -------------------------------------------- */

const SAVE = { reflex: "reflex", will: "will", fort: "fortitude", fortitude: "fortitude" };

function parseEffect(e) {
  let m;
  if ((m = e.match(/^duration (\d+) rounds?$/))) return { kind: "duration", rounds: +m[1] };
  if ((m = e.match(/^multiple targets \((.+)\)$/))) return { kind: "area", text: m[1], ...parseArea(m[1]) };
  if (["never miss", "liquid", "water", "gas"].includes(e)) return { kind: "flag", text: e };
  if ((m = e.match(/^(?:(contact|ingested) )?poison( gas)? \(([^\[]+?)\s*\[(\w+), Fort DC (\d+), ([^\]]+)\]\)$/)))
    return { kind: "poison", poison: m[3].trim(), vector: m[4], dc: +m[5], damage: m[6], gas: !!m[2] };
  if ((m = e.match(/^disease \(([^\[]+?)\s*\[(\w+), Fort DC (\d+), incubation ([^,]+), ([^\]]+)\]\)$/)))
    return { kind: "disease", disease: m[1].trim(), vector: m[2], dc: +m[3], incubation: m[4].trim(), damage: m[5] };
  if ((m = e.match(/^DC (\d+) Reflex save avoids$/))) return { kind: "pitSave", dc: +m[1] };
  if ((m = e.match(/^(\d+) ft\. deep \((\S+), fall\)$/))) return { kind: "fall", depth: +m[1], damage: m[2] };
  if ((m = e.match(/^pit spikes \(Atk ([+-]\d+) melee, (\S+) spikes(?: per target)? for (\S+?)(?: plus (poison|disease))? each\)$/)))
    return { kind: "spikes", bonus: +m[1], count: m[2], damage: m[3], carries: m[4] ?? null };
  if ((m = e.match(/^onset delay \((\d+) rounds?\)$/))) return { kind: "onset", rounds: +m[1] };
  if ((m = e.match(/^(contact )?poison \(([^\[\]()]+)\)$/)))
    return { kind: "poison", poison: m[2].trim(), vector: m[1] ? "contact" : "injury", dc: null, damage: null };
  if ((m = e.match(/^Atk ([+-]\d+) (melee|ranged) \((.+)\)$/))) return { kind: "attack", bonus: +m[1], range: m[2], ...parseAttackDetail(m[3]) };
  if ((m = e.match(/^magic missile \((\S+) force damage\)$/))) return { kind: "auto", damage: m[1], energy: "force", label: "Magic Missile" };
  if ((m = e.match(/^(.+?) \((.+), DC (\d+) (Reflex|Will|Fort|Fortitude) save (for half damage only|for half damage|negates|avoids)(?:, otherwise Escape Artist DC (\d+) to escape grapple)?\)$/))) {
    const [, label, inner, dc, save, how, escape] = m;
    const r = { kind: "save", label, dc: +dc, save: SAVE[save.toLowerCase()], half: how.startsWith("for half"), escapeDC: escape ? +escape : null };
    let x;
    if ((x = inner.match(/^(\S+) (?:(\w+) )?damage(?: for (\S+) rounds?)?(?: and (\w+)(?: for (\S+) rounds?)?)?$/))) {
      Object.assign(r, { damage: x[1], energy: x[2] ?? null, damageRounds: x[3] ?? null, condition: x[4] ?? null, rounds: x[5] ?? null });
    } else if ((x = inner.match(/^(\w+)(?: for (\S+) rounds?)?$/))) {
      Object.assign(r, { condition: x[1], rounds: x[2] ?? null });
    } else if ((x = inner.match(/^teleported (.+)$/))) {
      Object.assign(r, { condition: "teleported", detail: x[1] });
    } else return { kind: "unknown", text: e };
    return r;
  }
  return { kind: "unknown", text: e };
}

function parseAttackDetail(s) {
  let m;
  if ((m = s.match(/^grappled, Escape Artist DC (\d+) to escape(, plus poison)?$/))) return { grapple: true, escapeDC: +m[1], poison: !!m[2] };
  m = s.match(/^(\d+d\d+(?:[+-]\d+)?|\d+)(?:\/(x\d|\d+-\d+))?(?: (cold))?( plus (?:poison|disease))?( and knocked prone)?(?:, (needle|dart))?$/);
  if (!m) return { detail: s };
  const r = { damage: m[1], energy: m[3] ?? null, poison: !!m[4], prone: !!m[5], weapon: m[6] ?? null, critRange: 20, critMult: 2 };
  if (m[2]?.startsWith("x")) r.critMult = +m[2].slice(1);
  else if (m[2]) r.critRange = +m[2].split("-")[0];
  return r;
}

function parseArea(t) {
  let m;
  if ((m = t.match(/(\d+) ft\. radius (burst|arc)/))) return { template: "circle", size: +m[1] };
  if ((m = t.match(/(\d+) ft\. cone/))) return { template: "cone", size: +m[1] };
  if ((m = t.match(/(\d+) ft\. line/))) return { template: "ray", size: +m[1] };
  if ((m = t.match(/(\d+) ft\. (?:square|sqare)/))) return { template: "rect", size: +m[1] };
  return {};
}

export function parseTrap(text) {
  const clean = text.replace(/\s+/g, " ").trim();
  const [name, rest] = [clean.slice(0, clean.indexOf(":")), clean.slice(clean.indexOf(":") + 1)];
  const out = { name: name.trim(), cr: null, type: null, trigger: null, reset: null, bypass: null, search: null, disable: null, effects: [], notes: [] };
  const parts = rest.split(";").map((p) => p.trim()).filter(Boolean);
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    if (p.startsWith("CR ")) out.cr = +p.slice(3);
    else if (!out.type && /^(mechanical|magic device|spell)/.test(p)) out.type = p;
    else if (!out.trigger && p.includes("trigger")) out.trigger = p;
    else if (!out.reset && /\breset\b/.test(p)) out.reset = p;
    else if (p.includes("bypass")) out.bypass = p;
    else if (p.startsWith("Search DC")) out.search = +p.match(/\d+/)[0];
    else if (p.startsWith("Disable Device DC")) out.disable = +p.match(/\d+/)[0];
    else if (p.startsWith("Note:")) { out.notes.push(parts.slice(i).join("; ").slice(5).trim()); break; }
    else out.effects.push(parseEffect(p));
  }
  return out;
}

/* -------------------------------------------- */
/*  Building the D35E actor (Foundry only)      */
/* -------------------------------------------- */

const ENERGY = { fire: "energy-fire", cold: "energy-cold", acid: "energy-acid", electricity: "energy-electric", sonic: "energy-sonic", negative: "energy-negative" };
const BUFFS = { frightened: "Frightened", paralyzed: "Paralyzed", petrified: "Petrified", shaken: "Shaken", grappled: "Grappled", prone: "Prone", stunned: "Stunned" };
const POISONS = {
  "black lotus extract": "Poison, Black Lotus Extract", bloodroot: "Poison, Bloodroot", deathblade: "Poison, Deathblade",
  "giant wasp poison": "Poison, Giant Wasp Poison", "greenblood oil": "Poison, Greenblood Oil", "large scorpion venom": "Poison, Large Scorpion Venom",
  "medium spider venom": "Poison, Medium Spider Venom", nitharit: "Poison, Nitharit", "purple worm poison": "Poison, Purple Worm Poison",
  "sassone leaf residue": "Poison, Sassone Leaf Residue", "shadow essence": "Poison, Shadow Essence", "small centipede poison": "Poison, Small Centipede Poison",
  "terinav root": "Poison, Terinav Root", "wyvern poison": "Poison, Wyvern",
  "dragon bile": "Poison, Dragon Bile", "malyass root paste": "Poison, Malyss Root Paste", "malyss root paste": "Poison, Malyss Root Paste",
};
const ICONS = [
  // Poison and disease traps (checked first)
  [/spore/i, "icons/magic/air/fog-gas-smoke-swirling-green.webp"],
  [/gas/i, "systems/D35E/icons/spells/named-spells/fog-cloud.png"],
  [/spiked pit/i, "systems/D35E/icons/traps/trap-spikes.png"],
  [/\bpit\b/i, "systems/D35E/icons/traps/trapdoor.png"],
  [/needle/i, `modules/${MOD}/icons/poison-needle.png`],
  [/dart/i, "icons/skills/ranged/dart-thrown-poison-green.webp"],
  [/smeared|contaminated/i, "icons/containers/chest/chest-simple-box-red.webp"],
  [/tainted (water|well)/i, "systems/D35E/icons/spells/domain/water.png"],
  [/tainted/i, "systems/D35E/icons/special-abilities/poison.png"],
  [/poisoned (scythe|guillotine)/i, `modules/${MOD}/icons/pendulum-blade-green.png`],
  [/scythe|guillotine|blade/i, `modules/${MOD}/icons/pendulum-blade.png`],
  [/flail/i, `modules/${MOD}/icons/swinging-spiked-ball.png`],
  [/falling block|ceiling/i, "icons/commodities/stone/masonry-block-cube-brown.webp"],
  [/net/i, "systems/D35E/icons/items/weapons/Net_01.png"],
  [/ice|freeze/i, "icons/weapons/ammunition/bullet-ice-blue.webp"],
  [/arrow|bolter/i, "icons/weapons/ammunition/arrow-head-war-flight.webp"],
  [/fire|flame/i, "systems/D35E/icons/spells/named-spells/fireball.png"],
  [/lightning|electri|thunder/i, "systems/D35E/icons/spells/named-spells/lightning-bolt.png"],
  [/acid/i, "systems/D35E/icons/spells/named-spells/acid-arrow.png"],
  [/earth/i, "systems/D35E/icons/spells/named-spells/earthquake.png"],
  [/rune|symbol/i, "systems/D35E/icons/spells/named-spells/glyph-of-warding.png"],
  [/idol|shrine|altar/i, "systems/D35E/icons/spells/named-spells/inflict-wounds.png"],
];
const iconFor = (name) => (ICONS.find(([re]) => re.test(name)) ?? [null, "systems/D35E/icons/traps/generic.png"])[1];
const physicalType = (name) =>
  /arrow|bolter|spear|dart/i.test(name) ? "damage-piercing" : /blade|scythe|guillotine/i.test(name) ? "damage-slashing" : "damage-bludg";
const roundsText = (r) => `${r} round${String(r) === "1" ? "" : "s"}`;
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

const itemCache = new Map();
async function packItem(pack, name) {
  const key = `${pack}|${name}`;
  if (!itemCache.has(key)) {
    const p = game.packs.get(PACK(pack));
    const entry = p?.index.find((i) => i.name === name);
    if (!entry) throw new Error(`Item "${name}" not found in ${PACK(pack)}`);
    itemCache.set(key, (await p.getDocument(entry._id)).toObject());
  }
  const obj = foundry.utils.deepClone(itemCache.get(key));
  delete obj._id;
  return obj;
}

let FORCE_KEY;
async function forceKey() {
  if (FORCE_KEY !== undefined) return FORCE_KEY;
  FORCE_KEY = "damage-untyped";
  try {
    const pack = game.packs.get("D35E.damage-types");
    const docs = await pack.getDocuments();
    const fire = docs.find((d) => d.name === "Fire"), force = docs.find((d) => d.name === "Force");
    const flat = foundry.utils.flattenObject(fire.toObject().system);
    const path = Object.keys(flat).find((k) => flat[k] === "energy-fire");
    const v = path && foundry.utils.getProperty(force.toObject().system, path);
    if (typeof v === "string" && v) FORCE_KEY = v;
  } catch (e) { console.warn(`${MOD} | Could not look up the Force damage type; using untyped.`, e); }
  return FORCE_KEY;
}

function conditionAction(cond, rounds) {
  const buff = BUFFS[cond];
  if (buff) {
    const set = rounds ? ` Set buff "${buff}" field system.timeline.formula to max(1,${rounds}) on target;` : "";
    return `Create unique "${buff}" from "${MOD}.common-trap-buffs" on target;${set} Activate buff "${buff}" on target;`;
  }
  const what = cond === "teleported" ? "teleported one level down" : `${cond}${rounds ? ` for ${roundsText(rounds)}` : ""}`;
  return `Message public Target is ${what} on target;`;
}

function applyArea(item, area) {
  if (!area?.template) return;
  item.system.measureTemplate = { ...(item.system.measureTemplate ?? {}), type: area.template, size: String(area.size) };
}

async function buildItems(trap) {
  const items = [];
  const area = trap.effects.find((e) => e.kind === "area");
  const notes = area ? `multiple targets (${area.text})` : "";
  let main = null;

  for (const e of trap.effects) {
    if (e.kind === "attack") {
      const it = await packItem("trap-attacks", e.weapon === "needle" ? "Needle" : e.weapon === "dart" ? "Dart Attack" : e.range === "ranged" ? "Arrow Attack" : "Slash");
      it.name = `${trap.name} Attack`;
      const s = it.system;
      s.attackBonus = String(e.bonus);
      s.attackParts = [];
      s.attackNotes = notes;
      s.specialActions = [];
      if (e.grapple) {
        s.damage = { ...(s.damage ?? {}), parts: [] };
        s.attackNotes = [`Grappled (Escape Artist DC ${e.escapeDC})`, notes].filter(Boolean).join("; ");
        s.specialActions.push({ name: "Grappled", action: conditionAction("grappled"), img: "" });
      } else {
        const type = e.energy ? ENERGY[e.energy] : e.weapon ? "damage-piercing" : physicalType(trap.name);
        s.damage = { ...(s.damage ?? {}), parts: [[e.damage, null, type]] };
        s.ability = { ...(s.ability ?? {}), critRange: String(e.critRange), critMult: e.critMult };
        if (e.prone) s.specialActions.push({ name: "Knocked Prone", action: conditionAction("prone"), img: "" });
      }
      main = it; items.push(it);
    } else if (e.kind === "save") {
      const it = await packItem("trap-attacks", e.damage ? "Flame" : "Add Condition");
      it.name = cap(e.label);
      const s = it.system;
      s.actionType = "spellsave";
      s.save = { ...(s.save ?? {}), dc: String(e.dc), type: `${e.save}${e.half ? "half" : "negates"}` };
      s.specialActions = [];
      if (e.damage) {
        const type = e.energy ? ENERGY[e.energy] ?? "damage-untyped" : /inflict/i.test(e.label) ? "energy-negative" : /earth/i.test(e.label) ? "damage-bludg" : "damage-untyped";
        s.damage = { ...(s.damage ?? {}), parts: [[e.damage, null, type]] };
      } else s.damage = { ...(s.damage ?? {}), parts: [] };
      const extra = [];
      if (e.damageRounds) extra.push(`damage repeats for ${e.damageRounds} rounds`);
      if (e.escapeDC) { extra.push(`grappled on a failed save (Escape Artist DC ${e.escapeDC})`); s.specialActions.push({ name: "Grappled", action: conditionAction("grappled"), img: "" }); }
      if (e.condition && !(e.condition === "grappled" && e.escapeDC)) {
        s.specialActions.push({ name: cap(e.condition), action: conditionAction(e.condition, e.rounds), img: "" });
        if (e.damage) extra.push(`${e.condition}${e.rounds ? ` for ${roundsText(e.rounds)}` : ""} on a failed save`);
      }
      s.effectNotes = [...extra, notes].filter(Boolean).join("; ");
      applyArea(it, area);
      main = it; items.push(it);
    } else if (e.kind === "auto") {
      const it = await packItem("trap-attacks", "Cold");
      it.name = e.label;
      it.system.damage = { ...(it.system.damage ?? {}), parts: [[e.damage, null, await forceKey()]] };
      it.system.effectNotes = ["Automatic hit (no attack roll or save)", notes].filter(Boolean).join("; ");
      applyArea(it, area);
      main = it; items.push(it);
    } else if (e.kind === "poison") {
      const nm = poisonByKey(e.poison)?.item ?? POISONS[e.poison.toLowerCase()];
      let it = null;
      if (nm) { try { it = await packItem("poisons", nm); } catch (err) { console.warn(`${MOD} |`, err.message); } }
      if (it) {
        if (e.dc) it.system.save = { ...(it.system.save ?? {}), dc: String(e.dc) };
        if (e.gas && area) applyArea(it, area);
        items.push(it);
      } else trap.notes.push(`Poison: ${e.poison} [${e.vector}, Fort DC ${e.dc}, ${e.damage}]`);
    } else if (e.kind === "disease") {
      const d = diseaseByKey(e.disease);
      let it = null;
      if (d) { try { it = await packItem("diseases", d.item); } catch (err) { console.warn(`${MOD} |`, err.message); } }
      if (it) {
        it.system.save = { ...(it.system.save ?? {}), dc: String(e.dc) };
        items.push(it);
      }
      trap.notes.push(`Disease: ${e.disease} (Fort DC ${e.dc}, incubation ${e.incubation}, ${e.damage}); the GM tracks incubation and daily saves`);
    } else if (e.kind === "fall") {
      const it = await packItem("trap-attacks", "Fall Damage");
      it.name = "Fall Damage";
      const dc = trap.effects.find((x) => x.kind === "pitSave")?.dc;
      it.system.save = { ...(it.system.save ?? {}), dc: String(dc ?? 20), type: "reflexnegates" };
      it.system.damage = { ...(it.system.damage ?? {}), parts: [[e.damage, null, "damage-bludg"]] };
      it.system.effectNotes = `${e.depth} ft. deep pit; DC ${dc ?? 20} Reflex save avoids the fall`;
      main ??= it; items.push(it);
    } else if (e.kind === "spikes") {
      const it = await packItem("trap-attacks", "Arrow Attack");
      it.name = "Spike Attack";
      it.img = "systems/D35E/icons/traps/trap-spikes.png";
      const s = it.system;
      s.attackBonus = String(e.bonus);
      s.attackParts = [];
      s.specialActions = [];
      s.damage = { ...(s.damage ?? {}), parts: [[e.damage, null, "damage-piercing"]] };
      s.attackNotes = `Target strikes [[${e.count}]] spikes after falling into the pit${e.carries ? `; each spike that hits also delivers the ${e.carries}` : ""}`;
      items.push(it);
    } else if (e.kind === "onset") {
      const it = await packItem("trap-attacks", "Start 5 round Timer");
      it.name = `Start ${e.rounds} round Timer`;
      it.system.specialActions = (it.system.specialActions ?? []).map((a) => ({
        ...a, name: "Onset Delay", action: a.action.replace(/max\(1,\d+\)/, `max(1,${e.rounds})`),
      }));
      it.system.effectNotes = `The trap takes effect ${e.rounds} round${e.rounds === 1 ? "" : "s"} after it is triggered`;
      items.push(it);
    } else if (e.kind === "duration") {
      const it = await packItem("trap-attacks", "Start 5 round Timer");
      it.name = `Start ${e.rounds} round Timer`;
      it.system.specialActions = (it.system.specialActions ?? []).map((a) => ({
        ...a, name: "Trap Duration", action: a.action.replace(/max\(1,\d+\)/, `max(1,${e.rounds})`),
      }));
      items.push(it);
    } else if (e.kind === "unknown") trap.notes.push(e.text);
    // pitSave and flags (never miss, liquid, water, gas) are covered by the items above and the notes
  }
  if (main && area && !area.template) main.system.attackNotes = notes;
  return items;
}

function notesHtml(trap, text) {
  const save = trap.effects.find((e) => e.dc)?.dc ?? 0;
  const lines = [cap(trap.trigger ?? ""), `Save DC ${save}`];
  const fx = text.replace(/\s+/g, " ").split(";").map((s) => s.trim()).slice(1)
    .filter((s) => !/^(CR |mechanical|magic device|spell$|Search DC|Disable Device DC)/.test(s) && s !== trap.trigger);
  lines.push(fx.join("; "));
  return lines.map((l) => `<p>${l}</p>`).join("\n") + `\n<p><em>Generated by the Random Trap Generator.</em></p>`;
}

async function getFolder() {
  return game.folders.find((f) => f.type === "Actor" && f.name === FOLDER_NAME)
    ?? Folder.create({ name: FOLDER_NAME, type: "Actor", color: "#3b24f0" });
}

/** Create a D35E trap actor from a rolled trap. */
export async function createTrapActor(rolled, { folder } = {}) {
  folder ??= await getFolder();
  if (rolled.srd && rolled.uuid) {
    const src = await fromUuid(rolled.uuid);
    const data = src.toObject();
    delete data._id;
    data.folder = folder.id;
    foundry.utils.setProperty(data, `flags.${MOD}.generated`, { text: rolled.text, cr: rolled.cr, srd: true });
    return Actor.create(data);
  }
  if (rolled.base?.uuid) {
    // An SRD trap with something added (e.g. Tainted Water-Filled Room): copy the SRD actor and add the extra items.
    const src = await fromUuid(rolled.base.uuid);
    if (src) {
      const data = src.toObject();
      delete data._id;
      data.name = rolled.name;
      data.folder = folder.id;
      const extra = parseTrap(`${rolled.name}: CR ${rolled.cr}; ${rolled.base.agentText}`);
      data.items.push(...(await buildItems(extra)));
      Object.assign(data.system.details, { cr: rolled.cr, totalCr: rolled.cr });
      const old = data.system.details.notes?.value ?? "";
      data.system.details.notes = { ...(data.system.details.notes ?? {}), value: `${old}\n<p><strong>Tainted:</strong> ${cap(rolled.base.agentText)}.</p>`
        + (extra.notes.length ? `\n<p>Notes: ${extra.notes.join("; ")}</p>` : "") + `\n<p><em>Generated by the Random Trap Generator.</em></p>` };
      foundry.utils.mergeObject(data.prototypeToken, { name: rolled.name });
      foundry.utils.setProperty(data, `flags.${MOD}.generated`, { text: rolled.text, cr: rolled.cr, srd: false });
      return Actor.create(data);
    }
  }
  const trap = parseTrap(rolled.text);
  const base = (await fromUuid(BASE_ACTOR)).toObject();
  delete base._id;
  base.name = trap.name;
  base.img = iconFor(trap.name);
  base.folder = folder.id;
  base.ownership = { default: 0 };
  base.items = base.items.filter((i) => i.type === "buff" && i.name === "Basic Trap").map((i) => { delete i._id; return i; });
  base.items.push(...(await buildItems(trap)));
  const d = base.system.details;
  Object.assign(d, { cr: rolled.cr, totalCr: rolled.cr, findDC: trap.search, disarmDC: trap.disable });
  d.notes = { ...(d.notes ?? {}), value: notesHtml(trap, rolled.text) + (trap.notes.length ? `\n<p>Notes: ${trap.notes.join("; ")}</p>` : "") };
  foundry.utils.mergeObject(base.prototypeToken, { name: trap.name, texture: { src: base.img } });
  foundry.utils.setProperty(base, "system.tokenImg", base.img);
  foundry.utils.setProperty(base, `flags.${MOD}.generated`, { text: rolled.text, cr: rolled.cr, srd: false });
  return Actor.create(base);
}

/* -------------------------------------------- */
/*  User interface                              */
/* -------------------------------------------- */

function trapOptions(cr, includeSrd, includeRules = true) {
  const opts = templatesFor(cr, { includeRules }).filter((t) => includeSrd || !t.srd)
    .map((t) => `<option value="${t.name}">${t.name}${t.srd ? " (SRD)" : t.rule ? " (poison/disease)" : ""}</option>`);
  return `<option value="">Random</option>${opts.join("")}`;
}

export async function openGenerator() {
  if (!game.user.isGM) return ui.notifications.warn("Only the GM can generate traps.");
  await loadData();
  const crOpts = Array.from({ length: 20 }, (_, i) => `<option value="${i + 1}">CR ${i + 1}</option>`).join("");
  const content = `
    <div class="form-group"><label>Challenge Rating</label><select name="cr">${crOpts}</select></div>
    <div class="form-group"><label>Trap</label><select name="trap">${trapOptions(1, true)}</select></div>
    <div class="form-group"><label>How many</label><input type="number" name="count" value="1" min="1" max="10" step="1"></div>
    <div class="form-group"><label>Include SRD sample traps</label><input type="checkbox" name="includeSrd" checked></div>
    <div class="form-group"><label>Include poison &amp; disease traps</label><input type="checkbox" name="includeRules" checked></div>
    <div class="form-group"><label>Create actors</label><input type="checkbox" name="createActors" checked></div>
    <p class="hint">Unchecking "Create actors" only posts the stat lines to chat. Use Customize… to choose the trap\'s trigger, damage, DCs and other values yourself.</p>`;

  const refresh = (root) => {
    const form = root.querySelector("form") ?? root;
    const cr = form.querySelector('[name="cr"]'), trap = form.querySelector('[name="trap"]'), srd = form.querySelector('[name="includeSrd"]'), rules = form.querySelector('[name="includeRules"]');
    const update = () => { trap.innerHTML = trapOptions(+cr.value, srd.checked, rules.checked); };
    cr.addEventListener("change", update); srd.addEventListener("change", update); rules.addEventListener("change", update);
  };

  const { DialogV2 } = foundry.applications.api;
  const result = await DialogV2.wait({
    window: { title: "Random Trap Generator", icon: "fas fa-dice-d20" },
    content,
    rejectClose: false,
    render: (event, dialog) => refresh((dialog ?? event?.target)?.element ?? document),
    buttons: [{
      action: "generate", label: "Generate", icon: "fas fa-dice-d20", default: true,
      callback: (event, button) => {
        const f = button.form;
        return { cr: +f.elements.cr.value, trap: f.elements.trap.value || null, count: Math.min(10, Math.max(1, +f.elements.count.value || 1)),
          includeSrd: f.elements.includeSrd.checked, includeRules: f.elements.includeRules.checked, createActors: f.elements.createActors.checked };
      },
    }, {
      action: "customize", label: "Customize…", icon: "fas fa-sliders",
      callback: (event, button) => {
        const f = button.form;
        return { customize: true, cr: +f.elements.cr.value, trap: f.elements.trap.value || null, count: Math.min(10, Math.max(1, +f.elements.count.value || 1)),
          includeSrd: f.elements.includeSrd.checked, includeRules: f.elements.includeRules.checked, createActors: f.elements.createActors.checked };
      },
    }, { action: "cancel", label: "Cancel" }],
  });
  if (!result || result === "cancel") return;
  if (result.customize) return openCustomizer(result);
  return generate(result);
}

/** Chat card HTML. Traps without an actor get a "Create Actor" button. */
function chatContent(cr, traps) {
  const rows = traps.map((t, i) => {
    const title = t.actor ? `@UUID[${t.actor}]{${t.name}}` : `<strong>${t.name}</strong>`;
    const button = t.actor ? "" :
      `<br><button type="button" class="tp-create-trap" data-index="${i}"><i class="fas fa-user-plus"></i> Create Actor</button>`;
    return `<li>${title}${t.srd ? " (SRD)" : ""}<br><small>${t.text}</small>${button}</li>`;
  });
  return `<h3>Random Trap${traps.length > 1 ? "s" : ""} — CR ${cr}</h3><ol>${rows.join("")}</ol>`;
}

export async function generate({ cr, trap = null, count = 1, includeSrd = true, includeRules = true, createActors = true, custom = null }) {
  await loadData();
  const traps = [];
  let last = null;
  for (let i = 0; i < count; i++) {
    const rolled = rollTrap(cr, { name: trap, includeSrd, includeRules, custom });
    const entry = { name: rolled.name, cr: rolled.cr, text: rolled.text.replace(/\s+/g, " "), srd: rolled.srd, uuid: rolled.uuid ?? null, base: rolled.base ?? null, actor: null };
    if (createActors) {
      try { last = await createTrapActor(rolled); entry.actor = last.uuid; }
      catch (err) { console.error(`${MOD} | Failed to create trap actor`, err, rolled); ui.notifications.error(`Could not create ${rolled.name}: ${err.message}`); }
    }
    traps.push(entry);
  }
  await ChatMessage.create({
    content: chatContent(cr, traps),
    whisper: ChatMessage.getWhisperRecipients("GM").map((u) => u.id),
    speaker: { alias: "Random Trap Generator" },
    flags: { [MOD]: { cr, traps } },
  });
  if (createActors && count === 1 && last) last.sheet.render(true);
}

/** Wire up the "Create Actor" buttons on generator chat cards. */
function activateChatButtons(message, html) {
  const root = html instanceof HTMLElement ? html : html?.[0];
  const flags = message?.flags?.[MOD];
  if (!root || !flags?.traps) return;
  root.querySelectorAll("button.tp-create-trap").forEach((btn) => {
    if (!game.user.isGM) return btn.remove();
    btn.addEventListener("click", async (ev) => {
      ev.preventDefault();
      btn.disabled = true;
      const i = Number(btn.dataset.index);
      const traps = foundry.utils.deepClone(message.flags[MOD].traps);
      try {
        await loadData();
        const actor = await createTrapActor(traps[i]);
        traps[i].actor = actor.uuid;
        await message.update({ content: chatContent(flags.cr, traps), [`flags.${MOD}.traps`]: traps });
        actor.sheet.render(true);
      } catch (err) {
        btn.disabled = false;
        console.error(`${MOD} | Failed to create trap actor`, err, traps[i]);
        ui.notifications.error(`Could not create ${traps[i].name}: ${err.message}`);
      }
    });
  });
}

/* -------------------------------------------- */
/*  Hooks                                       */
/* -------------------------------------------- */

if (globalThis.Hooks) {
  Hooks.once("ready", () => {
    const mod = game.modules.get(MOD);
    if (mod) mod.api = { ...(mod.api ?? {}), openGenerator, generate, chatContent, rollTrap: async (cr, o) => (await loadData(), rollTrap(cr, o)), parseTrap, createTrapActor };
  });
  Hooks.on("renderChatMessageHTML", activateChatButtons);
  if (globalThis.AxecleftTools) {
    // Shared "Axecleft's Tools" menu in D35E's Game Master Tools (see scripts/axecleft-tools.js)
    globalThis.AxecleftTools.register({
      module: MOD, name: "random-trap", title: "Random Trap Generator", img: "icons/svg/trap.svg",
      hint: "Roll random traps by CR and create trap actors", gmOnly: true, onClick: () => openGenerator(),
    });
  }
  Hooks.on("renderActorDirectory", (app, html) => {
    if (!game.user.isGM) return;
    const root = html instanceof HTMLElement ? html : html?.[0] ?? app.element;
    if (!root || root.querySelector(".tp-random-trap")) return;
    const target = root.querySelector(".header-actions") ?? root.querySelector(".directory-header");
    if (!target) return;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "tp-random-trap";
    btn.innerHTML = '<i class="fas fa-dice-d20"></i> Random Trap';
    btn.addEventListener("click", (ev) => { ev.preventDefault(); openGenerator(); });
    target.append(btn);
  });
}
