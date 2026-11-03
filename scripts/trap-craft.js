/**
 * Axecleft's Traps, Poisons, and Diseases — crafting trap kits (shared Crafting window, "Trap kits" tab).
 *
 * SRD, Designing a Trap / Craft (trapmaking): mechanical traps only. Raw materials cost ⅓ of the trap's price; poisons
 * and alchemical items in it are bought at full price (×20 with an automatic reset). Each week's progress is a
 * Craft (trapmaking) check: check × DC in silver pieces (or the coin chosen in the Trap kits: crafting progress setting). DC: CR 1–3 20, 4–6 25, 7–10 30 (Axecleft: +5 per 3 CR past 10),
 * +5 for a proximity trigger, +5 for an automatic reset. The result is a Trap Kit in the crafter's inventory.
 *
 * Traps on offer: mechanical trap actors in the chosen Actor compendiums (all by default) and world trap actors the
 * user can see (the GM sees the Random Trap Generator's traps; show one to a player to let them craft it).
 */
import { facts, makeKit, KIT_SETTINGS } from "./trap-kits.js";
import { enIndex, srdTrap, isMagicTrap, marketPrice, normName, t, gp, fmt } from "./trap-pricing.js";
import { trapData } from "./trap-generator.js";

const MOD = "traps-and-poisons";
const esc = (v) => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const opt = (v, label, sel) => `<option value="${esc(v)}"${String(v) === String(sel ?? "") ? " selected" : ""}>${esc(label)}</option>`;
const H = (s, d) => esc(t(s, d));
const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const setting = (k) => { try { return game.settings.get(MOD, k); } catch (e) { return KIT_SETTINGS[k]?.default ?? CRAFT_SETTINGS[k]?.default; } };

/**
 * The coin a week's Craft (trapmaking) progress is counted in (1.14.6.12). SRD: silver (check × DC in sp each week),
 * which makes costly traps take years; gold makes it 10 times faster, platinum 100 times, copper 10 times slower.
 */
export const CRAFT_SETTINGS = {
  kitProgress: { name: /*t*/"Trap kits: crafting progress", hint: /*t*/"Each week of work on a trap kit makes progress worth the Craft (trapmaking) check × the DC in this coin. SRD: silver pieces. Gold pieces make it 10 times faster, platinum pieces 100 times; copper pieces make it 10 times slower.", type: String, default: "sp",
    choices: { cp: /*t*/"Copper pieces (10 times slower)", sp: /*t*/"Silver pieces (SRD)", gp: /*t*/"Gold pieces (10 times faster)", pp: /*t*/"Platinum pieces (100 times faster)" } },
};

/** The tab's note when this world counts trap progress in another coin than the SRD's silver. */
const COINS = { cp: /*t*/"copper pieces", gp: /*t*/"gold pieces", pp: /*t*/"platinum pieces" };
function coinNote() {
  const c = setting("kitProgress");
  return COINS[c] ? ` ${H("This world counts the progress in {coins} (Trap kits: crafting progress).", { coins: t(COINS[c]) })}` : "";
}


/**
 * 1.14.6.22: what the trap tabs read from a trap actor, for anyone making their own (the Crafting window's help, as for items).
 * The words can be English or the usual French ones (Prix du marché … po, PX, déclencheur de sort).
 */
