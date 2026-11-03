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

import { enIndex, enName, t, costOf } from "./trap-pricing.js";
// The window is in the world's language; the items it makes stay English for now (their text and action names are read back)
const MOD = "traps-and-poisons";
const CUSTOM_PACK_NAME = "axecleft-custom-poisons";
const CUSTOM_PACK_LABEL = "Custom Poisons & Diseases";
const CUSTOM_PACK = `world.${CUSTOM_PACK_NAME}`;
const WORLD_FOLDER = "Custom Poisons & Diseases";

export const DELIVERY = [/*t*/"Contact", /*t*/"Ingested", /*t*/"Inhaled", /*t*/"Injury"];
const ABILITIES = { str: "Str", dex: "Dex", con: "Con", int: "Int", wis: "Wis", cha: "Cha" };
const SAVES = { fortitude: /*t*/"Fortitude", reflex: /*t*/"Reflex", will: /*t*/"Will" };
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
  { re: /^(unconsciousness|unconscious|inconscience|inconscient|inconsciente?|inconsciencia|inconsciencia)$/, label: "unconsciousness", word: "Unconscious", cond: ["unconscious", "helpless", "prone"] },
  { re: /^(paralysis|paralyzed|paralysie|paralyse|paralysee|paralisis|paralizado|paralizada|paralisia|paralisado|paralisada)$/, label: "paralysis", word: "Paralyzed", buff: ["Paralyzed", `${MOD}.common-trap-buffs`] },
  { re: /^(stun|stunned|etourdi|etourdie|etourdissement|aturdido|aturdida|atordoado|atordoada)$/, label: "stunned", word: "Stunned", buff: ["Stunned", `${MOD}.common-trap-buffs`] },
  { re: /^(shaken|secoue|secouee|estremecido|estremecida|abalado|abalada)$/, label: "shaken", word: "Shaken", buff: ["Shaken", `${MOD}.common-trap-buffs`] },
  { re: /^(frightened|fear|effraye|effrayee|peur|terreur|asustado|asustada|miedo|amedrontado|amedrontada|medo)$/, label: "frightened", word: "Frightened", buff: ["Frightened", `${MOD}.common-trap-buffs`] },
  { re: /^(petrified|petrification|petrifie|petrifiee|petrificado|petrificada|petrificacion|petrificacao)$/, label: "petrified", word: "Petrified", buff: ["Petrified", `${MOD}.common-trap-buffs`] },
  { re: /^(prone|renverse|renversee|aterre|derribado|derribada|caido|caida)$/, label: "prone", word: "Prone", buff: ["Prone", `${MOD}.common-trap-buffs`] },
  { re: /^(blind|blinded|blindness|aveugle|aveuglee|cecite|cegado|cegada|ceguera|cego|cega|cegueira)$/, label: "blindness", word: "Blinded", buff: ["Blinded", "D35E.commonbuffs"] },
  { re: /^(sickened|fievreux|fievreuse|mareado|mareada|enjoado|enjoada)$/, label: "sickened", word: "Sickened", cond: ["sickened"] },
  { re: /^(fatigued|fatigue|fatiguee|fatigado|fatigada)$/, label: "fatigued", word: "Fatigued", cond: ["fatigued"] },
  { re: /^(exhausted|exhaustion|epuise|epuisee|epuisement|exhausto|exhausta|agotado|agotada|exausto|exausta)$/, label: "exhausted", word: "Exhausted", cond: ["exhausted"] },
  { re: /^(deaf|deafened|deafness|sourd|sourde|surdite|ensordecido|ensordecida|sordera|surdo|surda|surdez)$/, label: "deafness", word: "Deafened", cond: ["deaf"] },
  { re: /^(dazzled|ebloui|eblouie|deslumbrado|deslumbrada|ofuscado|ofuscada)$/, label: "dazzled", word: "Dazzled", cond: ["dazzled"] },
  { re: /^(nauseated|nausea|nauseeux|nauseeuse|nausee|nauseado|nauseada)$/, label: "nauseated", word: "Nauseated", cond: ["nauseated"] },
];

