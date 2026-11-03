# Axecleft's Crafting (shared engine) — changelog

## Version 1.97

- **Feats in the world's language**: requirement lines and epic notes show a feat by the name this world uses (D35E's Feats compendium through Babele: *Création d'armes et d'armures magiques*), loaded once when the world is ready. English worlds are unchanged.
- The tab's name under the crafter's name on a request card is translated (it was stored in English).
- **Construction lines in other languages**: *NLS 5* (also NL, NC, NM), *Prérequis :* / *Requisitos:*, *ou* / *o* between names, *Prix 12 000 po* / *Precio* / *Preço*, *Coût 6 000 po + 480 PX* (also Costo, Custo; mo, PE), thousands written 1,250, 1 250 or 1.250. A feat written by the name this world shows counts as its English name. The help says so.
- Request card buttons wrap whole (or at a space) in a narrow chat, never in the middle of a word (*Approuve-r*).
- Magic plans may give `days` through `base` the usual way; the Traps module's **Magic traps** tab uses base = 2 × gp so the SRD's 1 day per 500 gp falls out of the engine's 1 day per 1,000 gp of base price.

## Version 1.96

- **Tours** (Axecleft's Tools 9.7, Foundry 13+): every crafting tab has a tour in Configure Settings → Tour Management and in the Crafting window's ⋮ menu (**Tour of this tab**), for players too. `AxecleftCrafting.registerTour({ module, key, label, title, description, intro, steps })` lets a module describe its own tab's tour; the Crafter, the plan and Send for approval steps are added for it.

## Version 1.95

- Number boxes in the Crafting window show their value against the right edge.

## Version 1.94

- Time estimates use each skill's full bonus as D35E rolls it (its source details: ranks, ability, feats, items, buffs), the total the character sheet shows, instead of the skill's stored modifier, which can leave bonuses out.

## Version 1.93

- A Craft check's weekly progress can be counted in another coin than the SRD's silver (copper, gold or platinum pieces). Only trap kits use it, through the Traps setting "Trap kits: crafting progress"; the time estimate and the request card follow it.

## Version 1.92

- Spell sources for crafting follow the SRD's list: the crafter, a helping caster, or a spell completion or spell trigger item: a scroll, a wand, and now a staff (for powers: a power stone, a dorje or a psicrown).

## 1.91

- **Foundry v11**: the Crafting window and its chat cards work on Foundry v11 (with Axecleft's Tools 9).

## 1.7

- **Worlds in other languages**: the crafter's feats, spells and classes are matched by their English names too (Babele's original names, or English names the user gave them), and Craft sub-skills named in French, Spanish or Portuguese are recognized (armes, armures, arcs, alchimie, pièges; armas, armaduras, arcos, alquimia, trampas; armas, armaduras, arcos, alquimia, armadilhas).

## 1.6

- **Epic items** (SRD Epic Magic Items): a plan marked epic by its kind, or over the nonepic limits (market price above 200,000 gp or caster level above 20), uses the epic rules:
  - XP = market price ÷ 100 + 10,000 (epic scrolls: market price ÷ 25 + 1,000); gp as usual (half the base price plus the item cost).
  - Both creation feats: the nonepic one and its epic version (Craft Epic Magic Arms and Armor, Craft Epic Wondrous Item, Forge Epic Ring, Craft Epic Rod, Craft Epic Staff, Scribe Epic Scroll).
  - Only while the shared Epic items switch is on.
  - Time: 1 day per 10,000 gp of base price (Axecleft house rule: better methods from the epic feats and costlier materials), reported and not enforced like all crafting time.

## 1.5

- The Crafting window's searchable lists also work without the Treasure Generator: they come from Axecleft's Tools 7 when it's there (Axecleft's Traps, Poisons, and Diseases ships the engine and the Tools script but not the Treasure Generator).
- Shipped by Axecleft's Traps, Poisons, and Diseases (new Trap kits tab), as well as the Armory and Curios.

## 1.4

- The Crafting window's item boxes use the Treasure Generator's (9.6) scrolling searchable lists instead of the browser's popup.

## 1.3

- `parsePrereqs()` also reads the statblock's **price** ("Price 22,400 gp"), and for items priced per version ("2,000 gp ( ring +1 ), 8,000 gp ( ring +2 )") picks the one in the item's name. Versions are now matched by every number and roman numeral in their label, so "ring +2" no longer matches "Ring of Protection +2" as "ring".
- `prereqHelp("arms")`: the help box for specific magic weapons and armor (the Cost that separates the masterwork item).

## 1.2

- The engine reads an **SRD construction line** from an item's description: `C.parsePrereqs(html, { spell, isFeat, itemName })` → caster level, feats, spells (with the SRD's "or"), alignment, skill ranks, level, race, "three times the bonus", the statblock's own Cost, and anything else for the GM. Understands both D35E styles ("CL 10th; Craft Wondrous Item, …; Price …" and the epic "Caster Level: 20th; Prerequisites: …; Market Price: …"), one caster level per version ("CL 11th (I), 14th (II)"), and D35E's linked descriptions.
- `C.prereqHelp("items" | "abilities")`: a collapsible **How requirements are found** box for crafting tabs, explaining the line's format so GMs can make custom items and abilities craftable.

## 1.1

- `beforeApprove({ actor, values, plan })` on a kind: the GM's client rolls features the SRD leaves random (an intelligent item's mind and powers) when approving. The plan is evaluated again, so the costs on the card are the real ones before anything is charged.
- If the crafter can't pay the total after those rolls, the card says so and stays pending.

## 1

- First version, shipped with Axecleft's Armory 1.14.3.
- `registerKind({ module, key, label, icon, order, magic, feat, prepare?, content, wire?, evaluate })`.
  - A kind returns a plan. The engine adds the SRD costs, requirements, checks, time, the request card, GM approval, rolls and the result.
- Settings, registered under the module that runs the engine:
  - `crafting_playersMayCraft`
  - `crafting_magicChecks` (srd | spellcraft)
  - `crafting_poisonRule` (house | off)
  - `crafting_rollMode`
  - `crafting_chargeGp`
  - `crafting_chargeXp`
  - `crafting_xpFloor`
- Chat card flags are stored under `flags.world.axecleftCrafting`. No socket is needed:
  - The GM's client updates any message and actor.
  - The player's client updates their own request and their own character.