function trapHelp(magic) {
  const ex = magic ? "Spell effect (burning hands, 1st-level wizard, 1d4 fire, DC 11 Reflex save half damage)<br>Proximity Trigger (alarm)<br>Market Price - 500 gp, 40 XP"
    : "Location Trigger; Manual Reset<br>Atk +10 melee (1d4+1/×3 plus poison (Large monstrous spider venom))<br>Market Price - 1,300 gp";
  return `<details class="acr-help"><summary><i class="fas fa-circle-question"></i> ${H("How a trap actor is read (making your own traps craftable)")}</summary>
    <p>${H("The tab reads the trap actor's Notes (Details tab), the same lines the SRD sample traps have, or the stat line the Random Trap Generator gives the traps it makes. For example:")}</p>
    <blockquote>${ex}</blockquote>
    <ul>
      <li>${t("<strong>Market Price - 1,300 gp</strong> is the trap's price (magic traps: <strong>500 gp, 40 XP</strong>; spell traps: <strong>85 gp to hire NPC spellcaster</strong>). Without one, a mechanical trap is priced by the SRD cost table from its other lines.")}</li>
      <li>${t("<strong>Search DC</strong> and <strong>Disable Device DC</strong> come from the actor's own boxes, else from the lines.")}</li>
      <li>${t("<strong>Trigger</strong> (location, proximity, touch, timed…), <strong>Reset</strong> (no, repair, manual, automatic) and <strong>Bypass</strong> (lock, hidden switch, hidden lock) change the price and the Craft (trapmaking) DC.")}</li>
      <li>${t("<strong>Atk +10</strong>, <strong>DC 20 Reflex</strong> and <strong>never miss</strong> change the price by the SRD table.")}</li>
      <li>${t("<strong>poison (name)</strong> and <strong>disease (name)</strong> add the poison's price (its consumable) or the disease's (a <strong>Cost: 1,000 gp</strong> line in its description), ×20 with an automatic reset.")}</li>
      <li>${t("Magic traps: <strong>spell effect (spell, 5th-level wizard, …)</strong> gives each spell and its caster level; a trigger in brackets (<strong>alarm</strong>, <strong>detect good</strong>, <strong>true seeing</strong>) is a spell too; <strong>Spell Trigger</strong> marks a spell trap.")}</li>
      <li>${t("These words are read in English, or in the usual French ones (Prix du marché : 1 300 po; 500 po, 40 PX; Déclencheur de sort).")}</li>
    </ul></details>`;
}

class TrapCraft {
  constructor() { this.list = null; }

