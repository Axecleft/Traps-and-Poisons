/**
 * Axecleft's Traps, Poisons, and Diseases — trap kits.
 *
 * A Trap Kit is a one-use consumable that carries a full copy of a mechanical trap actor. Using it (D35E's Use button)
 * lets the player pick a spot on the scene; the GM approves (world setting) and the GM's client creates the trap actor
 * (folder "Placed Traps") and its token. Setting takes 1 minute × CR (world setting).
 *
 * Who sees a placed trap (world setting): the GM only (hidden token); everyone (the GM decides whether creatures spot
 * it); or the GM only plus a marker for the player who set it, who can share the marker with other players.
 *
 * Each placed trap has a status: active, disabled or triggered (GM: token HUD or My Traps). Recovery (world setting):
 * an active trap can be packed back into a kit: 1 minute × CR and a Disable Device check against its Disable Device
 * DC + 5. Success: the kit returns to the character. Fail by 1–4: no effect, try again. Fail by 5–10: the trap is
 * disabled and can't be recovered. Fail by more than 10: the trap is triggered on the character.
 *
 * Players never change scene documents themselves: their requests are chat messages that the active GM's client
 * carries out (after approval when the setting asks for it). No socket is needed.
 *
 * Macro API (game.modules.get("traps-and-poisons").api): makeKit(actorOrData), openMyTraps(), placedTraps(scene).
 */
import { trapData } from "./trap-generator.js";
import { trapFacts, normName } from "./trap-pricing.js";

const MOD = "traps-and-poisons";
const PLACED_FOLDER = "Placed Traps";
const KIT_FOLDER = "Trap Kits";
const esc = (v) => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const gp = (n) => `${Number(Math.round((Number(n) || 0) * 100) / 100).toLocaleString("en-US")} gp`;
const STATUS = { active: "Active", disabled: "Disabled", triggered: "Triggered" };
const STATUS_TINT = { active: "#ffffff", disabled: "#8a8a8a", triggered: "#ff7070" };
const STATUS_ICON = { active: "fas fa-circle-check", disabled: "fas fa-ban", triggered: "fas fa-bolt" };

export const KIT_SETTINGS = {
  kitApproval: { name: "Trap kits: GM approves", hint: "A player setting or recovering a trap sends a request that the GM approves on its chat card. Off: it happens at once.", type: Boolean, default: true },
  kitSetTime: { name: "Trap kits: setting takes time", hint: "Setting a trap takes 1 minute per CR (shown on the chat card; game time isn't advanced). Off: traps are set at once. Recovering one always takes 1 minute per CR.", type: Boolean, default: true },
  kitVisibility: { name: "Trap kits: who sees a placed trap", hint: "GM only: a hidden token. Everyone: a visible token (the GM decides whether creatures spot it). GM only, plus a marker: a hidden token, and the player who set it sees a marker that they can share with other players (My Traps).", type: String, default: "marker", choices: { gm: "GM only", all: "Everyone", marker: "GM only, plus a marker for the player who set it" } },
  kitRecovery: { name: "Trap kits: placed traps can be recovered", hint: "An active trap can be packed back into a kit: 1 minute per CR and a Disable Device check against its Disable Device DC + 5. Failing by 5–10 disables it for good; by more than 10 triggers it. Off: once placed, a trap stays until triggered or disabled.", type: Boolean, default: true },
  kitPacks: { name: "Trap kits: compendiums for crafting", hint: "Actor compendiums whose mechanical traps can be crafted as kits, separated by commas (for example traps-and-poisons.traps). Blank: every compendium with trap actors.", type: String, default: "" },
};
const setting = (k) => { try { return game.settings.get(MOD, k); } catch (e) { return KIT_SETTINGS[k]?.default; } };

/* -------------------------------------------- */
/*  Facts, prices and kit items                 */
/* -------------------------------------------- */

let POISON_PRICES = null;
async function poisonPrices() {
  if (POISON_PRICES) return POISON_PRICES;
  POISON_PRICES = new Map();
  const pack = game.packs.get(`${MOD}.poison-consumables`);
  try {
    const idx = await pack?.getIndex({ fields: ["system.price"] });
    for (const e of idx ?? []) POISON_PRICES.set(normName(e.name), Number(e.system?.price) || 0);
  } catch (e) { console.warn(`${MOD} | poison prices not loaded`, e); }
  return POISON_PRICES;
}

/** The SRD facts for a trap actor (or its data): price, Craft DC, CR, DCs, whether it's mechanical. */
export async function facts(actorOrData) {
  const data = actorOrData?.toObject ? actorOrData.toObject() : actorOrData;
  return trapFacts(data, await trapData(), { poisonPrices: await poisonPrices(), MOD });
}

/** Trap actor data as a kit carries it (no ids, folder, ownership or sort). */
function cleanActor(data) {
  const d = foundry.utils.deepClone(data);
  delete d._id; delete d.folder; delete d.sort; delete d._stats; delete d.ownership;
  for (const i of d.items ?? []) { delete i._stats; }
  if (d.flags?.[MOD]?.placed) delete d.flags[MOD].placed;
  return d;
}