const DICE = String.raw`\(?\d+(?:d\d+)?(?:\s*[+-]\s*\d+)?\)?`;
const cleanDice = (d) => String(d).replace(/[()\s]/g, "");
const isZero = (d) => /^(0|1d1-1)$/.test(cleanDice(d));
const plainDice = (d) => { const x = cleanDice(d); return x === "1d1" ? "1" : isZero(x) ? "0" : x; };
/**
 * 1.14.6.22: the damage boxes also take the usual French, Spanish and Portuguese words (accents optional):
 * abilities For/Dex/Con/Int/Sag/Cha (Fue, Des, Sab, Car), pv / pg (hp), diminution / dreno (drain), aucun / ninguno / nenhum (0),
 * conditions (inconscience, paralysie, étourdi…) and durations (tours, heures, jours; asaltos, horas, días; rodadas, dias).
 */
const fold = (s) => String(s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const ABILITY_WORDS = { str: ["str", "for", "fue"], dex: ["dex", "des"], con: ["con"], int: ["int"], wis: ["wis", "sag", "sab"], cha: ["cha", "car"] };
const ABILITY_RE = Object.values(ABILITY_WORDS).flat().join("|");
const abilityKey = (s) => { const x = fold(s).slice(0, 3); return Object.keys(ABILITY_WORDS).find((k) => ABILITY_WORDS[k].includes(x)) ?? Object.keys(ABILITIES).find((k) => k.slice(0, 2) === x.slice(0, 2)); };
const DRAIN_RE = String.raw`(?: ?\*| (?:permanent )?drain| (?:diminution|absorption)(?: permanente)?| (?:consuncion|absorcion|dreno|drenagem)(?: permanente)?)`;
const HP_RE = String.raw`(?:hp|hit points?|points? of damage|damage|pv|points? de vie|degats|pg|puntos de golpe|dano|pontos de vida|pv\.)`;
const UNITS = { round: 1, rounds: 1, tour: 1, tours: 1, asalto: 1, asaltos: 1, rodada: 1, rodadas: 1, minute: 10, minutes: 10, minuto: 10, minutos: 10,
  hour: 600, hours: 600, heure: 600, heures: 600, hora: 600, horas: 600, day: 14400, days: 14400, jour: 14400, jours: 14400, dia: 14400, dias: 14400 };

/** Convert a duration ("1 minute", "2d4 hours", "3 rounds") to a rounds formula, or null. */
export function durationRounds(text) {
  const m = fold(text).trim().match(new RegExp(`^(${DICE})\\s*([a-z]+)`, "i"));
  if (!m || !UNITS[m[2]]) return null;
  const n = cleanDice(m[1]);
  const mult = UNITS[m[2]];
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
    const lower = fold(p);
    let m;
    if (/^(0|none|-|—|no effect|aucun|aucun effet|sans effet|rien|ninguno|ningun efecto|sin efecto|nenhum|nenhum efeito|sem efeito)$/.test(lower)) continue;
    if ((m = lower.match(new RegExp(`^(${DICE}) (${ABILITY_RE})[a-z]*(${DRAIN_RE})?$`)))) {
      const amount = cleanDice(m[1]);
      if (isZero(amount)) continue;
      parts.push({ kind: m[3] ? "drain" : "ability", ability: abilityKey(m[2]), amount });
    } else if ((m = lower.match(new RegExp(`^(${DICE}) ${HP_RE}$`)))) {
      parts.push({ kind: "hp", amount: cleanDice(m[1]) });
    } else {
      const [word, ...rest] = lower.split(" ");
      const c = CONDITIONS.find((x) => x.re.test(word.replace(/[^a-z]/g, "")));
      if (c) parts.push({ kind: "condition", key: c.label, duration: p.split(" ").slice(1).join(" ").replace(/^(?:for|pendant|durante|por) /i, "").trim() || null });
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
  if (!parts.length) return [t("No effect")];
  return parts.map((p) => {
    if (p.kind === "ability") return t("Ability damage: {amount} {ability}", { amount: p.amount, ability: ABILITIES[p.ability] });
    if (p.kind === "drain") return t("Ability drain (permanent): {amount} {ability}", { amount: p.amount, ability: ABILITIES[p.ability] });
    if (p.kind === "hp") return t("Hit point damage: {amount}", { amount: p.amount });
    if (p.kind === "condition") {
      const c = CONDITIONS.find((x) => x.label === p.key);
      const how = c.buff ? t("\"{buff}\" buff", { buff: c.buff[0] }) : t(c.cond.length > 1 ? "conditions {list}" : "condition {list}", { list: c.cond.join(", ") });
      const r = c.buff && durationRounds(p.duration);
      return `${c.word}: ${how}${p.duration ? `, ${p.duration}${r ? t(" ({n} rounds)", { n: r }) : t(" (shown in chat)")}` : ""}`;
    }
    return t("Chat message: \"{text}\"", { text: p.text });
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
  if (!f.price && isDisease) f.price = costOf(item);
  return f;
}

/** Problems with the form, or [] if it can be created. */
export function validateForm(f) {
  const errs = [];
  if (!safeName(f.name)) errs.push(t("Give it a name."));
  if (!(Number(f.dc) > 0)) errs.push(t("The save DC must be a number above 0."));
  if (f.kind === "poison" && !parseEffectText(f.initial).length && !parseEffectText(f.secondary).length) errs.push(t("A poison needs an initial or secondary effect."));
  if (f.kind === "disease" && !parseEffectText(f.secondary).length) errs.push(t("A disease needs its damage."));
  if (f.kind === "disease" && !String(f.incubation ?? "").trim()) errs.push(t("A disease needs an incubation period."));
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
      + `${Number(f.recover) === 3 ? "Three" : "Two"} successful saving throws in a row indicate that he has fought off the disease and recovers.</p>`
      // 1.14.6.22: the SRD gives diseases no price; a price here is written as a Cost line that trap prices add (like a poison's)
      + (Number(f.price) > 0 ? `<p>Cost: ${Number(f.price).toLocaleString("en-US")} gp</p>` : "") + `</div>` };
    if (Number(f.price) > 0) s.price = Number(f.price);
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

const CC = () => foundry.documents?.collections?.CompendiumCollection ?? (typeof CompendiumCollection !== "undefined" ? CompendiumCollection : globalThis.CompendiumCollection);
const ItemCls = () => CONFIG.Item.documentClass;

async function customPack({ create = true } = {}) {
  let pack = game.packs.get(CUSTOM_PACK);
  if (!pack && create) {
    pack = await CC().createCompendium({ label: CUSTOM_PACK_LABEL, name: CUSTOM_PACK_NAME, type: "Item" });
    ui.notifications.info(t("Created the world compendium \"{name}\" for your poisons and diseases.", { name: CUSTOM_PACK_LABEL }));
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
  for (const [label, id, kind] of [[/*t*/"Your custom poisons & diseases", CUSTOM_PACK, null], [/*t*/"Module poisons", `${MOD}.poisons`, "poison"], [/*t*/"Module diseases", `${MOD}.diseases`, "disease"]]) {
    const pack = game.packs.get(id);
    if (!pack) continue;
    const idx = await enIndex(pack, { fields: ["type"] }); // English names (Babele: "Arsenic" is "Poison, Arsenic")
    const list = idx.filter((e) => e.type === "attack" && /^(poison|disease),/i.test(e.name))
      .map((e) => ({ uuid: `Compendium.${id}.Item.${e._id}`, name: e.display ?? e.name, kind: kind ?? (/^disease/i.test(e.name) ? "disease" : "poison") }));
    const seen = new Set();
    groups.push({ label: t(label), items: list.filter((e) => !seen.has(e.name) && seen.add(e.name)).sort((a, b) => a.name.localeCompare(b.name)) });
  }
  return groups.filter((g) => g.items.length);
}

export async function loadTemplate(uuid) {
  const doc = await fromUuid(uuid);
  if (!doc) return null;
  const folderName = doc.folder?.name ?? null;
  // Price comes from the matching consumable (module pack or custom pack).
  const en = enName(doc);
  const bare = en.replace(/^(poison|disease),\s*/i, "");
  let consumable = null;
  // Match by the attack the consumable adds (names differ, e.g. "Wyvern Poison" adds "Poison, Wyvern").
  for (const id of [CUSTOM_PACK, `${MOD}.poison-consumables`]) {
    const pack = game.packs.get(id);
    if (!pack) continue;
    const idx = await enIndex(pack);
    const e = idx.find((x) => x.name === bare) ?? idx.find((x) => x.name === `${bare} Poison`);
    const docs = e ? [await pack.getDocument(e._id)] : (await pack.getDocuments()).filter((d) => d.type === "consumable");
    const hit = docs.find((d) => (d.system?.specialActions ?? []).some((a) => a.action?.includes(`"${doc.name}"`) || a.action?.includes(`"${en}"`)));
    if (hit) { consumable = hit.toObject(); break; }
  }
  return itemToForm(doc.toObject(), { folderName, consumable });
}

async function baseItem(packId, name) {
  const pack = game.packs.get(packId);
  const e = pack && (await enIndex(pack)).find((x) => x.name === name);
  if (!e) throw new Error(t("\"{name}\" was not found in {pack}", { name, pack: packId }));
  return (await pack.getDocument(e._id)).toObject();
}

/** Create (or update) the attack and consumable. Returns the two documents. */
export async function createPoison(f, { templateUuid = null, copyToWorld = true } = {}) {
  const pack = await customPack();
  if (pack.locked) throw new Error(t("The \"{name}\" compendium is locked. Unlock it and try again.", { name: CUSTOM_PACK_LABEL }));
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
    const ok = await (globalThis.AxecleftTools?.DialogV2 ?? foundry.applications.api.DialogV2).confirm({
      window: { title: t("Replace existing?") },
      content: `<p>${escHtml(t(clash.length === 1 ? "{items} already exists in {pack}. Replace it?" : "{items} already exist in {pack}. Replace them?", { items: "\u0001", pack: CUSTOM_PACK_LABEL })).replace("\u0001", clash.map((d) => `<strong>${escHtml(d.name)}</strong>`).join(escHtml(t(" and "))))}</p>`,
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
    content: `<h3>${escHtml(t(isDisease ? "Disease created" : "Poison created"))}</h3><p>@UUID[${a.uuid}]{${escHtml(a.name)}}<br>@UUID[${c.uuid}]{${escHtml(c.name)}} ${escHtml(t("(consumable)"))}</p>`
      + `<p><small>${escHtml(copyToWorld ? t("Saved in the {pack} compendium and the \"{folder}\" Items folder.", { pack: CUSTOM_PACK_LABEL, folder: WORLD_FOLDER }) : t("Saved in the {pack} compendium.", { pack: CUSTOM_PACK_LABEL }))}</small></p>`,
    whisper: ChatMessage.getWhisperRecipients("GM").map((u) => u.id),
    speaker: { alias: t("Poison & Disease Creator") },
  });
  return { attack: a, consumable: c };
}

/* -------------------------------------------- */
/*  Dialog                                      */
/* -------------------------------------------- */

function formHtml(f, groups, templateUuid) {
  const sel = (name, opts, value) => `<select name="${name}">${opts.map(([v, l]) => `<option value="${escHtml(v)}"${String(v) === String(value) ? " selected" : ""}>${escHtml(l)}</option>`).join("")}</select>`;
  const H = (s, d) => escHtml(t(s, d));
  const tmplOpts = `<option value="">${H("— None (start blank) —")}</option>` + groups.map((g) =>
    `<optgroup label="${escHtml(g.label)}">${g.items.map((i) => `<option value="${i.uuid}" data-kind="${i.kind}"${i.uuid === templateUuid ? " selected" : ""}>${escHtml(i.name)}</option>`).join("")}</optgroup>`).join("");
  return `<style>
      .tp-pc .form-group label { flex: 0 0 9.5em; }
      .tp-pc input[type=number] { text-align: right; }
      .tp-pc input[name="dc"], .tp-pc input[name="price"] { flex: 0 0 5em; }
      .tp-pc .tp-pc-preview { border: 1px solid var(--color-border-light-tertiary, #999); border-radius: 4px; padding: 4px 8px; margin: 6px 0; font-size: 0.9em; }
      .tp-pc .tp-pc-preview ul { margin: 2px 0 4px 1.2em; padding: 0; }
      .tp-pc .tp-pc-preview h4 { margin: 4px 0 0; border: none; font-size: 1em; }
      .tp-pc .tp-pc-extras label { flex: 1; }
    </style>
    <div class="tp-pc" data-kind="${f.kind}">
    <p class="hint">${H("Start from an existing poison or disease to fill in the form, then change only what you need.")}</p>
    <div class="form-group"><label>${H("Template")}</label><select name="template">${tmplOpts}</select></div>
    <hr>
    <div class="form-group"><label>${H("Type")}</label>${sel("kind", [["poison", t("Poison")], ["disease", t("Disease")]], f.kind)}</div>
    <div class="form-group"><label>${H("Name")}</label><input type="text" name="name" value="${escHtml(f.name)}" placeholder="${H("e.g. Swamp Adder Venom")}"></div>
    <div class="form-group"><label>${H("Delivery")}</label>${sel("delivery", DELIVERY.map((d) => [d, t(d)]), f.delivery)}</div>
    <div class="form-group"><label>${H("Saving throw")}</label>${sel("saveType", Object.entries(SAVES).map(([k, l]) => [k, t(l)]), f.saveType)}<label style="flex:0 0 2.5em;text-align:right">${H("DC")}</label><input type="number" name="dc" value="${escHtml(f.dc)}" min="1" step="1"></div>
    <div class="form-group" data-for="poison"${f.kind === "poison" ? "" : ' style="display:none"'}><label>${H("Initial damage")}</label><input type="text" name="initial" value="${escHtml(f.kind === "poison" ? f.initial : "")}" placeholder="${H("e.g. 1d6 Con  or  2d12 hp  or  unconsciousness 1 minute")}"></div>
    <div class="form-group" data-for="disease"${f.kind === "disease" ? "" : ' style="display:none"'}><label>${H("Incubation")}</label><input type="text" name="incubation" value="${escHtml(f.incubation)}" placeholder="${H("e.g. 1d3 days")}"></div>
    <div class="form-group"><label><span data-for="poison"${f.kind === "poison" ? "" : ' style="display:none"'}>${H("Secondary damage")}</span><span data-for="disease"${f.kind === "disease" ? "" : ' style="display:none"'}>${H("Damage (each day)")}</span></label><input type="text" name="secondary" value="${escHtml(f.secondary)}" placeholder="${H("e.g. 2d6 Con  or  1d4 Con + 1d3 Wis")}"></div>
    <div class="form-group" data-for="disease"${f.kind === "disease" ? "" : ' style="display:none"'}><label>${H("Recovery")}</label>${sel("recover", [[2, t("Two successful saves in a row")], [3, t("Three successful saves in a row")]], f.recover)}</div>
    <div class="form-group"><label>${H("Price (gp)")}</label><input type="number" name="price" value="${escHtml(f.price)}" min="0" step="1"></div>
    <div class="form-group"><label>${H("Notes")}</label><input type="text" name="notes" value="${escHtml(f.notes)}" placeholder="${H("Optional description")}"></div>
    <div class="hint" style="margin:-2px 0 6px 9.5em;font-size:0.85em;line-height:1.35">
      <strong>${H("What you can type in the damage boxes:")}</strong><br>
      ${H("Ability damage:")} <code>${H("1d6 Con")}</code> &nbsp;·&nbsp; ${H("Ability drain (permanent):")} <code>${H("1 Con drain")}</code><br>
      ${H("Hit point damage:")} <code>${H("2d12 hp")}</code> &nbsp;·&nbsp; ${H("No effect:")} <code>0</code><br>
      ${H("Condition, with optional duration:")} <code>${H("unconsciousness 2d4 hours")}</code>, <code>${H("paralysis 2d6 minutes")}</code><br>
      ${H("Several effects: join with {plus}, e.g. {example}", { plus: "\u0001", example: "\u0002" }).replace("\u0001", "<code>+</code>").replace("\u0002", `<code>${H("1d4 Con + 1d3 Wis")}</code>`)}<br>
      ${/^en\b/i.test(game.i18n?.lang ?? "en") ? "" : `${H("The English words work too (1d6 Con, 2d12 hp, unconsciousness 2d4 hours), as do French, Spanish and Portuguese ones.")}<br>`}
      ${H("Anything else is posted to chat as a message. Check the preview below.")}
    </div>
    <div class="tp-pc-extras"></div>
    <div class="tp-pc-preview"></div>
    <div class="form-group"><label>${H("Also add to Items")}</label><input type="checkbox" name="copyToWorld" checked><span class="hint" style="flex:2">${H("Copies both items into the \"{folder}\" Items folder.", { folder: WORLD_FOLDER })}</span></div>
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
  const H = (s, d) => escHtml(t(s, d));
  const nm = titleCase(safeName(f.name)) || t("(no name)");
  const errs = validateForm(f);
  let h = `<h4>${H("Will create: {attack} (attack) and {name} (consumable)", { attack: `${f.kind === "disease" ? "Disease" : "Poison"}, ${nm}`, name: nm })}</h4>`;
  if (f.kind === "poison") h += `<h4>${H("Initial (on exposure, failed save)")}</h4>${list(partsPreview(parseEffectText(f.initial)))}`
    + `<h4>${H("Secondary ({when} later, second failed save)", { when: t("{min} minute ({n} rounds)", { min: POISON_SECONDARY_ROUNDS / 10, n: POISON_SECONDARY_ROUNDS }) })}</h4>${list(partsPreview(parseEffectText(f.secondary)))}`
    + `<p>${H("The poison then runs its course and ends. The Poisoned buff lasts {n} rounds; conditions it caused last their own duration.", { n: POISON_SECONDARY_ROUNDS })}</p>`;
  else h += `<h4>${H("After {time}, each day (failed save)", { time: f.incubation || "?" })}</h4>${list(partsPreview(parseEffectText(f.secondary)))}`
    + `<p>${H(Number(f.recover) === 3 ? "Recovery: three successful saves in a row." : "Recovery: two successful saves in a row.")}</p>`;
  if (errs.length) h += `<p style="color:var(--color-level-error,#c00)">${errs.map(escHtml).join("<br>")}</p>`;
  return h;
}

export async function openPoisonCreator(state = null) {
  if (!game.user.isGM) return ui.notifications.warn(t("Only the GM can create poisons and diseases."));
  const groups = await templateIndex();
  let f = state?.form ?? blankForm();
  let extras = f.extras ?? [];
  let templateUuid = state?.templateUuid ?? "";
  const DialogV2 = (globalThis.AxecleftTools?.DialogV2 ?? foundry.applications.api.DialogV2);

  const wire = (root) => {
    const box = root.querySelector(".tp-pc");
    const form = root.querySelector("form") ?? box.closest("form");
    if (!box || !form) return;
    const extrasEl = box.querySelector(".tp-pc-extras");
    const drawExtras = () => {
      extrasEl.innerHTML = extras.length ? `<p class="hint">${escHtml(t("The template also has these effects:"))}</p>` + extras.map((e, i) =>
        `<div class="form-group"><label>${escHtml(e.name)}</label><input type="checkbox" name="extra${i}" ${e.keep === false ? "" : "checked"}><span class="hint" style="flex:2">${escHtml(t("Keep"))}</span></div>`).join("") : "";
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
    window: { title: t("Poison & Disease Creator"), icon: "fas fa-flask" },
    classes: ["tp-poison-creator"],
    position: { width: 560 },
    content: formHtml(f, groups, templateUuid),
    rejectClose: false,
    render: (event, dialog) => wire((dialog ?? event?.target)?.element ?? document),
    buttons: [{
      action: "create", label: t("Create"), icon: "fas fa-flask", default: true,
      callback: (event, button) => ({ form: readForm(button.form, extras), copyToWorld: button.form.elements.copyToWorld.checked, templateUuid }),
    }, { action: "cancel", label: t("Cancel") }],
  });
  if (!result || result === "cancel") return;
  const errs = validateForm(result.form);
  if (errs.length) {
    ui.notifications.warn(errs.join(" "));
    return openPoisonCreator({ form: result.form, templateUuid: result.templateUuid });
  }
  try {
    const made = await createPoison(result.form, { templateUuid: result.templateUuid || null, copyToWorld: result.copyToWorld });
    if (made) { ui.notifications.info(t("Created {attack} and {consumable}.", { attack: made.attack.name, consumable: made.consumable.name })); made.attack.sheet.render(true); }
  } catch (err) {
    console.error(`${MOD} | Poison & Disease Creator failed`, err);
    ui.notifications.error(t("Could not create it: {error}", { error: err.message }));
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
    module: MOD, name: "poison-creator", title: /*t*/"Poison & Disease Creator", img: "icons/svg/poison.svg",
    hint: /*t*/"Create a new poison or disease (attack and consumable)", gmOnly: true, onClick: () => openPoisonCreator(),
  });  // A tour of the window (Axecleft's Tools 9.7): Tour Management, or the window's ⋮ menu
  globalThis.AxecleftTools?.registerTour?.({ module: MOD, id: "poison-creator", cls: "tp-poison-creator",
    open: async () => { if (!document.querySelector(".tp-poison-creator")) openPoisonCreator(); for (let i = 0; i < 60 && !document.querySelector(".tp-poison-creator"); i++) await new Promise((r) => setTimeout(r, 50)); },
    title: /*t*/"Poison & Disease Creator", description: /*t*/"Create a poison or disease: its attack and its consumable item.",
    steps: [
      { id: "template", field: "template", title: /*t*/"Template", content: /*t*/"Start from an existing poison or disease to fill in the form, then change only what you need. Or start blank." },
      { id: "kind", field: "kind", title: /*t*/"Type", content: /*t*/"Poison or disease. The boxes below change with it." },
      { id: "name", field: "name", title: /*t*/"Name", content: /*t*/"Its name." },
      { id: "delivery", field: "delivery", title: /*t*/"Delivery", content: /*t*/"How it is delivered: contact, ingested, inhaled or injury." },
      { id: "save", field: "saveType", title: /*t*/"Saving throw", content: /*t*/"The save that resists it, and its DC." },
      { id: "initial", field: "initial", title: /*t*/"Initial damage", content: /*t*/"For a poison: the damage on exposure, on a failed save. For a disease, Incubation (how long before it strikes) takes its place." },
      { id: "secondary", field: "secondary", title: /*t*/"Secondary damage", content: /*t*/"For a poison: the damage a minute later, on a second failed save. For a disease: the damage each day, with the saves in a row needed to recover." },
      { id: "help", sel: ".tp-pc > div.hint", title: /*t*/"What you can type", content: /*t*/"The damage boxes understand ability damage (1d6 Con), drain (1 Con drain), hit points (2d12 hp), conditions with a duration (paralysis 2d6 minutes) and several effects joined with +. Anything else is posted to chat." },
      { id: "price", field: "price", title: /*t*/"Price and notes", content: /*t*/"Its price in gp, and an optional description." },
      { id: "preview", sel: ".tp-pc-preview", title: /*t*/"Preview", content: /*t*/"What will be created, an attack and a consumable, and how each damage box was read. Problems are shown in red." },
      { id: "copy", field: "copyToWorld", title: /*t*/"Also add to Items", content: /*t*/"Ticked, both items are also copied into a folder of the Items sidebar." },
      { id: "buttons", sel: "footer.form-footer, .dialog-buttons", title: /*t*/"Create", direction: "UP", content: /*t*/"Creates the poison or disease in the module's compendium (and the Items folder if ticked)." },
    ] });
}