  /** Trap actors on offer: [{ key, name, cr, source, pack?, id }]. */
  async prepare() {
    const wanted = String(setting("kitPacks") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
    const out = [];
    for (const pack of game.packs) {
      if (pack.documentName !== "Actor") continue;
      if (wanted.length && !wanted.includes(pack.collection)) continue;
      if (!game.user.isGM && pack.visible === false) continue;
      let index;
      try { index = await enIndex(pack, { fields: ["type", "system.details.cr", "system.details.notes.value"] }); } catch (e) { continue; }
      const data = await trapData();
      for (const e of index) {
        if (e.type !== "trap") continue;
        // Magic traps: by the SRD stat line (English name, so Babele-translated traps too), else the notes in any language
        if (isMagicTrap({ ...e, flags: { babele: { originalName: e.name } } }, srdTrap({ name: e.name }, data)?.text ?? null)) continue;
        out.push({ key: `${pack.collection}|${e._id}`, name: e.display ?? e.name, cr: Number(e.system?.details?.cr) || 0, source: pack.metadata.label, pack: pack.collection, id: e._id });
      }
    }
    for (const a of game.actors ?? []) {
      if (a.type !== "trap" || !a.testUserPermission?.(game.user, "OBSERVER")) continue;
      if (a.folder?.name === "Placed Traps") continue;
      out.push({ key: `world|${a.id}`, name: a.name, cr: Number(a.system?.details?.cr) || 0, source: t("This world"), id: a.id });
    }
    out.sort((a, b) => a.cr - b.cr || a.name.localeCompare(b.name));
    this.list = out;
  }

  content({ values: v }) {
    const list = this.list ?? [];
    const groups = [...new Set(list.map((x) => x.source))];
    const sel = v.trap ?? list[0]?.key ?? "";
    return `<p class="hint">${H("Craft (trapmaking), by the SRD: mechanical traps only. Raw materials cost ⅓ of the trap's price; poisons in it are bought at full price (×20 with an automatic reset). Each week's progress is a check (check × DC in silver pieces). The result is a {kit}: use it to set the trap on a scene.", { kit: "{kit}" }).replace("{kit}", `<strong>${H("Trap Kit")}</strong>`)}${coinNote()}</p>
      <div class="form-group"><label>${H("Trap")}</label><select name="craft.trap">${list.length ? groups.map((g) => `<optgroup label="${esc(g)}">${list.filter((x) => x.source === g).map((x) => opt(x.key, t("CR {cr}: {name}", { cr: x.cr, name: x.name }), sel)).join("")}</optgroup>`).join("") : opt("", t("No mechanical trap actors found"), "")}</select></div>
      <p class="hint">${H("Traps from the Random Trap Generator are in the GM's world; the GM can show one to a player (Observer permission) to let them craft it.")}</p>
      ${trapHelp(false)}`;
  }

  async doc(key) {
    const [src, id] = String(key ?? "").split("|");
    if (src === "world") return game.actors.get(id) ?? null;
    return (await game.packs.get(src)?.getDocument(id)) ?? null;
  }

  async evaluate({ actor: crafter, values: v }) {
    if (!this.list) await this.prepare();
    const key = v.trap ?? this.list[0]?.key;
    if (!key) throw new Error(t("Choose a trap."));
    const actor = await this.doc(key);
    if (!actor) throw new Error(t("That trap actor no longer exists."));
    const f = await facts(actor);
    if (!f.mechanical) throw new Error(t("{name} is a magic trap; only mechanical traps can be crafted (magic traps come from spellcasting).", { name: actor.name }));
    if (!(f.price > 0)) throw new Error(t("{name} has no price. Add \"Market Price - 1,000 gp\" (its SRD price) to its notes.", { name: actor.name }));
    const data = await makeKit(actor, { price: f.price });
    const mech = round2(f.mechanicalPrice);
    // 1.14.6.22: "Trap kits: need Craft (trapmaking)" (on by default)
    const requirements = [];
    if (setting("kitTraining") && crafter) {
      const trained = !!globalThis.AxecleftCrafting?.actor?.craft?.(crafter, "trapmaking")?.trained;
      requirements.push({ key: "trapmaking", label: t("At least 1 rank in Craft (trapmaking)"), ok: trained, detail: trained ? t("yes") : t("no (Trap kits: need Craft (trapmaking))"), waivable: false });
    }
    const notes = [
      t(f.extras ? "Price {price} ({source}; {extras} of it is poison or alchemical items, bought at full price)." : "Price {price} ({source}).", { price: gp(f.price), source: f.priceSource, extras: gp(f.extras) }),
      t("Craft (trapmaking) DC {dc}: {why}.", { dc: f.craftDc, why: f.craftDcNote }),
      t((f.cr || 1) > 1 ? "The kit is set with 1 minute of work per CR ({n} minutes)." : "The kit is set with 1 minute of work per CR ({n} minute).", { n: f.cr || 1 }),
    ];
    if (f.formula?.parts?.length && !f.market) notes.push(t("Cost table: base {base} ({parts}) × CR {cr}{extras}.", { base: gp(f.formula.base), parts: f.formula.parts.map(([l, g]) => `${l} ${g > 0 ? "+" : ""}${fmt(g)}`).join(", "), cr: f.cr, extras: f.formula.extraParts.length ? ` + ${f.formula.extraParts.map(([l, g]) => `${l} ${gp(g)}`).join(", ")}` : "" }));
    for (const a of f.assumptions) notes.push(t("Note: {note}.", { note: a }));
    return {
      magic: false, name: data.name, img: data.img, data, quantity: 1, market: f.price,
      raw: round2(mech / 3), componentGp: round2(f.extras),
      checks: [{ key: "trap", label: actor.name, craft: "trapmaking", dc: f.craftDc, price: mech, raw: round2(mech / 3), progress: setting("kitProgress") || "sp" }],
      summary: t("{name} (CR {cr}), {price}; Craft (trapmaking) DC {dc}", { name: actor.name, cr: f.cr, price: gp(f.price), dc: f.craftDc }), requirements, notes,
    };
  }
}


/* -------------------------------------------- */
/*  Magic traps (1.14.6.22)                     */
/* -------------------------------------------- */

/**
 * SRD, Magic Trap Costs and Construction:
 *  - Spell trap (fire trap, glyph of warding…): the spell is the trap. Its caster (the crafter, or a hired NPC) casts it;
 *    it costs nothing but the spell's components, or the SRD price to hire the NPC.
 *  - Magic device trap: needs Craft Wondrous Item and every spell in it (the crafter's own, a helper's, or from a scroll,
 *    wand or staff). Cost per spell: 50 gp × CL × spell level + 4 XP × CL × spell level for a one-shot trap; 500 gp and
 *    40 XP × CL × spell level with an automatic reset (the SRD sample traps carry the total: "Market Price - 500 gp, 40 XP").
 *    Time: 1 day per 500 gp of its cost. No skill check.
 *  - A proximity, touch, sound or visual trigger is a spell too (alarm, detect good, clairaudience, true seeing…).
 * The result is a Magic Trap item. "Magic traps: can be carried" off (default): only its builder can set it, on the scene
 * where it was built. On: any spellcaster can carry it and set it elsewhere. Magic traps are never recovered into a kit.
 */
const METAMAGIC = /^(extended|maximized|empowered|quickened|heightened|widened|enlarged|silent|still)\s+/i;
const plain = (html) => String(html ?? "").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
const ordinal = (s) => Number(String(s).match(/\d+/)?.[0]) || 0;

/** The spells, caster levels, kind and cost of a magic trap actor, from its stat line and notes. */
export function magicTrapFacts(actorData, text) {
  const notes = plain(actorData?.system?.details?.notes?.value);
  const src = `${text ?? ""} ; ${notes}`;
  const kindWord = String(text ?? "").match(/;\s*(magic device|spell)\s*;/i)?.[1]?.toLowerCase();
  const spellTrap = kindWord ? kindWord === "spell" : /spell trigger|d[ée]clencheur de sort|activador de conjuro|gatilho de magia/i.test(notes);
  const spells = [];
  for (const m of src.matchAll(/spell effect \(([^,()]+?)(?:\s*\[[^\]]*\])?,\s*(\d+)(?:st|nd|rd|th)?[- ]level ([a-z]+)/gi)) {
    const name = m[1].trim().replace(METAMAGIC, "");
    if (!spells.some((x) => normName(x.name) === normName(name))) spells.push({ name, cl: ordinal(m[2]), cls: m[3] });
  }
  // The trigger's spell: "proximity trigger (alarm)", "visual trigger (true seeing)", "touch trigger (detect good)"
  const trig = src.match(/\b(?:proximity|touch|sound|visual|location)\s+trigger\s*\(([^)]+)\)/i)?.[1]?.trim();
  const triggerSpell = trig && !/attached/i.test(trig) ? trig : null;
  const cl = Math.max(0, ...spells.map((x) => x.cl));
  // Cost: "Market Price - 2,500 gp, 200 XP" or "305 gp to hire NPC spellcaster" (and translations)
  const i = notes.search(/Market Price|Prix du march[ée]|Prix de vente|Precio de mercado|Pre[çc]o de mercado/i);
  const seg = i >= 0 ? notes.slice(i, i + 200) : "";
  const xp = Number((seg.match(/(\d(?:[\d.,]|\s(?=\d))*)\s*(?:XP|PX|PE)\b/i)?.[1] ?? "").replace(/\s/g, "").replace(/[.,](?=\d{3}(?:\D|$))/g, "")) || 0;
  const hire = /hire|engager|embaucher|contratar/i.test(seg);
  return { spellTrap, spells, triggerSpell, cl, gp: marketPrice(actorData), xp, hire };
}