/** Build the Trap Kit item data for a trap actor. */
export async function makeKit(actorOrData, { price = null } = {}) {
  const data = actorOrData?.toObject ? actorOrData.toObject() : foundry.utils.deepClone(actorOrData);
  if (data?.type !== "trap") throw new Error(`${data?.name ?? "That"} is not a trap actor.`);
  const f = await facts(data);
  if (!f.mechanical) throw new Error(`${data.name} is a magic trap; trap kits are for mechanical traps (magic traps come from spellcasting).`);
  const cr = f.cr || 1;
  const value = price ?? f.price;
  const notes = data.system?.details?.notes?.value ?? "";
  const statLine = f.text ? `<p><em>${esc(f.text)}</em></p>` : "";
  const desc = `<p><strong>Trap kit.</strong> The parts of a ready-built ${esc(data.name)} (CR ${cr}), packed to be set up somewhere else. Use it to choose where to set it.</p>
    ${statLine}
    <p>Search DC ${f.search ?? "?"}; Disable Device DC ${f.disable ?? "?"}; ${esc(f.trigger ?? "")}; ${esc(f.reset ?? "")}.</p>
    ${notes ? `<hr>${notes}` : ""}
    <hr><p><em>Setting it takes ${cr} minute${cr > 1 ? "s" : ""} (1 minute per CR). It can only be set once; a set trap can be packed up again only if the GM allows it (Disable Device DC ${(f.disable ?? 20) + 5}).</em></p>`;
  return {
    name: `Trap Kit: ${data.name} (CR ${cr})`,
    type: "consumable",
    img: data.img || "systems/D35E/icons/traps/generic.png",
    system: {
      consumableType: "misc", quantity: 1, weight: 10, price: value, identified: true,
      actionType: "special", activation: { cost: cr, type: "minute" }, // D35E shows the Use button and "1 minute per CR"
      uses: { value: 1, max: 1, per: "single" },
      description: { value: desc, unidentified: "", chat: "" },
    },
    flags: { [MOD]: { kit: { actor: cleanActor(data), name: data.name, cr, price: value, text: f.text ?? null, search: f.search, disable: f.disable } } },
  };
}

async function folderFor(name, type) {
  return game.folders.find((f) => f.type === type && f.name === name) ?? Folder.create({ name, type, color: "#3b24f0" });
}

/** GM: make a kit item in the Items sidebar ("Trap Kits" folder) from a trap actor. */
export async function createKitItem(actor) {
  const data = await makeKit(actor);
  const folder = await folderFor(KIT_FOLDER, "Item");
  const item = await CONFIG.Item.documentClass.create({ ...data, folder: folder.id });
  ui.notifications.info(`${item.name} is in the "${KIT_FOLDER}" Items folder.`);
  return item;
}

/* -------------------------------------------- */
/*  Requests (chat messages the GM carries out)  */
/* -------------------------------------------- */

const isActiveGM = () => game.user.isGM && (!game.users.activeGM || game.users.activeGM.isSelf);
const reqOf = (m) => m?.flags?.[MOD]?.kitReq ?? null;
const gmIds = () => ChatMessage.getWhisperRecipients("GM").map((u) => u.id);
const needsApproval = (r) => ["place", "recover"].includes(r.type) && setting("kitApproval") && !game.users.get(r.userId)?.isGM;

function requestTitle(r) {
  return { place: "Set a trap", recover: "Recover a trap", share: "Share a trap marker" }[r.type] ?? "Trap kit";
}
function requestHtml(r) {
  const who = esc(r.actorName ?? game.users.get(r.userId)?.name ?? "Someone");
  const lines = [`<h3><i class="fas fa-dungeon"></i> ${esc(requestTitle(r))}</h3>`];
  if (r.type === "place") {
    lines.push(`<p>${who} sets <strong>${esc(r.trapName)}</strong> (CR ${r.cr}) on ${esc(r.sceneName ?? "the scene")}.</p>`);
    if (r.minutes) lines.push(`<p>Setting it takes <strong>${r.minutes} minute${r.minutes > 1 ? "s" : ""}</strong>.</p>`);
  }
  if (r.type === "recover") {
    lines.push(`<p>${who} tries to pack up <strong>${esc(r.trapName)}</strong> (CR ${r.cr}): ${r.minutes} minute${r.minutes > 1 ? "s" : ""}.</p>`);
    lines.push(`<p>Disable Device ${r.total} against DC ${r.dc} (Disable Device DC ${r.dc - 5} + 5).</p>`);
    if (r.state === "pending") {
      // What approving will do, so the GM sees the consequence before pressing Approve
      const by = r.dc - r.total;
      const what = by <= 0 ? "success: the trap goes back into a kit"
        : by <= 4 ? `failed by ${by}: no effect, the trap stays set`
        : by <= 10 ? `failed by ${by}: the trap is disabled for good`
        : `<strong style="color:#c00">failed by ${by}: the trap is TRIGGERED on ${who}</strong>`;
      lines.push(`<p><em>If approved:</em> ${what}.</p>`);
    }
  }
  if (r.type === "share") lines.push(`<p>${who} shows ${esc(r.trapName)} to ${esc((r.users ?? []).map((u) => game.users.get(u)?.name ?? "?").join(", ") || "nobody")}.</p>`);
  if (r.state === "pending") lines.push(`<p class="tp-kit-state"><em>Waiting for the GM.</em></p><div class="tp-kit-gm" style="display:flex;gap:4px"><button type="button" data-kit="approve"><i class="fas fa-check"></i> Approve</button><button type="button" data-kit="deny"><i class="fas fa-xmark"></i> Cancel</button></div>`);
  if (r.state === "done") lines.push(`<p class="tp-kit-state"><strong>${r.result ?? "Done."}</strong></p>`);
  if (r.state === "cancelled") lines.push(`<p class="tp-kit-state"><em>${esc(r.result ?? "Cancelled by the GM.")}</em></p>`);
  if (r.state === "failed") lines.push(`<p class="tp-kit-state"><strong>Not done:</strong> ${esc(r.result ?? "")}</p>`);
  return lines.join("");
}

