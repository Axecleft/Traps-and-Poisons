/**
 * Axecleft's Traps, Poisons, and Diseases — Poison & Disease Creator
 *
 * Lets the GM build a new poison or disease from a simple form (optionally
 * starting from an existing one as a template), then creates:
 *   - the attack item ("Poison, X" / "Disease, X"), like the module's own, and
 *   - a consumable ("X") whose "Poison Weapon" action adds that attack to the user.
 * Both go into a world compendium, "Custom Poisons & Diseases", so module updates
 * never overwrite them and the consumable's action can load the attack from it.
 *
 * Open it from the "Axecleft's Tools" toolbar group, or with a macro:
 *   game.modules.get("traps-and-poisons").api.openPoisonCreator();
 */

const MOD = "traps-and-poisons";
const CUSTOM_PACK_NAME = "axecleft-custom-poisons";
const CUSTOM_PACK_LABEL = "Custom Poisons & Diseases";
const CUSTOM_PACK = `world.${CUSTOM_PACK_NAME}`;
const WORLD_FOLDER = "Custom Poisons & Diseases";

export const DELIVERY = ["Contact", "Ingested", "Inhaled", "Injury"];
const ABILITIES = { str: "Str", dex: "Dex", con: "Con", int: "Int", wis: "Wis", cha: "Cha" };
const SAVES = { fortitude: "Fortitude", reflex: "Reflex", will: "Will" };
const ICON_POISON = "systems/D35E/icons/special-abilities/poison.png";
const ICON_DISEASE = "icons/svg/biohazard.svg";
const IMG_INITIAL = "systems/D35E/icons/special-abilities/poison-initial.png";
const IMG_SECONDARY = "systems/D35E/icons/special-abilities/poison-secondary.png";

/* -------------------------------------------- */
/*  Effect text  <->  D35E special actions      */
/*  (pure functions, testable outside Foundry)  */
/* -------------------------------------------- */

/*
 * Conditions the effect text understands. Each becomes D35E actions:
 *  cond: set D35E condition flags; buff: apply a buff (module's or D35E's).
 */
const CONDITIONS = [
  { re: /^(unconsciousness|unconscious)$/, label: "unconsciousness", word: "Unconscious", cond: ["unconscious", "helpless", "prone"] },
  { re: /^(paralysis|paralyzed)$/, label: "paralysis", word: "Paralyzed", buff: ["Paralyzed", `${MOD}.common-trap-buffs`] },
  { re: /^(stun|stunned)$/, label: "stunned", word: "Stunned", buff: ["Stunned", `${MOD}.common-trap-buffs`] },
  { re: /^(shaken)$/, label: "shaken", word: "Shaken", buff: ["Shaken", `${MOD}.common-trap-buffs`] },
  { re: /^(frightened|fear)$/, label: "frightened", word: "Frightened", buff: ["Frightened", `${MOD}.common-trap-buffs`] },
  { re: /^(petrified|petrification)$/, label: "petrified", word: "Petrified", buff: ["Petrified", `${MOD}.common-trap-buffs`] },
  { re: /^(prone)$/, label: "prone", word: "Prone", buff: ["Prone", `${MOD}.common-trap-buffs`] },
  { re: /^(blind|blinded|blindness)$/, label: "blindness", word: "Blinded", buff: ["Blinded", "D35E.commonbuffs"] },
  { re: /^(sickened)$/, label: "sickened", word: "Sickened", cond: ["sickened"] },
  { re: /^(fatigued|fatigue)$/, label: "fatigued", word: "Fatigued", cond: ["fatigued"] },
  { re: /^(exhausted|exhaustion)$/, label: "exhausted", word: "Exhausted", cond: ["exhausted"] },
  { re: /^(deaf|deafened|deafness)$/, label: "deafness", word: "Deafened", cond: ["deaf"] },
  { re: /^(dazzled)$/, label: "dazzled", word: "Dazzled", cond: ["dazzled"] },
  { re: /^(nauseated|nausea)$/, label: "nauseated", word: "Nauseated", cond: ["nauseated"] },
];

const DICE = String.raw`\(?\d+(?:d\d+)?(?:\s*[+-]\s*\d+)?\)?`;
const cleanDice = (d) => String(d).replace(/[()\s]/g, "");
const isZero = (d) => /^(0|1d1-1)$/.test(cleanDice(d));
const plainDice = (d) => { const x = cleanDice(d); return x === "1d1" ? "1" : isZero(x) ? "0" : x; };
const abilityKey = (s) => Object.keys(ABILITIES).find((k) => k.slice(0, 2) === String(s).toLowerCase().slice(0, 2));

/** Convert a duration ("1 minute", "2d4 hours", "3 rounds") to a rounds formula, or null. */
export function durationRounds(text) {
  const m = String(text ?? "").trim().match(new RegExp(`^(${DICE})\\s*(round|minute|hour|day)s?\\b`, "i"));
  if (!m) return null;
  const n = cleanDice(m[1]), unit = m[2].toLowerCase();
  const mult = { round: 1, minute: 10, hour: 600, day: 14400 }[unit];
  return mult === 1 ? n : /^\d+$/.test(n) ? String(+n * mult) : `(${n})*${mult}`;
}

/**
 * Parse SRD-style effect text into parts. Pieces are separated by "+" or ",".
 *   "1d6 Con"            ability damage          "1 Con drain" / "1 Con*"   ability drain
 *   "2d12 hp"            hit point damage        "unconsciousness 2d4 hours" condition (+ duration)
 *   "0" / "none"         nothing                 anything else              shown in chat as a message
 */