class MagicTrapCraft {
  constructor() { this.list = null; }

  async prepare() {
    const out = [];
    const data = await trapData();
    for (const pack of game.packs) {
      if (pack.documentName !== "Actor") continue;
      if (!game.user.isGM && pack.visible === false) continue;
      let index;
      try { index = await enIndex(pack, { fields: ["type", "system.details.cr", "system.details.notes.value"] }); } catch (e) { continue; }
      for (const e of index) {
        if (e.type !== "trap") continue;
        if (!isMagicTrap({ ...e, flags: { babele: { originalName: e.name } } }, srdTrap({ name: e.name }, data)?.text ?? null)) continue;
        out.push({ key: `${pack.collection}|${e._id}`, name: e.display ?? e.name, cr: Number(e.system?.details?.cr) || 0, source: pack.metadata.label, pack: pack.collection, id: e._id });
      }
    }
    for (const a of game.actors ?? []) {
      if (a.type !== "trap" || !a.testUserPermission?.(game.user, "OBSERVER") || a.folder?.name === "Placed Traps") continue;
      let magic = false;
      try { magic = !(await facts(a)).mechanical; } catch (e) { magic = false; }
      if (magic) out.push({ key: `world|${a.id}`, name: a.name, cr: Number(a.system?.details?.cr) || 0, source: t("This world"), id: a.id });
    }
    out.sort((a, b) => a.cr - b.cr || a.name.localeCompare(b.name));
    this.list = out;
  }

