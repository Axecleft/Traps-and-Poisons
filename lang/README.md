# Translating Axecleft's modules

Each language is one file in this folder, named by Foundry's language code: `fr.json`, `es.json`, `pt-BR.json`, `pt-PT.json`.

1. Copy `template.json` and rename the copy, for example to `fr.json`.
2. Each line is `"English text": "translation"`. Type the translation between the second pair of quotes. Leave a line empty (`""`) to keep the English for now.
3. Keep anything in curly braces exactly as it is: `{n}`, `{name}`, `{gp}` are filled in by the module (you can move them within the sentence).
4. Keep HTML tags such as `<strong>…</strong>` around the matching words.
5. Lines starting with `__` only show which script the texts come from; leave them empty.
6. Add the language code to `languages.json`, for example `["fr"]`.

Brazilian Portuguese uses `pt-PT.json` for anything `pt-BR.json` lacks, and the other way round; anything missing in both stays in English.

Texts shared by several Axecleft modules (Treasure Generator, Merchant Generator, Crafting, Tools) appear in each module's template: translate them once and copy them between files.

## Names built from parts (patterns)

Some texts are patterns for names the modules build, for example `{bonus} {adj} {masterwork} {material} {base}[ of {of:and}][ ({size})]` for "+1 Flaming Keen Longsword of Speed (Small)". Translate a pattern by putting its parts in your language's order and translating the words around them; keep each `{part}` as it is.

- `{part}`: a word or several (several are joined with spaces).
- `{part:and}` / `{part:or}`: a list, joined as "A, B and C" with your language's word (see the grammar file).
- `{part:a}` / `{part:the}`: with an article that agrees with the word ("un", "une"…); `{part:lower}`: in lower case.
- `{part:head}`: the word the others agree with (the noun: "Épée longue" makes "acéré" become "acérée").
- `[ … ]`: an optional piece, left out when a part inside it is empty. In `[ of {of:and}]`, " of" only appears when there is something after it.

Example (French): `{base:head} {masterwork} {material} {bonus} {adj}[ {of:and}][ ({size})]`.

## The grammar file

Each language also has `<code>.grammar.json` (`fr.grammar.json`, `es.grammar.json`, `pt-BR.grammar.json`, `pt-PT.grammar.json`): the word for "and", articles, elision (de → d' before a vowel, except before an aspirated h), contractions (de le → du), capital letters, and what the grammar needs to know about some words (gender, agreeing forms, a different text, the part of a name a word moves to). `grammar.template.json` explains every line. Drafts for French, Spanish and Portuguese are included; they are only used once the language is listed in `languages.json`. The same grammar file goes in every Axecleft module.

Every item the modules make keeps its English name too (for matching), so translated names never break anything.

## The words file

`words.template.json` lists every English word that goes into names this module builds: abilities, materials, base weapons, gems, art objects, item kinds, shop-name words. Copy it to `<code>.words.json` (`fr.words.json`…) and write each word as it should appear in a name, with what the grammar needs to know, in a short notation:

| Write | Meaning |
|---|---|
| `"Longsword": "Épée longue (f)"` | the text and its gender (`m` or `f`) |
| `"Longsword": "(f)"` | the gender only; the name Babele already gives stays |
| `"Keen": "acéré/acérée/acérés/acérées"` | a word that agrees with the noun: masculine / feminine / masculine plural / feminine plural |
| `"Flaming": "de feu (of)"` | a word that moves to another part of the name (`of`: after the noun, with the "of" words; `adj`: with the adjectives) |
| `"Shears": "Ciseaux (m, pl)"` | markers combine |

An empty line keeps the language file's translation (or the English). Words used by several modules (shop names) appear in each module's template: fill them once and copy them.

In a pattern, `{~sculpté/sculptée/sculptés/sculptées}` is a word that agrees with the head: `{object:a:lower}[ {~sculpté/sculptée} dans {material:the:lower}]` gives "une statuette sculptée dans l'ivoire" or "un coffre sculpté dans le chêne".