async function postRequest(r) {
  r.state = "pending";
  r.userId ??= game.user.id;
  const msg = await ChatMessage.create({
    content: requestHtml(r), speaker: { alias: "Trap Kits" },
    whisper: [...new Set([...gmIds(), game.user.id])],
    flags: { [MOD]: { kitReq: r } },
  });
  // The GM acting alone (or a request that needs no approval) is carried out by the GM's client from createChatMessage
  return msg;
}

async function saveRequest(message, r) {
  await message.update({ content: requestHtml(r), [`flags.${MOD}.kitReq`]: r });
}

async function carryOut(message) {
  const r = foundry.utils.deepClone(reqOf(message));
  if (!r || r.state !== "pending") return;
  r.state = "working";
  await message.update({ [`flags.${MOD}.kitReq.state`]: "working" });
  try {
    if (r.type === "place") r.result = await doPlace(r);
    else if (r.type === "recover") r.result = await doRecover(r);
    else if (r.type === "share") r.result = await doShare(r);
    r.state = "done";
  } catch (err) {
    console.error(`${MOD} | trap kit request failed`, err, r);
    r.state = "failed";
    r.result = err.message;
  }
  await saveRequest(message, r);
}

function onCreateMessage(message) {
  const r = reqOf(message);
  if (!r || r.state !== "pending" || !isActiveGM()) return;
  if (!needsApproval(r)) carryOut(message);
}

function onRenderMessage(message, html) {
  const r = reqOf(message);
  const root = html instanceof HTMLElement ? html : html?.[0];
  root?.querySelectorAll?.(".tp-kit-trigger").forEach((b) => {
    if (!game.user.isGM) return b.remove();
    b.addEventListener("click", async (ev) => {
      ev.preventDefault();
      const tok = await fromUuid(b.dataset.token);
      const victim = b.dataset.victim ? await fromUuid(b.dataset.victim) : null;
      if (victim?.object) { victim.object.setTarget(true, { releaseOthers: true }); canvas.animatePan({ x: victim.x, y: victim.y }); }
      else if (b.dataset.victim) ui.notifications.warn("That character's token isn't on this scene; target it yourself.");
      tok?.actor?.sheet?.render(true);
    });
  });
  if (!r || !root) return;
  root.querySelectorAll(".tp-kit-gm").forEach((box) => {
    if (!game.user.isGM || r.state !== "pending") return box.remove();
    box.querySelector('[data-kit="approve"]')?.addEventListener("click", (ev) => { ev.preventDefault(); carryOut(message); });
    box.querySelector('[data-kit="deny"]')?.addEventListener("click", async (ev) => {
      ev.preventDefault();
      const r2 = { ...reqOf(message), state: "cancelled", result: "Cancelled by the GM." };
      await saveRequest(message, r2);
    });
  });
}

/* -------------------------------------------- */
/*  Setting a trap                              */
/* -------------------------------------------- */

/** Let the user click a spot on the scene. Resolves { x, y } (top-left of the grid square) or null. */
function pickPoint() {
  return new Promise((resolve) => {
    const stage = canvas?.stage;
    if (!stage) return resolve(null);
    ui.notifications.info("Click where to set the trap. Right-click or Esc cancels.");
    const finish = (v) => { stage.off("pointerdown", down); document.removeEventListener("keydown", key, true); resolve(v); };
    const down = (ev) => {
      if (ev.button === 2) return finish(null);
      if (ev.button !== 0) return;
      const p = typeof ev.getLocalPosition === "function" ? ev.getLocalPosition(stage) : ev.data?.getLocalPosition(stage);
      if (!p) return finish(null);
      let tl = null;
      try { tl = canvas.grid.getTopLeftPoint?.(p) ?? null; } catch (e) { tl = null; }
      if (!tl) { try { const [x, y] = canvas.grid.getTopLeft(p.x, p.y); tl = { x, y }; } catch (e) { tl = { x: p.x, y: p.y }; } }
      finish({ x: Math.round(tl.x), y: Math.round(tl.y) });
    };
    const key = (e) => { if (e.key === "Escape") { e.stopPropagation(); finish(null); } };
    stage.on("pointerdown", down);
    document.addEventListener("keydown", key, true);
  });
}

/** The player used a kit: pick the spot and send the request. */
export async function useKit(item, actor) {
  const kit = item?.flags?.[MOD]?.kit;
  if (!kit) return;
  if (!canvas?.scene) return ui.notifications.warn("Open the scene where the trap goes first.");
  if ((Number(item.system?.quantity ?? 1) || 0) < 1) return ui.notifications.warn(`${item.name} is used up.`);
  const sheet = actor?.sheet;
  const wasOpen = sheet?.rendered;
  try { if (wasOpen) sheet.minimize?.(); } catch (e) { /* ignore */ }
  const pt = await pickPoint();
  try { if (wasOpen) sheet.maximize?.(); } catch (e) { /* ignore */ }
  if (!pt) return;
  const cr = Number(kit.cr) || 1;
  await postRequest({
    type: "place", actorUuid: actor.uuid, actorName: actor.name, itemId: item.id, trapName: kit.name, cr,
    sceneId: canvas.scene.id, sceneName: canvas.scene.name, x: pt.x, y: pt.y, minutes: setting("kitSetTime") ? cr : 0,
  });
  if (setting("kitApproval") && !game.user.isGM) ui.notifications.info(`The GM has your request to set ${kit.name}.`);
}