  content({ values: v }) {
    const list = this.list ?? [];
    const groups = [...new Set(list.map((x) => x.source))];
    const sel = v.trap ?? list[0]?.key ?? "";
    const carried = setting("magicKits");
    return `<p class="hint">${H("Magic traps, by the SRD: a spell trap (fire trap, glyph of warding) is cast by its creator; a magic device trap needs Craft Wondrous Item and every spell in it, including its trigger's (alarm, detect good, true seeing). A device costs 500 gp and 40 XP × caster level × spell level per spell with an automatic reset (50 gp and 4 XP for a one-shot trap) and takes 1 day per 500 gp. No skill check.")}</p>
      <p class="hint">${H(carried ? "This world lets magic traps be carried: the result is a magic trap kit any spellcaster can set." : "The trap is built where it will be: the result can only be set by its builder, on the scene that is open now ({scene}).", { scene: canvas?.scene?.name ?? "?" })}</p>
      <div class="form-group"><label>${H("Trap")}</label><select name="craft.trap">${list.length ? groups.map((g) => `<optgroup label="${esc(g)}">${list.filter((x) => x.source === g).map((x) => opt(x.key, t("CR {cr}: {name}", { cr: x.cr, name: x.name }), sel)).join("")}</optgroup>`).join("") : opt("", t("No magic trap actors found"), "")}</select></div>
      ${trapHelp(true)}`;
  }

  async doc(key) {
    const [src, id] = String(key ?? "").split("|");
    if (src === "world") return game.actors.get(id) ?? null;
    return (await game.packs.get(src)?.getDocument(id)) ?? null;
  }

  async evaluate({ actor: crafter, values: v }) {
    if (!this.list) await this.prepare();
    const key = v.trap ?? this.list[0]?.key;
    if (!key) throw new Error(t("Choose a trap."));
    const trap = await this.doc(key);
    if (!trap) throw new Error(t("That trap actor no longer exists."));
    const f = await facts(trap);
    if (f.mechanical) throw new Error(t("{name} is a mechanical trap: make it on the Trap kits tab.", { name: trap.name }));
    const carried = setting("magicKits");
    if (!carried && !canvas?.scene) throw new Error(t("Open the scene where the trap will be built first."));
    const m = magicTrapFacts(trap.toObject(), f.text);
    if (!m.spells.length) throw new Error(t("{name} has no spell effect in its stat line or notes (\"spell effect (burning hands, 1st-level wizard, …)\"), so its spells aren't known.", { name: trap.name }));
    const price = Number(m.gp) || srdTrap(trap.toObject(), await trapData())?.price || 0;
    if (!(price > 0)) throw new Error(t("{name} has no price. Add \"Market Price - 500 gp, 40 XP\" (its SRD cost) to its notes.", { name: trap.name }));
    const bound = carried ? null : { actorUuid: crafter?.uuid ?? null, actorName: crafter?.name ?? null, sceneId: canvas?.scene?.id ?? null, sceneName: canvas?.scene?.name ?? null };
    const data = await makeKit(trap, { price, magic: true, bound });
    const spells = m.spells.map((x) => ({ any: [x.name], for: trap.name }));
    if (m.triggerSpell) spells.push({ any: [m.triggerSpell], for: t("trigger") });
    const notes = [];
    let plan;
    if (m.spellTrap) {
      // Free when the crafter casts it; the SRD price is what an NPC caster charges
      const known = globalThis.AxecleftCrafting?.actor?.spells?.(crafter) ?? new Map();
      const own = m.spells.every((x) => known.has(normName(x.name)));
      notes.push(t("A spell trap: the crafter casts the spell (its components are paid as usual). The SRD price, {price}, is for hiring an NPC spellcaster to cast it.", { price: gp(price) }));
      plan = { base: 0, itemCost: own ? 0 : price, xpExtra: 0 };
      if (!own) notes.push(t("The crafter can't cast it, so the cost is the hired caster's price."));
    } else {
      // gp = base ÷ 2, XP = base ÷ 25 + extra, time = base ÷ 1,000 days: base = 2 × gp gives the SRD's 1 day per 500 gp
      const xp = m.xp || Math.round(price * 0.08);
      plan = { feat: "Craft Wondrous Item", base: price * 2, itemCost: 0, xpExtra: round2(xp - (price * 2) / 25) };
      notes.push(t("Magic device trap (SRD): {gp} and {xp} XP; 1 day of work per 500 gp.", { gp: gp(price), xp: fmt(xp) }));
    }
    notes.push(t(bound ? "Built on {scene}: only {name} can set it, there (Magic traps: can be carried is off)." : "A magic trap kit: any spellcaster can carry and set it (Magic traps: can be carried is on).", { scene: bound?.sceneName ?? "", name: bound?.actorName ?? "" }));
    notes.push(t("Magic traps can never be packed up again."));
    return {
      magic: true, epic: false, name: data.name, img: data.img, data, quantity: 1, market: price, ...plan,
      casterLevel: m.cl || null, spells, checks: [], requirements: [], notes,
      summary: t("{name} (CR {cr}), {price}", { name: trap.name, cr: f.cr, price: gp(price) }),
    };
  }
}

