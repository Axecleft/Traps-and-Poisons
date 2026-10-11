/**
 * Axecleft's Tools — shared menu for Axecleft's modules.
 *
 * Copy this same file into every Axecleft module and load it BEFORE the
 * module's own scripts (list it first under "esmodules" in module.json).
 *
 * Whichever module loads first creates the menu; every other active module
 * adds its own tools to it. The menu is its own "Axecleft's Tools" group on
 * the left toolbar (next to Game Master Tools); each tool is a button in it.
 *
 * Registering a tool (from any module, at load time or in an "init" hook):
 *
 *   globalThis.AxecleftTools.register({
 *     module: "traps-and-poisons",            // your module id
 *     name:   "random-trap",                  // unique within your module
 *     title:  "Random Trap Generator",        // menu label
 *     icon:   "fas fa-dice-d20",              // Font Awesome icon, or...
 *     img:    "icons/svg/trap.svg",           // ...an image (SVG works best); used instead of icon
 *     hint:   "Roll a random trap by CR",     // optional tooltip
 *     gmOnly: true,                           // optional, default true
 *     onClick: () => { ... }                  // what the tool does
 *   });
 *
 * Searchable lists (version 7): AxecleftTools.enhanceDatalists(root) turns every <input list="…"> inside root
 * into a list that scrolls and stays on screen (the browser's own <datalist> popup doesn't scroll in Foundry).
 *
 * English names (version 8), for worlds in other languages (Babele-translated compendiums, items named in French…):
 *   AxecleftTools.enName(docOrIndexEntry, { pack })  → the item's English name. In order: our own flag (flags.world.axecleftEn),
 *     Babele's original name (flags.babele.originalName), an "en:Bastard Sword" tag, the English key in the Babele
 *     translation of its compendium, else its own name.
 *   await AxecleftTools.enIndex(pack, { fields })     → the compendium index as copies whose name is English
 *     (display: the name as shown), so name matching works in any language.
 *   AxecleftTools.classEn("Magicien")                  → "Wizard" (class names in translated spell lists).
 *   AxecleftTools.registerEnglishNames(module, names)  → names offered when a user gives an item its English name.
 * In a world not in English, naming or renaming an item asks for its English name (optional; Skip / Don't ask again),
 * and item sheets get an "English name" header button.
 *
 * If two modules ship different versions of this file, the newest one wins.
 */
const AXECLEFT_TOOLS_VERSION = 8;

