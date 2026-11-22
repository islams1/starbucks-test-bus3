# Feedback on the Interactive Books AI Agent Engineering Execution Plan v1.0

**From:** Islam Sherif (3D web demos: Situations 5 and 6, Flight 1549, Seven Minutes, The Store on the Table)  
**Date:** 22 November 2026  
**Attached:** `Islam Sherif - contracts-proposal.md`, a draft of the nine JSON contracts with one worked example (input to IB-02 / IB-03)

---

## 1. Summary

I have read the full plan and agree with its direction: a shared runtime driven by validated JSON, a reuse-first
library, and deterministic checks that gate every LLM output. That is the right fix for the problem my demos show:
each one is a separate hand-built application.

My main concern is that the contracts and the core verb set are built around **spatial object tasks** (inspect,
pick up, use). Most of our client scenarios are carried by **conversation, documents and decisions**. I suggest
adding those to the contracts before IB-02 is approved (see 3.1).

## 2. Tasks I propose to own or support

### Owner (I am responsible for delivering these)

| Task | Depends on | Why |
|---|---|---|
| **IB-01** Audit the demos (my five demos) | Nothing, can start now | I built them, and the audit has already found licensing items (Section 4). |
| **IB-07** GLB ingestion and optimisation | IB-06 | I have normalised scale, pivots and textures for Sketchfab, Poly Haven and Rocketbox assets across the demos. |
| **IB-10** Scenario + experience planning agents | IB-03, IB-09 | I turned each client scenario into states, dialogue, decisions and feedback by hand for the demos; this task automates that step, and the contracts it produces are the ones I drafted. |
| **IB-13** 3D generation provider adapters | IB-07, IB-08 | It follows directly from IB-07: generated models need the same scale, pivot, texture and collider normalisation before they can be used. |
| **IB-15** QA harness | IB-14 | The demos already have scripted headless-browser playthroughs (Playwright + Edge, desktop and mobile profiles) that replay a JSON step list. |

### Support (another owner leads; I contribute)

| Task | Depends on | What I contribute |
|---|---|---|
| **IB-03** Contracts | IB-02 | The draft contracts (`Islam Sherif - contracts-proposal.md`). |
| **IB-04** Minimal shared runtime | IB-02 | Three.js runtime work from the demos: loading, first-person and seated cameras, navigation, avatars, lip-sync, mobile tuning. |
| **IB-05** Interaction registry + state machine | IB-03, IB-04 | Each demo has a hand-coded version of this (`flow.js`, `hotspots.js`, `handson.js`); I can turn the common parts into the generic component. |

These are proposals for the assignment meeting.

## 3. Technical concerns and suggestions

### 3.1 The contracts need dialogue, documents and cameras, not only objects

The demos and the scenario library (Aviation, Business & Strategy, Finance, First Aid, Hygiene, Petroleum) depend
on things the current contracts do not describe:

- **Dialogue and character performance:** who speaks, the line, its emotion, gaze target, gestures, lip-sync, and
  conversation between NPCs. The Store on the Table is mostly a committee conversation.
- **Information interactions:** reading a memo, comparing figures on a tablet, sorting cards, filling in and signing
  a recommendation. These are where most of the learning evidence comes from in the business cases.
- **Camera modes beyond first person:** seated, cinematic shots, a replay screen, a cockpit view.

**Suggestion:** add a `dialogue` / `performance` section to the experience graph, a set of UI-panel interactions
(`read`, `choose`, `fill`, `sign`, `sort`) to the core verb registry, and `camera` modes to `world_spec`. The demos'
`lines.<lang>.json` format (speaker, emotion, text, voice file) is a working starting point for the dialogue part.

### 3.2 Runtime stack: decide from evidence, keep the core framework-free

The plan proposes React + R3F + Rapier. All my demos use plain Three.js (r160, ES modules, no build step) with
their own navigation and none of them needed a physics engine. I am not against R3F, but I suggest:

- The runtime core (loader, state machine, interaction engine, assessment) is **framework-free TypeScript**, so it
  can be tested headlessly and reused whatever we pick for the UI.
- Rapier is optional for milestone 1; a navmesh and simple colliders cover the planned verbs.
- Phase 0 compares the stacks on one shared test scene (load time, frame time on a mid-range phone, effort to add a
  new interaction) instead of choosing by preference.

### 3.3 Visual style expectations

The demos we built are fairly close to realistic. **Question:** for the generated experiences, do we keep this
level, push it further towards realism, or lower it (the plan excludes photorealism from the first milestone)?
The answer decides which library assets, avatar set and generation providers we invest in, so it is better
decided early.

### 3.4 Note: generated assets and domain-critical models

