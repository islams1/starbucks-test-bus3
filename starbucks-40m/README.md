# Seven Minutes — the $40 million service decision (Starbucks case)

A first-person 3D game built from `Starbucks_Scenario_AR.md` / `_EN.md` (Case Studies › Business & Strategy).
The player spends one day in the "Al-Midan" café: measures the pickup wait at the morning peak and in the quiet
afternoon, works out the break-even order lift with the finance partner upstairs, and recommends a decision to the
investment committee. Scored out of 100; the debrief puts the memo beside the published case.

This folder has everything the game uses (its own copies of the engine, people, animations, models, textures and
voices) and nothing of the other games in this repository.

- Run: `python -I tools/devserver.py` (inside this folder), then open http://localhost:8791
  - `?lang=en` — English subtitles and UI (voices stay Arabic)
  - `?dev=s1` / `s2` / `s3` / `s4` / `debrief` — jump to a scene; `?dev=walk` — walk around the set
  - `?glass=0` (or `?q=low`) — the plain CSS panels instead of the liquid glass
- Sets: the café is the scanned "Cafe-Misti" interior and the boardroom the "Meeting room" model (Sketchfab, CC BY),
  loaded by `js/world/scan.js`, which reads the colliders and the walk grid off the meshes themselves.
  `tools/view.html?m=<slug>` and `tools/plan.html?m=<slug>` inspect a model.
- UI: the cards are liquid glass after `../glass.md` — `js/ui/glass.js` is the composer's last pass (lens, frost,
  rim, and a per-card dim measured on the GPU so the text keeps 4.5 : 1), `css/glass.css` the page side. The paper
  props (notebook, notepad, comment card) and the tablet stay physical.
- Voices: edit `data/lines.ar.json`, then `python -I tools/gen_voice.py ar` (edge-tts, word timings for lip-sync).
- Models: `python -I tools/fetch_polyhaven.py` (CC0) and `python -I tools/fetch_cafe_models.py` (Sketchfab CC BY,
  needs `SKETCHFAB_TOKEN` in `.env.local`); credits in `assets/cafe_models/CREDITS.json` and in the game.
- Contact (`js/actors/contact.js`): nobody passes through the furniture or through each other. The venues' tables,
  counters and chairs (knee to head height) go into one BVH; every frame arms are lifted out of surfaces (two-bone IK),
  standing bodies slide out of counters, people step apart, and `sit()` fits each person to the chair that is really
  there. `?qa=1` measures it all (`__clip()` lists the worst depths in cm with where they happened), `?nocontact=1`
  turns the fixes off for comparison, `?dev=faces` lines up the speaking cast for close-ups.
- Automated play-throughs (headless Edge): `python -I tools/drive.py <outdir> s1 "?dev=s1"`, `... s2 "?dev=s2"`,
  `... s3 "?dev=s3"` (boardroom), `... glass ""` (menu, instructions and HUD glass).

Historical facts: Harvard Business Publishing case 504-016 (premise only, from the public listing) and the
Starbucks FY2002 Form 10-K (5,886 stores). Everything else — café, people, dialogue, store figures — is illustrative.