export function parseEffectText(text) {
  const parts = [];
  const pieces = String(text ?? "").split(/\s*(?:\+|,)\s*(?![^()]*\))/).map((s) => s.trim()).filter(Boolean);
  for (const piece of pieces) {
    const p = piece.replace(/\s+/g, " ");
    const lower = p.toLowerCase();
    let m;
    if (/^(0|none|-|—|no effect)$/.test(lower)) continue;
    if ((m = lower.match(new RegExp(`^(${DICE}) (str|dex|con|int|wis|cha)[a-z]*( ?\\*| (?:permanent )?drain)?$`)))) {
      const amount = cleanDice(m[1]);
      if (isZero(amount)) continue;
      parts.push({ kind: m[3] ? "drain" : "ability", ability: m[2], amount });
    } else if ((m = lower.match(new RegExp(`^(${DICE}) (?:hp|hit points?|points? of damage|damage)$`)))) {
      parts.push({ kind: "hp", amount: cleanDice(m[1]) });
    } else {
      const [word, ...rest] = lower.split(" ");
      const c = CONDITIONS.find((x) => x.re.test(word.replace(/[^a-z]/g, "")));
      if (c) parts.push({ kind: "condition", key: c.label, duration: p.split(" ").slice(1).join(" ").replace(/^for /i, "").trim() || null });
      else parts.push({ kind: "message", text: p.replace(/;/g, ",") });
    }
  }
  return parts;
}

/** Human-readable text for parsed parts (also used to describe a template). */
export function partsToText(parts) {
  if (!parts.length) return "0";
  return parts.map((p) => {
    if (p.kind === "ability") return `${plainDice(p.amount)} ${ABILITIES[p.ability]}`;
    if (p.kind === "drain") return `${plainDice(p.amount)} ${ABILITIES[p.ability]} drain`;
    if (p.kind === "hp") return `${p.amount} hp`;
    if (p.kind === "condition") return p.duration ? `${p.key} ${p.duration}` : p.key;
    return p.text;
  }).join(" + ");
}

/** D35E special-action text for parsed parts. */
export function partsToAction(parts) {
  const out = [];
  for (const p of parts) {
    if (p.kind === "ability") out.push(`AbilityDamage ${p.ability} ${p.amount} on target;`);
    else if (p.kind === "drain") out.push(`Update subtract data.abilities.${p.ability}.value to ${p.amount} on target;`);
    else if (p.kind === "hp") out.push(`Update subtract data.attributes.hp.value to ${p.amount} on target;`);
    else if (p.kind === "message") out.push(`Message public ${p.text} on target;`);
    else if (p.kind === "condition") {
      const c = CONDITIONS.find((x) => x.label === p.key);
      if (c.cond) out.push(...c.cond.map((k) => `Condition set ${k} to true on target;`));
      if (c.buff) {
        const [buff, pack] = c.buff;
        out.push(`Create unique "${buff}" from "${pack}" on target;`);
        const r = durationRounds(p.duration);
        if (r) out.push(`Set buff "${buff}" field system.timeline.formula to max(1,${r}) on target;`);
        out.push(`Activate buff "${buff}" on target;`);
      }
      if (p.duration) out.push(`Message public ${c.word} for ${p.duration.replace(/;/g, ",")} on target;`);
    }
  }
  return out.join(" ");
}

/** Plain-English preview of what parts will do in play. */
export function partsPreview(parts) {
  if (!parts.length) return ["No effect"];
  return parts.map((p) => {
    if (p.kind === "ability") return `Ability damage: ${p.amount} ${ABILITIES[p.ability]}`;
    if (p.kind === "drain") return `Ability drain (permanent): ${p.amount} ${ABILITIES[p.ability]}`;
    if (p.kind === "hp") return `Hit point damage: ${p.amount}`;
    if (p.kind === "condition") {
      const c = CONDITIONS.find((x) => x.label === p.key);
      const how = c.buff ? `"${c.buff[0]}" buff` : `condition${c.cond.length > 1 ? "s" : ""} ${c.cond.join(", ")}`;
      const r = c.buff && durationRounds(p.duration);
      return `${c.word}: ${how}${p.duration ? `, ${p.duration}${r ? ` (${r} rounds)` : " (shown in chat)"}` : ""}`;
    }
    return `Chat message: "${p.text}"`;
  });
}

/**
 * Read a D35E special-action string back into parts. Commands it doesn't
 * recognise are returned in `extra` so they can be kept as-is.
 */
