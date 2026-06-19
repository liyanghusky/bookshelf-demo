# -*- coding: utf-8 -*-
"""Build a unified books.json from raw Project Gutenberg texts.

Strips PG boilerplate, splits into chapters/poems, extracts readable excerpts.
"""
import json, re, os

RAW = os.path.join(os.path.dirname(__file__), "raw")

# (file, title, author, category, accent, blurb)
META = [
    ("pride",        "Pride and Prejudice",        "Jane Austen",          "fiction",
     "A sharp, witty comedy of manners on love, class and first impressions in Regency England."),
    ("moby",         "Moby-Dick",                  "Herman Melville",      "fiction",
     "Ishmael ships aboard the Pequod under Captain Ahab's monomaniacal hunt for a white whale."),
    ("alice",        "Alice's Adventures in Wonderland", "Lewis Carroll",  "fiction",
     "A curious girl tumbles down a rabbit hole into a world of riddling logic and talking creatures."),

    ("holmes",       "The Adventures of Sherlock Holmes", "Arthur Conan Doyle", "mystery",
     "Twelve cases of the world's first consulting detective and his cool deductive genius."),
    ("moonstone",    "The Moonstone",              "Wilkie Collins",       "mystery",
     "A cursed Indian diamond vanishes in an English country house — the first great detective novel."),
    ("hound",        "The Hound of the Baskervilles", "Arthur Conan Doyle","mystery",
     "A spectral hound stalks the moors of Devon, and Holmes hunts the truth behind the legend."),

    ("timemachine",  "The Time Machine",           "H. G. Wells",          "scifi",
     "An inventor travels to the year 802,701 and finds humanity split into two strange species."),
    ("frankenstein", "Frankenstein",               "Mary Shelley",         "scifi",
     "Victor Frankenstein animates a creature from dead matter — and is hunted by his own creation."),
    ("warofworlds",  "The War of the Worlds",      "H. G. Wells",          "scifi",
     "Martian war machines land in England and the thin veneer of civilization collapses."),

    ("meditations",  "Meditations",                "Marcus Aurelius",      "philosophy",
     "The private notebook of a Roman emperor on duty, mortality and the discipline of the mind."),
    ("tao",          "Tao Te Ching",               "Lao Tzu",              "philosophy",
     "Eighty-one verses on the Way — yielding, simplicity, and the power of non-action."),
    ("beyond",       "Beyond Good and Evil",       "Friedrich Nietzsche",  "philosophy",
     "A daring attack on traditional morality and a call for a philosophy of the future."),

    ("leaves",       "Leaves of Grass",            "Walt Whitman",         "poetry",
     "Sprawling, ecstatic free verse celebrating the body, democracy and the American self."),
    ("dickinson",    "Poems",                      "Emily Dickinson",      "poetry",
     "Terse, electric lyrics on death, immortality and the inner life, dashed and slant-rhymed."),
    ("sonnets",      "The Sonnets",                "William Shakespeare",  "poetry",
     "154 sonnets on love, time, beauty and mortality — the summit of the English lyric."),

    # --- additional English titles ---
    ("greatexp",     "Great Expectations",         "Charles Dickens",      "fiction",
     "The orphan Pip is raised to be a gentleman by a mysterious benefactor — and learns its cost."),
    ("signfour",     "The Sign of the Four",       "Arthur Conan Doyle",   "mystery",
     "A pact of stolen Agra treasure, a one-legged man, and Holmes at his most restless and brilliant."),
    ("invisible",    "The Invisible Man",          "H. G. Wells",          "scifi",
     "A scientist discovers invisibility — and the power unhinges him into terror and tyranny."),
    ("leagues",      "Twenty Thousand Leagues Under the Sea", "Jules Verne", "scifi",
     "Captain Nemo and the Nautilus carry three captives on a wondrous, vengeful voyage beneath the waves."),

    # --- Chinese classics (zh_*.txt) ---
    ("zh_24264",     "紅樓夢",                       "曹雪芹",                "fiction",
     "賈寶玉與林黛玉、薛寶釵的情緣興衰,寫盡一個鐘鳴鼎食之家的繁華與幻滅。"),
    ("zh_23950",     "三國演義",                     "羅貫中",                "fiction",
     "漢末群雄並起,魏蜀吳三分天下,英雄豪傑與權謀征伐的千古史詩。"),
    ("zh_23962",     "西遊記",                       "吳承恩",                "fiction",
     "孫悟空護送唐僧西天取經,歷九九八十一難,降妖伏魔的神魔奇譚。"),
    ("zh_23863",     "水滸傳",                       "施耐庵",                "fiction",
     "一百零八位好漢聚義梁山,替天行道,寫盡亂世逼上梁山的悲壯。"),
    ("zh_24051",     "李娃傳",                       "白行簡",                "fiction",
     "唐傳奇名篇:滎陽公子與長安名妓李娃的離合悲歡,情義動人。"),
    ("zh_7337",      "道德經",                       "老子",                  "philosophy",
     "八十一章,論「道」與「德」、無為與柔弱,中國思想的源頭活水。"),
    ("zh_23839",     "論語",                         "孔子及弟子",            "philosophy",
     "孔門師徒的言行語錄,仁、禮、學、政,塑造東亞兩千年的處世之道。"),
    ("zh_7341",      "列子",                         "列禦寇",                "philosophy",
     "道家寓言集:愚公移山、杞人憂天、夸父逐日,以奇想說玄理。"),
]

