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
- Voices: edit `data/lines.ar.json`, then `python -I tools/gen_voice.py ar` (edge-tts, word timings for lip-sync).
- Models: `python -I tools/fetch_polyhaven.py` (CC0) and `python -I tools/fetch_cafe_models.py` (Sketchfab CC BY,
  needs `SKETCHFAB_TOKEN` in `.env.local`); credits in `assets/cafe_models/CREDITS.json` and in the game.
- Automated play-throughs (headless Edge): `python -I tools/drive.py <outdir> s1 "?dev=s1"`, `... s2 "?dev=s2"`.

Historical facts: Harvard Business Publishing case 504-016 (premise only, from the public listing) and the
Starbucks FY2002 Form 10-K (5,886 stores). Everything else — café, people, dialogue, store figures — is illustrative.