export function actionToParts(action) {
  const parts = [], extra = [];
  const cmds = String(action ?? "").split(";").map((s) => s.trim()).filter(Boolean);
  let lastCond = null;
  for (const cmd of cmds) {
    let m;
    if ((m = cmd.match(/^AbilityDamage (\w+) (.+?) on target$/i))) {
      const ab = abilityKey(m[1]);
      if (!ab) { extra.push(cmd); continue; }
      if (!isZero(m[2])) parts.push({ kind: "ability", ability: ab, amount: plainDice(m[2]) });
      lastCond = null;
    } else if ((m = cmd.match(/^AbilityDrain (\w+) (.+?) on target$/i)) || (m = cmd.match(/^Update subtract data\.abilities\.(\w+)\.value to (.+?) on target$/i))) {
      const ab = abilityKey(m[1]);
      if (!ab) { extra.push(cmd); continue; }
      parts.push({ kind: "drain", ability: ab, amount: plainDice(m[2]) }); lastCond = null;
    } else if ((m = cmd.match(/^Update subtract data\.attributes\.hp\.value to (.+?) on target$/i))) {
      parts.push({ kind: "hp", amount: cleanDice(m[1]) }); lastCond = null;
    } else if ((m = cmd.match(/^Condition set (\w+) to true on target$/i))) {
      const k = m[1].toLowerCase();
      if ((k === "helpless" || k === "prone") && lastCond?.key === "unconsciousness") continue;
      const c = CONDITIONS.find((x) => x.cond?.includes(k)) ?? CONDITIONS.find((x) => x.re.test(k));
      if (c) { lastCond = { kind: "condition", key: c.label, duration: null }; parts.push(lastCond); }
      else extra.push(cmd);
    } else if ((m = cmd.match(/^Create unique "([^"]+)" from "?([\w.-]+)"? on target$/i))) {
      const c = CONDITIONS.find((x) => x.buff?.[0].toLowerCase() === m[1].toLowerCase());
      if (c) { lastCond = { kind: "condition", key: c.label, duration: null }; parts.push(lastCond); }
      else extra.push(cmd);
    } else if (/^(Set buff "[^"]+" field system\.timeline\.formula|Activate buff) /i.test(cmd) && lastCond) {
      continue;
    } else if ((m = cmd.match(/^Message public (.+?) on target$/i))) {
      const d = m[1].match(/^(\w+) for (.+)$/);
      if (d && lastCond && CONDITIONS.find((x) => x.label === lastCond.key)?.word.toLowerCase() === d[1].toLowerCase()) lastCond.duration = d[2];
      else parts.push({ kind: "message", text: m[1] });
    } else extra.push(cmd);
  }
  return { parts, extra };
}

/* -------------------------------------------- */
/*  Form values  <->  items                     */
/* -------------------------------------------- */