# books whose raw text is Chinese and needs CJK-aware parsing
ZH = {"zh_24264", "zh_23950", "zh_23962", "zh_23863", "zh_24051",
      "zh_7337", "zh_23839", "zh_7341"}

CATEGORIES = [
    ("fiction",    "Fiction",    "Novels & tales"),
    ("mystery",    "Mystery",    "Crime & detection"),
    ("scifi",      "Science Fiction", "Worlds to come"),
    ("philosophy", "Philosophy", "Ideas & ethics"),
    ("poetry",     "Poetry",     "Verse & song"),
]

POETRY = {"leaves", "dickinson", "sonnets"}

def strip_boilerplate(text):
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    m = re.search(r"\*\*\* ?START OF TH(IS|E) PROJECT GUTENBERG EBOOK.*?\*\*\*", text, re.I)
    if m:
        text = text[m.end():]
    m = re.search(r"\*\*\* ?END OF TH(IS|E) PROJECT GUTENBERG EBOOK", text, re.I)
    if m:
        text = text[:m.start()]
    return text.strip("\n")

# a heading line: keyword+numeral / spelled-out book / lone roman+dot, then a
# short title that must NOT contain quotes or parens (those mark editorial notes)
HEAD_RE = re.compile(
    r"^\s*(?:"
    r"(?:CHAPTER|Chapter|LETTER|Letter|ADVENTURE|Adventure|BOOK|Book)\s+[\dIVXLC]+"
    r"|THE\s+(?:FIRST|SECOND|THIRD|FOURTH|FIFTH|SIXTH|SEVENTH|EIGHTH|NINTH|TENTH)\s+BOOK"
    r"|[IVXLC]{1,6}\.(?=\s|$)"   # roman numeral + dot, then whitespace/EOL (not "C.C.H.")
    r")[^\"(]{0,55}$"            # optional short title, no quote/paren (excludes notes)
)
NOTE_RE = re.compile(r"gutenberg|etext|transcrib|proofread|public domain", re.I)
FRONT_RE = re.compile(r"contents|project gutenberg|illustration|produced by|"
                      r"start of|end of|preface|introduction by|editor", re.I)

def find_body_start(paras):
    """Index of the first real narrative paragraph, skipping TOC / front matter."""
    for i, p in enumerate(paras):
        if len(re.findall(r"\b[IVXLC]{1,5}\.", p)) >= 4:   # roman-numeral list = TOC
            continue
        if len(re.findall(r"(?i)chapter\s+\d", p)) >= 3:   # "Chapter 1 ... Chapter 2" = TOC
            continue
        if FRONT_RE.search(p):
            continue
        if len(p) >= 200:
            return i
    return 0