async function doPlace(r) {
  const scene = game.scenes.get(r.sceneId);
  if (!scene) throw new Error("That scene no longer exists.");
  const owner = await fromUuid(r.actorUuid);
  const item = owner?.items?.get(r.itemId);
  const kit = item?.flags?.[MOD]?.kit;
  if (!kit) throw new Error(`The trap kit is no longer in ${owner?.name ?? "the character"}'s inventory.`);
  if ((Number(item.system?.quantity ?? 1) || 0) < 1) throw new Error(`${item.name} is used up.`);
  const folder = await folderFor(PLACED_FOLDER, "Actor");
  const data = foundry.utils.deepClone(kit.actor);
  data.folder = folder.id;
  data.ownership = { default: 0 };
  foundry.utils.setProperty(data, `flags.${MOD}.fromKit`, { price: kit.price, name: kit.name, cr: kit.cr, text: kit.text });
  // Search and Disable Device DCs: on the sheet and in the token's two bars, as on the module's own trap actors
  const det = (data.system ??= {}).details ??= {};
  if (!(Number(det.findDC) > 1) && kit.search) det.findDC = kit.search;
  if (!(Number(det.disarmDC) > 1) && kit.disable) det.disarmDC = kit.disable;
  const bars = { displayBars: data.prototypeToken?.displayBars || CONST.TOKEN_DISPLAY_MODES.OWNER_HOVER, bar1: { attribute: "details.findDC" }, bar2: { attribute: "details.disarmDC" } };
  data.prototypeToken = { ...(data.prototypeToken ?? {}), ...bars };
  const trap = await CONFIG.Actor.documentClass.create(data);
  // D35E may reset a new actor's token settings: put the bars back if it did
  if (trap.prototypeToken?.bar1?.attribute !== "details.findDC" || trap.prototypeToken?.bar2?.attribute !== "details.disarmDC") await trap.update({ prototypeToken: bars });
  const vis = setting("kitVisibility");
  const td = (await trap.getTokenDocument({ x: r.x, y: r.y, hidden: vis !== "all", actorLink: true })).toObject();
  Object.assign(td, foundry.utils.deepClone(bars));
  foundry.utils.setProperty(td, `flags.${MOD}.placed`, {
    by: r.userId, byActor: r.actorUuid, byName: r.actorName, status: "active", seenBy: vis === "marker" ? [r.userId] : [],
    at: Date.now(), cr: kit.cr, price: kit.price, disable: kit.disable ?? trap.system?.details?.disarmDC ?? null,
  });
  await scene.createEmbeddedDocuments("Token", [td]);
  // The kit is used up
  const q = Number(item.system?.quantity ?? 1) || 1;
  if (q > 1) await item.update({ "system.quantity": q - 1 }); else await item.delete();
  const seen = { gm: "Only the GM sees it.", all: "Everyone can see it; the GM decides whether creatures spot it.", marker: `Only the GM sees it; ${esc(game.users.get(r.userId)?.name ?? "the player")} sees a marker (My Traps can share it).` }[vis];
  return `${esc(kit.name)} is set${r.minutes ? ` (${r.minutes} minute${r.minutes > 1 ? "s" : ""} of work)` : ""}. ${seen}`;
}

/* -------------------------------------------- */
/*  Status, sharing and recovery                */
/* -------------------------------------------- */

const placedOf = (t) => t?.flags?.[MOD]?.placed ?? null;
const entryOf = (t) => ({ id: t.id, uuid: t.uuid, name: t.name, x: t.x, y: t.y, width: t.width || 1, height: t.height || 1, img: t.texture?.src ?? null, hidden: !!t.hidden, placed: placedOf(t) });

/*
 * The scene's list of placed traps (flags.traps-and-poisons.traps), kept by the GM's client. Players read it instead of
 * the trap tokens themselves, which they may not be able to see or select (hidden tokens, no permission on the actor).
 */
const syncTimers = new Map();
function syncRegistry(scene) {
  if (!scene || !isActiveGM()) return;
  clearTimeout(syncTimers.get(scene.id));
  syncTimers.set(scene.id, setTimeout(async () => {
    const now = {};
    for (const t of scene.tokens.contents) if (placedOf(t)) now[t.id] = entryOf(t);
    const old = scene.flags?.[MOD]?.traps ?? {};
    const update = {};
    for (const id of Object.keys(old)) if (!now[id]) update[`flags.${MOD}.traps.-=${id}`] = null;
    for (const [id, e] of Object.entries(now)) if (JSON.stringify(old[id]) !== JSON.stringify(e)) update[`flags.${MOD}.traps.${id}`] = e;
    if (Object.keys(update).length) await scene.update(update);
  }, 200));
}