const stripTags = (h) => String(h ?? "").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
const escHtml = (v) => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const safeName = (s) => String(s ?? "").replace(/["“”;]/g, "").replace(/\s+/g, " ").trim();
const titleCase = (s) => { const t = String(s); return t.charAt(0).toUpperCase() + t.slice(1); };

/** An empty form. */
export function blankForm(kind = "poison") {
  return { kind, name: "", delivery: "Injury", saveType: "fortitude", dc: 15, initial: "", secondary: "", incubation: kind === "disease" ? "1 day" : "", recover: 2,
    price: kind === "poison" ? 100 : 0, notes: "", extras: [], templateName: "" };
}

/**
 * Turn an existing attack item (and its consumable, if any) into form values.
 * `folderName` is the item's compendium folder (Contact/Ingested/Inhaled/Injury).
 */
export function itemToForm(item, { folderName = null, consumable = null } = {}) {
  const s = item.system ?? {};
  const isDisease = /^disease,/i.test(item.name) || (s.specialActions ?? []).some((a) => a.name === "Apply Disease");
  const f = blankForm(isDisease ? "disease" : "poison");
  f.templateName = item.name;
  f.name = item.name.replace(/^(poison|disease),\s*/i, "");
  const desc = stripTags(s.description?.value);
  f.delivery = DELIVERY.find((d) => d === folderName) ?? DELIVERY.find((d) => new RegExp(`\\b${d}\\b`, "i").test(desc)) ?? "Injury";
  const st = String(s.save?.type ?? "fortitudenegates");
  f.saveType = Object.keys(SAVES).find((k) => st.startsWith(k)) ?? "fortitude";
  f.dc = Number(s.save?.dc) || f.dc;
  const actions = s.specialActions ?? [];
  const extras = [];
  if (isDisease) {
    const inc = actions.find((a) => /^Incubation/i.test(a.name));
    f.incubation = inc?.name.match(/\((.+)\)/)?.[1] ?? (s.effectNotes?.match(/Incubation ([^;]+)/i)?.[1] ?? "1 day");
    const dmg = actions.find((a) => a.name === "Daily Damage");
    const r = actionToParts(dmg?.action);
    f.secondary = partsToText(r.parts);
    if (r.extra.length) extras.push({ name: "Daily Damage (other)", action: r.extra.join("; ") + ";", img: dmg?.img ?? IMG_SECONDARY });
    f.recover = /three successful/i.test(s.effectNotes ?? "") ? 3 : 2;
    const p = String(s.description?.value ?? "").match(/<\/table>\s*<p>(.*?)<\/p>/s);
    f.notes = p ? stripTags(p[1]) : "";
    for (const a of actions) if (!["Apply Disease", "Daily Damage"].includes(a.name) && !/^Incubation/i.test(a.name)) extras.push({ name: a.name, action: a.action, img: a.img });
  } else {
    for (const [field, nm] of [["initial", "Initial Damage"], ["secondary", "Secondary Damage"]]) {
      const a = actions.find((x) => x.name === nm);
      const r = actionToParts(a?.action);
      f[field] = partsToText(r.parts);
      if (r.extra.length) extras.push({ name: `${nm} (other)`, action: r.extra.join("; ") + ";", img: a?.img ?? IMG_SECONDARY });
    }
    for (const a of actions) if (!["Initial Damage", "Secondary Damage", "Apply Poison"].includes(a.name)) extras.push({ name: a.name, action: a.action, img: a.img });
    f.notes = stripTags(s.effectNotes ?? "");
  }
  f.extras = extras;
  if (consumable) f.price = Number(consumable.system?.price) || 0;
  return f;
}

/** Problems with the form, or [] if it can be created. */
export function validateForm(f) {
  const errs = [];
  if (!safeName(f.name)) errs.push("Give it a name.");
  if (!(Number(f.dc) > 0)) errs.push("The save DC must be a number above 0.");
  if (f.kind === "poison" && !parseEffectText(f.initial).length && !parseEffectText(f.secondary).length) errs.push("A poison needs an initial or secondary effect.");
  if (f.kind === "disease" && !parseEffectText(f.secondary).length) errs.push("A disease needs its damage.");
  if (f.kind === "disease" && !String(f.incubation ?? "").trim()) errs.push("A disease needs an incubation period.");
  return errs;
}

/* SRD: secondary damage comes 1 minute (10 rounds) after exposure; then the poison has run its course. */
export const POISON_SECONDARY_ROUNDS = 10;
const secondaryWhen = () => POISON_SECONDARY_ROUNDS % 10 === 0 ? `${POISON_SECONDARY_ROUNDS / 10} minute${POISON_SECONDARY_ROUNDS === 10 ? "" : "s"} (${POISON_SECONDARY_ROUNDS} rounds)` : `${POISON_SECONDARY_ROUNDS} rounds`;
const POISON_TIMING = () => `Initial damage on a failed save at exposure. ${secondaryWhen()} later, a second save avoids the secondary damage. The poison then runs its course and ends; conditions it caused (such as unconsciousness) last their own duration.`;

const RECOVER_TEXT = (n) => `${n === 3 ? "three" : "two"} successful saves in a row to recover`;

/**
 * Build the attack and consumable data. `attackBase` / `consumableBase` are
 * plain objects of existing items to copy the structure from.
 */
export function buildDocuments(f, { attackBase, consumableBase, packId = CUSTOM_PACK }) {
  const name = titleCase(safeName(f.name));
  const dc = Math.round(Number(f.dc));
  const save = SAVES[f.saveType] ?? "Fortitude";
  const isDisease = f.kind === "disease";
  const attackName = `${isDisease ? "Disease" : "Poison"}, ${name}`;
  const ini = parseEffectText(f.initial), sec = parseEffectText(f.secondary);
  const iniText = partsToText(ini), secText = partsToText(sec);

  const attack = JSON.parse(JSON.stringify(attackBase));
  delete attack._id; delete attack.folder; delete attack.sort;
  attack.name = attackName;
  attack.type = "attack";
  attack.img = isDisease ? ICON_DISEASE : ICON_POISON;
  attack.ownership = { default: 0 };
  const s = attack.system;
  s.actionType = "save";
  s.save = { ...(s.save ?? {}), dc: String(dc), type: `${f.saveType}negates` };
  s.damage = { ...(s.damage ?? {}), parts: [] };
  if ("identifiedName" in s) s.identifiedName = attackName;
  const keep = (f.extras ?? []).filter((e) => e.keep !== false).map((e) => ({ name: e.name, action: e.action, condition: "", img: e.img ?? IMG_SECONDARY }));
  const notes = String(f.notes ?? "").trim();

  if (isDisease) {
    const inc = String(f.incubation).trim();
    const recover = RECOVER_TEXT(Number(f.recover));
    const bufftext = `${name}: ${save} DC ${dc} each day, damage ${secText}, incubation ${inc}, ${recover}.`.replace(/"/g, "'").replace(/;/g, ",");
    s.description = { ...(s.description ?? {}), value:
      `<div><table id="tableDiseases"><thead><tr><th>Disease</th><th>Infection</th><th>DC</th><th>Incubation</th><th>Damage</th></tr>`
      + `<tr><td>${escHtml(name)}</td><td>${f.delivery}</td><td>${dc}</td><td>${escHtml(inc)}</td><td>${escHtml(secText)}</td></tr></thead></table>`
      + (notes ? `<p>${escHtml(notes)}</p>` : "")
      + `<p>On a failed ${save} save the disease takes hold. After the incubation period the victim takes the listed damage, and must make a ${save} save each day afterward to avoid repeated damage. `
      + `${Number(f.recover) === 3 ? "Three" : "Two"} successful saving throws in a row indicate that he has fought off the disease and recovers.</p></div>` };
    s.effectNotes = `Incubation ${inc}; ${secText} per day; ${save.slice(0, 4)} DC ${dc} daily; ${recover}`;
    s.specialActions = [
      { name: "Apply Disease", action: `Create unique "Diseased" from "${MOD}.common-trap-buffs" on target;Set buff "Diseased" field system.description.value exact "${bufftext}" on target;Set buff "Diseased" field name to "Diseased (${name})" on target;Activate buff "Diseased (${name})" on target;`, condition: "", img: ICON_DISEASE },
      { name: `Incubation (${inc})`, action: `Message public ${name} incubation period: ${inc.replace(/;/g, ",")} on target;`, condition: "", img: IMG_INITIAL },
      { name: "Daily Damage", action: partsToAction(sec), condition: "", img: IMG_SECONDARY },
      ...keep,
    ];
  } else {
    const secDesc = secText === "0" ? "none" : secText.replace(/^unconsciousness/, "Unconsciousness");
    s.description = { ...(s.description ?? {}), value:
      `<div><table id="tablePoisons"><thead><tr><th>Poison</th><th>Type</th><th>Initial Damage</th><th>Secondary Damage</th><th>Price</th></tr>`
      + `<tr><td>${escHtml(name)}</td><td>${f.delivery} DC ${dc}</td><td>${escHtml(iniText)}</td><td>${escHtml(secText)}</td><td>${Number(f.price) || 0} gp</td></tr></thead></table>`
      + (notes ? `<p>${escHtml(notes)}</p>` : "") + `<p>${POISON_TIMING()}</p></div>` };
    s.effectNotes = [`Secondary damage ${secondaryWhen()} after exposure; the poison then ends`, notes].filter(Boolean).join("; ");
    s.specialActions = [
      { name: "Initial Damage", action: partsToAction(ini), condition: "", img: IMG_INITIAL },
      { name: "Secondary Damage", action: partsToAction(sec), condition: "", img: IMG_SECONDARY },
      { name: "Apply Poison", action: `Create unique "Poisoned" from "D35E.commonbuffs" on target;Set buff "Poisoned" field data.level to max(1,${dc}) on target;Set buff "Poisoned" field system.description.value exact "${save} DC ${dc}, secondary damage ${secDesc.replace(/"/g, "'").replace(/;/g, ",")} after ${secondaryWhen()}, then the poison ends" on target;Set buff "Poisoned" field system.timeline.enabled to true on target;Set buff "Poisoned" field system.timeline.formula to ${POISON_SECONDARY_ROUNDS} on target;Set buff "Poisoned" field name to "Poisoned (${name})" on target;Activate buff "Poisoned (${name})" on target;`, condition: "", img: ICON_POISON },
      ...keep,
    ];
  }

  const con = JSON.parse(JSON.stringify(consumableBase));
  delete con._id; delete con.folder; delete con.sort;
  con.name = name;
  con.type = "consumable";
  con.img = isDisease ? ICON_DISEASE : consumableBase.img;
  con.ownership = { default: 0 };
  const c = con.system;
  c.identifiedName = name;
  c.price = Number(f.price) || 0;
  c.save = { ...(c.save ?? {}), dc: String(dc) };
  c.unidentified = { ...(c.unidentified ?? {}), name: isDisease ? "Vial" : f.delivery === "Inhaled" ? "Powder" : "Oil" };
  const weapon = f.delivery === "Injury" || f.delivery === "Contact";
  c.target = { ...(c.target ?? {}), value: weapon ? "one weapon" : f.delivery === "Ingested" ? "one meal or drink" : "one dose" };
  c.description = { ...(c.description ?? {}), value: isDisease
    ? `<p>(${f.delivery}, ${save} DC ${dc}, incubation ${escHtml(f.incubation)}, ${escHtml(secText)})</p>${notes ? `<p>${escHtml(notes)}</p>` : ""}`
    : `<p>(${f.delivery}, ${save} DC ${dc}, ${escHtml(iniText)} initial, ${escHtml(secText)} secondary)</p>${notes ? `<p>${escHtml(notes)}</p>` : ""}` };
  const verb = isDisease ? (weapon ? "Infect Weapon" : "Prepare Dose") : (weapon ? "Poison Weapon" : "Prepare Dose");
  c.specialActions = [{
    name: verb,
    action: `Create unique "${attackName}" from ${packId} on self; Set attack "${attackName}" field system.uses.per to "charges" on self; Set attack "${attackName}" field system.uses.maxFormula to 1 on self; Set attack "${attackName}" field system.uses.value to +1 on self;`,
    condition: "", img: attack.img,
  }];
  return { attack, consumable: con };
}

/* -------------------------------------------- */
/*  Foundry: compendium, templates, creating    */
/* -------------------------------------------- */

const CC = () => foundry.documents?.collections?.CompendiumCollection ?? globalThis.CompendiumCollection;
const ItemCls = () => CONFIG.Item.documentClass;

async function customPack({ create = true } = {}) {
  let pack = game.packs.get(CUSTOM_PACK);
  if (!pack && create) {
    pack = await CC().createCompendium({ label: CUSTOM_PACK_LABEL, name: CUSTOM_PACK_NAME, type: "Item" });
    ui.notifications.info(`Created the world compendium "${CUSTOM_PACK_LABEL}" for your poisons and diseases.`);
  }
  return pack ?? null;
}

async function packFolder(pack, name) {
  const existing = pack.folders?.find((f) => f.name === name);
  if (existing) return existing.id;
  const f = await Folder.create({ name, type: "Item" }, { pack: pack.collection });
  return f?.id ?? null;
}

async function worldFolder() {
  return (game.folders.find((f) => f.type === "Item" && f.name === WORLD_FOLDER)
    ?? await Folder.create({ name: WORLD_FOLDER, type: "Item", color: "#2f6b2f" })).id;
}

/** Template choices: the module's poisons and diseases, plus the GM's custom ones. */
async function templateIndex() {
  const groups = [];
  for (const [label, id, kind] of [["Your custom poisons & diseases", CUSTOM_PACK, null], ["Module poisons", `${MOD}.poisons`, "poison"], ["Module diseases", `${MOD}.diseases`, "disease"]]) {
    const pack = game.packs.get(id);
    if (!pack) continue;
    const idx = await pack.getIndex({ fields: ["type"] });
    const list = [...idx].filter((e) => e.type === "attack" && /^(poison|disease),/i.test(e.name))
      .map((e) => ({ uuid: `Compendium.${id}.Item.${e._id}`, name: e.name, kind: kind ?? (/^disease/i.test(e.name) ? "disease" : "poison") }));
    const seen = new Set();
    groups.push({ label, items: list.filter((e) => !seen.has(e.name) && seen.add(e.name)).sort((a, b) => a.name.localeCompare(b.name)) });
  }
  return groups.filter((g) => g.items.length);
}

export async function loadTemplate(uuid) {
  const doc = await fromUuid(uuid);
  if (!doc) return null;
  const folderName = doc.folder?.name ?? null;
  // Price comes from the matching consumable (module pack or custom pack).
  const bare = doc.name.replace(/^(poison|disease),\s*/i, "");
  let consumable = null;
  // Match by the attack the consumable adds (names differ, e.g. "Wyvern Poison" adds "Poison, Wyvern").
  for (const id of [CUSTOM_PACK, `${MOD}.poison-consumables`]) {
    const pack = game.packs.get(id);
    if (!pack) continue;
    const idx = [...await pack.getIndex()];
    const e = idx.find((x) => x.name === bare) ?? idx.find((x) => x.name === `${bare} Poison`);
    const docs = e ? [await pack.getDocument(e._id)] : (await pack.getDocuments()).filter((d) => d.type === "consumable");
    const hit = docs.find((d) => (d.system?.specialActions ?? []).some((a) => a.action?.includes(`"${doc.name}"`)));
    if (hit) { consumable = hit.toObject(); break; }
  }
  return itemToForm(doc.toObject(), { folderName, consumable });
}

async function baseItem(packId, name) {
  const pack = game.packs.get(packId);
  const e = pack && [...await pack.getIndex()].find((x) => x.name === name);
  if (!e) throw new Error(`"${name}" was not found in ${packId}`);
  return (await pack.getDocument(e._id)).toObject();
}

/** Create (or update) the attack and consumable. Returns the two documents. */
export async function createPoison(f, { templateUuid = null, copyToWorld = true } = {}) {
  const pack = await customPack();
  if (pack.locked) throw new Error(`The "${CUSTOM_PACK_LABEL}" compendium is locked. Unlock it and try again.`);
  const isDisease = f.kind === "disease";
  const tmpl = templateUuid ? (await fromUuid(templateUuid))?.toObject() : null;
  const attackBase = tmpl && /^(poison|disease),/i.test(tmpl.name) && /^disease/i.test(tmpl.name) === isDisease
    ? tmpl : await baseItem(isDisease ? `${MOD}.diseases` : `${MOD}.poisons`, isDisease ? "Disease, Filth Fever" : "Poison, Black Adder Venom");
  const consumableBase = await baseItem(`${MOD}.poison-consumables`, "Black Adder Venom");
  const { attack, consumable } = buildDocuments(f, { attackBase, consumableBase, packId: pack.collection });

  attack.folder = await packFolder(pack, isDisease ? "Diseases" : "Poisons");
  consumable.folder = await packFolder(pack, "Consumables");
  const idx = await pack.getIndex({ fields: ["type"] });
  const existing = (d) => [...idx].find((e) => e.name === d.name && e.type === d.type);
  const clash = [attack, consumable].filter(existing);
  if (clash.length) {
    const ok = await foundry.applications.api.DialogV2.confirm({
      window: { title: "Replace existing?" },
      content: `<p>${clash.map((d) => `<strong>${escHtml(d.name)}</strong>`).join(" and ")} already exist${clash.length === 1 ? "s" : ""} in ${CUSTOM_PACK_LABEL}. Replace ${clash.length === 1 ? "it" : "them"}?</p>`,
    });
    if (!ok) return null;
  }
  const save = async (d) => {
    const e = existing(d);
    if (e) { const doc = await pack.getDocument(e._id); await doc.update({ ...d, _id: e._id }, { recursive: false, diff: false }); return doc; }
    return ItemCls().create(d, { pack: pack.collection });
  };
  const a = await save(attack), c = await save(consumable);
  if (copyToWorld) {
    const folder = await worldFolder();
    for (const d of [attack, consumable]) {
      const old = game.items.find((i) => i.name === d.name && i.type === d.type && i.folder?.id === folder);
      if (old) await old.delete();
      await ItemCls().create({ ...d, folder });
    }
  }
  await ChatMessage.create({
    content: `<h3>${isDisease ? "Disease" : "Poison"} created</h3><p>@UUID[${a.uuid}]{${escHtml(a.name)}}<br>@UUID[${c.uuid}]{${escHtml(c.name)}} (consumable)</p>`
      + `<p><small>Saved in the ${CUSTOM_PACK_LABEL} compendium${copyToWorld ? ` and the "${WORLD_FOLDER}" Items folder` : ""}.</small></p>`,
    whisper: ChatMessage.getWhisperRecipients("GM").map((u) => u.id),
    speaker: { alias: "Poison & Disease Creator" },
  });
  return { attack: a, consumable: c };
}

/* -------------------------------------------- */
/*  Dialog                                      */
/* -------------------------------------------- */

function formHtml(f, groups, templateUuid) {
  const sel = (name, opts, value) => `<select name="${name}">${opts.map(([v, l]) => `<option value="${escHtml(v)}"${String(v) === String(value) ? " selected" : ""}>${escHtml(l)}</option>`).join("")}</select>`;
  const tmplOpts = `<option value="">— None (start blank) —</option>` + groups.map((g) =>
    `<optgroup label="${escHtml(g.label)}">${g.items.map((i) => `<option value="${i.uuid}" data-kind="${i.kind}"${i.uuid === templateUuid ? " selected" : ""}>${escHtml(i.name)}</option>`).join("")}</optgroup>`).join("");
  return `<style>
      .tp-pc .form-group label { flex: 0 0 9.5em; }
      .tp-pc input[name="dc"], .tp-pc input[name="price"] { flex: 0 0 5em; }
      .tp-pc .tp-pc-preview { border: 1px solid var(--color-border-light-tertiary, #999); border-radius: 4px; padding: 4px 8px; margin: 6px 0; font-size: 0.9em; }
      .tp-pc .tp-pc-preview ul { margin: 2px 0 4px 1.2em; padding: 0; }
      .tp-pc .tp-pc-preview h4 { margin: 4px 0 0; border: none; font-size: 1em; }
      .tp-pc .tp-pc-extras label { flex: 1; }
    </style>
    <div class="tp-pc" data-kind="${f.kind}">
    <p class="hint">Start from an existing poison or disease to fill in the form, then change only what you need.</p>
    <div class="form-group"><label>Template</label><select name="template">${tmplOpts}</select></div>
    <hr>
    <div class="form-group"><label>Type</label>${sel("kind", [["poison", "Poison"], ["disease", "Disease"]], f.kind)}</div>
    <div class="form-group"><label>Name</label><input type="text" name="name" value="${escHtml(f.name)}" placeholder="e.g. Swamp Adder Venom"></div>
    <div class="form-group"><label>Delivery</label>${sel("delivery", DELIVERY.map((d) => [d, d]), f.delivery)}</div>
    <div class="form-group"><label>Saving throw</label>${sel("saveType", Object.entries(SAVES), f.saveType)}<label style="flex:0 0 2.5em;text-align:right">DC</label><input type="number" name="dc" value="${escHtml(f.dc)}" min="1" step="1"></div>
    <div class="form-group" data-for="poison"${f.kind === "poison" ? "" : ' style="display:none"'}><label>Initial damage</label><input type="text" name="initial" value="${escHtml(f.kind === "poison" ? f.initial : "")}" placeholder="e.g. 1d6 Con  or  2d12 hp  or  unconsciousness 1 minute"></div>
    <div class="form-group" data-for="disease"${f.kind === "disease" ? "" : ' style="display:none"'}><label>Incubation</label><input type="text" name="incubation" value="${escHtml(f.incubation)}" placeholder="e.g. 1d3 days"></div>
    <div class="form-group"><label><span data-for="poison"${f.kind === "poison" ? "" : ' style="display:none"'}>Secondary damage</span><span data-for="disease"${f.kind === "disease" ? "" : ' style="display:none"'}>Damage (each day)</span></label><input type="text" name="secondary" value="${escHtml(f.secondary)}" placeholder="e.g. 2d6 Con  or  1d4 Con + 1d3 Wis"></div>
    <div class="form-group" data-for="disease"${f.kind === "disease" ? "" : ' style="display:none"'}><label>Recovery</label>${sel("recover", [[2, "Two successful saves in a row"], [3, "Three successful saves in a row"]], f.recover)}</div>
    <div class="form-group"><label>Price (gp)</label><input type="number" name="price" value="${escHtml(f.price)}" min="0" step="1"></div>
    <div class="form-group"><label>Notes</label><input type="text" name="notes" value="${escHtml(f.notes)}" placeholder="Optional description"></div>
    <div class="hint" style="margin:-2px 0 6px 9.5em;font-size:0.85em;line-height:1.35">
      <strong>What you can type in the damage boxes:</strong><br>
      Ability damage: <code>1d6 Con</code> &nbsp;·&nbsp; Ability drain (permanent): <code>1 Con drain</code><br>
      Hit point damage: <code>2d12 hp</code> &nbsp;·&nbsp; No effect: <code>0</code><br>
      Condition, with optional duration: <code>unconsciousness 2d4 hours</code>, <code>paralysis 2d6 minutes</code><br>
      Several effects: join with <code>+</code>, e.g. <code>1d4 Con + 1d3 Wis</code><br>
      Anything else is posted to chat as a message. Check the preview below.
    </div>
    <div class="tp-pc-extras"></div>
    <div class="tp-pc-preview"></div>
    <div class="form-group"><label>Also add to Items</label><input type="checkbox" name="copyToWorld" checked><span class="hint" style="flex:2">Copies both items into the "${WORLD_FOLDER}" Items folder.</span></div>
    </div>`;
}

function readForm(form, extras) {
  const g = (n) => form.elements[n]?.value ?? "";
  const f = { kind: g("kind"), name: g("name"), delivery: g("delivery"), saveType: g("saveType"), dc: Number(g("dc")),
    initial: g("initial"), secondary: g("secondary"), incubation: g("incubation"), recover: Number(g("recover")) || 2,
    price: Number(g("price")) || 0, notes: g("notes") };
  // Poisons have no incubation or recovery; diseases have no initial damage.
  if (f.kind === "poison") { f.incubation = ""; f.recover = null; } else f.initial = "";
  f.extras = extras.map((e, i) => ({ ...e, keep: !!form.elements[`extra${i}`]?.checked }));
  return f;
}

function previewHtml(f) {
  const list = (items) => `<ul>${items.map((t) => `<li>${escHtml(t)}</li>`).join("")}</ul>`;
  const nm = titleCase(safeName(f.name)) || "(no name)";
  const errs = validateForm(f);
  let h = `<h4>Will create: ${f.kind === "disease" ? "Disease" : "Poison"}, ${escHtml(nm)} (attack) and ${escHtml(nm)} (consumable)</h4>`;
  if (f.kind === "poison") h += `<h4>Initial (on exposure, failed save)</h4>${list(partsPreview(parseEffectText(f.initial)))}`
    + `<h4>Secondary (${secondaryWhen()} later, second failed save)</h4>${list(partsPreview(parseEffectText(f.secondary)))}`
    + `<p>The poison then runs its course and ends. The Poisoned buff lasts ${POISON_SECONDARY_ROUNDS} rounds; conditions it caused last their own duration.</p>`;
  else h += `<h4>After ${escHtml(f.incubation || "?")}, each day (failed save)</h4>${list(partsPreview(parseEffectText(f.secondary)))}`
    + `<p>Recovery: ${RECOVER_TEXT(Number(f.recover))}.</p>`;
  if (errs.length) h += `<p style="color:var(--color-level-error,#c00)">${errs.map(escHtml).join("<br>")}</p>`;
  return h;
}

export async function openPoisonCreator(state = null) {
  if (!game.user.isGM) return ui.notifications.warn("Only the GM can create poisons and diseases.");
  const groups = await templateIndex();
  let f = state?.form ?? blankForm();
  let extras = f.extras ?? [];
  let templateUuid = state?.templateUuid ?? "";
  const { DialogV2 } = foundry.applications.api;

  const wire = (root) => {
    const box = root.querySelector(".tp-pc");
    const form = root.querySelector("form") ?? box.closest("form");
    if (!box || !form) return;
    const extrasEl = box.querySelector(".tp-pc-extras");
    const drawExtras = () => {
      extrasEl.innerHTML = extras.length ? `<p class="hint">The template also has these effects:</p>` + extras.map((e, i) =>
        `<div class="form-group"><label>${escHtml(e.name)}</label><input type="checkbox" name="extra${i}" ${e.keep === false ? "" : "checked"}><span class="hint" style="flex:2">Keep</span></div>`).join("") : "";
    };
    const refresh = () => {
      const kind = form.elements.kind.value;
      box.dataset.kind = kind;
      box.querySelectorAll("[data-for]").forEach((el) => { el.style.display = el.dataset.for.split(" ").includes(kind) ? "" : "none"; });
      box.querySelector(".tp-pc-preview").innerHTML = previewHtml(readForm(form, extras));
    };
    form.elements.template.addEventListener("change", async (ev) => {
      templateUuid = ev.target.value;
      if (!templateUuid) { extras = []; drawExtras(); return refresh(); }
      const t = await loadTemplate(templateUuid);
      if (!t) return;
      extras = t.extras;
      for (const k of ["kind", "name", "delivery", "saveType", "dc", "initial", "secondary", "incubation", "recover", "price", "notes"]) {
        if (form.elements[k]) form.elements[k].value = k === "initial" && t.kind === "disease" ? "" : t[k];
      }
      drawExtras(); refresh();
    });
    form.addEventListener("input", refresh);
    form.addEventListener("change", refresh);
    drawExtras(); refresh();
  };

  const result = await DialogV2.wait({
    window: { title: "Poison & Disease Creator", icon: "fas fa-flask" },
    classes: ["tp-poison-creator"],
    position: { width: 560 },
    content: formHtml(f, groups, templateUuid),
    rejectClose: false,
    render: (event, dialog) => wire((dialog ?? event?.target)?.element ?? document),
    buttons: [{
      action: "create", label: "Create", icon: "fas fa-flask", default: true,
      callback: (event, button) => ({ form: readForm(button.form, extras), copyToWorld: button.form.elements.copyToWorld.checked, templateUuid }),
    }, { action: "cancel", label: "Cancel" }],
  });
  if (!result || result === "cancel") return;
  const errs = validateForm(result.form);
  if (errs.length) {
    ui.notifications.warn(errs.join(" "));
    return openPoisonCreator({ form: result.form, templateUuid: result.templateUuid });
  }
  try {
    const made = await createPoison(result.form, { templateUuid: result.templateUuid || null, copyToWorld: result.copyToWorld });
    if (made) { ui.notifications.info(`Created ${made.attack.name} and ${made.consumable.name}.`); made.attack.sheet.render(true); }
  } catch (err) {
    console.error(`${MOD} | Poison & Disease Creator failed`, err);
    ui.notifications.error(`Could not create it: ${err.message}`);
  }
}

/* -------------------------------------------- */
/*  Hooks                                       */
/* -------------------------------------------- */

if (globalThis.Hooks) {
  Hooks.once("ready", () => {
    const mod = game.modules.get(MOD);
    if (mod) mod.api = { ...(mod.api ?? {}), openPoisonCreator, createPoison };
  });
  globalThis.AxecleftTools?.register({
    module: MOD, name: "poison-creator", title: "Poison & Disease Creator", img: "icons/svg/poison.svg",
    hint: "Create a new poison or disease (attack and consumable)", gmOnly: true, onClick: () => openPoisonCreator(),
  });
}