def split_prose(text):
    """Return list of (title, [paragraphs]).

    Drops the table of contents by keeping only headings that are spaced far
    apart (body), then requires a real run of prose (>=500 chars) after each.
    """
    lines = text.split("\n")
    raw_heads = [i for i, ln in enumerate(lines)
                 if 0 < len(ln.strip()) <= 70 and HEAD_RE.match(ln.strip())]
    # body headings sit far apart; TOC headings are densely packed
    heads = [h for k, h in enumerate(raw_heads)
             if k + 1 == len(raw_heads) or raw_heads[k + 1] - h >= 12]
    chapters = []
    if heads:
        bounds = heads + [len(lines)]
        for j, start in enumerate(heads):
            end = bounds[j + 1]
            title = re.sub(r"\s+", " ", lines[start].strip().rstrip(".]").strip())
            paras = paragraphs("\n".join(lines[start + 1:end]))
            prose_len = sum(len(p) for p in paras)
            if prose_len >= 500 and not NOTE_RE.search(paras[0]):   # real chapter
                chapters.append((title, paras))
            if len(chapters) >= 5:
                break
    if len(chapters) < 3:                             # fallback: skip front matter, chunk
        paras = paragraphs(text)
        start = find_body_start(paras)
        body = paras[start:]
        chapters = [("Section %d" % (j // 5 + 1), body[j:j + 5])
                    for j in range(0, min(len(body), 25), 5)]
    return chapters

def paragraphs(body):
    blocks = re.split(r"\n[ \t]*\n", body)
    out = []
    for b in blocks:
        joined = " ".join(part.strip() for part in b.split("\n") if part.strip())
        joined = re.sub(r"\s+", " ", joined).strip()
        if len(joined) > 40 and not joined.isupper():
            out.append(joined)
    return out

def split_poetry(text):
    """Return list of (title, [lines-as-stanzas]) treating blank-sep blocks as poems."""
    blocks = re.split(r"\n[ \t]*\n", text)
    poems = []
    n = 0
    for b in blocks:
        lines = [ln.rstrip() for ln in b.split("\n") if ln.strip()]
        if len(lines) < 3:
            continue
        avg = sum(len(l) for l in lines) / len(lines)
        if avg > 55:                       # long lines = prose preface, not verse
            continue
        if FRONT_RE.search(" ".join(lines[:2])):
            continue
        # first short all-ish line may be a title/number
        n += 1
        title = "Poem %d" % n
        body = lines
        if len(lines[0]) < 45 and (lines[0].isupper() or re.match(r"^[IVXLC0-9]+\.?$", lines[0].strip())):
            title = lines[0].strip().rstrip(".")
            body = lines[1:]
        if body:
            poems.append((title, body))
        if n >= 8:
            break
    return poems

# Chinese chapter markers: 第N回/章/篇/節/卷  OR  名+第N (e.g. 學而第一)
ZH_HEAD = re.compile(
    r"^第[一二三四五六七八九十百千零〇0-9]+[回章節篇卷].{0,40}$"
    r"|^.{1,8}第[一二三四五六七八九十]+$"
)
ZH_JUNK = re.compile(r"^[-—=*＊·．。\s]+$")

def clean_zh(line):
    return re.sub(r"\s+", "", line).strip()

def split_zh(text):
    """Split a Chinese classic into chapters; each non-empty line is a paragraph."""
    lines = text.split("\n")
    heads = [i for i, ln in enumerate(lines)
             if 0 < len(ln.strip()) <= 50 and ZH_HEAD.match(ln.strip())]
    chapters = []
    if len(heads) >= 2:
        bounds = heads + [len(lines)]
        for j, start in enumerate(heads):
            end = bounds[j + 1]
            title = clean_zh(lines[start])
            paras = [clean_zh(x) for x in lines[start + 1:end]
                     if x.strip() and not ZH_JUNK.match(x.strip())]
            paras = [p for p in paras if len(p) >= 6][:6]
            if paras:
                chapters.append((title, paras))
            if len(chapters) >= 5:
                break
    if not chapters:                                  # fallback: skip latin front matter, chunk
        body = [clean_zh(x) for x in lines
                if len(x.strip()) >= 5 and not ZH_JUNK.match(x.strip())
                and not re.search(r"[A-Za-z]{4,}", x)]
        body = [p for p in body if len(p) >= 5]
        chapters = [("第%d節" % (j // 6 + 1), body[j:j + 6])
                    for j in range(0, min(len(body), 30), 6)]
    return chapters

def build():
    books = []
    for fid, title, author, cat, blurb in META:
        raw = open(os.path.join(RAW, fid + ".txt"), encoding="utf-8", errors="replace").read()
        text = strip_boilerplate(raw)
        if fid in ZH:
            secs = split_zh(text)[:5]
            chapters = [{"title": t, "type": "prose", "paragraphs": p[:6]} for t, p in secs]
        elif fid in POETRY:
            secs = split_poetry(text)[:8]
            chapters = [{"title": t, "type": "verse", "lines": ln[:40]} for t, ln in secs]
        else:
            secs = split_prose(text)[:5]
            chapters = [{"title": t, "type": "prose", "paragraphs": p[:6]} for t, p in secs]
        if fid in ZH:                                 # Chinese: count characters, not words
            words = sum(len("".join(c["paragraphs"])) for c in chapters)
        else:
            words = sum(len(" ".join(c.get("paragraphs", c.get("lines", []))).split()) for c in chapters)
        books.append({
            "id": fid, "title": title, "author": author, "category": cat,
            "blurb": blurb, "words": words, "chapters": chapters,
        })
        print("%-14s %2d chapters  ~%5d words" % (fid, len(chapters), words))
    data = {
        "source": "Project Gutenberg (public domain)",
        "categories": [{"id": c, "name": n, "tagline": t} for c, n, t in CATEGORIES],
        "books": books,
    }
    out = os.path.join(os.path.dirname(__file__), "books.json")
    json.dump(data, open(out, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print("\nwrote", out, "  %.0f KB" % (os.path.getsize(out)/1024))

if __name__ == "__main__":
    build()
