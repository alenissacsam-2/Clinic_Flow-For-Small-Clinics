# assets/

Source media and retired code. **Nothing here is deployed or compiled** — that is the
point of the folder. Only `public/` is served, so anything sitting in `public/` is
downloadable by anyone whether or not the app links to it; and only `src/` is type-checked
and bundled, so a file parked here costs nothing.

This project is **not under version control** (no `.git`), so superseded work is moved
here rather than deleted. Check with `git init` before assuming anything is recoverable.

## retired-components/

| file | what it was |
| --- | --- |
| `manifesto.tsx` | the dark band whose sentence lit word by word |
| `day-timeline.tsx` | the 24-hour dial and its six event cards |
| `scrub-text.tsx` | the word-by-word reveal primitive, used only by the manifesto |
| `stack-panels.tsx` | three sticky full-viewport panels, used only by HowItWorks |

**The first three** were replaced by `src/components/landing/day-chapter.tsx`. They were two
adjacent dark sections narrating the same six beats — the sentence *listed* the clinic day
and the timeline *showed* it, back to back.

`DayChapter`'s first attempt pinned the sentence above the cards so each clause lit as its
own card arrived. That synchronised the duplication without removing it: every beat was
still written twice, once as a clause and once as a card title plus body, so pinning them
together only guaranteed you read both. It was rejected. The version that shipped deletes
one copy outright — the clause **is** the beat's headline, there are no card titles, and
the six clauses read top to bottom as the original manifesto sentence.

`scrub-text.tsx` retired with them because its logic lives on as `ClauseWord`, which
anchors each word to its own beat's scroll rather than to one page-wide ramp.

Kept because the round dial in `day-timeline.tsx` is a nicer piece of work than anything
that replaced it, and may be worth reviving elsewhere.

**`stack-panels.tsx` retired separately, and for the opposite reason: it worked.** It was
`HowItWorks` that was wrong — three pinned viewports (2,921px, 23% of the whole landing
page) to carry three sentences, which left every panel half empty and had to be padded with
a giant ghosted numeral. That section is compact alternating rows now. The primitive is kept
because pinned stacking is a good device looking for the right content, and its
`prefers-reduced-motion` rule is still in `globals.css`, so reviving it needs only the
import put back.

## brand-sources/

Full-resolution originals for the brand mark. The optimised copies that actually ship
live in `public/brand/`. These were previously at `public/brand/_original/`, where
~470 KB of source imagery was being deployed and served for no reason.

## hero-archive/

The previous hero clip and its poster, kept because they are **far smaller than what
currently ships**:

| file | size |
| --- | --- |
| `hero-previous.mp4` | ~1.0 MB |
| `hero-previous.webm` | ~872 KB |
| `public/hero.mp4` (live) | **10.8 MB** |

The live clip is ten times the weight of the one it replaced, aimed at an audience of
solo doctors on low-end Android in Indian clinics. `src/components/landing/hero-video.tsx`
already refuses to fetch it under reduced-motion, Data Saver or a 2G/3G connection, and
since the playback reconciler was rewritten it also fetches **nothing at all** for a
visitor who never scrolls the hero into view — but everyone who does pays the full 10.8 MB
for a decorative background.

Two ways out, whenever someone gets to it:

1. **Re-encode the current clip.** Needs `ffmpeg`, which is not installed on the dev
   machine — that is the only reason it has not been done:

   ```bash
   ffmpeg -i public/hero.mp4 -c:v libx264 -crf 30 -preset slow -an -vf "scale=1280:-2" -movflags +faststart public/hero-new.mp4
   ```

   ```bash
   ffmpeg -i public/hero.mp4 -c:v libvpx-vp9 -crf 40 -b:v 0 -an -vf "scale=1280:-2" public/hero.webm
   ```

   Then list the WebM first in `hero-video.tsx` so browsers that support it take the
   smaller file.

2. **Go back to this clip.** `hero-previous.mp4` + `hero-previous.webm` are already an
   encoded, matched pair. Moving them into `public/` and pointing the component at both
   costs 10 MB less today, at the price of the older footage.

Do **not** simply add `hero-previous.webm` as a `<source>` next to the current
`hero.mp4`: they are different films, so visitors would see different video depending
on codec support. `hero-video.tsx` says the same thing at its `<source>` tag.
