# Starbucks Test — SYRA-EDU-BUS-03

A 3D educational web game for MBA/MPA students, based on `Situation5_Starbucks_MarketingStrategy_AR.docx`.

## Run locally
From the project folder:
```
python tools/devserver.py 8777      # or any static file server
```
Then open `http://127.0.0.1:8777/` (Chrome / Edge; a dedicated graphics card and headphones are recommended).

Quick test links (developer only):
- `?dev=lobby` · `?dev=office` · `?dev=meeting` — jump to a scene.
- `?dev=meeting&preset=good` — the meeting, with the state of a player who did the office work correctly (E1 path).

## Deploy (Vercel)
The project folder is a fully static site. `.vercelignore` excludes `_src/` (raw source files, ~1 GB) and `tools/`.
Deployed assets ≈ 130 MB.

## Structure
| Path | Contents |
|---|---|
| `data/lines.ar.json` | All the Arabic dialogue (`src: doc` = word for word from the document, `src: adapted` = needs a language review) + each character's voice |
| `assets/vo/ar/` | Voice recordings (Microsoft neural TTS) + the timing of each word for the lips and subtitles |
| `js/story/flow.js` | The scene sequence S1→S8 |
| `js/story/state.js` | State variables, evidence M1–M10 and the ending logic E1–E4 |
| `js/story/endings.js` | The four plans, the tension, the January card and market index, the final review |
| `js/ui/docs.js` | Documents and finance tasks |
| `js/actors/character.js` | Characters: mocap animation, visemes, blinking, gaze |
| `js/world/*` | The building, the city, the lighting, the video-call scene |
| `tools/` | Asset download, animation baking, voice generation, automated tests (Playwright) |

## Regenerate the voices after editing the text
```
pip install edge-tts
python -I tools/gen_voice.py ar        # only regenerates lines whose text changed
```

## What we used for each part

| Part | Tool / source | Licence | Notes |
|---|---|---|---|
| 3D engine | [three.js](https://threejs.org) r160 (WebGL2) | MIT | No build step; ES modules + importmap |
| Building, offices and halls | Built in code (`js/world/building.js`) | — | Walls, ceilings, beams and glass in code, with real PBR materials |
| Materials (brick, wood, marble, asphalt, tiles) | [Poly Haven](https://polyhaven.com) + the brick and wood materials from the `demo/` demo | CC0 | brick_wall_005, wood_floor_deck, walnut_veneer, concrete_pavers… |
| Furniture and props | Poly Haven (desk, lobby chairs, industrial lamps, picture frames, fire extinguisher, plants, cake…) + meeting chairs and tables in code | CC0 | |
| Trees and shrubs | Poly Haven (island_tree_02, shrub_02), thinned with `tools/thin_tree.py` | CC0 | Wind motion in a vertex shader |
| Sky and lighting | Poly Haven HDRI (kloofendal_38d_partly_cloudy_puresky) + a sun at a November-morning angle | CC0 | Eye adaptation indoors/outdoors, GTAO, Bloom, colour grading |
| City, road, cars and shops | In code (`js/world/city.js`, `traffic.js`) | — | Procedural cars with clear-coat paint, traffic lights, pedestrians |
| Blowing leaves | In code (`js/world/leaves.js`), InstancedMesh | — | |
| Characters (14 + 4 on the street) | [Microsoft Rocketbox](https://github.com/microsoft/Microsoft-Rocketbox), facial versions | MIT | 175 blendshapes (15 visemes + ARKit); we use 31 |
| Motion (walking, running, sitting, talking, emotions, phone, coffee, presenting…) | Rocketbox Animations library (motion capture) | MIT | 99 clips baked into a compressed binary file (`tools/bake_anims.html`) |
| Hands on the desk | IK in code (`js/actors/deskhands.js`) | — | The shoulder and elbow are calculated so the hand reaches the object |
| Facial expressions, blinking, gaze and breathing | In code (`js/actors/character.js`) | — | An emotion for each line + head/eyebrow movement driven by the voice |
| Speech (voices) | [edge-tts](https://github.com/rany2/edge-tts), Microsoft neural Arabic voices | Tool: MIT; the service is unofficial | For internal demos; for an official release, Azure Speech or voice actors are recommended |
| Lip-sync | Word timings from edge-tts + Arabic letters mapped to visemes + voice loudness | — | |
| Ambient sound and effects | Web Audio in code (filtered noise: city, air conditioning, keyboard, footsteps, coffee machine, breathing, car horns) | — | |
| Character paths | A* on a 25 cm grid (`js/world/nav.js`) | — | They walk around furniture and go through doors |
| Fonts | IBM Plex Sans Arabic, Noto Naskh Arabic, Inter (Google Fonts) | OFL | |
| Automated testing | Playwright + Microsoft Edge (`tools/drive.py`) | Apache-2.0 | |
| Hosting | Vercel | — | https://third-place-bus3.vercel.app |

## Sources and licences
- Characters and animation: Microsoft Rocketbox (MIT) — https://github.com/microsoft/Microsoft-Rocketbox
- Furniture, trees, materials and sky: Poly Haven (CC0)
- 3D library: three.js r160 (MIT)
- The logo in the game is a generic cup symbol; the real brand logo is not used. The market index is an "educational simulation" with fictional data.