Generated models (Tripo, Meshy) suit generic props. Domain-critical models (anatomy, cockpit panels, refinery
equipment, surgical instruments) should come from the reviewed library or be built procedurally, since a
wrong-looking object in a safety or medical scenario teaches the wrong thing.

### 3.5 Question: how will a generated experience be judged?

The plan says automated playthrough QA decides pass or fail, with a vision model as supporting evidence. What are
the actual criteria a generated experience is judged on, and who decides when it is good enough to publish?

### 3.6 Question: what is required for Arabic?

The demos ship Arabic and English: RTL UI, Arabic text inside the 3D scene, Arabic voices and lip-sync. The plan only
mentions "locale". Is Arabic required in the first milestone, and how far (UI only, or also voices, lip-sync and text
inside the scene)? Who owns translation and voice-over, given there is no task for it in the plan today?

## 4. Findings from the demo asset inventory (early IB-01 results)

These affect what can enter the shared library. Each needs a legal or product decision:

| Item | What I use | Question / impact |
|---|---|---|
| Props in the demos (OR equipment, café models, etc.) | Free models downloaded from **Sketchfab** (licence **CC BY 4.0**: free to use, including commercially, as long as the author is credited) and **Poly Haven** (licence **CC0**: free, no conditions) | **Are these two sources approved for the product and the shared library?** If yes, CC BY models need the author's name shown in the product, so the library stores author and URL and the runtime gets a credits screen. |
| Characters | **Microsoft Rocketbox** avatars with their mocap animation clips (licence **MIT**: free to use, including commercially, as long as the licence text is kept) | **Are these approved for the product and the shared library?** If yes, they are a ready starting set of actors for the library, and we keep the MIT licence text with them. |
| Chest anatomy in the OR demo (`bp3d_thorax`: sternum, ribs, cartilages, arteries) | Built from **BodyParts3D** data by The Database Center for Life Science (licence **CC BY 4.0**: free to use and modify, including commercially, as long as it is credited as "BodyParts3D, © The Database Center for Life Science licensed under CC Attribution 4.0 International"). Already listed in the demo's credits. | **Is this source approved for the product and the shared library?** It is the only accurate anatomy source we have, so it matters for any medical scenario. |
| Flight 1549 city (New York, Hudson River) | **Google Photorealistic 3D Tiles**, streamed live from Google while the game runs. Needs a Google Maps Platform API key, billed per use; Google's attribution must stay on screen, and its policies restrict storing or caching the tiles. | **Is this approved for scenarios set in real cities?** If yes, those scenarios always need an internet connection and an API budget, and the city can never be stored in the library or bundled in an offline `.ibook`. |
| Voice-over (Arabic and English, all characters) | **edge-tts**: a free tool that uses the Microsoft Edge "read aloud" neural voices through an unofficial route. It is not a licensed service, so it suits demos but not a product. | **Do we keep it, or move to a licensed provider?** The same voices are available officially (paid per use) through Microsoft Azure Speech, so moving would not change how the characters sound. |

## 5. Open questions and notes on the plan

1. **Is AI generation of 3D assets required or optional in the first milestone?** IB-13 (generation adapters) has
   no dependent task, so the pipeline can finish without it, and the Definition of Done says "generates *or*
   procedurally constructs". But Phase 4 requires at least one newly generated asset. If generation is required,
   IB-14 should depend on IB-13.
2. **Who reviews an experience before it is published, and where?** The plan has a `paused_for_review` state and
   "human approval points", but no task builds the place where that review happens. If the first milestone
   publishes automatically, or only the engineering team reviews (by reading the JSON and the preview), no screen is
   needed yet. If a non-developer reviews (a teacher or subject expert), we need a review screen to see the plan, fix
   it and resume the job, and a new task for it.
3. **Assessment results (note, not a question):** results are saved in the database and the LMS reads them from
   there. We will handle writing them; I suggest adding this to the scope of IB-17 so it has an owner.
4. **Reference scenarios (note, not a question):** we choose them from the client scenario library. The scenarios
   we already built demos for become **development benchmarks** (the hand-built demo is a quality baseline), and
   other scenarios from the library are **held out**, untouched during development, as the truly "unseen"
   acceptance test. The held-out set should mix object/procedure-based scenarios (e.g. Hygiene, Petroleum) and
   dialogue/decision-based ones (e.g. Business & Strategy).

## 6. What I can bring to the first review

- (a) **Schema fixture:** `Islam Sherif - contracts-proposal.md`, nine contract files worked through one scenario, plus 15
  cross-file validation rules and the open questions for IB-02.
- **Demo reports (IB-01)** for my five demos: stack, structure, reusable parts, limitations, performance, asset
  inventory and licences.
- (e) **Blocked dependencies:** the licensing decisions in Section 4 and the stack decision in 3.2.

## 7. What we already have vs. the tools in the plan

