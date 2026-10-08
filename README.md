# Axecleft's Traps, Poisons, and Diseases
A collection of Traps, Poisons, and Diseases from the Dungeons and Dragons 3.5 SRD

Changelog:

v1.14.5.1:

- Ships the Crafting engine 1.6 (epic item rules for Axecleft's Armory and Curios; nothing changes for trap kits).

v1.14.5:

Renamed the module to "Axecleft's Traps, Poisons, and Diseases". The module ID and folder are unchanged (traps-and-poisons), so existing worlds and links keep working.

Added a Random Trap Generator (GM only).

- Generates random room traps for CR 1–20 using the same trap templates and value ranges as the d20srd.org Random Generator: 62 trap templates plus the SRD sample traps, about 74,000 possible combinations.
- Each generated trap becomes a ready-to-use D35E trap actor built from this module's own trap attacks, poisons, condition buffs and timers. SRD sample traps are copied from the Traps compendium.
- Open it from the "Axecleft's Tools" group (toolbox icon) on the left toolbar, the "Random Trap" button at the top of the Actors sidebar, or a macro:
  game.modules.get("traps-and-poisons").api.openGenerator();
- Options: CR, a specific trap or random, how many (1–10), include SRD sample traps, and create actors or post the stat lines to chat only.
- "Customize…" opens a second window where you choose any of the trap's values yourself: type, trigger, reset, bypass, Search/Disable DCs, attack bonus, damage, save DCs, durations, area sizes and which poison. Boxes suggest the generator's values, but you can type anything. Anything left blank is rolled as usual. "Generate" stays fully random.
- When posting to chat only, each trap has a "Create Actor" button that builds that exact trap. The button then becomes a link to the new actor.
- Added the shared "Axecleft's Tools" toolbar group (scripts/axecleft-tools.js). Every Axecleft module that's active adds its tools to this one group.
- Added a Diseases compendium with the 10 SRD diseases (blinding sickness, cackle fever, demon fever, devil chills, filth fever, mindfire, mummy rot, red ache, the shakes, slimy doom). They're built like the poison attacks: Fortitude save, Apply Disease, Incubation, Daily Damage, plus the SRD special effects (permanent blindness, permanent drain).
- Added a "Diseased" buff to Common Trap Buffs. The disease attacks apply it.
- Generated actors go in a "Random Traps" actor folder. A GM-only chat message lists them with links.

Added poison and disease traps to the generator.

- 13 new trap types built from the SRD trap-design rules (CR = the sum of the SRD CR modifiers): Poison Gas Trap, Spore Cloud Trap, Gas-Filled Pit Trap, Poisoned and Diseased Spiked Pit Traps, Envenomed and Diseased Needle Traps, Envenomed and Diseased Dart Traps, Poisoned Object (contact poison), Contaminated Object (contact disease), Tainted Food or Water, and Tainted Water-Filled Room (the SRD Water-Filled Room with an ingested poison or disease in the water).
- Every SRD poison is used by the right delivery: inhaled poisons in gas traps, injury and contact poisons on spikes, needles and darts, contact poisons on objects, ingested poisons in food and water. Every SRD disease except mummy rot is used the same way.
- The website's poisoned traps (arrow traps, guillotines, nets...) now use any injury or contact SRD poison within one CR of the website's original poison.
- The main window has an "Include poison & disease traps" option. In Customize…, poison and disease traps get a choice for each option (poison or disease, depth, onset delay, attack bonus, DCs) with its CR modifier shown; website traps get a poison list.
- CR modifiers the SRD doesn't give are the module's own: ingested poisons (striped toadstool +1, arsenic +1, id moss +2, oil of taggit +2, lich dust +3, dark reaver powder +4), drow poison +2, and diseases (filth fever and mindfire +1; cackle fever, red ache, the shakes, devil chills and blinding sickness +2; slimy doom +3; demon fever +4).
- Added the missing Drow Poison to the Poisons compendium (Injury folder).
- Fixed the disease attacks: their Diseased buff now gets its description (a stray ";" in the action cut it off).
- Fixed poisons: Nitharit save DC (17 → 13), Sassone Leaf Residue secondary damage (3d6 → 1d6 Con), Insanity Mist initial damage (now Wis). Poison consumables now carry their poison's save DC, and the Insanity Mist, Oil of Taggit and Ungol Dust descriptions are corrected.
- Disease incubation and the daily saves are tracked by the GM; the trap applies the disease when the target fails the first save.

Added a Poison & Disease Creator (GM only), suggested by the community.

- Open it from the "Axecleft's Tools" toolbar group (poison-drop icon) or a macro: game.modules.get("traps-and-poisons").api.openPoisonCreator();
- Enter a name, delivery (contact, ingested, inhaled, injury), saving throw and DC, initial and secondary damage (poisons) or incubation, daily damage and recovery (diseases), price and notes.
- Pick any existing poison or disease as a template to fill in the form, then change only what you need. Extra effects on the template (such as permanent blindness) can be kept or dropped.
- Damage is typed the way the SRD writes it: "1d6 Con", "1d4 Con + 1d3 Wis", "1 Con drain", "2d12 hp", "unconsciousness 2d4 hours", "paralysis 2d6 minutes", "0". A preview shows what each part will do before you create it.
- Poisons: initial damage on exposure, secondary damage 1 minute (10 rounds) later on a second failed save, then the poison ends (its Poisoned buff lasts 10 rounds; conditions it caused last their own duration). Incubation and recovery apply to diseases only.
- Creates the attack ("Poison, Name" or "Disease, Name") and a consumable ("Name") whose action adds the attack to the user, like the module's poison consumables.
- Both are saved in a world compendium, "Custom Poisons & Diseases" (created on first use), so module updates never overwrite them. Copies can also go in a "Custom Poisons & Diseases" Items folder. Creating one with the same name again replaces it.

Added trap kits (mechanical traps you can carry, craft, set and recover).

- A Trap Kit is a one-use item carrying a complete mechanical trap. Use it (the Use button on the character sheet), click where it goes on the scene, and the trap actor and its token are created there (actor folder "Placed Traps"). The kit is used up.
- Where kits come from: the Crafting window (new "Trap kits" tab), or the GM right-clicks any trap actor in the Actors sidebar and chooses "Make Trap Kit" (Items folder "Trap Kits"). Mechanical traps only; magic traps remain the work of spellcasters.
- Crafting (SRD, Craft (trapmaking)): any mechanical trap from your Actor compendiums (the SRD sample traps by default), and any trap actor in the world the crafter can see (show a Random Trap Generator trap to a player to let them craft it). Price: the SRD market price of the sample traps, or the SRD cost table (base 1,000 gp, trigger, reset, bypass, DCs, attack bonus, never miss, × CR; at least CR × 100 gp). Raw materials cost ⅓; poisons in the trap are bought at full price (×20 with an automatic reset). DC by CR (1–3 20, 4–6 25, 7–10 30; past CR 10, +5 per 3 CR), +5 for a proximity trigger, +5 for an automatic reset. Weekly progress as for any Craft item.
- Settings (Configure Settings, this module):
  - Trap kits: GM approves (on): setting or recovering a trap is a request the GM approves on its chat card.
  - Trap kits: setting takes time (on): 1 minute per CR, shown on the chat card. The GM asks for any rolls.
  - Trap kits: who sees a placed trap: GM only (hidden token); Everyone (visible token; the GM decides whether creatures spot it); or GM only, plus a marker (default) for the player who set it, who can show it to other players.
  - Trap kits: placed traps can be recovered (on): an active trap can be packed back into a kit. 1 minute per CR and a Disable Device check against its Disable Device DC + 5. Success: the kit goes back to the character. Fail by 1–4: no harm, try again. Fail by 5–10: the trap is disabled and can't be recovered. Fail by more than 10: the trap is triggered on the character. Only active traps can be recovered; a trap with an automatic reset can be recovered again once it is active.
  - Trap kits: compendiums for crafting: which Actor compendiums' traps can be crafted (blank: all).
- Each placed trap has a status: Active, Disabled or Triggered. The GM changes it with a new button on the trap token's HUD (right-click the token) or in Placed Traps. Disabled traps are tinted grey, triggered ones red.
- My Traps (Axecleft's Tools group, for players and the GM): the traps on the scene that you set or that were shown to you, with their status; Share shows your marker to other players; Recover packs a trap up (no need to select anything: you're asked which character if you have more than one). A trap you can see (Everyone visibility) can also be targeted to list it there. Players read the scene's list of placed traps, kept by the GM's client, so hidden traps and traps they have no permission on still show for their setter. Players only see the traps they know about (set, shown to them, or targeted), never every trap on the scene. The GM sees every placed trap, can change its status, pan to it, and set which players know about it (the eye button, for example after a successful Search).
- Players' requests travel as chat messages that the GM's client carries out, so players never need permission to create actors or tokens.
- Macro API: game.modules.get("traps-and-poisons").api: makeKit(actor), createKitItem(actor), openMyTraps(), placedTraps(scene), setStatus(token, status).

Shared tools and treasure.

- Ships the shared Crafting engine 1.5 (the Crafting window: Axecleft's Tools group) for the Trap kits tab, the same copy as Axecleft's Armory and Curios.
- The shared "Axecleft's Tools" toolbar script is version 7, the same copy Axecleft's Gemstones, Armory and Curios ship (the newest copy runs). Foundry v11/v12 get the toolbar group's own canvas layer, so its buttons always show.
- Random Trap Generator, Customize…: the suggestion lists on the value boxes now scroll and stay on screen (Foundry's own popup ran off the bottom of the screen). Double-click a box or press ↓ to see every suggestion; typing filters them; ↑ ↓ Enter and Esc work.
- Poisons in random treasure and merchant stock: with any of Axecleft's treasure modules active (Gemstones, Armory or Curios), the Treasure Generator and Merchant Generator pull poison consumables straight from this module's Poison Consumables compendium (Item Sources tab; Generation settings → Poisons). Nothing else is needed in this module.

v1.14.1:

Added folders to organize the compendiums.

Added consumable poison item support (suggested by @Landryan and @Gilgalad)

Added roll tables for random trap selection

Added roll tables for random poison consumables selection

Bug fixes

Reported by:  Status:   Bug:

@Gilgalad     Fixed    Spiked pit trap CR3 : full attack not working

@Gilgalad     Fixed    Compacting room CR7 : miss a 4 rounds timer

@Gilgalad     Fixed    Spiked Pit Trap (100 Ft. Deep) : full attack not working (fall attack only not spikes, bad id i think)

@Gilgalad     Pushed   Glyph of Warding (CR4 and 6) : no use of measure template (3 feet around)

@Gilgalad     Fixed    Acid Fog trap CR 7 : no attack ?

@Gilgalad     Fixed    Water-Filled Room CR 7 : 3 rounds timer instead 4 rounds

@Gilgalad     Fixed    Destruction trap CR8 : action for dead condition doesn't work

@Gilgalad     Fixed    Earthquake Trap CR 8 : idem for Open Ground Earthquake attack

@Gilgalad     Fixed    Insanity Mist Vapor Trap CR 8 : miss a 1 round timer + here is a Dazed1 buff not used i think

@Gilgalad     Fixed    Prismatic spray trap CR8 : Green beam, incorrect con damage special action (cha 1d1 instead con 1d6. I wonder if it's not a 20 hp damage ?)

@Gilgalad     Fixed    Dropping Ceiling CR 9 : no delay 1 round delay

@Gilgalad     Fixed    Incendiary cloud CR 9 : trap timer in items with no apparent interest

@Axecleft     Fixed    Several icons and tokens that had broken links.

@Gilgalad     Fixed    Incendiary cloud CR 9 : trap timer in items with no apparent interest

@Axecleft     Fixed    Several icons and tokens that had broken links.
