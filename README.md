# Primordial Velocity

A cinematic, fan-made Spline + Three.js parallax showcase pairing four Tensura Primordial Demons with the supercars behind their names:

- Diablo / Noir — Lamborghini Diablo
- Testarossa / Blanc — Ferrari Testarossa
- Carrera / Jaune — Porsche Carrera GT
- Ultima / Violet — Ultima GTR

## Run locally

```bash
npm install
npm run dev
```

Production check:

```bash
npm run build
npm run preview
```

## Interaction

- Scroll through the long prologue to reveal four story beats and the final title card.
- The live Spline core responds to pointer position and scroll-directed rotation on desktop.
- Move the pointer over each dossier for Three.js depth and camera lean.
- Each chapter opens with a cinematic act card, then crossfades into its interactive dossier.
- Use the fixed dossier rail on desktop for direct navigation.
- Open **Field notes** or any **Inspect dossier** button for supporting context.
- The sound toggle enables a generative low-frequency score and interface cues; it starts off.
- Reduced-motion preferences automatically switch to static fallbacks.

## Implementation

- A real `@splinetool/runtime` scene is lazy-loaded from the self-hosted `public/spline/primordial-core.splinecode`; programmatic named-object control links it to scroll and pointer input.
- The Spline prologue retains a local animated fallback for WebGL, loading, or network failure.
- Three.js 2.5D planes, particles, transparent HUD layers, pointer parallax, and scroll lerping power all four acts.
- Fixed letterboxing, editorial subtitles, timecode, act labels, flash cuts, title cards, and image crossfades create the motion-picture treatment.
- `SRGBColorSpace` is applied to renderer, loaded image textures, and canvas textures.
- All Three.js canvases are responsive via `ResizeObserver` and rendering is activated near the viewport.
- Four generated scene assets live in `public/assets/`.

## Research references

- [Tensura Wiki — Diablo](https://tensura.fandom.com/wiki/Diablo)
- [Tensura Wiki — Testarossa](https://tensura.fandom.com/wiki/Testarossa)
- [Tensura Wiki — Carrera](https://tensura.fandom.com/wiki/Carrera)
- [Tensura Wiki — Ultima](https://tensura.fandom.com/wiki/Ultima)
- [Porsche Newsroom — Carrera GT](https://newsroom.porsche.com/en/2025/history/porsche-25-years-world-premiere-carrera-gt-40609.html)

This is an unofficial fan project. Character and automotive properties belong to their respective rights holders.
