# Bookshelf Demo — Build Contract (shared by all styles)

You are building ONE self-contained reading website in a specific visual style.
Content and structure are FIXED below; only the aesthetic is yours to design.

## Output
- A single file: `styles/<NN-name>/index.html`
- Everything inline (CSS in `<style>`, JS in `<script>`). NO external CSS/JS/font
  files of your own, NO build step, NO frameworks. Plain HTML/CSS/vanilla JS.
- Web fonts: you MAY use Google Fonts via `<link>` to fit the aesthetic.
- Must work by double-clicking the file (opened over `file://`).

## Data — load it like this (do NOT fetch())
Add ONE script tag, then read the global `window.BOOKS`:
```html
<script src="../../data/books.js"></script>
```
`fetch()` is blocked over file:// — always use `window.BOOKS`.

### Shape of window.BOOKS
```js
{
  source: "Project Gutenberg (public domain)",
  categories: [ { id:"fiction", name:"Fiction", tagline:"Novels & tales" }, ... ],  // 5 of them
  books: [
    {
      id: "pride",
      title: "Pride and Prejudice",
      author: "Jane Austen",
      category: "fiction",          // matches a category id
      blurb: "A sharp, witty comedy of manners ...",
      words: 1469,
      chapters: [
        // PROSE chapter:
        { title:"Chapter I", type:"prose", paragraphs:[ "para text", "para text", ... ] },
        // VERSE chapter (poetry books only):
        { title:"Poem 1", type:"verse", lines:[ "line", "line", ... ] }
      ]
    }, ...  // 15 books total
  ]
}
```
- categories (ids): `fiction`, `mystery`, `scifi`, `philosophy`, `poetry` — 3 books each.
- A chapter is EITHER `type:"prose"` (render `paragraphs` as `<p>`) OR
  `type:"verse"` (render `lines`, preserving line breaks, stanza feel).
- Text may contain em-dashes/curly quotes (UTF-8). Set `<meta charset="utf-8">`.

## Required screens / behavior (single-page app, JS view switching)
All three views live in one index.html; switch with JS (no page reloads):

1. **Home / Library** — site title + a browse experience over all 15 books,
   grouped or filterable by the 5 categories. Show cover (you design it from
   title/author/accent — no image files), title, author. Clicking a book opens it.
   A category filter (all / per category) is required.

2. **Book detail** — title, author, category, blurb, a chapter/poem list, and a
   clear "Start reading" affordance. Clicking a chapter opens the reader at it.

3. **Reader** — renders the selected chapter's text beautifully and legibly.
   Required controls: previous/next chapter, a chapter jump (list or dropdown),
   font-size adjust (at least A- / A+), and back-to-book / back-to-library.
   Reading width and line-height must be comfortable. This is the core screen —
   make the typography genuinely good in your style.

## Covers
No image assets. Generate covers from CSS (gradients, type, shapes, patterns,
SVG you inline). Use the book title/author. Each category may share a motif.

## Quality bar
- Fully responsive (looks right on phone and desktop widths).
- Smooth, considered interactions (hover, transitions) appropriate to the style.
- Commit FULLY to the assigned aesthetic — colors, type, spacing, motifs, texture,
  cursor, even the empty/hover states. This is a taste test; be bold and coherent,
  not generic. Avoid the default "Bootstrap-ish" look unless the style IS that.
- Accessible-ish: real contrast for body text, semantic HTML, keyboard-focusable.

## Do NOT
- Do not modify anything under `data/`. Do not change other styles' folders.
- Do not invent extra books or change the data shape.
- Do not leave TODOs or placeholder lorem ipsum — wire it to real window.BOOKS data.