(() => {
  const LAYER = "axecleftTools";
  const existing = globalThis.AxecleftTools;
  if (existing && existing.version >= AXECLEFT_TOOLS_VERSION) return;

  const tools = existing?.tools ?? new Map();
  const esc = (v) => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  /* Searchable lists (version 7; the same code as the Treasure Generator's, for modules that don't ship it) */
  const COMBO_CSS = `.axecleft-combo { position: fixed; z-index: 100000; overflow-y: auto; min-width: 160px; background: var(--color-bg-option, #1f2029); color: var(--color-text-primary, #e8e6e3);
      border: 1px solid var(--color-border-highlight, #ff6400); border-radius: 4px; box-shadow: 0 4px 14px rgba(0,0,0,0.55); font-size: var(--font-size-13, 13px); padding: 2px 0; }
    .axecleft-combo div { padding: 3px 8px; cursor: pointer; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .axecleft-combo div.active, .axecleft-combo div:hover { background: var(--color-warm-2, #a33b24); color: #fff; }
    .axecleft-combo div.none { opacity: 0.7; cursor: default; font-style: italic; } .axecleft-combo div.none:hover { background: none; color: inherit; }
    .axecleft-combo mark { background: none; color: inherit; font-weight: bold; text-decoration: underline; }`;
  let comboEl = null, comboFor = null, comboActive = -1;
  function comboBox() {
    if (comboEl?.isConnected) return comboEl;
    if (!document.getElementById("axecleft-combo-css")) {
      const st = document.createElement("style"); st.id = "axecleft-combo-css"; st.textContent = COMBO_CSS; document.head.append(st);
    }
    comboEl = document.createElement("div");
    comboEl.className = "axecleft-combo";
    comboEl.style.display = "none";
    comboEl.addEventListener("mousedown", (ev) => ev.preventDefault()); // keep focus in the text box
    document.body.append(comboEl);
    // Close when anything else scrolls (the box would drift away from its text box) or the window resizes
    document.addEventListener("scroll", (ev) => { if (comboFor && ev.target !== comboEl && !comboEl.contains(ev.target)) comboClose(); }, true);
    window.addEventListener("resize", () => comboClose());
    return comboEl;
  }
  function comboClose() { if (comboEl) comboEl.style.display = "none"; comboFor = null; comboActive = -1; }
  function comboItems() { return comboEl ? [...comboEl.querySelectorAll("div[data-v]")] : []; }
  function comboMark(i) {
    const items = comboItems();
    items.forEach((x, n) => x.classList.toggle("active", n === i));
    comboActive = i;
    items[i]?.scrollIntoView({ block: "nearest" });
  }
  function comboPick(input, value) {
    input.value = value;
    comboClose();
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }
  function comboOpen(input, filter) {
    const box = comboBox();
    const all = input._axcOptions?.() ?? [];
    const q = filter ? String(input.value ?? "").trim().toLowerCase() : "";
    const hits = q ? all.filter((v) => v.toLowerCase().includes(q)) : all;
    const LIMIT = 400;
    const shown = hits.slice(0, LIMIT);
    const hi = (v) => {
      if (!q) return esc(v);
      const i = v.toLowerCase().indexOf(q);
      return `${esc(v.slice(0, i))}<mark>${esc(v.slice(i, i + q.length))}</mark>${esc(v.slice(i + q.length))}`;
    };
    box.innerHTML = shown.map((v) => `<div data-v="${esc(v)}" title="${esc(v)}">${hi(v)}</div>`).join("")
      + (hits.length > LIMIT ? `<div class="none">${hits.length - LIMIT} more — type to narrow the list</div>` : "")
      + (!hits.length ? `<div class="none">${all.length ? "No match" : "Nothing to choose from"}</div>` : "");
    box.querySelectorAll("div[data-v]").forEach((el) => el.addEventListener("click", () => comboPick(input, el.dataset.v)));
    // Below the text box, or above it when there's more room there; never past the screen's edge
    const r = input.getBoundingClientRect(), gap = 6, MAX = 320;
    const below = window.innerHeight - r.bottom - gap, above = r.top - gap;
    const down = below >= Math.min(MAX, 180) || below >= above;
    box.style.display = "block";
    box.style.left = `${Math.max(4, Math.min(r.left, window.innerWidth - Math.max(r.width, 160) - 4))}px`;
    box.style.width = `${Math.max(r.width, 160)}px`;
    box.style.maxHeight = `${Math.max(80, Math.min(MAX, down ? below : above))}px`;
    if (down) { box.style.top = `${r.bottom + 2}px`; box.style.bottom = ""; }
    else { box.style.top = ""; box.style.bottom = `${window.innerHeight - r.top + 2}px`; }
    box.scrollTop = 0;
    comboFor = input;
    comboActive = -1;
    const exact = shown.findIndex((v) => v === input.value);
    if (exact >= 0) comboMark(exact);
  }
  /** Turn every <input list="…"> inside root into a scrolling searchable list. */
  function enhanceDatalists(root) {
    if (!root?.querySelectorAll) return;
    for (const input of root.querySelectorAll("input[list]")) {
      if (input._axcOptions) continue;
      const id = input.getAttribute("list");
      const find = () => root.querySelector?.(`datalist#${CSS.escape(id)}`) ?? document.getElementById(id);
      input._axcOptions = () => [...(find()?.options ?? [])].map((o) => o.value).filter(Boolean);
      input.dataset.list = id;
      input.removeAttribute("list");
      input.setAttribute("autocomplete", "off");
      input.addEventListener("dblclick", () => comboOpen(input, false));
      input.addEventListener("click", () => { if (comboFor !== input && !input.value) comboOpen(input, false); });
      input.addEventListener("input", (ev) => { if (ev.isTrusted) comboOpen(input, true); }); // typing filters; our own picks don't reopen it
      input.addEventListener("blur", () => setTimeout(() => { if (comboFor === input) comboClose(); }, 120));
      input.addEventListener("keydown", (ev) => {
        const open = comboFor === input && comboEl?.style.display !== "none";
        if (ev.key === "ArrowDown" || ev.key === "ArrowUp") {
          ev.preventDefault();
          if (!open) { comboOpen(input, false); return; }
          const n = comboItems().length;
          if (n) comboMark(ev.key === "ArrowDown" ? (comboActive + 1) % n : (comboActive - 1 + n) % n);
        } else if (ev.key === "Enter" && open && comboActive >= 0) {
          ev.preventDefault();
          comboPick(input, comboItems()[comboActive].dataset.v);
        } else if (ev.key === "Escape" && open) { ev.preventDefault(); ev.stopPropagation(); comboClose(); }
        else if (ev.key === "Tab") comboClose();
      });
    }
  }

  /* ---------- English names (version 8) ---------- */
  const enNorm = (s) => String(s ?? "").toLowerCase().normalize("NFC").replace(/[’']/g, "'").replace(/[^\p{L}\p{N}']+/gu, " ").trim();
  const babeleMaps = new Map(); // pack id -> Map(normalized translated name -> English name)
  const englishNames = existing?.englishNames ?? new Map(); // module -> [names]
  function babeleEntries(packId) {
    const b = globalThis.game?.babele;
    if (!b || !packId) return null;
    try {
      const tc = b.packs?.get?.(packId);
      if (tc?.translations) return tc.translations;
      const t = (Array.isArray(b.translations) ? b.translations : []).find((x) => x.collection === packId);
      return t?.entries ?? null;
    } catch (e) { return null; }
  }
  function babeleMap(packId) {
    if (!packId) return null;
    if (babeleMaps.has(packId)) return babeleMaps.get(packId);
    const entries = babeleEntries(packId);
    const map = new Map();
    if (entries) {
      const list = Array.isArray(entries) ? entries.map((e) => [e.id ?? e.name, e]) : Object.entries(entries);
      for (const [key, v] of list) if (key && v?.name) map.set(enNorm(v.name), key);
    }
    if (globalThis.game?.babele) babeleMaps.set(packId, map);
    return map;
  }
  const packOf = (x, pack) => pack ?? x?.pack ?? x?.compendium?.collection
    ?? String(x?._stats?.compendiumSource ?? x?.flags?.core?.sourceId ?? x?.uuid ?? "").match(/^Compendium\.([^.]+\.[^.]+)\./)?.[1] ?? null;
  const tagEn = (x) => {
    for (const t of Array.isArray(x?.system?.tags) ? x.system.tags : []) {
      const txt = String(Array.isArray(t) ? t[0] : t ?? "").trim();
      if (/^en\s*:/i.test(txt)) return txt.replace(/^en\s*:\s*/i, "").trim() || null;
    }
    return null;
  };
  /** The English name of an item, an index entry or item data (see the header). */
  function enName(x, { pack = null } = {}) {
    if (!x) return "";
    const f = x.flags ?? {};
    const own = f.world?.axecleftEn ?? f.axecleft?.en ?? foundry.utils?.getProperty?.(x, "flags.world.axecleftEn");
    if (own) return own;
    const orig = f.babele?.originalName ?? foundry.utils?.getProperty?.(x, "flags.babele.originalName");
    if (orig) return orig;
    const tag = tagEn(x);
    if (tag) return tag;
    const hit = babeleMap(packOf(x, pack))?.get(enNorm(x.name));
    return hit ?? x.name ?? "";
  }
  const INDEX_EXTRA = ["flags.babele.originalName", "flags.world.axecleftEn", "system.tags"];
  /** A compendium's index with English names: [{ ...entry, name: English, display: shown name }]. */
  async function enIndex(pack, { fields = [] } = {}) {
    const index = await pack.getIndex({ fields: [...new Set([...fields, ...INDEX_EXTRA])] });
    return [...index].map((e) => { const en = enName(e, { pack: pack.collection }); return en === e.name ? { ...e, display: e.name } : { ...e, name: en, display: e.name }; });
  }
  let classMap = null;
  /** A class name in English ("Magicien" -> "Wizard"), from the Babele translations of the classes compendiums. */
  function classEn(name) {
    if (!globalThis.game?.babele) return name;
    if (!classMap) {
      classMap = new Map();
      for (const pack of game.packs ?? []) {
        if (pack.documentName !== "Item" || !/class/i.test(pack.collection) || /abilit|feature/i.test(pack.collection)) continue;
        for (const [k, v] of babeleMap(pack.collection) ?? []) classMap.set(k, v);
      }
    }
    return classMap.get(enNorm(name)) ?? name;
  }
  Hooks.on("babele.ready", () => { babeleMaps.clear(); classMap = null; });

  /* English name prompt: worlds not in English */
  const ASK_KEY = "axecleft-tools.askEnglish";
  const ASK_TYPES = new Set(["weapon", "equipment", "consumable", "loot", "spell", "feat", "enhancement", "material", "container"]);
  const askOff = () => { try { return localStorage.getItem(ASK_KEY) === "off"; } catch (e) { return false; } };
  const nonEnglish = () => !/^en\b/i.test(globalThis.game?.i18n?.lang ?? "en");
  const hasEnglish = (item) => !!(item.flags?.world?.axecleftEn || item.flags?.babele?.originalName || tagEn(item));
  function knownEnglish() {
    const out = new Set();
    for (const list of englishNames.values()) for (const n of list) out.add(n);
    try { for (const pack of game.packs ?? []) if (pack.documentName === "Item") for (const v of babeleMap(pack.collection)?.values() ?? []) out.add(v); } catch (e) { /* none */ }
    return [...out].sort((a, b) => a.localeCompare(b));
  }
  async function askEnglishName(item, { force = false } = {}) {
    if (!force && (askOff() || hasEnglish(item))) return;
    const DV = foundry.applications?.api?.DialogV2;
    const current = item.flags?.world?.axecleftEn ?? "";
    const listId = `axecleft-en-${item.id}`;
    const content = `<p>What is <strong>${esc(item.name)}</strong> called in English? Axecleft's modules (treasure, merchants, crafting) recognize items by their English name. Optional.</p>
      <div class="form-group"><label>English name</label><input type="text" name="en" list="${listId}" value="${esc(current)}" autofocus><datalist id="${listId}">${knownEnglish().map((n) => `<option value="${esc(n)}">`).join("")}</datalist></div>`;
    let res = null;
    if (DV) {
      const buttons = [{ action: "save", label: "Save", icon: "fas fa-check", default: true, callback: (ev, btn) => ({ action: "save", en: btn.form.elements.en?.value }) },
        { action: "skip", label: "Skip", icon: "fas fa-forward" }];
      if (!force) buttons.push({ action: "never", label: "Don't ask again", icon: "fas fa-ban" });
      const p = DV.wait({ window: { title: "English name" }, content, buttons, rejectClose: false, render: (ev, dlg) => { try { api.enhanceDatalists(dlg.element ?? dlg); } catch (e) { /* plain list */ } } });
      res = await p;
    } else {
      // Foundry v11: the classic Dialog
      res = await new Promise((resolve) => new Dialog({ title: "English name", content: `<form>${content}</form>`,
        buttons: { save: { label: "Save", callback: (html) => resolve({ action: "save", en: html.find('[name="en"]').val() }) }, skip: { label: "Skip", callback: () => resolve(null) },
          ...(force ? {} : { never: { label: "Don't ask again", callback: () => resolve("never") } }) }, default: "save", close: () => resolve(null) }).render(true));
    }
    if (res === "never" || res?.action === "never") { try { localStorage.setItem(ASK_KEY, "off"); } catch (e) { /* private mode */ } ui.notifications.info("Axecleft: you won't be asked for English names again (the item sheet's English name button still works)."); return; }
    if (res?.action !== "save") return;
    const en = String(res.en ?? "").trim();
    await item.update(en ? { "flags.world.axecleftEn": en } : { "flags.world.-=axecleftEn": null }, { axecleftEnglish: true });
  }
  if (!existing || (existing.version ?? 0) < 8) {
    // A person creating an item (Foundry's Create Item dialog opens its sheet), not a module or an import
    Hooks.on("createItem", (item, options, userId) => {
      const T = globalThis.AxecleftTools;
      if (userId !== game.user?.id || !nonEnglish() || !ASK_TYPES.has(item.type) || options?.renderSheet !== true) return;
      if (options?.axecleftEnglish || options?.curiosInternal || item._stats?.compendiumSource || item.flags?.core?.sourceId) return;
      if (!item.name || /^(new|nouvel|nouveau|nueva?o?|novo|nova)\b/i.test(item.name)) return; // default name: asked when it's renamed
      T.askEnglishName(item);
    });
    // A person renaming an item (modules rename with their own options, which are skipped)
    Hooks.on("updateItem", (item, changes, options, userId) => {
      const T = globalThis.AxecleftTools;
      if (userId !== game.user?.id || !nonEnglish() || changes?.name === undefined || options?.axecleftEnglish || options?.curiosInternal || options?.axecleft || !ASK_TYPES.has(item.type)) return;
      if (item._stats?.compendiumSource || item.flags?.core?.sourceId) return;
      T.askEnglishName(item);
    });
    const headerButton = (sheet, buttons) => {
      const item = sheet.document ?? sheet.item ?? sheet.object;
      if (!nonEnglish() || !item || item.documentName !== "Item" || !item.isOwner) return;
      buttons.unshift({ label: "English name", class: "axecleft-en", icon: "fas fa-language", onclick: () => globalThis.AxecleftTools.askEnglishName(item, { force: true }) });
    };
    Hooks.on("getItemSheetHeaderButtons", headerButton);
    // Foundry v13+ ApplicationV2 sheets
    Hooks.on("getHeaderControlsItemSheet", (sheet, controls) => {
      const item = sheet.document;
      if (!nonEnglish() || !item?.isOwner) return;
      controls.unshift({ label: "English name", icon: "fas fa-language", action: "axecleftEnglish", onClick: () => globalThis.AxecleftTools.askEnglishName(item, { force: true }) });
    });
  }


  const api = {
    version: AXECLEFT_TOOLS_VERSION,
    tools,
    enhanceDatalists,
    englishNames, enName, enIndex, classEn, enNorm, askEnglishName,
    registerEnglishNames(module, names) { englishNames.set(module, [...new Set((names ?? []).filter(Boolean))]); },

    /** Add (or replace) a tool in the shared menu. */
    register(tool) {
      if (!tool?.module || !tool?.name || typeof tool.onClick !== "function") {
        console.error("AxecleftTools | register() needs module, name and onClick", tool);
        return;
      }
      const entry = { gmOnly: true, icon: "fas fa-wrench", ...tool };
      if (tool.img) entry.icon = api.imageIcon(tool.img);
      tools.set(`${tool.module}.${tool.name}`, entry);
    },

    /**
     * Turn an image path into an icon class. The image is drawn as a mask in the
     * button's text colour, so it follows the toolbar's normal/active colours.
     */
    imageIcon(img) {
      const cls = "axecleft-img-" + [...img].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7).toString(36);
      if (!document.getElementById(cls)) {
        const url = img.startsWith("/") || /^https?:/.test(img) ? img : `/${img}`;
        const style = document.createElement("style");
        style.id = cls;
        style.textContent = `.${cls}::before { content: ""; display: inline-block; width: 1em; height: 1em; vertical-align: -0.125em;
          background-color: currentColor; -webkit-mask: url("${url}") center / contain no-repeat; mask: url("${url}") center / contain no-repeat; }`;
        document.head.append(style);
      }
      return `fa-fw ${cls}`;
    },

    /** Remove a tool. */
    unregister(module, name) { tools.delete(`${module}.${name}`); },

    /** Tools the current user may use. */
    available() {
      return [...tools.values()].filter((t) =>
        (!t.gmOnly || game.user?.isGM) && (game.modules.get(t.module)?.active ?? true));
    },

    /** Open the menu of tools. */
    async openMenu() {
      const list = api.available();
      if (!list.length) return ui.notifications.info("No Axecleft tools are available.");
      const moduleTitle = (id) => game.modules.get(id)?.title ?? id;
      list.sort((a, b) => moduleTitle(a.module).localeCompare(moduleTitle(b.module)) || a.title.localeCompare(b.title));
      const { DialogV2 } = foundry.applications.api;
      const choice = await DialogV2.wait({
        window: { title: "Axecleft's Tools", icon: "fas fa-toolbox" },
        classes: ["axecleft-tools-menu"],
        position: { width: 340 },
        content: `<style>
            .axecleft-tools-menu .form-footer { flex-direction: column; gap: 4px; }
            .axecleft-tools-menu .form-footer button { justify-content: flex-start; width: 100%; }
          </style>
          <p>Choose a tool:</p>`,
        rejectClose: false,
        buttons: list.map((t) => ({
          action: `${t.module}.${t.name}`,
          icon: t.icon,
          label: `${t.title} — ${moduleTitle(t.module)}`,
        })),
      });
      const tool = choice && tools.get(choice);
      if (tool) {
        try { await tool.onClick(); }
        catch (err) { console.error(`AxecleftTools | ${choice} failed`, err); ui.notifications.error(`${tool.title} failed: ${err.message}`); }
      }
    },

    /** Add the "Axecleft's Tools" group to the scene controls (called from the hook). */
    addControls(controls) {
      const list = api.available();
      if (!list.length) return;
      const moduleTitle = (id) => game.modules.get(id)?.title ?? id;
      list.sort((a, b) => moduleTitle(a.module).localeCompare(moduleTitle(b.module)) || a.title.localeCompare(b.title));
      const group = { name: "axecleft", title: "Axecleft's Tools", icon: "fas fa-toolbox", layer: "tokens", activeTool: "select", visible: true };
      // Foundry needs a selectable "select" tool in every group; it just keeps token selection active.
      const select = { name: "select", title: "Select Tokens", icon: "fas fa-expand", button: false };
      const run = (t) => async () => {
        try { await t.onClick(); }
        catch (err) { console.error(`AxecleftTools | ${t.module}.${t.name} failed`, err); ui.notifications.error(`${t.title} failed: ${err.message}`); }
      };
      const buttons = list.map((t) => ({ name: `${t.module}--${t.name}`, title: t.hint ? `${t.title}: ${t.hint}` : t.title, icon: t.icon, button: true, visible: true, run: run(t) }));

      if (Array.isArray(controls)) {
        // Foundry v11/v12: array of groups, array of tools. The group needs its own
        // canvas layer: on a shared layer (like tokens) Foundry switches back to the
        // group that owns that layer and our buttons never show.
        if (controls.some((c) => c.name === group.name)) return;
        const layer = CONFIG.Canvas?.layers?.[LAYER] ? LAYER : "tokens";
        controls.push({ ...group, layer,
          tools: [{ ...select, title: "Axecleft's Tools" }, ...buttons.map(({ run, ...b }) => ({ ...b, onClick: run }))] });
        return;
      }
      // Foundry v13+: object of groups, object of tools
      const order = Math.max(0, ...Object.values(controls).map((c) => c.order ?? 0)) + 1;
      const tools = { select: { ...select, order: 1, onChange: () => {} } };
      buttons.forEach(({ run, ...b }, i) => { tools[b.name] = { ...b, order: i + 2, onChange: run }; });
      controls[group.name] = { ...group, order, tools };
    },
  };

  globalThis.AxecleftTools = api;

  // Foundry v11/v12: register the toolbar group's own (empty) canvas layer before the canvas is built.
  Hooks.once("init", () => {
    const layers = CONFIG.Canvas?.layers;
    // Foundry v11 core classes are global names but not properties of globalThis, so use typeof.
    const Base = typeof InteractionLayer !== "undefined" ? InteractionLayer : null;
    if (!layers || layers[LAYER] || foundry.utils.isNewerVersion?.(game.version ?? "0", "12.999")) return;
    if (!Base) return console.warn("AxecleftTools | InteractionLayer not found; the toolbar group will use the token layer.");
    class AxecleftToolsLayer extends Base {
      static get layerOptions() { return foundry.utils.mergeObject(super.layerOptions, { name: LAYER, zIndex: 180 }); }
      async _draw() {}
    }
    layers[LAYER] = { layerClass: AxecleftToolsLayer, group: "primary" };
    console.log("AxecleftTools | Registered the Axecleft's Tools canvas layer.");
  });
  // Register the hook only once; it always calls the newest API.
  if (!existing) Hooks.on("getSceneControlButtons", (controls) => globalThis.AxecleftTools.addControls(controls));
})();