export function registerTrapCrafting() {
  if (globalThis.Hooks) Hooks.once("init", () => { for (const [k, o] of Object.entries(CRAFT_SETTINGS)) game.settings.register(MOD, k, { scope: "world", config: true, ...o }); });
  const C = globalThis.AxecleftCrafting;
  if (!C?.registerKind) return null;
  const craft = new TrapCraft();
  C.registerKind({
    module: MOD, key: "trap-kits", label: /*t*/"Trap kits", icon: "fas fa-dungeon", order: 40, magic: false,
    prepare: () => craft.prepare(), content: (ctx) => craft.content(ctx), evaluate: (ctx) => craft.evaluate(ctx),
  });
  const magic = new MagicTrapCraft();
  C.registerKind({
    module: MOD, key: "magic-traps", label: /*t*/"Magic traps", icon: "fas fa-wand-magic-sparkles", order: 41, magic: true,
    prepare: () => magic.prepare(), content: (ctx) => magic.content(ctx), evaluate: (ctx) => magic.evaluate(ctx),
  });
  C.registerTour?.({ module: MOD, key: "magic-traps", label: /*t*/"Magic traps",
    title: /*t*/"Crafting: Magic traps", description: /*t*/"Build a magic trap (a spell trap or a magic device trap) by the SRD.",
    intro: /*t*/"Build a magic trap by the SRD: a spell trap is cast; a magic device trap needs Craft Wondrous Item, its spells, gp and XP, and 1 day per 500 gp. Unless this world lets magic traps be carried, the builder sets it on the scene where it was built.",
    steps: [
      { id: "trap", field: "craft.trap", title: /*t*/"Trap", content: /*t*/"The magic trap to build, from the trap actors you can see (spell traps and magic device traps)." },
      { id: "help", sel: "details.acr-help", title: /*t*/"How a trap is read", content: /*t*/"Open this to see how crafting reads a trap actor (its CR, DCs, price and the spells it needs), so you can make your own traps craftable." },
      { id: "help", sel: "details.acr-help", title: /*t*/"How a trap is read", content: /*t*/"Open this to see how crafting reads a trap actor (its CR, DCs, price and the spells it needs), so you can make your own traps craftable." },
    ] });
  // A tour of the tab (Axecleft's Tools 9.7, Crafting 1.96)
  C.registerTour?.({ module: MOD, key: "trap-kits", label: /*t*/"Trap kits",
    title: /*t*/"Crafting: Trap kits", description: /*t*/"Make a trap kit from a trap actor, to set and recover in play.",
    intro: /*t*/"Make a trap kit (Craft (trapmaking), SRD): a trap a character carries, sets on a scene and can recover. The kit is made from a trap actor the crafter can see.",
    steps: [
      { id: "trap", field: "craft.trap", title: /*t*/"Trap", content: /*t*/"The trap to make, from the trap actors you can see. Traps from the Random Trap Generator are in the GM's world; the GM can show one to a player (Observer permission) to let them craft it." },
    ] });
  return craft;
}

registerTrapCrafting();