- ✅ **We have it:** used in the games today.
- 🟡 **We have an alternative:** something that does the same job with a different tool.
- ❌ **We don't have it:** not present at all.

### 7.1 Runtime (runs the game in the browser)

| Tool in the plan | What it does | What we have |
|---|---|---|
| Three.js | 3D rendering in the browser: lights, camera, models | ✅ three.js r160, the base of every game |
| React + React Three Fiber | Writes the 3D scene as components, so one player can build any scene from JSON | ❌ Plain JavaScript; each game has its own code |
| TypeScript | JavaScript with types, so errors show before running | ❌ Plain JavaScript |
| Rapier | Physics engine: gravity, collisions, falling and pushed bodies | 🟡 three-mesh-bvh plus our own code: stops hands and objects passing through things, and a navigation mesh. Collision only, no full physics |
| GLB / glTF | Standard 3D model format | ✅ All our models are glTF |

### 7.2 AI that plans the game

| Tool | What it does | What we have |
|---|---|---|
| LLM with structured output | Reads the scenario and outputs structured JSON: objectives, characters, decisions, endings | 🟡 Done by hand during development with Claude Code, which writes the game code directly instead of JSON |
| Pydantic / JSON Schema | Rules that check the JSON is valid and complete | ❌ |
| LangGraph | Runs the agents in order, resumes from the last checkpoint after a failure, and lets a person review mid-way | ❌ |

### 7.3 Asset library and search

| Tool | What it does | What we have |
|---|---|---|
| PostgreSQL | Database of every asset with its size, licence and version | ❌ Assets are files in folders |
| pgvector + embeddings | Search by meaning: "office chair" finds the closest models even under different names | ❌ |
| Reranker | Re-orders search results and picks the best fit | ❌ |
| S3 (object storage) | Stores the model files themselves | ❌ Files live in the repository |
| Asset sources | — | ✅ Sketchfab and Poly Haven (with download scripts), BodyParts3D, Google 3D Tiles |

### 7.4 Making 3D models

| Tool | What it does | What we have |
|---|---|---|
| Tripo / Meshy | AI that makes a 3D model from text or an image | ❌ Never tried |
| Image generation | Makes a reference image first, which is then turned into a model | ❌ |
| Blender (command line) | Edits models by script: fixes scale and origin, simplifies, adds colliders | 🟡 Python/numpy scripts such as `decimate.py` (simplification) and `build_thorax.py` (building the rib cage) |
| glTF Transform | Compresses, checks and optimises GLB files | 🟡 Partly, with the same Python scripts and `gltf_simplify_parts.mjs` |
| Procedural | Builds walls, floors and dimension-defined objects in code | ✅ e.g. `room.js`, `traffic.js` |

### 7.5 Characters and animation

| Tool | What it does | What we have |
|---|---|---|
| Ready rigs and clips | Characters with ready skeletons and recorded motion | ✅ Microsoft Rocketbox, with talking faces and mocap |
| Auto-rig | Adds a skeleton to a new model automatically | ❌ Not needed so far |
| Retargeting | Moves an animation from one character to another | 🟡 We pre-bake animations for the same skeleton |

### 7.6 Audio

| Tool | What it does | What we have |
|---|---|---|
| Licensed sound library | Effects and sounds legal for commercial use | ❌ |
| Voice generation (TTS) | Turns dialogue into speech | ✅ edge-tts in Arabic and English, with word timings for lip-sync. Warning: not licensed for commercial use; the official alternative is Azure Speech (see 4.5) |

### 7.7 Testing (QA)

| Tool | What it does | What we have |
|---|---|---|
| Test harness | Plays the game by itself, tries every path and outputs a report | ✅ `drive.py` (Playwright + Edge) with `drive_*.json` scenarios |
| Vision LLM | Looks at game screenshots and flags visual problems | ✅ Claude Code reviews the screenshots from the automated runs |
| Collision check | Makes sure nobody stands inside a table and every place is reachable | ✅ `audit_obstacles.js` and in-game detectors |

### 7.8 Infrastructure

| Tool | What it does | What we have |
|---|---|---|
| AI Service API | Server the backend sends a scenario to and receives the game from | ❌ |
| Docker | Runs the services the same way on any server | ❌ |
| `.ibook` package | One versioned file containing the whole game | ❌ We have static sites on Vercel |

### 7.9 Summary

- **We have and use:** three.js and glTF models, Rocketbox characters and animation, voices and lip-sync, QA tools, collision.
- **We don't have at all:** the LLM pipeline with schemas, LangGraph, the library (PostgreSQL, pgvector, S3), Tripo
  and Meshy, Blender, React and R3F, the AI Service API.
- **Biggest gap:** the plan relies on one runtime that reads JSON. We write separate code for each game, so that
  runtime is the first thing to build, before anything else.
