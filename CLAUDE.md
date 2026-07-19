# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

[qagiyda.com](https://www.qagiyda.com) — a static reference site collecting the orthography/spelling rules (imla qaǵıydaları) of the Karakalpak language. Built with Jekyll 4. Modeled after [pravilna.by](https://pravilna.by/).

Site content is written in Karakalpak (Latin script, `lang="kaa"`), including UI strings in `_includes/`. Keep all user-facing text in Karakalpak, and preserve the special characters (á, ǵ, ń, ó, ú, ı, w, x) exactly — they are distinct letters, not typos.

Rule content is sourced from *Qaraqalpaq tili imla qaǵıydalarınıń jıynaǵı* (Nókis – «Bilim» – 2016); see `references.md`. Do not invent or alter linguistic rules — only transcribe from the cited source.

## Commands

```bash
bundle install                # install gems
bundle exec jekyll serve      # dev server at http://localhost:4000/
bundle exec jekyll build      # build to _site/
```

There are no tests, linters, or CI. The site has no external runtime dependencies — no CDN scripts, no third-party services.

## Architecture

**Rules are a Jekyll collection, not posts.** `_config.yml` defines the `rules` collection with `permalink: /:collection/:name/`, so `_rules/01.md` publishes at `/rules/01/`. Adding a rule means:

1. Create `_rules/NN.md` with front matter: `layout: post`, `title`, `section`, `chapter`.
2. Add a link to it manually in `index.html` — the homepage table of contents is hand-written HTML grouped under `<h2>`/`<h3>` headings, not generated from the collection.

Numeric filenames determine both URL and the prev/next ordering used by `_layouts/post.html`, so renumbering a file changes its permalink and breaks inbound links.

**Layouts.** `default.html` is the shell (head, `header.html`, `footer.html`, and the deferred `search.js`). `post.html` renders a rule: a `section → chapter` breadcrumb from front matter, the title, then prev/next navigation via `page.previous` / `page.next`. `page.html` is a bare passthrough used by standalone pages like `references.md`.

**Search is local and dependency-free.** `search.json` is a Liquid template that splits each rule's rendered HTML on `</p>` and emits one record per paragraph (`u`rl, `t`itle, `s`ection, `c`ontent) — currently 129 records, ~38 KB. `assets/js/search.js` fetches it once on first focus and does substring matching in the browser. Nothing is precomputed at deploy time beyond the normal `jekyll build`.

The critical piece is `fold()` in `search.js`: it lowercases, NFD-decomposes, strips combining marks, and maps `ı → i`, so a query typed without diacritics (`dawissiz`) matches `dawıssız`. It folds **one character at a time** and returns a parallel `map` array from folded offsets back to original-string offsets. That map is what lets snippets highlight the original text with its diacritics intact — if you change `fold()` to fold whole strings at once, NFD will change the string length and highlight offsets will silently drift. Any new letter-form variant (e.g. apostrophe digraphs like `g'`) needs handling there.

**CSS** is hand-written, no framework or preprocessor: `assets/css/main.css` for the site, `assets/css/search.css` for the autocomplete dropdown. Both are linked directly from `default.html`.