/** Placed traps on a scene: [{ id, uuid, name, x, y, width, height, img, hidden, placed }] (tokens, plus the scene's list for players). */
export function placedTraps(scene = canvas?.scene) {
  const out = new Map();
  for (const e of Object.values(scene?.flags?.[MOD]?.traps ?? {})) if (e?.placed) out.set(e.id, e);
  for (const t of scene?.tokens?.contents ?? []) if (placedOf(t)) out.set(t.id, entryOf(t));
  return [...out.values()];
}

/** GM: set a placed trap's status (active, disabled, triggered). */
export async function setStatus(token, status) {
  const doc = token?.document ?? token;
  if (!game.user.isGM || !placedOf(doc) || !STATUS[status]) return;
  await doc.update({ [`flags.${MOD}.placed.status`]: status, "texture.tint": STATUS_TINT[status] });
}

async function doShare(r) {
  const token = await fromUuid(r.tokenUuid);
  const p = placedOf(token);
  if (!p) throw new Error("That trap is gone.");
  const seen = [...new Set([...(p.seenBy ?? []), ...(r.users ?? [])])];
  await token.update({ [`flags.${MOD}.placed.seenBy`]: seen });
  return `The marker for ${esc(token.name)} is shown to ${esc((r.users ?? []).map((u) => game.users.get(u)?.name ?? "?").join(", "))}.`;
}

/** The character recovering a trap: the only character the user owns, or the one they pick (their selected token's or assigned character first). */
async function recoveringActor() {
  const owned = (game.actors?.contents ?? [...(game.actors ?? [])]).filter((a) => a.isOwner && a.type === "character");
  const first = canvas?.tokens?.controlled?.find((x) => x.actor?.isOwner)?.actor ?? game.user.character ?? null;
  if (game.user.isGM) return first;
  const list = [...new Set([first, ...owned].filter(Boolean))];
  if (list.length <= 1) return list[0] ?? null;
  const { DialogV2 } = foundry.applications.api;
  const id = await DialogV2.wait({
    window: { title: "Who recovers the trap?", icon: "fas fa-box" }, rejectClose: false,
    content: `<div class="form-group"><label>Character</label><select name="who">${list.map((a) => `<option value="${a.id}">${esc(a.name)}</option>`).join("")}</select></div>`,
    buttons: [{ action: "ok", label: "Recover", icon: "fas fa-box", default: true, callback: (ev, button) => button.form.elements.who.value }, { action: "cancel", label: "Cancel" }],
  });
  return id && id !== "cancel" ? game.actors.get(id) : null;
}

/** Try to pack a placed trap back into a kit. entry: from placedTraps() (or a trap token). */
export async function recover(entry) {
  const tokenDoc = entry?.document ?? entry;
  const p = tokenDoc?.placed ?? placedOf(tokenDoc);
  if (!p) return;
  if (!setting("kitRecovery")) return ui.notifications.warn("The GM doesn't allow placed traps to be recovered.");
  if (p.status !== "active") return ui.notifications.warn(`${tokenDoc.name} is ${STATUS[p.status]?.toLowerCase() ?? p.status}; only active traps can be recovered.`);
  const actor = await recoveringActor();
  if (!actor) return ui.notifications.warn("You have no character to recover the trap with.");
  const dev = actor.system?.skills?.dev ?? {};
  if (!((Number(dev.rank) || 0) > 0)) return ui.notifications.warn(`${actor.name} has no ranks in Disable Device (trained only).`);
  const disable = Number(p.disable) || 20;
  const dc = disable + 5;
  const roll = await new Roll(`1d20 + ${Number(dev.mod) || 0}`).evaluate();
  await roll.toMessage({ speaker: ChatMessage.getSpeaker({ actor }), flavor: `Disable Device: recover ${tokenDoc.name} (DC ${dc})` });
  const cr = Number(p.cr) || 1;
  await postRequest({ type: "recover", tokenUuid: tokenDoc.uuid, actorUuid: actor.uuid, actorName: actor.name, trapName: tokenDoc.name, cr, minutes: cr, total: roll.total, dc });
}

async function doRecover(r) {
  const token = await fromUuid(r.tokenUuid);
  const p = placedOf(token);
  if (!p) throw new Error("That trap is gone.");
  if (p.status !== "active") throw new Error(`${token.name} is ${STATUS[p.status]?.toLowerCase() ?? p.status}; only active traps can be recovered.`);
  const by = r.dc - r.total;
  if (by <= 0) {
    const who = await fromUuid(r.actorUuid);
    if (!who) throw new Error("The recovering character no longer exists.");
    const kit = await makeKit(token.actor, { price: p.price ?? null });
    await who.createEmbeddedDocuments("Item", [kit]);
    await token.delete();
    return `Success: ${esc(who.name)} packs ${esc(token.name)} back into a trap kit.`;
  }
  if (by <= 4) return `Failed by ${by}: no harm done; the trap is still set and can be tried again.`;
  if (by <= 10) { await setStatus(token, "disabled"); return `Failed by ${by}: ${esc(token.name)} is disabled and can no longer be recovered.`; }
  await setStatus(token, "triggered");
  await postTriggered(token, r);
  return `Failed by ${by}: ${esc(token.name)} is <span style="color:#c00">triggered</span> on ${esc(r.actorName)}! (See the GM's Trap Triggered card.)`;
}

