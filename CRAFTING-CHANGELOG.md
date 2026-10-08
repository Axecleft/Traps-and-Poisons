# Axecleft's Crafting (shared engine) — changelog

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
