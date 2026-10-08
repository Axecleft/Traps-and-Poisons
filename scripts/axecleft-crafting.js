/**
 * Axecleft's Crafting — shared engine, version 1.6.
 *
 * Copy this same file into every Axecleft module that makes craftable items (Armory, Curios, Gemstones,
 * Traps, Poisons and Diseases) and list it in module.json "esmodules" after axecleft-tools.js and before the
 * module's own scripts. Whichever copy has the highest version runs.
 *
 * The engine follows the 3.5 SRD: item creation feats, caster level, required spells, gp and XP for magic items
 * (supplies ½ the base price, XP 1/25 of it, plus the item cost), and Craft checks for mundane items (raw materials
 * ⅓ of the price). A player's item is a request: the GM approves it (the gp and XP are spent then, as the SRD says),
 * and only then does the player roll the checks. Time is shown to the GM, never enforced.
 *
 * Modules add what they can make:
 *
 *   globalThis.AxecleftCrafting.registerKind({
 *     module, key, label, icon, order,
 *     magic: true, feat: "Craft Magic Arms and Armor",
 *     content({ actor, values }) -> HTML (inputs named "craft.<field>"),
 *     wire?(section, { actor, values, refresh }),
 *     evaluate({ actor, values }) -> plan (see below),
 *     beforeApprove?({ actor, values, plan }) -> new values (1.1: roll anything the SRD leaves random, e.g. an intelligent item's features)
 *   });
 *
 * Version 1.2: C.parsePrereqs(html, { spell, isFeat, itemName }) reads an SRD construction line ("CL 10th; Craft Wondrous Item,
 * bull's strength; Price …") and C.prereqHelp("items" | "abilities") is the collapsible help explaining it.
 *
 * plan = { name, img, data, quantity, market, base, itemCost, raw, xpExtra, casterLevel, casterNote,
 *          spells: [{ any: ["flame strike", "fireball"], for: "Flaming" }], align, cls, minLevel,
 *          requirements: [{ label, ok, detail, waivable }], checks: [{ key, label, craft | skill, dc, price }],
 *          consume: [{ id, qty }], days, notes: [], summary }
 *
 * Version 1.6, epic items (SRD Epic Magic Items): plan.epic true (or, unless plan.epic is false, a market price above 200,000 gp
 * or a caster level above 20) makes the epic rules apply: XP = market price ÷ 100 + 10,000 (scrolls, plan.scroll: ÷ 25 + 1,000),
 * both the nonepic and the epic creation feat (plan.epicFeat, or the epic version of plan.feat), only while the shared Epic
 * items switch is on; time 1 day per 10,000 gp of base price (Axecleft house rule; reported, not enforced).
 */