/** A GM-only card when a recovery sets a trap off: its attacks, and a button that targets the victim and opens the trap. */
async function postTriggered(token, r) {
  const trap = token.actor;
  const attacks = (trap?.items?.contents ?? [...(trap?.items ?? [])]).filter((i) => ["attack", "full-attack"].includes(i.type)).map((i) => i.name);
  const victim = canvas?.scene?.id === token.parent?.id ? canvas.tokens?.placeables?.find((t) => t.actor?.uuid === r.actorUuid || t.document?.actorId === r.actorUuid.split(".").pop()) : null;
  await ChatMessage.create({
    speaker: { alias: "Trap Kits" }, whisper: gmIds(),
    content: `<h3 style="color:#c00"><i class="fas fa-bolt"></i> Trap triggered</h3>
      <p><strong>${esc(token.name)}</strong> goes off on <strong>${esc(r.actorName)}</strong> while they try to pack it up (failed by ${r.dc - r.total}).</p>
      ${attacks.length ? `<p>Its attacks: ${attacks.map(esc).join(", ")}.</p>` : "<p>It has no attack items; resolve it from its notes.</p>"}
      <button type="button" class="tp-kit-trigger" data-token="${esc(token.uuid)}" data-victim="${esc(victim?.document?.uuid ?? "")}"><i class="fas fa-crosshairs"></i> Target ${esc(r.actorName)} and open the trap</button>
      <p class="hint"><small>The trap stays Triggered until you set it Active again (its token HUD or Placed Traps), for example once it resets.</small></p>`,
    flags: { [MOD]: { kitTriggered: true } },
  });
}

/** Deleting a placed trap's token removes the actor that was made for it ("Placed Traps" folder) too. */
async function onDeleteToken(token) {
  if (!placedOf(token) || !isActiveGM()) return;
  const actor = game.actors.get(token.actorId);
  if (!actor?.flags?.[MOD]?.fromKit) return; // only actors made for a placed kit
  const stillUsed = game.scenes.some((s) => s.tokens.some((t) => t.actorId === actor.id));
  if (!stillUsed) await actor.delete();
}

/* -------------------------------------------- */
/*  Markers (players)                           */
/* -------------------------------------------- */

let markerLayer = null, markerTimer = null;
function scheduleMarkers() { clearTimeout(markerTimer); markerTimer = setTimeout(drawMarkers, 100); }
async function drawMarkers() {
  if (!canvas?.ready) return;
  if (markerLayer) { markerLayer.destroy({ children: true }); markerLayer = null; }
  if (game.user.isGM || setting("kitVisibility") !== "marker") return;
  markerLayer = new PIXI.Container();
  markerLayer.eventMode = "none";
  (canvas.interface ?? canvas.stage).addChild(markerLayer);
  const load = foundry.canvas?.loadTexture ?? globalThis.loadTexture;
  for (const t of placedTraps()) {
    const p = t.placed;
    if (!t.hidden || !(p.seenBy ?? []).includes(game.user.id)) continue;
    const w = (t.width || 1) * canvas.grid.size, h = (t.height || 1) * canvas.grid.size;
    try {
      const tex = t.img ? await load(t.img) : null;
      if (tex) { const s = new PIXI.Sprite(tex); Object.assign(s, { x: t.x, y: t.y, width: w, height: h, alpha: 0.5 }); markerLayer?.addChild(s); }
    } catch (e) { /* no image: the frame still shows */ }
    const color = { active: 0xffb000, disabled: 0x8a8a8a, triggered: 0xff4040 }[p.status] ?? 0xffb000;
    const g = new PIXI.Graphics();
    if (typeof g.setStrokeStyle === "function") g.rect(t.x + 2, t.y + 2, w - 4, h - 4).stroke({ width: 3, color, alpha: 0.9 });
    else g.lineStyle(3, color, 0.9).drawRect(t.x + 2, t.y + 2, w - 4, h - 4);
    markerLayer?.addChild(g);
    const label = new PIXI.Text(`${t.name}${p.status !== "active" ? ` (${STATUS[p.status]})` : ""}`, { fontSize: Math.max(10, canvas.grid.size / 5), fill: 0xffffff, stroke: 0x000000, strokeThickness: 3 });
    Object.assign(label, { x: t.x, y: t.y + h + 2 });
    markerLayer?.addChild(label);
  }
}

/* -------------------------------------------- */
/*  My Traps window                             */
/* -------------------------------------------- */

