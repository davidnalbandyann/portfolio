# DESIGN.md — David Nalbandyan Portfolio

## Style Prompt
Cinematic single-page portfolio in the spirit of a late-credits title sequence: deep midnight canvas, warm gold and cyan accents, Fraunces serif headlines paired with a clean geometric sans for body. Restrained, slow, intentional motion — hero glyphs assemble in golden light, content sections rise with a soft blur-fade, a continuous marquee carries the skill stack across the screen. Editorial typography, generous whitespace, contact block sits in a warm gold spotlight.

## Colors
- `#070a14` — canvas (deep midnight, base background)
- `#0e1424` — surface (cards, code blocks)
- `#e8d39e` — gold accent (highlights, primary CTA, focus underline)
- `#7fc8d8` — cyan accent (links, secondary focus, KPI digits)
- `#f4ecd8` — text primary (warm off-white)
- `#9aa3b8` — text secondary (muted slate)
- `#1a2238` — hairline / border

## Typography
- Display: **Fraunces** (variable serif, 100–900, italic axis) — used for hero title, section heads, project titles
- Body: **Inter** (variable sans, 100–900) — body, labels, navigation
- Mono accent: **JetBrains Mono** — only inside code-fence / tag chips

## Motion Language
- Easing: `cubic-bezier(.2,.7,.2,1)` for entrances (soft settle), `cubic-bezier(.7,0,.2,1)` for exits
- Hero assembly: glyphs rise from `y: 60`, `opacity: 0`, `filter: blur(8px)`, 1.1s, stagger 0.06s
- Section reveal: `y: 40`, `opacity: 0`, `blur(6px)`, 0.8s, scroll-triggered, once
- Marquee: continuous horizontal scroll, 35s linear, duplicated for seamless loop
- Project card hover: `y: -6px`, gold underline grows from 0 to 100% width, 0.4s
- Cursor: custom gold dot + ring, scales 1→1.6 on interactive hover

## What NOT to Do
- No bright pure white text (use `#f4ecd8` to keep warm cinematic feel)
- No rainbow / neon gradients — palette stays navy + gold + cyan only
- No bouncy / springy eases — motion is weighted and slow
- No decorative emoji — use unicode sparingly (· — →) for editorial rhythm
- No auto-playing video or audio
- No pure black `#000` — keep `#070a14` to retain warmth
