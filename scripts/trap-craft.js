/**
 * Axecleft's Traps, Poisons, and Diseases — crafting trap kits (shared Crafting window, "Trap kits" tab).
 *
 * SRD, Designing a Trap / Craft (trapmaking): mechanical traps only. Raw materials cost ⅓ of the trap's price; poisons
 * and alchemical items in it are bought at full price (×20 with an automatic reset). Each week's progress is a
 * Craft (trapmaking) check: check × DC in silver pieces. DC: CR 1–3 20, 4–6 25, 7–10 30 (Axecleft: +5 per 3 CR past 10),
 * +5 for a proximity trigger, +5 for an automatic reset. The result is a Trap Kit in the crafter's inventory.
 *
 * Traps on offer: mechanical trap actors in the chosen Actor compendiums (all by default) and world trap actors the
 * user can see (the GM sees the Random Trap Generator's traps; show one to a player to let them craft it).
 */
import { facts, makeKit, KIT_SETTINGS } from "./trap-kits.js";

const MOD = "traps-and-poisons";
const esc = (v) => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const opt = (v, label, sel) => `<option value="${esc(v)}"${String(v) === String(sel ?? "") ? " selected" : ""}>${esc(label)}</option>`;
const gp = (n) => `${Number(Math.round((Number(n) || 0) * 100) / 100).toLocaleString("en-US")} gp`;
const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const setting = (k) => { try { return game.settings.get(MOD, k); } catch (e) { return KIT_SETTINGS[k]?.default; } };

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
      try { index = await pack.getIndex({ fields: ["type", "system.details.cr", "system.details.notes.value"] }); } catch (e) { continue; }
      for (const e of index) {
        if (e.type !== "trap") continue;
        if (/spell (effect|trigger)|\bXP\b|hire NPC spellcaster/i.test(e.system?.details?.notes?.value ?? "")) continue; // magic traps
        out.push({ key: `${pack.collection}|${e._id}`, name: e.name, cr: Number(e.system?.details?.cr) || 0, source: pack.metadata.label, pack: pack.collection, id: e._id });
      }
    }
    for (const a of game.actors ?? []) {
      if (a.type !== "trap" || !a.testUserPermission?.(game.user, "OBSERVER")) continue;
      if (a.folder?.name === "Placed Traps") continue;
      out.push({ key: `world|${a.id}`, name: a.name, cr: Number(a.system?.details?.cr) || 0, source: "This world", id: a.id });
    }
    out.sort((a, b) => a.cr - b.cr || a.name.localeCompare(b.name));
    this.list = out;
  }

  content({ values: v }) {
    const list = this.list ?? [];
    const groups = [...new Set(list.map((t) => t.source))];
    const sel = v.trap ?? list[0]?.key ?? "";
    return `<p class="hint">Craft (trapmaking), by the SRD: mechanical traps only. Raw materials cost ⅓ of the trap's price; poisons in it are bought at full price (×20 with an automatic reset). Each week's progress is a check (check × DC in silver pieces). The result is a <strong>Trap Kit</strong>: use it to set the trap on a scene.</p>
      <div class="form-group"><label>Trap</label><select name="craft.trap">${list.length ? groups.map((g) => `<optgroup label="${esc(g)}">${list.filter((t) => t.source === g).map((t) => opt(t.key, `CR ${t.cr}: ${t.name}`, sel)).join("")}</optgroup>`).join("") : opt("", "No mechanical trap actors found", "")}</select></div>
      <p class="hint">Traps from the Random Trap Generator are in the GM's world; the GM can show one to a player (Observer permission) to let them craft it.</p>`;
  }

  async doc(key) {
    const [src, id] = String(key ?? "").split("|");
    if (src === "world") return game.actors.get(id) ?? null;
    return (await game.packs.get(src)?.getDocument(id)) ?? null;
  }

  async evaluate({ values: v }) {
    if (!this.list) await this.prepare();
    const key = v.trap ?? this.list[0]?.key;
    if (!key) throw new Error("Choose a trap.");
    const actor = await this.doc(key);
    if (!actor) throw new Error("That trap actor no longer exists.");
    const f = await facts(actor);
    if (!f.mechanical) throw new Error(`${actor.name} is a magic trap; only mechanical traps can be crafted (magic traps come from spellcasting).`);
    if (!(f.price > 0)) throw new Error(`${actor.name} has no price. Add "Market Price - 1,000 gp" (its SRD price) to its notes.`);
    const data = await makeKit(actor, { price: f.price });
    const mech = round2(f.mechanicalPrice);
    const notes = [
      `Price ${gp(f.price)} (${f.priceSource}${f.extras ? `; ${gp(f.extras)} of it is poison or alchemical items, bought at full price` : ""}).`,
      `Craft (trapmaking) DC ${f.craftDc}: ${f.craftDcNote}.`,
      `The kit is set with 1 minute of work per CR (${f.cr || 1} minute${(f.cr || 1) > 1 ? "s" : ""}).`,
    ];
    if (f.formula?.parts?.length && f.priceSource !== "SRD market price") notes.push(`Cost table: base ${gp(f.formula.base)} (${f.formula.parts.map(([l, g]) => `${l} ${g > 0 ? "+" : ""}${g.toLocaleString("en-US")}`).join(", ")}) × CR ${f.cr}${f.formula.extraParts.length ? ` + ${f.formula.extraParts.map(([l, g]) => `${l} ${gp(g)}`).join(", ")}` : ""}.`);
    for (const a of f.assumptions) notes.push(`Note: ${a}.`);
    return {
      magic: false, name: data.name, img: data.img, data, quantity: 1, market: f.price,
      raw: round2(mech / 3), componentGp: round2(f.extras),
      checks: [{ key: "trap", label: actor.name, craft: "trapmaking", dc: f.craftDc, price: mech, raw: round2(mech / 3) }],
      summary: `${actor.name} (CR ${f.cr}), ${gp(f.price)}; Craft (trapmaking) DC ${f.craftDc}`, requirements: [], notes,
    };
  }
}

export function registerTrapCrafting() {
  const C = globalThis.AxecleftCrafting;
  if (!C?.registerKind) return null;
  const craft = new TrapCraft();
  C.registerKind({
    module: MOD, key: "trap-kits", label: "Trap kits", icon: "fas fa-dungeon", order: 40, magic: false,
    prepare: () => craft.prepare(), content: (ctx) => craft.content(ctx), evaluate: (ctx) => craft.evaluate(ctx),
  });
  return craft;
}

registerTrapCrafting();