export async function openMyTraps() {
  if (!canvas?.scene) return ui.notifications.warn("Open a scene first.");
  const gm = game.user.isGM;
  // Targeted trap tokens count too (any trap the player can see and target, e.g. with "Everyone" visibility)
  const targeted = new Set([...(game.user.targets ?? [])].map((t) => t.document?.id ?? t.id));
  // Players see only traps they know: set by them, shown to them (another player or the GM), or targeted
  const list = placedTraps().filter((e) => gm || e.placed.by === game.user.id || (e.placed.seenBy ?? []).includes(game.user.id) || targeted.has(e.id))
    .sort((a, b) => (targeted.has(b.id) ? 1 : 0) - (targeted.has(a.id) ? 1 : 0) || a.name.localeCompare(b.name));
  const players = game.users.filter((u) => !u.isGM && u.id !== game.user.id);
  const rows = list.map((t) => {
    const p = t.placed;
    const by = esc(p.byName ?? game.users.get(p.by)?.name ?? "?");
    const status = gm ? `<select data-status="${t.id}">${Object.entries(STATUS).map(([k, l]) => `<option value="${k}"${k === p.status ? " selected" : ""}>${l}</option>`).join("")}</select>`
      : `<i class="${STATUS_ICON[p.status] ?? ""}"></i> ${STATUS[p.status] ?? p.status}`;
    const canShare = !gm && setting("kitVisibility") === "marker" && ((p.seenBy ?? []).includes(game.user.id)) && players.length;
    const canRecover = setting("kitRecovery") && p.status === "active" && !gm;
    return `<tr><td>${esc(t.name)}${targeted.has(t.id) ? ' <i class="fas fa-crosshairs" title="Targeted"></i>' : ""}</td><td>${p.cr ?? "?"}</td><td>${by}</td><td>${status}</td><td style="white-space:nowrap">
      ${canShare ? `<button type="button" data-share="${t.id}" title="Show its marker to other players"><i class="fas fa-share-nodes"></i></button>` : ""}
      ${canRecover ? `<button type="button" data-recover="${t.id}" title="Pack it back into a kit (Disable Device DC ${(Number(p.disable) || 20) + 5})"><i class="fas fa-box"></i></button>` : ""}
      ${gm ? `<button type="button" data-known="${t.id}" title="Players who know about it: ${esc((p.seenBy ?? []).map((u) => game.users.get(u)?.name).filter(Boolean).join(", ") || "only the one who set it")}"><i class="fas fa-eye"></i></button>` : ""}
      ${gm ? `<button type="button" data-pan="${t.id}" title="Show on the scene"><i class="fas fa-location-crosshairs"></i></button>` : ""}</td></tr>`;
  }).join("");
  // GM: which players know about a trap (found it with Search, were told, ...)
  const allPlayers = game.users.filter((u) => !u.isGM);
  const knownBox = gm && allPlayers.length ? `<div data-knownbox style="display:none;margin-top:6px"><p class="hint">Players who know about <strong data-known-name></strong> (it shows in their My Traps${setting("kitVisibility") === "marker" ? ", with a marker" : ""}):</p>${allPlayers.map((u) => `<label style="display:block"><input type="checkbox" value="${u.id}"> ${esc(u.name)}${u.character ? ` (${esc(u.character.name)})` : ""}</label>`).join("")}<button type="button" data-known-save><i class="fas fa-eye"></i> Save</button></div>` : "";
  const shareBox = players.length ? `<div data-sharebox style="display:none;margin-top:6px"><p class="hint">Show the marker to:</p>${players.map((u) => `<label style="display:block"><input type="checkbox" value="${u.id}"> ${esc(u.name)}${u.character ? ` (${esc(u.character.name)})` : ""}</label>`).join("")}<button type="button" data-share-send><i class="fas fa-share-nodes"></i> Share</button></div>` : "";
  const content = `<p class="hint">${gm ? "Traps set from trap kits on this scene. Change a trap's status here or on its token (right-click, token HUD). The eye sets which players know about a trap (for example after a successful Search); players only see the traps they know." : "Traps on this scene that you know about: you set them, someone showed them to you, or you have them targeted."}</p>
    ${list.length ? `<table><thead><tr><th>Trap</th><th>CR</th><th>Set by</th><th>Status</th><th></th></tr></thead><tbody>${rows}</tbody></table>` : "<p><em>None.</em></p>"}
    ${shareBox}
    ${knownBox}
    ${!gm && setting("kitRecovery") ? '<p class="hint">Recovering: press the box next to the trap (you\'ll be asked which character if you have more than one). It takes 1 minute per CR and a Disable Device check against its Disable Device DC + 5. A trap you can see can also be targeted (T) to list it here.</p>' : ""}`;
  const { DialogV2 } = foundry.applications.api;
  let shareFor = null;
  await DialogV2.wait({
    window: { title: gm ? "Placed Traps" : "My Traps", icon: "fas fa-dungeon" },
    position: { width: 520 },
    content, rejectClose: false,
    buttons: [{ action: "close", label: "Close", default: true }],
    render: (event, dialog) => {
      const root = (dialog ?? event?.target)?.element ?? document;
      const tok = (id) => canvas.scene.tokens.get(id);
      const ent = (id) => list.find((e) => e.id === id);
      root.querySelectorAll("[data-status]").forEach((s) => s.addEventListener("change", () => setStatus(tok(s.dataset.status), s.value)));
      root.querySelectorAll("[data-pan]").forEach((b) => b.addEventListener("click", () => { const t = tok(b.dataset.pan); if (t) canvas.animatePan({ x: t.x, y: t.y }); }));
      root.querySelectorAll("[data-recover]").forEach((b) => b.addEventListener("click", async () => { b.disabled = true; await recover(ent(b.dataset.recover)); }));
      let knownFor = null;
      root.querySelectorAll("[data-known]").forEach((b) => b.addEventListener("click", () => {
        knownFor = b.dataset.known;
        const e = ent(knownFor);
        const box = root.querySelector("[data-knownbox]");
        if (!e || !box) return;
        box.querySelector("[data-known-name]").textContent = e.name;
        box.querySelectorAll("input").forEach((x) => { x.checked = (e.placed.seenBy ?? []).includes(x.value) || e.placed.by === x.value; x.disabled = e.placed.by === x.value; });
        box.style.display = "";
      }));
      root.querySelector("[data-known-save]")?.addEventListener("click", async () => {
        const e = ent(knownFor), t = tok(knownFor);
        if (!e || !t) return;
        const users = [...root.querySelectorAll("[data-knownbox] input:checked")].map((x) => x.value);
        const seen = [...new Set([e.placed.by, ...users].filter(Boolean))];
        await t.update({ [`flags.${MOD}.placed.seenBy`]: seen });
        e.placed.seenBy = seen;
        ui.notifications.info(`${e.name}: known to ${users.map((u) => game.users.get(u)?.name).join(", ") || "only the one who set it"}.`);
        root.querySelector("[data-knownbox]").style.display = "none";
      });
      root.querySelectorAll("[data-share]").forEach((b) => b.addEventListener("click", () => { shareFor = b.dataset.share; root.querySelector("[data-sharebox]").style.display = ""; }));
      root.querySelector("[data-share-send]")?.addEventListener("click", async () => {
        const users = [...root.querySelectorAll("[data-sharebox] input:checked")].map((x) => x.value);
        const t = ent(shareFor);
        if (!t || !users.length) return ui.notifications.warn("Choose a trap and at least one player.");
        await postRequest({ type: "share", tokenUuid: t.uuid, trapName: t.name, users, actorName: game.user.name });
        ui.notifications.info(`${t.name} will be shown to ${users.map((u) => game.users.get(u)?.name).join(", ")}.`);
        root.querySelector("[data-sharebox]").style.display = "none";
      });
    },
  });
}