const AXECLEFT_CRAFTING_VERSION = 1.6;
const AXECLEFT_CRAFTING_HOST = (() => {
  try { return decodeURIComponent(new URL(import.meta.url).pathname).match(/\/modules\/([^/]+)\//)?.[1] ?? null; } catch (e) { return null; }
})();

(() => {
  const existing = globalThis.AxecleftCrafting;
  if (existing && existing.version >= AXECLEFT_CRAFTING_VERSION) { existing.hosts?.add(AXECLEFT_CRAFTING_HOST); return; }

  const registry = existing?.registry ?? { kinds: new Map() };
  const hosts = existing?.hosts ?? new Set();
  if (AXECLEFT_CRAFTING_HOST) hosts.add(AXECLEFT_CRAFTING_HOST);
  const host = () => [...hosts].find((h) => game.modules?.get(h)?.active) ?? [...hosts][0] ?? null;

  const FLAG = "world", KEY = "axecleftCrafting";
  const STORE = "axecleft-crafting.";
  const esc = (v) => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const opt = (v, label, sel, extra = "") => `<option value="${esc(v)}"${String(v) === String(sel ?? "") ? " selected" : ""}${extra}>${esc(label)}</option>`;
  const normName = (s) => String(s ?? "").toLowerCase().replace(/[’']/g, "'").replace(/[^a-z0-9']+/g, " ").trim();
  const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
  const gp = (n) => `${round2(n).toLocaleString("en-US")} gp`;
  const remember = (k, v) => { try { localStorage.setItem(STORE + k, v); } catch (e) { /* private mode */ } };
  const recall = (k, d) => { try { return localStorage.getItem(STORE + k) ?? d; } catch (e) { return d; } };
  const ROLL_MODES = { publicroll: "Public roll", gmroll: "Private GM roll", blindroll: "Blind GM roll" };

  /* ------------------------------------------ */
  /*  Settings                                  */
  /* ------------------------------------------ */
  let ns = null;
  const SETTINGS = {
    playersMayCraft: { name: "Players may craft", hint: "Players can open the Crafting window and send requests to the GM. Nothing is made or charged until the GM approves.", type: Boolean, default: true },
    magicChecks: { name: "Magic item checks", hint: "SRD: no check to make a magic item; every prerequisite must be met. Spellcraft (house rule): Spellcraft DC 5 + caster level, +5 for each missing prerequisite (other than the feat and caster level) instead of blocking; failing by 5 or more wastes the gp and XP.", type: String, default: "srd", choices: { srd: "SRD (no check)", spellcraft: "Spellcraft check (house rule)" } },
    poisonRule: { name: "Poison crafting", hint: "The SRD has no rule for making poison. House rule: Craft (alchemy) against the poison's save DC, raw materials ⅓ of the price, spellcasters only (as for alchemy).", type: String, default: "house", choices: { house: "House rule", off: "Off" } },
    rollMode: { name: "Crafting checks are rolled as", hint: "The default when you approve a request; you can change it on each request card.", type: String, default: "publicroll", choices: ROLL_MODES },
    chargeGp: { name: "Charge gp", hint: "Spend the crafter's gold when a request is approved.", type: Boolean, default: true },
    chargeXp: { name: "Charge XP", hint: "Spend the crafter's experience points when a request is approved.", type: Boolean, default: true },
    xpFloor: { name: "XP can't cost a level", hint: "SRD: a character can't spend so much XP on an item that he or she loses a level.", type: Boolean, default: true },
  };
  function registerSettings() {
    for (const n of [host(), "world"].filter(Boolean)) {
      try {
        for (const [k, o] of Object.entries(SETTINGS)) {
          if (!game.settings.settings?.has?.(`${n}.crafting_${k}`)) game.settings.register(n, `crafting_${k}`, { scope: "world", config: true, ...o });
        }
        ns = n; return;
      } catch (e) { console.warn(`AxecleftCrafting | could not register settings under "${n}"`, e); }
    }
  }
  const setting = (k) => { try { return ns ? game.settings.get(ns, `crafting_${k}`) : SETTINGS[k].default; } catch (e) { return SETTINGS[k].default; } };

  /* ------------------------------------------ */
  /*  Reading the crafter (D35E actor)          */
  /* ------------------------------------------ */
  const sys = (a) => a?.system ?? {};
  const actorInfo = {
    feats(actor) { return new Set((actor?.items ?? []).filter((i) => i.type === "feat").map((i) => normName(i.name))); },
    /** Caster levels of the spellbooks in use: [{ key, name, cl, spontaneous }]. */
    casterLevels(actor) {
      const books = sys(actor).attributes?.spells?.spellbooks ?? {};
      return Object.entries(books).map(([key, b]) => ({ key, name: b.name || key, cl: Number(b.cl?.total ?? b.cl?.value ?? 0) || 0, spontaneous: !!b.spontaneous }))
        .filter((b) => b.cl > 0);
    },
    casterLevel(actor) { return Math.max(0, ...actorInfo.casterLevels(actor).map((b) => b.cl)); },
    /** normName -> [{ name, book, level, prepared, spontaneous }] for every spell the actor has. */
    spells(actor) {
      const books = sys(actor).attributes?.spells?.spellbooks ?? {};
      const out = new Map();
      for (const i of actor?.items ?? []) {
        if (i.type !== "spell") continue;
        const s = i.system ?? {}, book = books[s.spellbook] ?? {};
        const e = { name: i.name, book: book.name || s.spellbook, level: s.level, prepared: Number(s.preparation?.preparedAmount ?? 0) || 0, spontaneous: !!book.spontaneous || !!s.atWill };
        const k = normName(i.name);
        if (!out.has(k)) out.set(k, []);
        out.get(k).push(e);
      }
      return out;
    },
    alignment(actor) {
      const d = sys(actor).details ?? {};
      const ax = d.actualAlignmentAxes ?? d.alignmentAxes;
      if (ax?.lawChaos) return { lc: ax.lawChaos, ge: ax.goodEvil };
      const t = String(d.alignment ?? "").toLowerCase();
      if (/^[lnc][gne]$/.test(t)) return { lc: t[0], ge: t[1] === "n" ? "n" : t[1] };
      return { lc: /lawful/.test(t) ? "l" : /chaotic/.test(t) ? "c" : "n", ge: /good/.test(t) ? "g" : /evil/.test(t) ? "e" : "n" };
    },
    classes(actor) {
      const m = new Map();
      for (const i of actor?.items ?? []) if (i.type === "class") m.set(normName(i.name), Number(i.system?.levels ?? 0) || 0);
      return m;
    },
    level(actor) { return Number(sys(actor).details?.level?.available ?? sys(actor).details?.level?.value ?? 0) || 0; },
    /** { value, floor }: the XP the actor has, and the least it may keep (the start of its current level). */
    xp(actor) {
      const d = sys(actor).details ?? {};
      const value = Number(d.xp?.value ?? 0) || 0;
      let prior = actorInfo.level(actor) - 1;
      for (const i of actor?.items ?? []) {
        if (i.type === "race") prior += Number(i.system?.la ?? 0) || 0;
        if (i.type === "class") prior += Number(i.system?.la ?? 0) || 0;
      }
      let floor = 0;
      try { floor = Number(actor.getLevelExp?.(Math.max(0, prior))) || 0; } catch (e) { floor = 0; }
      return { value, floor };
    },
    /** Total gp in both purses (carried and weightless). */
    gold(actor) {
      const c = (p) => (Number(p?.pp) || 0) * 10 + (Number(p?.gp) || 0) + (Number(p?.sp) || 0) / 10 + (Number(p?.cp) || 0) / 100;
      return round2(c(sys(actor).currency) + c(sys(actor).altCurrency));
    },
    /** A Craft skill by name ("weaponsmithing"): { rollId, label, mod, trained }. Craft can be used untrained. */
    craft(actor, name) {
      const crf = sys(actor).skills?.crf ?? {};
      for (const group of ["subSkills", "namedSubSkills"]) {
        for (const [id, s] of Object.entries(crf[group] ?? {})) {
          if (normName(s?.name).includes(normName(name)) || normName(name).includes(normName(s?.name))) {
            return { rollId: `crf.${group}.${id}`, label: `Craft (${s.name})`, mod: Number(s.mod ?? 0) || 0, trained: (Number(s.rank ?? 0) || 0) > 0 };
          }
        }
      }
      return { rollId: "crf", label: `Craft (${name}), untrained`, mod: Number(crf.mod ?? 0) || 0, trained: false };
    },
    skill(actor, id, label) {
      const s = sys(actor).skills?.[id] ?? {};
      return { rollId: id, label, mod: Number(s.mod ?? 0) || 0, trained: (Number(s.rank ?? 0) || 0) > 0, trainedOnly: !!s.rt };
    },
  };

  /** Pay gp from the actor's purses (carried first, then weightless), making change. Returns the update data. */
  function payment(actor, amount) {
    let rest = Math.round(round2(amount) * 100); // in cp
    if (rest <= 0) return {};
    const V = { pp: 1000, gp: 100, sp: 10, cp: 1 };
    const update = {};
    for (const purse of ["currency", "altCurrency"]) {
      const p = { pp: 0, gp: 0, sp: 0, cp: 0, ...(sys(actor)[purse] ?? {}) };
      for (const k of Object.keys(p)) p[k] = Number(p[k]) || 0;
      // Whole coins first (gp, then pp, sp, cp), then break one coin and take change
      for (const k of ["gp", "pp", "sp", "cp"]) { const n = Math.min(p[k], Math.floor(rest / V[k])); p[k] -= n; rest -= n * V[k]; }
      if (rest > 0) {
        const k = ["cp", "sp", "gp", "pp"].find((x) => p[x] > 0 && V[x] > rest);
        if (k) {
          p[k] -= 1; let change = V[k] - rest; rest = 0;
          for (const c of ["gp", "sp", "cp"]) { const n = Math.floor(change / V[c]); p[c] += n; change -= n * V[c]; }
        }
      }
      update[`system.${purse}`] = p;
      if (rest <= 0) break;
    }
    if (rest > 0) throw new Error(`${actor.name} doesn't have ${gp(amount)}.`);
    return update;
  }

  /* ------------------------------------------ */
  /*  Plans: the kind's plan plus the SRD rules */
  /* ------------------------------------------ */
  const kinds = () => [...registry.kinds.values()].filter((k) => game.modules?.get(k.module)?.active ?? true).sort((a, b) => (a.order ?? 100) - (b.order ?? 100));
  const kindOf = (id) => registry.kinds.get(id);

  /**
   * Complete a kind's plan: costs (gp, XP), feat, caster level, spells, alignment, gold and XP, and the checks.
   * values["src.<n>"] says where a missing spell comes from: "ally" | "scroll" | "wand".
   */
  /** SRD epic item creation feats, by their nonepic feat. */
  const EPIC_FEATS = { "craft magic arms and armor": "Craft Epic Magic Arms and Armor", "craft wondrous item": "Craft Epic Wondrous Item", "forge ring": "Forge Epic Ring",
    "craft rod": "Craft Epic Rod", "craft staff": "Craft Epic Staff", "scribe scroll": "Scribe Epic Scroll" };
  function finishPlan(kind, actor, values, plan) {
    const p = { requirements: [], checks: [], notes: [], spells: [], consume: [], ...plan };
    const base = round2(p.base ?? 0);
    // Epic items (1.6): flagged by the kind, or over the SRD's nonepic limits (price above 200,000 gp, caster level above 20)
    p.epic = !!p.magic && (p.epic === true || (p.epic !== false && ((Number(p.market) || base) > 200000 || (Number(p.casterLevel) || 0) > 20)));
    const feat0 = p.feat ?? kind.feat;
    if (p.epic) p.epicFeat ??= EPIC_FEATS[normName(feat0)] ?? null;
    const market = Number(p.market) || base;
    p.gp = round2((p.magic ? base / 2 : 0) + (p.itemCost ?? 0) + (p.raw ?? 0) + (p.componentGp ?? 0));
    p.xp = Math.ceil(round2((p.magic ? (p.epic ? (p.scroll ? market / 25 + 1000 : market / 100 + 10000) : base / 25) : 0) + (p.xpExtra ?? 0)));
    if (!setting("chargeGp")) p.gp = 0;
    if (!setting("chargeXp")) p.xp = 0;
    p.days = p.magic ? Math.max(1, Math.ceil(base / (p.epic ? 10000 : 1000))) : null;
    if (p.epic) p.notes = [`Epic item (SRD): XP = ${p.scroll ? "market price ÷ 25 + 1,000" : "market price ÷ 100 + 10,000"}; needs both ${feat0 ?? "the creation feat"} and ${p.epicFeat ?? "its epic version"}. Time: 1 day per 10,000 gp of base price (house rule; not enforced).`, ...(p.notes ?? [])];
    const req = [];
    if (actor && p.magic) {
      const feats = actorInfo.feats(actor);
      const feat = feat0;
      if (feat) req.push({ key: "feat", label: feat, ok: feats.has(normName(feat)), detail: feats.has(normName(feat)) ? "has the feat" : "doesn't have the feat", waivable: false });
      if (p.epic) {
        const on = globalThis.AxecleftTreasure?.rules?.()?.epic;
        if (on === false) req.push({ key: "epic", label: "Epic items allowed", ok: false, detail: "Epic items is off (Treasure Generator → Generation settings)", waivable: false });
        const ef = p.epicFeat;
        const already = (p.requirements ?? []).some((r) => normName(r.label) === normName(ef));
        if (ef && normName(ef) !== normName(feat) && !already) req.push({ key: "feat.epic", label: ef, ok: feats.has(normName(ef)), detail: feats.has(normName(ef)) ? "has the feat" : "doesn't have the feat (epic item)", waivable: false });
      }
      const cl = actorInfo.casterLevel(actor);
      if (p.casterLevel) req.push({ key: "cl", label: `Caster level ${p.casterLevel}`, ok: cl >= p.casterLevel, detail: `${cl ? `caster level ${cl}` : "not a spellcaster"}${p.casterNote ? `; ${p.casterNote}` : ""}`, waivable: false });
      // Spells: one of each group; from the crafter, a helping caster, a scroll or a wand
      const known = actorInfo.spells(actor);
      const seen = new Set();
      let n = 0;
      for (const s of p.spells ?? []) {
        const key = s.any.map(normName).sort().join("|");
        if (seen.has(key)) continue;
        seen.add(key);
        const i = n++;
        const label = s.any.length > 1 ? s.any.join(" or ") : s.any[0];
        const mine = s.any.map((x) => ({ x, e: known.get(normName(x)) })).find((o) => o.e);
        const src = values?.[`src.${i}`] ?? "";
        let ok = false, detail;
        if (mine) {
          const e = mine.e[0];
          ok = true;
          detail = `${e.spontaneous ? "knows" : e.prepared ? `prepared (${e.prepared})` : "in spellbook, not prepared"} ${mine.x}${e.spontaneous || e.prepared ? "" : " — prepare it each day of work"}`;
          if (!e.spontaneous && !e.prepared) ok = "warn";
        } else if (src === "ally") { ok = true; detail = "a helping caster provides it each day"; }
        else if (src === "scroll") { ok = true; detail = `a scroll each day of work (${p.days ?? 1} scroll${(p.days ?? 1) > 1 ? "s" : ""})`; }
        else if (src === "wand") { ok = true; detail = `a wand charge each day of work (${p.days ?? 1} charge${(p.days ?? 1) > 1 ? "s" : ""})`; }
        else detail = "not known or prepared";
        req.push({ key: `spell.${i}`, label: `Spell: ${label}`, ok, detail: `${detail}${s.for ? ` (for ${s.for})` : ""}`, waivable: true, source: { index: i, value: mine ? "self" : src, self: !!mine } });
      }
      if (p.align) {
        const al = actorInfo.alignment(actor);
        const need = { good: al.ge === "g", evil: al.ge === "e", lawful: al.lc === "l", chaotic: al.lc === "c" };
        for (const a of [].concat(p.align)) req.push({ key: `align.${a}`, label: `Creator must be ${a}`, ok: !!need[a], detail: need[a] ? "yes" : "no", waivable: true });
      }
      if (p.cls) for (const c of [].concat(p.cls)) {
        const has = actorInfo.classes(actor).has(normName(c));
        req.push({ key: `cls.${c}`, label: `Creator must be a ${c}`, ok: has, detail: has ? "yes" : "no", waivable: true });
      }
      if (p.minLevel) {
        const lv = actorInfo.level(actor);
        req.push({ key: "level", label: `Creator at least level ${p.minLevel}`, ok: lv >= p.minLevel, detail: `level ${lv}`, waivable: true });
      }
    }
    req.push(...(p.requirements ?? []));
    // Gold and XP
    if (actor) {
      const g = actorInfo.gold(actor);
      req.push({ key: "gp", label: `${gp(p.gp)} to spend`, ok: g >= p.gp, detail: `has ${gp(g)}`, waivable: false });
      if (p.xp > 0) {
        const x = actorInfo.xp(actor);
        const left = x.value - p.xp;
        const ok = x.value >= p.xp && (!setting("xpFloor") || left >= x.floor);
        req.push({ key: "xp", label: `${p.xp.toLocaleString("en-US")} XP to spend`, ok, detail: `has ${x.value.toLocaleString("en-US")} XP${setting("xpFloor") ? `; can spend ${Math.max(0, x.value - x.floor).toLocaleString("en-US")} without losing a level` : ""}`, waivable: false });
      }
    }
    // Magic item check (house rule): Spellcraft DC 5 + caster level, +5 per missing prerequisite instead of blocking
    if (p.magic && setting("magicChecks") === "spellcraft" && actor) {
      const missing = req.filter((r) => r.waivable && r.ok === false);
      for (const r of missing) { r.ok = "warn"; r.detail += " — +5 to the Spellcraft DC"; }
      const dc = 5 + (p.casterLevel || 1) + 5 * missing.length;
      p.checks = [{ key: "spellcraft", label: "Spellcraft (house rule)", skill: "spl", dc, magic: true }, ...(p.checks ?? [])];
    }
    // Each check resolved against the crafter's skills
    for (const c of p.checks) {
      const s = actor ? (c.craft ? actorInfo.craft(actor, c.craft) : actorInfo.skill(actor, c.skill, c.skillLabel ?? (c.skill === "spl" ? "Spellcraft" : c.skill))) : null;
      if (s) { c.rollId = s.rollId; c.skillLabel = s.label; c.mod = s.mod; }
      if (c.skill === "spl" && s && !s.trained) req.push({ key: "spl", label: "Spellcraft is trained only", ok: false, detail: "no ranks in Spellcraft", waivable: false });
      if (c.price) {
        // SRD Craft: progress per week = check × DC in silver pieces; estimate with taking 10
        const t10 = Math.max(1, (c.mod ?? 0) + 10) * c.dc;
        c.weeks = round2((c.price * 10) / t10);
      }
    }
    if (p.alchemy && actor && !actorInfo.casterLevel(actor)) req.push({ key: "alchemy", label: "Craft (alchemy) needs a spellcaster", ok: false, detail: "not a spellcaster", waivable: false });
    p.requirements = req;
    p.ready = req.every((r) => r.ok !== false);
    p.kind = kind.id;
    return p;
  }

  async function evaluate(kindId, actor, values) {
    const kind = kindOf(kindId);
    if (!kind) throw new Error(`Unknown craft kind ${kindId}.`);
    const plan = await kind.evaluate({ actor, values: values ?? {} });
    return finishPlan(kind, actor, values ?? {}, plan);
  }

  /* ------------------------------------------ */
  /*  Rendering a plan                          */
  /* ------------------------------------------ */
  const mark = (ok) => ok === true ? '<i class="fas fa-check acr-ok"></i>' : ok === "warn" ? '<i class="fas fa-triangle-exclamation acr-warn"></i>' : '<i class="fas fa-xmark acr-no"></i>';
  function timeText(p) {
    if (p.days) return `${p.days.toLocaleString("en-US")} day${p.days > 1 ? "s" : ""} of work (8 hours a day; ${p.epic ? "epic item: 1 day per 10,000 gp of base price, house rule" : "1 day per 1,000 gp of base price"})`;
    const w = (p.checks ?? []).filter((c) => c.weeks).map((c) => c.weeks);
    if (w.length) return `about ${Math.max(...w).toLocaleString("en-US")} week${Math.max(...w) === 1 ? "" : "s"} (Craft: check × DC in silver pieces each week; estimate with taking 10)`;
    return "";
  }
  function costLines(p) {
    const lines = [];
    if (p.magic) lines.push(`Magic supplies ${gp((p.base ?? 0) / 2)} (½ of the ${gp(p.base ?? 0)} base price)`);
    if (p.itemCost) lines.push(`${esc(p.itemCostLabel ?? "Item cost")} ${gp(p.itemCost)}`);
    if (p.raw) lines.push(`Raw materials ${gp(p.raw)} (⅓ of the price)`);
    if (p.componentGp) lines.push(`Spell components ${gp(p.componentGp)}`);
    return lines;
  }
  /** The plan as HTML for the window (with spell-source choices) or the chat card. */
  function planHTML(p, { form = false, values = {} } = {}) {
    if (!p) return "";
    const reqs = (p.requirements ?? []).map((r) => {
      let extra = "";
      if (form && r.source && !r.source.self) {
        extra = ` <select name="craft.src.${r.source.index}" class="acr-src">${opt("", "Not available", values[`src.${r.source.index}`])}${opt("ally", "A helping caster", values[`src.${r.source.index}`])}${opt("scroll", "A scroll", values[`src.${r.source.index}`])}${opt("wand", "A wand", values[`src.${r.source.index}`])}</select>`;
      }
      return `<li>${mark(r.ok)} <strong>${esc(r.label)}</strong> <small>${esc(r.detail ?? "")}</small>${extra}</li>`;
    }).join("");
    const checks = (p.checks ?? []).map((c) => `<li><i class="fas fa-dice-d20"></i> ${esc(c.label)}: ${esc(c.skillLabel ?? "")} DC ${c.dc}${c.mod !== undefined ? ` <small>(modifier ${c.mod >= 0 ? "+" : ""}${c.mod})</small>` : ""}</li>`).join("");
    const t = timeText(p);
    return `<div class="acr-plan">
      <div class="acr-name"><strong>${esc(p.name ?? "")}</strong>${p.quantity > 1 ? ` (${p.quantity})` : ""}${p.market ? ` — market price ${gp(p.market)}` : ""}</div>
      ${p.summary ? `<div class="acr-sum">${esc(p.summary)}</div>` : ""}
      <div class="acr-costs"><strong>Cost:</strong> ${gp(p.gp ?? 0)}${p.xp ? ` and ${p.xp.toLocaleString("en-US")} XP` : ""}${costLines(p).length ? `<br><small>${costLines(p).join("; ")}</small>` : ""}</div>
      ${t ? `<div class="acr-time"><i class="fas fa-hourglass-half"></i> <strong>Time:</strong> ${esc(t)}</div>` : ""}
      ${reqs ? `<ul class="acr-reqs">${reqs}</ul>` : ""}
      ${checks ? `<div><strong>Checks (rolled after approval):</strong><ul class="acr-reqs">${checks}</ul></div>` : `<div class="acr-sum">No check: ${p.magic ? "the SRD needs none for a magic item when its prerequisites are met" : "nothing to roll"}.</div>`}
      ${(p.notes ?? []).length ? `<ul class="acr-notes">${p.notes.map((n) => `<li>${esc(n)}</li>`).join("")}</ul>` : ""}
    </div>`;
  }

  /* ------------------------------------------ */
  /*  Requests (chat cards)                     */
  /* ------------------------------------------ */
  const gmIds = () => (game.users ?? []).filter((u) => u.isGM).map((u) => u.id);
  const reqOf = (m) => m?.flags?.[FLAG]?.[KEY] ?? null;
  async function actorOf(r) { return r?.actorUuid ? await fromUuid(r.actorUuid) : null; }
  const canRoll = (m, actor) => !!actor && (game.user.isGM || (actor.isOwner && m.isAuthor));

  const STATE = { pending: "Waiting for the GM", rolling: "Approved — roll the checks", ruined: "Materials ruined", done: "Finished", failed: "Failed", rejected: "Rejected", abandoned: "Abandoned" };

  function cardHTML(r) {
    const p = r.plan;
    const state = `<div class="acr-state acr-${r.state}"><strong>${esc(STATE[r.state] ?? r.state)}</strong>${r.note ? ` — ${esc(r.note)}` : ""}</div>`;
    const hidden = r.rollMode === "blindroll";
    const results = (p.checks ?? []).map((c) => {
      const res = r.results?.[c.key];
      if (!res) return `<li>${esc(c.label)}: ${esc(c.skillLabel ?? "")} DC ${c.dc} — not rolled yet</li>`;
      const word = res.status === "passed" ? "success" : res.status === "retry" ? "failed by 4 or less: no progress, roll again" : res.status === "ruined" ? "failed by 5 or more: half the raw materials ruined" : res.status === "lost" ? "failed by 5 or more: the gp and XP are lost" : res.status === "waiting" ? "rolled — the GM resolves it" : res.status;
      const weeks = res.status === "passed" && c.price ? ` (${(Math.round((c.price * 10) / Math.max(1, res.total * c.dc) * 100) / 100).toLocaleString("en-US")} weeks at this result)` : "";
      return `<li ${hidden ? "data-gm-only" : ""}>${esc(c.label)}: ${res.total} vs DC ${c.dc} — ${esc(word)}${weeks}${res.tries > 1 ? ` <small>(try ${res.tries})</small>` : ""}</li>`;
    }).join("");
    const paid = r.paid ? `<div class="acr-sum">Spent: ${gp(r.paid.gp ?? 0)}${r.paid.xp ? ` and ${r.paid.xp.toLocaleString("en-US")} XP` : ""}${r.paid.extra ? `; ${gp(r.paid.extra)} more after ruined materials` : ""}.</div>` : "";
    const buttons = [];
    if (r.state === "pending") {
      buttons.push(`<div data-gm-only class="acr-gm"><label>Checks rolled as <select data-roll-mode>${Object.entries(ROLL_MODES).map(([k, l]) => opt(k, l, r.rollMode ?? setting("rollMode"))).join("")}</select></label>
        <div class="acr-buttons"><button type="button" data-acr="approve"><i class="fas fa-check"></i> Approve</button><button type="button" data-acr="edit"><i class="fas fa-pen"></i> Edit</button><button type="button" data-acr="reject"><i class="fas fa-xmark"></i> Reject</button></div></div>`);
    }
    if (r.state === "rolling") {
      for (const c of p.checks ?? []) {
        const res = r.results?.[c.key];
        if (res && res.status !== "retry") continue;
        buttons.push(`<button type="button" data-acr="roll" data-check="${esc(c.key)}" data-roller><i class="fas fa-dice-d20"></i> Roll ${esc(c.skillLabel ?? c.label)} (DC ${c.dc})${res ? " again" : ""}</button>`);
      }
      if (hidden && (p.checks ?? []).some((c) => r.results?.[c.key]?.status === "waiting")) buttons.push(`<button type="button" data-acr="resolve" data-gm-only><i class="fas fa-eye"></i> Resolve the blind rolls</button>`);
    }
    if (r.state === "ruined") {
      buttons.push(`<div class="acr-buttons" data-roller><button type="button" data-acr="repay"><i class="fas fa-coins"></i> Pay ${gp(r.repay ?? 0)} and roll again</button><button type="button" data-acr="abandon"><i class="fas fa-ban"></i> Abandon</button></div>`);
    }
    return `<div class="axecleft-crafting-card">
      <h3><i class="fas fa-hammer"></i> Crafting: ${esc(p.name)}</h3>
      <div class="acr-sum">${esc(r.actorName ?? "")}${r.kindLabel ? ` · ${esc(r.kindLabel)}` : ""}</div>
      ${state}
      ${planHTML(p)}
      ${paid}
      ${results ? `<div><strong>Results:</strong><ul class="acr-reqs">${results}</ul></div>` : ""}
      ${buttons.join("")}
    </div>`;
  }

  async function saveRequest(message, r) {
    await message.update({ content: cardHTML(r), [`flags.${FLAG}.${KEY}`]: r });
  }

  /** Send a plan as a request (or, for the GM, craft it at once: approved, then rolled). */
  async function submit({ kindId, actor, values, plan, approve = false, message = null }) {
    const kind = kindOf(kindId);
    const r = {
      v: 1, state: "pending", kind: kindId, kindLabel: kind?.label ?? kindId, actorUuid: actor.uuid, actorName: actor.name,
      userId: game.user.id, values, plan, results: {}, rollMode: setting("rollMode"), created: Date.now(),
    };
    if (message) {
      const old = reqOf(message);
      Object.assign(r, { userId: old?.userId ?? r.userId, created: old?.created ?? r.created, note: "edited by the GM" });
      await saveRequest(message, r);
      return message;
    }
    const whisper = [...new Set([...gmIds(), game.user.id])];
    const msg = await ChatMessage.create({ content: cardHTML(r), whisper, speaker: ChatMessage.getSpeaker({ actor }), flags: { [FLAG]: { [KEY]: r } } });
    if (approve && game.user.isGM) await approveRequest(msg, r.rollMode);
    return msg;
  }

  async function approveRequest(message, rollMode) {
    if (!game.user.isGM) return ui.notifications.warn("Only the GM can approve crafting.");
    const r = foundry.utils.deepClone(reqOf(message));
    if (!r || r.state !== "pending") return;
    const actor = await actorOf(r);
    if (!actor) return ui.notifications.error("The crafting character no longer exists.");
    // Features the SRD leaves random (an intelligent item's powers) are rolled now, by the GM, and the costs follow
    const kind = kindOf(r.kind);
    if (typeof kind?.beforeApprove === "function") {
      const v2 = await kind.beforeApprove({ actor, values: r.values, plan: r.plan });
      if (v2) { r.values = v2; r.plan = await evaluate(r.kind, actor, v2); }
    }
    const p = r.plan;
    if (actorInfo.gold(actor) < (p.gp ?? 0)) {
      r.note = `${actor.name} can't pay ${gp(p.gp)} after the rolls; reject or edit the request`;
      await saveRequest(message, r);
      return ui.notifications.error(r.note);
    }
    // SRD: "The character must spend the gold and XP at the beginning of the construction process."
    const update = {};
    try { Object.assign(update, payment(actor, p.gp ?? 0)); } catch (err) { return ui.notifications.error(err.message); }
    if (p.xp > 0) update["system.details.xp.value"] = Math.max(0, (Number(sys(actor).details?.xp?.value) || 0) - p.xp);
    if (Object.keys(update).length) await actor.update(update);
    r.paid = { gp: p.gp ?? 0, xp: p.xp ?? 0 };
    r.rollMode = rollMode ?? r.rollMode ?? setting("rollMode");
    r.approvedBy = game.user.id;
    if ((p.checks ?? []).length) { r.state = "rolling"; r.note = ""; await saveRequest(message, r); return; }
    await finish(message, r, actor);
  }

  /** Make the item: create it on the actor and use up the parts it was made from. */
  async function finish(message, r, actor) {
    const p = r.plan;
    const data = foundry.utils.deepClone(p.data);
    if (data) {
      delete data._id;
      await actor.createEmbeddedDocuments("Item", [data]);
    }
    for (const c of p.consume ?? []) {
      const it = actor.items.get(c.id);
      if (!it) continue;
      const q = Number(it.system?.quantity ?? 1) || 1;
      if (c.qty && q > c.qty) await it.update({ "system.quantity": q - c.qty });
      else await actor.deleteEmbeddedDocuments("Item", [c.id]);
    }
    r.state = "done";
    r.note = `${p.name} is in ${actor.name}'s inventory`;
    await saveRequest(message, r);
  }

  /** Apply a check result (SRD Craft: fail by 4 or less, no progress; by 5 or more, half the raw materials ruined). */
  function outcome(c, total) {
    if (total >= c.dc) return "passed";
    const by = c.dc - total;
    if (by <= 4) return "retry";
    return c.magic ? "lost" : "ruined";
  }
  async function applyResults(message, r, actor) {
    const p = r.plan;
    for (const c of p.checks ?? []) {
      const res = r.results?.[c.key];
      if (res?.status === "waiting") res.status = outcome(c, res.total);
    }
    const st = (p.checks ?? []).map((c) => r.results?.[c.key]?.status);
    if (st.includes("lost")) { r.state = "failed"; r.note = "the Spellcraft check failed by 5 or more; the gp and XP spent are lost"; return saveRequest(message, r); }
    const ruined = (p.checks ?? []).filter((c) => r.results?.[c.key]?.status === "ruined");
    if (ruined.length) {
      r.state = "ruined";
      r.repay = round2(ruined.reduce((s, c) => s + (c.raw ?? (c.price ?? 0) / 3) / 2, 0));
      r.note = `half the raw materials for ${ruined.map((c) => c.label).join(" and ")} are ruined`;
      return saveRequest(message, r);
    }
    if (st.every((s) => s === "passed")) return finish(message, r, actor);
    r.state = "rolling";
    r.note = st.includes("retry") ? "no progress on a check; roll it again" : "";
    return saveRequest(message, r);
  }

  async function rollCheck(message, key) {
    const r = foundry.utils.deepClone(reqOf(message));
    const actor = await actorOf(r);
    if (!r || r.state !== "rolling" || !actor) return;
    if (!canRoll(message, actor)) return ui.notifications.warn("Only the crafter's player (or the GM) can roll this check.");
    const c = (r.plan.checks ?? []).find((x) => x.key === key);
    if (!c) return;
    const roll = await actor.rollSkill(c.rollId ?? (c.craft ? "crf" : c.skill), { target: c.dc, rollMode: r.rollMode });
    const total = Number(roll?.total ?? roll?._total);
    if (!Number.isFinite(total)) return; // dialog closed
    if (!(roll?.dice?.length > 0) && /\b20\b/.test(String(roll?.formula ?? "")) && c.craft) {
      return ui.notifications.warn("You can't take 20 on a Craft check: failing costs materials. Roll or take 10.");
    }
    const prev = r.results[key];
    r.results[key] = { total, tries: (prev?.tries ?? 0) + 1, status: "waiting", by: game.user.id };
    const fresh = foundry.utils.deepClone(reqOf(message)) ?? r; // keep other rolls made meanwhile
    fresh.results = { ...(fresh.results ?? {}), [key]: r.results[key] };
    if (fresh.rollMode === "blindroll" && !game.user.isGM) {
      fresh.note = "rolled blind; the GM resolves the result";
      return saveRequest(message, fresh);
    }
    return applyResults(message, fresh, actor);
  }

  async function onCardAction(message, action, el) {
    const r = foundry.utils.deepClone(reqOf(message));
    if (!r) return;
    const actor = await actorOf(r);
    switch (action) {
      case "approve": {
        const mode = el.closest(".axecleft-crafting-card")?.querySelector("[data-roll-mode]")?.value;
        return approveRequest(message, mode);
      }
      case "reject":
        if (!game.user.isGM) return;
        r.state = "rejected"; r.note = "";
        return saveRequest(message, r);
      case "edit":
        if (!game.user.isGM) return;
        return open({ kindId: r.kind, actor, values: r.values, message });
      case "roll":
        return rollCheck(message, el.dataset.check);
      case "resolve":
        if (!game.user.isGM) return;
        return applyResults(message, r, actor);
      case "repay": {
        if (!actor || !canRoll(message, actor)) return;
        try { await actor.update(payment(actor, r.repay ?? 0)); } catch (err) { return ui.notifications.error(err.message); }
        r.paid = { ...(r.paid ?? {}), extra: round2((r.paid?.extra ?? 0) + (r.repay ?? 0)) };
        for (const c of r.plan.checks ?? []) if (r.results?.[c.key]?.status === "ruined") r.results[c.key].status = "retry";
        r.state = "rolling"; r.note = "materials replaced; roll again"; r.repay = 0;
        return saveRequest(message, r);
      }
      case "abandon":
        if (!actor || !canRoll(message, actor)) return;
        r.state = "abandoned"; r.note = "the gp and XP spent are lost";
        return saveRequest(message, r);
    }
  }

  function onChat(message, html) {
    const root = html instanceof HTMLElement ? html : html?.[0];
    const r = reqOf(message);
    if (!root || !r) return;
    const card = root.querySelector(".axecleft-crafting-card");
    if (!card) return;
    if (!game.user.isGM) card.querySelectorAll("[data-gm-only]").forEach((e) => e.remove());
    const actor = r.actorUuid ? fromUuidSync?.(r.actorUuid) : null;
    if (!game.user.isGM && !(actor?.isOwner && message.isAuthor)) card.querySelectorAll("[data-roller]").forEach((e) => e.remove());
    card.querySelectorAll("button[data-acr]").forEach((b) => b.addEventListener("click", async (ev) => {
      ev.preventDefault();
      b.disabled = true;
      try { await onCardAction(message, b.dataset.acr, b); } catch (err) { console.error("AxecleftCrafting |", err); ui.notifications.error(err.message); }
      finally { b.disabled = false; }
    }));
  }

  /* ------------------------------------------ */
  /*  The window                                */
  /* ------------------------------------------ */
  const STYLE = `<style>
    #axecleft-crafting { max-height: calc(100vh - 16px); }
    #axecleft-crafting .window-content { overflow-y: auto; }
    .acr nav.acr-tabs { display: flex; gap: 2px; border-bottom: 1px solid var(--color-border-light-tertiary, #999); margin-bottom: 8px; flex-wrap: wrap; }
    .acr nav.acr-tabs button { flex: 1 1 auto; border-radius: 4px 4px 0 0; margin: 0; padding: 4px 6px; white-space: nowrap; }
    .acr nav.acr-tabs button.active { font-weight: bold; box-shadow: inset 0 -3px 0 var(--color-warm-1, #c9593f); }
    .acr section[data-kind] { display: none; } .acr section[data-kind].active { display: block; }
    .acr .form-group > label { flex: 0 0 9em; }
    .acr .form-group select, .acr .form-group input[type=text] { flex: 1; min-width: 0; }
    .acr .form-group input[type=number] { flex: 0 0 5em; }
    .acr .hint { font-size: 0.85em; opacity: 0.85; margin: 2px 0 6px; }
    .acr fieldset { margin: 8px 0 4px; padding: 4px 8px 6px; }
    .acr .acr-footer { display: flex; gap: 6px; margin-top: 8px; position: sticky; bottom: -1rem; padding: 6px 0 calc(1rem + 4px); background: var(--background, var(--color-cool-5, #1b1d24)); }
    .acr .acr-footer button { flex: 1; }
    .acr .acr-cb { display: inline-flex; gap: 3px; align-items: center; }
    .acr-plan { font-size: 0.92em; border: 1px solid var(--color-border-light-tertiary, #888); border-radius: 4px; padding: 4px 8px; margin: 6px 0; }
    .acr-plan .acr-name { font-size: 1.05em; } .acr-sum { opacity: 0.85; font-size: 0.92em; }
    .acr-plan .acr-time { margin: 3px 0; padding: 2px 4px; border-left: 3px solid var(--color-warm-1, #c9593f); }
    ul.acr-reqs, ul.acr-notes { list-style: none; margin: 3px 0; padding: 0; } ul.acr-reqs li { margin: 1px 0; }
    .acr-ok { color: var(--color-level-success, #2a7d2a); } .acr-no { color: var(--color-level-error, #c33); } .acr-warn { color: var(--color-level-warning, #c90); }
    .acr-help { margin: 6px 0; font-size: 0.9em; } .acr-help summary { cursor: pointer; } .acr-help blockquote { margin: 4px 0; padding: 3px 8px; border-left: 3px solid var(--color-warm-1, #c9593f); font-family: monospace; font-size: 0.95em; } .acr-help ul { margin: 4px 0 4px 1.2em; padding: 0; } .acr-help li { margin: 2px 0; }
    select.acr-src { font-size: 0.9em; height: auto; width: auto; margin-left: 4px; }
    .axecleft-crafting-card h3 { margin: 0 0 2px; font-size: 1.1em; } .axecleft-crafting-card .acr-state { margin: 4px 0; }
    .axecleft-crafting-card .acr-buttons { display: flex; gap: 4px; margin-top: 4px; } .axecleft-crafting-card button { margin-top: 3px; }
    .axecleft-crafting-card .acr-gm label { display: flex; gap: 4px; align-items: center; font-size: 0.9em; }
  </style>`;

  const myActors = () => [...(game.actors ?? [])].filter((a) => game.user.isGM ? ["character", "npc"].includes(a.type) : a.isOwner && a.type === "character")
    .sort((a, b) => a.name.localeCompare(b.name));

  let APP = existing?._app ?? null;
  const AppV2 = globalThis.foundry?.applications?.api?.ApplicationV2 ?? class {};
  class CraftingWindow extends AppV2 {
    static DEFAULT_OPTIONS = {
      id: "axecleft-crafting",
      classes: ["axecleft-crafting"],
      window: { title: "Crafting", icon: "fas fa-hammer", resizable: true },
      position: { width: 620, height: "auto" },
    };
    kindId = recall("kind", null);
    actorId = recall("actor", null);
    values = {};
    message = null;
    plan = null;
    #timer = null;

    get actor() {
      const list = myActors();
      return list.find((a) => a.id === this.actorId) ?? canvas?.tokens?.controlled?.[0]?.actor ?? game.user.character ?? list[0] ?? null;
    }
    async _renderHTML() {
      const list = kinds();
      if (!list.find((k) => k.id === this.kindId)) this.kindId = list[0]?.id ?? null;
      const actor = this.actor;
      for (const k of list) { try { await k.prepare?.({ actor }); } catch (err) { console.error(`AxecleftCrafting | ${k.id} prepare failed`, err); } }
      const actors = myActors();
      const nav = `<nav class="acr-tabs">${list.map((k) => `<button type="button" data-kind-btn="${esc(k.id)}" class="${k.id === this.kindId ? "active" : ""}"><i class="${esc(k.icon ?? "fas fa-hammer")}"></i> ${esc(k.label)}</button>`).join("")}</nav>`;
      const sections = list.map((k) => {
        let body = "";
        if (k.id === this.kindId) {
          try { body = k.content({ actor, values: this.values }) ?? ""; } catch (err) { body = `<p class="hint">This tab failed to load: ${esc(err.message)}</p>`; console.error(`AxecleftCrafting | ${k.id}`, err); }
        }
        return `<section data-kind="${esc(k.id)}" class="${k.id === this.kindId ? "active" : ""}">${body}</section>`;
      }).join("");
      const gm = game.user.isGM;
      const footer = `<div class="acr-footer">
        ${this.message ? `<button type="button" data-action-acr="update" class="bright"><i class="fas fa-floppy-disk"></i> Update the request</button>`
          : `<button type="button" data-action-acr="send" class="bright"><i class="fas fa-paper-plane"></i> ${gm ? "Send for approval" : "Send to the GM"}</button>${gm ? `<button type="button" data-action-acr="craft"><i class="fas fa-hammer"></i> Approve and craft now</button>` : ""}`}
      </div>`;
      return `${STYLE}<form class="acr" autocomplete="off">
        <div class="form-group"><label>Crafter</label><select name="acr.actor">${actors.map((a) => opt(a.id, a.name, actor?.id)).join("")}</select></div>
        ${list.length ? nav : `<p class="hint">No module offers crafting yet.</p>`}${sections}
        <div data-acr="plan"></div>
        <p class="hint">${gm ? "As GM you can override any requirement: the request card shows what is missing." : "The GM approves the request before anything is spent. The checks are rolled after approval."} Time is shown for the GM; it isn't enforced.</p>
        ${footer}</form>`;
    }
    _replaceHTML(result, content) {
      content.innerHTML = result;
      this.#wire(content.querySelector("form.acr"));
    }
    _onRender(context, options) {
      super._onRender?.(context, options);
      try {
        this.setPosition({ height: "auto" });
        const max = window.innerHeight - 16, rect = this.element.getBoundingClientRect();
        if (rect.height > max) this.setPosition({ height: max, top: 8 });
      } catch (e) { /* closing */ }
    }
    read(form) {
      const v = {};
      for (const el of form.querySelectorAll("[name^='craft.']")) {
        const k = el.name.slice(6);
        v[k] = el.type === "checkbox" ? el.checked : el.value;
      }
      return v;
    }
    #wire(form) {
      if (!form) return;
      form.querySelector('[name="acr.actor"]')?.addEventListener("change", (ev) => { this.actorId = ev.target.value; remember("actor", this.actorId); this.render(); });
      form.querySelectorAll("[data-kind-btn]").forEach((b) => b.addEventListener("click", () => { this.kindId = b.dataset.kindBtn; remember("kind", this.kindId); this.values = {}; this.render(); }));
      const kind = kindOf(this.kindId);
      const section = form.querySelector(`section[data-kind="${CSS.escape(this.kindId ?? "")}"]`);
      const refresh = () => { clearTimeout(this.#timer); this.#timer = setTimeout(() => this.#evaluate(form), 200); };
      try { kind?.wire?.(section, { actor: this.actor, values: this.values, refresh }); } catch (err) { console.error(`AxecleftCrafting | ${this.kindId} wire failed`, err); }
      (globalThis.AxecleftTools?.enhanceDatalists ?? globalThis.AxecleftTreasure?.enhanceDatalists)?.(form); // scrolling searchable lists (1.4; 1.5: Axecleft's Tools 7, for modules without the Treasure Generator)
      form.addEventListener("change", (ev) => { if (ev.target.name !== "acr.actor") refresh(); });
      form.addEventListener("input", (ev) => { if (ev.target.type === "number") refresh(); });
      form.querySelectorAll("[data-action-acr]").forEach((b) => b.addEventListener("click", async () => {
        b.disabled = true;
        try { await this.#submit(form, b.dataset.actionAcr); } catch (err) { console.error("AxecleftCrafting |", err); ui.notifications.error(err.message); }
        finally { b.disabled = false; }
      }));
      this.#evaluate(form);
    }
    async #evaluate(form) {
      const box = form.querySelector('[data-acr="plan"]');
      if (!box || !this.kindId) return;
      this.values = this.read(form);
      const actor = this.actor;
      if (!actor) { box.innerHTML = `<p class="hint">Choose a character to craft.</p>`; return; }
      try {
        this.plan = await evaluate(this.kindId, actor, this.values);
        box.innerHTML = planHTML(this.plan, { form: true, values: this.values });
      } catch (err) {
        this.plan = null;
        box.innerHTML = `<p class="acr-no"><i class="fas fa-triangle-exclamation"></i> ${esc(err.message)}</p>`;
      }
      this._onRender?.({}, {});
    }
    async #submit(form, action) {
      this.values = this.read(form);
      const actor = this.actor;
      if (!actor) throw new Error("Choose a character to craft.");
      const plan = await evaluate(this.kindId, actor, this.values);
      if (!plan.ready && !game.user.isGM) throw new Error("Some requirements aren't met (marked ✘). The GM can still approve them, but ask first.");
      if (action === "update") { await submit({ kindId: this.kindId, actor, values: this.values, plan, message: this.message }); this.message = null; return this.close(); }
      await submit({ kindId: this.kindId, actor, values: this.values, plan, approve: action === "craft" });
      ui.notifications.info(action === "craft" ? `Crafting ${plan.name}.` : `Request for ${plan.name} sent to the GM.`);
    }
  }

  function open({ kindId = null, actor = null, values = null, message = null } = {}) {
    if (!game.user.isGM && !setting("playersMayCraft")) return ui.notifications.warn("The GM hasn't opened crafting to players.");
    if (!(APP instanceof CraftingWindow)) APP = new CraftingWindow();
    api._app = APP;
    if (kindId) APP.kindId = kindId;
    if (actor) APP.actorId = actor.id;
    APP.values = values ? { ...values } : (kindId ? {} : APP.values);
    APP.message = message;
    return APP.render(true);
  }

  function registerKind(def) {
    if (!def?.module || !def?.key || typeof def.evaluate !== "function" || typeof def.content !== "function") return console.error("AxecleftCrafting | registerKind() needs module, key, content and evaluate", def);
    registry.kinds.set(`${def.module}.${def.key}`, { icon: "fas fa-hammer", order: 100, ...def, id: `${def.module}.${def.key}` });
  }

  /* ------------------------------------------ */
  /*  SRD construction lines (version 1.2)      */
  /* ------------------------------------------ */

  /** The item creation feats (D35E's Feats compendium names) and their SRD minimum caster levels. */
  const CREATION_FEATS = {
    "scribe scroll": 1, "brew potion": 3, "craft wondrous item": 3, "craft magic arms and armor": 5, "craft wand": 5,
    "craft rod": 9, "forge ring": 12, "craft staff": 12,
    "imprint stone": 1, "scribe tattoo": 3, "craft universal item": 3, "craft cognizance crystal": 3, "craft psionic arms and armor": 5,
    "craft dorje": 5, "craft psicrown": 12, "craft construct": 5, "craft psionic construct": 5,
    "craft epic wondrous item": 0, "forge epic ring": 0, "craft epic rod": 0, "craft epic staff": 0, "craft epic magic arms and armor": 0, "scribe epic scroll": 0, "craft epic universal item": 0,
  };
  /** Typos and plurals in D35E's texts. */
  const FEAT_ALIAS = { "create wondrous item": "Craft Wondrous Item", "craft wondrous items": "Craft Wondrous Item" };
  const WORDNUM = { two: 2, twice: 2, three: 3, thrice: 3, four: 4 };
  const ROMAN = /^(i|ii|iii|iv|v|vi|vii|viii|ix|x)$/i;

  /** Plain text of an item description: links ("@UUID[...]{Fireball}") become their labels. */
  function plainText(html) {
    return String(html ?? "")
      .replace(/@UUID\[[^\]]*\]\{([^}]*)\}/g, "$1").replace(/@Compendium\[[^\]]*\]\{([^}]*)\}/g, "$1")
      .replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&#39;|&rsquo;/g, "'")
      .replace(/\s+/g, " ").trim();
  }
  /** D35E items whose text lives on another item: "@LinkedDescription[Compendium.D35E.magicitems.Item.xxx]". */
  const linkedDescription = (html) => String(html ?? "").match(/@LinkedDescription\[([^\]]+)\]/)?.[1] ?? null;

  /** Pick the caster level for this version of the item ("Ring of Wizardry III" → the "( III )" entry). */
  function pickCl(options, itemName) {
    if (options.length <= 1 || !itemName) return options[0]?.cl ?? null;
    // Score each version's label against the item's name: every number or roman numeral must match; other words add to the score
    const words = new Set(normName(itemName).split(" "));
    let best = null, bestScore = -1;
    for (const o of options) {
      const toks = normName(o.label).split(/\s+/).filter((x) => x && x !== "or");
      if (!toks.length) continue;
      if (toks.some((x) => (/\d/.test(x) || ROMAN.test(x)) && !words.has(x))) continue;
      const score = toks.filter((x) => words.has(x)).length;
      if (score > bestScore) { best = o; bestScore = score; }
    }
    return (best ?? options[0]).cl;
  }

  /**
   * Parse the construction line. spell(name) returns the spell's (or power's) canonical name or null; isFeat(name) says
   * whether a name is a feat. Returns null when the description has no caster level line.
   */
  function parsePrereqs(html, { spell = () => null, isFeat = () => false, itemName = "" } = {}) {
    const t = plainText(html);
    let m = t.match(/(?:\bCL\b|\bML\b|Caster Level:?|Manifester Level:?)\s*((?:\d+(?:st|nd|rd|th)?\s*(?:\([^)]*\))?\s*,?\s*(?:or\s+)?)+);\s*(?:Prerequisites?:\s*)?([^;]*?)\s*(?:;|$)/i);
    // Some epic items give only "Prerequisites: …" with no caster level
    if (!m) { const p = t.match(/Prerequisites?:\s*([^;]*?)\s*(?:;|$)/i); if (p) m = [p[0], "", p[1]]; }
    if (!m) return null;
    const options = [...m[1].matchAll(/(\d+)(?:st|nd|rd|th)?\s*(?:\(\s*([^)]*?)\s*\))?/g)].map((x) => ({ cl: Number(x[1]), label: x[2] ?? "" }));
    const out = { cl: pickCl(options, itemName) ?? null, feats: [], spells: [], align: [], skills: [], minLevel: null, minCl: null, race: null, factor: null, other: [], text: m[2].trim(), cost: null };
    const cost = t.match(/\bCost(?:\s+to\s+Create)?:?\s+([\d,]+(?:\.\d+)?)\s*gp\s*\+\s*([\d,]+)\s*XP/i);
    // The statblock's price (1.3): "Price 22,400 gp" or one per version, "Price 2,000 gp ( ring +1 ), 8,000 gp ( ring +2 )"
    const pm = t.match(/\b(?:Market\s+)?Price:?\s*((?:[\d,]+(?:\s*gp)?\s*(?:\([^)]*\))?\s*,?\s*(?:or\s+)?)+)/i);
    if (pm) {
      const prices = [...pm[1].matchAll(/([\d,]+)(?:\s*gp)?\s*(?:\(\s*([^)]*?)\s*\))?/g)].map((x) => ({ cl: Number(x[1].replace(/,/g, "")), label: x[2] ?? "" })).filter((x) => x.cl > 0);
      out.price = prices.length === 1 ? prices[0].cl : prices.length ? pickCl(prices, itemName) : null;
      if (prices.length > 1 && !prices.some((x) => x.label)) out.price = null;
    }
    if (cost) out.cost = { gp: Number(cost[1].replace(/,/g, "")), xp: Number(cost[2].replace(/,/g, "")) };
    // Split on commas outside parentheses
    const parts = [];
    let depth = 0, cur = "";
    for (const ch of m[2]) {
      if (ch === "(") depth++;
      if (ch === ")") depth = Math.max(0, depth - 1);
      if (ch === "," && depth === 0) { parts.push(cur); cur = ""; } else cur += ch;
    }
    parts.push(cur);
    let lastSpellGroup = null;
    for (let raw of parts) {
      raw = raw.trim().replace(/\.$/, "");
      if (!raw || /^(weight|price|market price|in effect)\b/i.test(raw)) continue;
      const or = /^or\s+/i.test(raw);
      const p = raw.replace(/^(or|and)\s+/i, "").trim();
      // Feats first (a feat is never a spell name)
    const featName = FEAT_ALIAS[normName(p)] ?? p.replace(/\s+feat$/i, "");
      if (CREATION_FEATS[normName(featName)] !== undefined || isFeat(featName)) { out.feats.push(featName); continue; }
    // Spells: "x", "x or y", "heightened x" (the spell x)
      const alts = p.split(/\s+or\s+/i).map((s) => s.trim()).filter(Boolean);
      const found = alts.map((a) => spell(a) ?? spell(a.replace(/^(heightened|improved heightened|maximized|empowered|extended|quickened)\s+/i, "")));
      if (found.length && found.every(Boolean)) {
        if (or && lastSpellGroup) lastSpellGroup.push(...found);
        else { lastSpellGroup = [...found]; out.spells.push(lastSpellGroup); }
        continue;
      }
      lastSpellGroup = null;
        let x;
      if ((x = p.match(/^(?:creator|caster|crafter)\s+must\s+be\s+(lawful|chaotic|good|evil)(?:\s+and\s+(lawful|chaotic|good|evil))?$/i))) { out.align.push(x[1].toLowerCase()); if (x[2]) out.align.push(x[2].toLowerCase()); continue; }
      if (/^(good|evil|lawful|chaotic)$/i.test(p)) { out.align.push(p.toLowerCase()); continue; }
      if ((x = p.match(/must have (\d+) ranks in (?:the )?(.+?)(?: skill)?$/i))) { out.skills.push({ ranks: Number(x[1]), skill: x[2].trim() }); continue; }
      if ((x = p.match(/must be (?:at least )?(\d+)(?:st|nd|rd|th) level$/i))) { out.minLevel = Number(x[1]); continue; }
      if ((x = p.match(/must be caster level (\d+)/i))) { out.minCl = Number(x[1]); continue; }
      if ((x = p.match(/^creator must be an? (elf|dwarf|gnome|halfling|half-elf|half-orc|human|triton)\b/i))) { out.race = x[1]; out.other.push(p); continue; }
      if ((x = p.match(/\b(?:(two|three|four) times|(twice|thrice))\b/i)) && /bonus/i.test(p)) { out.factor = WORDNUM[(x[1] ?? x[2]).toLowerCase()]; continue; }
      out.other.push(p);
    }
    return out;
  }

  /**
   * The collapsible help that explains the construction line (shown on the crafting tabs that read it).
   * what: "items" (rings, rods, staffs, wondrous items) | "abilities" (special abilities for arms and armor).
   */
  /** Help for specific magic arms (1.3): the same line, plus the Cost that separates the masterwork item. */
  function prereqHelpArms(thing) {
    return `<details class="acr-help"><summary><i class="fas fa-circle-question"></i> How requirements are found (making ${esc(thing)} craftable)</summary>
      <p>Crafting reads the <strong>SRD construction line</strong> at the end of the item's description, as every SRD specific weapon and armor has:</p>
      <blockquote>Moderate evocation; CL 12th; Craft Magic Arms and Armor, scorching ray, and flame blade, flame strike, or fireball; Price 20,715 gp; Cost 10,515 gp + 816 XP.</blockquote>
      <ul>
        <li><strong>CL 12th;</strong> is needed, followed by a semicolon (<em>Caster Level: 12th;</em> works too). The crafter's caster level must also be at least 3 × the item's enhancement bonus (SRD).</li>
        <li>The <strong>requirements</strong> follow, separated by commas, up to the next semicolon: the feat, spells (must match your Spell sources; <strong>or</strong> means either), and <em>creator must be good</em> (lawful, chaotic, evil), <em>… ranks in …</em>, <em>… level</em>, <em>creator must be a dwarf</em>. Anything else is listed for the GM (<i class="fas fa-triangle-exclamation acr-warn"></i>).</li>
        <li><strong>Price</strong> is read too, and used when the compendium's price is missing or wrong.</li>
        <li><strong>Cost X gp + Y XP</strong> splits the price the SRD way: the XP gives the magic's base price (XP × 25), and the rest of the gp is the masterwork item (and special material) the crafter supplies. Without a Cost, the whole price counts as the magic, a little more than the SRD would charge.</li>
        <li>The item must be in a compendium the generators read (Item Sources tab, or D35E's Magic Items). Without a construction line it can still be made, but the GM decides what it needs.</li>
      </ul></details>`;
  }

  function prereqHelp(what = "items") {
    const thing = what === "abilities" ? "a custom special ability (an enhancement item)" : what === "arms" ? "a custom specific weapon, armor or shield" : "a custom ring, rod, staff or wondrous item";
    if (what === "arms") return prereqHelpArms(thing);
    const example = what === "abilities"
      ? "Moderate evocation; CL 10th; Craft Magic Arms and Armor, flame blade, flame strike or fireball; Price +1 bonus."
      : "Faint evocation; CL 5th; Craft Wondrous Item, fireball, resist energy or protection from energy; Price 12,000 gp";
    return `<details class="acr-help"><summary><i class="fas fa-circle-question"></i> How requirements are found (making ${esc(thing)} craftable)</summary>
      <p>Crafting reads the <strong>SRD construction line</strong> at the end of the item's description, the same line every SRD item has. To make ${esc(thing)} craftable, end its description with one:</p>
      <blockquote>${esc(example)}</blockquote>
      <ul>
        <li><strong>CL 5th;</strong> is needed, followed by a semicolon. <em>Caster Level: 5th;</em> works too, and <em>ML</em> for psionic items. One caster level per version also works: <em>CL 11th (I), 14th (II)</em> picks the one in the item's name.</li>
        <li>The <strong>requirements</strong> come next, separated by commas, up to the next semicolon. <em>Prerequisites:</em> in front of them is fine.</li>
        <li><strong>Spells and powers</strong> must match a name in your Spell or Power sources (capitals don't matter; "greater magic fang" finds "Magic Fang, Greater"). <strong>or</strong> between names means either will do.</li>
        <li><strong>Feats</strong> are found by name: the item creation feats and any feat in a compendium called Feats.</li>
        <li>Also understood: <em>creator must be good</em> (lawful, chaotic, evil) · <em>creator must have 5 ranks in Jump</em> · <em>creator must be 12th level</em> · <em>creator must be caster level 11th</em> · <em>creator must be an elf</em> · <em>caster level at least three times the bonus</em> (the +N in the item's name).</li>
        <li>Anything else is listed for the GM to check (<i class="fas fa-triangle-exclamation acr-warn"></i>).</li>
        <li><strong>Cost 1,250 gp + 5,100 XP</strong> anywhere in the description replaces the usual cost (half the price in gp, 1/25 in XP).</li>
        <li>${what === "abilities" ? "The ability must be in a compendium chosen as an Enhancements source (Item Sources tab)." : "The item needs a price above 0 and must be in a compendium the generators read (Item Sources tab, or D35E's Magic Items)."} Without a construction line it can still be made, but the GM decides what it needs.</li>
      </ul></details>`;
  }

  const api = {
    version: AXECLEFT_CRAFTING_VERSION, registry, hosts, _app: APP,
    registerKind, kinds, evaluate, finishPlan, planHTML, cardHTML, submit, open, setting,
    parsePrereqs, plainText, linkedDescription, CREATION_FEATS, prereqHelp,
    actor: actorInfo, payment, outcome,
    _approve: approveRequest, _roll: rollCheck, _action: onCardAction, _apply: applyResults, _onChat: onChat, _registerSettings: registerSettings,
    _onInit() {
      registerSettings();
      globalThis.AxecleftTools?.register({
        module: host() ?? "axecleft-crafting", name: "crafting", title: "Crafting", icon: "fas fa-hammer",
        hint: "Craft items by the SRD: magic items with item creation feats, mundane items with Craft", gmOnly: false,
        onClick: () => globalThis.AxecleftCrafting.open(),
      });
      Hooks.callAll("axecleftCrafting.ready", globalThis.AxecleftCrafting);
    },
  };
  globalThis.AxecleftCrafting = api;

  if (!existing && globalThis.Hooks) {
    Hooks.once("init", () => globalThis.AxecleftCrafting._onInit());
    Hooks.on("renderChatMessageHTML", (m, h) => globalThis.AxecleftCrafting._onChat(m, h));
  }
})();