/* -------------------------------------------- */
/*  Hooks                                       */
/* -------------------------------------------- */

function onTokenHud(hud, html) {
  if (!game.user.isGM) return;
  const doc = hud.object?.document;
  const p = placedOf(doc);
  if (!p) return;
  const root = html instanceof HTMLElement ? html : html?.[0];
  const col = root?.querySelector(".col.right");
  if (!col) return;
  const order = ["active", "disabled", "triggered"];
  const next = order[(order.indexOf(p.status) + 1) % order.length];
  const btn = document.createElement("div");
  btn.className = "control-icon";
  btn.dataset.tooltip = `Trap: ${STATUS[p.status]} (click: ${STATUS[next]})`;
  btn.innerHTML = `<i class="${STATUS_ICON[p.status]}"></i>`;
  btn.addEventListener("click", async (ev) => { ev.preventDefault(); await setStatus(doc, next); hud.render?.(); });
  col.append(btn);
}

function actorContext(entries) {
  const getActor = (li) => game.actors.get((li?.dataset ?? li?.[0]?.dataset)?.entryId ?? (li?.dataset ?? li?.[0]?.dataset)?.documentId);
  entries.push({
    name: "Make Trap Kit", icon: '<i class="fas fa-box"></i>',
    condition: (li) => game.user.isGM && getActor(li)?.type === "trap",
    callback: async (li) => { try { await createKitItem(getActor(li)); } catch (err) { ui.notifications.error(err.message); } },
  });
}

export function registerKits() {
  if (!globalThis.Hooks) return;
  Hooks.once("init", () => {
    for (const [k, o] of Object.entries(KIT_SETTINGS)) game.settings.register(MOD, k, { scope: "world", config: true, ...o, onChange: () => scheduleMarkers() });
  });
  // D35E: a custom use for the kit (D35E.ItemUse.preUseItem; the Tome of Ability items use the same hook)
  Hooks.on("D35E.ItemUse.preUseItem", (item, actor, hookValues) => {
    if (!item?.flags?.[MOD]?.kit) return;
    hookValues.customUse = true;
    useKit(item, actor ?? item.actor);
  });
  Hooks.on("createChatMessage", (m) => onCreateMessage(m));
  Hooks.on("renderChatMessageHTML", (m, h) => onRenderMessage(m, h));
  Hooks.on("deleteToken", (t) => onDeleteToken(t));
  Hooks.on("renderTokenHUD", (hud, html) => onTokenHud(hud, html));
  Hooks.on("canvasReady", () => scheduleMarkers());
  for (const h of ["createToken", "updateToken", "deleteToken"]) Hooks.on(h, (t) => { if (placedOf(t)) { syncRegistry(t.parent); scheduleMarkers(); } });
  Hooks.on("updateScene", (scene, change) => { if (change?.flags?.[MOD] && scene.id === canvas?.scene?.id) scheduleMarkers(); });
  Hooks.once("ready", () => { for (const sc of game.scenes ?? []) if (sc.tokens.some((t) => placedOf(t)) || sc.flags?.[MOD]?.traps) syncRegistry(sc); });
  Hooks.on("getActorContextOptions", (app, entries) => actorContext(entries)); // Foundry 13+
  Hooks.on("getActorDirectoryEntryContext", (html, entries) => actorContext(entries)); // Foundry 11-12
  globalThis.AxecleftTools?.register({
    module: MOD, name: "my-traps", title: "My Traps", icon: "fas fa-dungeon",
    hint: "Traps set from trap kits: status, sharing markers, recovering", gmOnly: false, onClick: () => openMyTraps(),
  });
  Hooks.once("ready", () => {
    const mod = game.modules.get(MOD);
    if (mod) mod.api = { ...(mod.api ?? {}), makeKit, createKitItem, openMyTraps, placedTraps, setStatus, trapFacts: facts };
  });
}

registerKits();
