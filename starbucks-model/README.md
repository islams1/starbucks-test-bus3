# The Store on the Table — الفرع على الطاولة (Starbucks $40M case, the replay-screen version)

The second imagining of `docs/Starbucks_Service_Investment_Simulation.md`. The whole game is in one room: the
investment committee's table at 5:30 pm, with a screen hanging over the table's west end that replays Tuesday morning
at the illustrative "Al-Midan" store. The learner (service operations lead) sits with Noor (shift lead), Ellis
(finance) and Priya (chair). The committee watch the screen together, talk to each other and to the player, and the
player can step into the replay (a full-size café rendered live into the screen) and walk around it.

1. **Watch the counter**: the published premise card, Priya opens in a wide shot of the three, the screen comes on and
   Noor presents the recording; the camera pushes into the screen and lands inside the café: the morning peak, Ben
   joins the line, checks his watch twice and leaves before ordering, a drink goes out. Back at the table: the queue
   observation card replays the 8:10 peak or the 3:30 quiet afternoon on the screen; two comment cards taken out of the
   box, turned over and sorted by hand onto a "Speed" and an "Order accuracy" mat; the order rail (inside the replay):
   pull tickets off it and read their times until the order that has waited longest turns up. The first hypothesis
   outlines the area on the café floor.
2. **Price the improvement**: first by hand — coins from a dish into the orders' pan of a brass balance (one coin per
   extra completed order a day; labor $21,600/year in the other pan) until the beam is level at 20 — then Ellis's
   tablet in the player's hands to compare assumptions, with pale figures on the sidewalk in the replay for the
   assumed extra orders a day (the people recorded are real; the pale ones are an assumption). Two distinct order
   assumptions before the decision opens.
3. **Make a recommendation**: route → its consequence (rollout board on the wall screen / two calendar cards / a
   handoff point in the replay), with the committee's exchange in a wide shot → memo: customer evidence, cost evidence
   (only what was opened), review condition (+ distractor) with its one-line explanation; Back keeps choices.
   The player signs the memo on the pad with the pen; that locks it (localStorage; a refresh offers it again).
4. **Compare the decisions**: the memo beside the published case and the 10-K store count, three checks, the coaching
   rubric out of 3 (peak-specific observation, cost tied to contribution, matching condition); practice attempts after.

- Run: `python -I tools/devserver.py` (inside this folder), then open http://127.0.0.1:8792/index.html
  - `?lang=en` English subtitles and UI · `?still` still frames (also with prefers-reduced-motion / the no-GPU level)
  - `?dev=view` look at the set with the replay running (`__enter('rail')`, `__seat()`, `__period('off')`,
    `__shot('pickup')`, `__watch(true)`, `__line('noor_rail')`); `__gaze()` prints who looks at whom
  - `?dev=s1` / `s2` / `s3` / `debrief` jump to a scene
- Automated play-throughs (headless Edge): `python -I tools/drive.py <outdir> full ""` (the whole game),
  `... restore "?dev=s3"` (a 0/3 memo, a practice attempt, refresh → the memo comes back), `... view "?dev=view"`,
  `... group "?dev=s3"` (the committee's exchange after the "all stores" route), `... hello ""` (the opening gaze).
- How the two places share one renderer: the café is built at full size at x = 60 (`js/world/maquette.js`, same
  exports as the old model). `js/world/screenfeed.js` renders it from a moving camera (wide / counter / line / pickup /
  rail / front shots) into a render target shown on the hanging screen (`room.js` `HANG`). `lighting.js` keeps one set
  of lights and moves/recolours them per place (`applyWorld('room'|'cafe')`, run from the engine's `onBeforeRender`),
  so the light count never changes and no shader recompiles. Stepping into the replay (`view.js` `enterCafe`) pushes
  the camera at the screen, fades, and lands at the feed camera's pose; inside, drag orbits and the wheel zooms.
- Who looks at whom: `js/story/gaze.js`. Each line in `data/lines.ar.json` has `to` (player / noor / ellis / priya /
  all) and an optional `glance` (screen / balance / a name). The speaker opens on the one addressed and glances at the
  others or at what is talked about; listeners turn to the speaker a beat after the voice starts; over the playing
  replay, a line about the screen splits the eyes between speaker and screen; between lines they watch the screen, look
  at each other, and at the player when an answer is awaited. When the committee talk among themselves, `flow.js`
  `groupShot` steps the camera back so the three are in frame.
- Hands-on (`js/ui/hand.js`, `js/story/handson.js`): press on a thing, drag, let go over its place (a click on a thing
  with one place to go puts it there); pressing anywhere else still looks around. Every hands-on step also has buttons
  in the prompt at the top (and keys), so it can be played without dragging. `__handPts(id, target)` gives the screen
  points for `tools/drive.py` `dragjs` (the full play-through drags coins, cards, tickets and signs for real).
- Hands at rest: seated people use the calm sit-and-breathe clip, the head beats of a line never move their hands, and
  turning the head does not swing the shoulders (in the Biped rig the clavicles hang from the neck: they are turned
  back by the same amount) — otherwise a forearm resting on the table sinks into it and the arm solver lifts the hand.
- Code: `js/world/room.js` (the room, the hanging screen, the wall screen), `maquette.js` (the café, its clock,
  figures, floor marks), `screenfeed.js`, `scale.js` (the balance), `tableprops.js` (cards, comment box, tablet, memo
  pad, calendars), `lighting.js`; `js/story/replay.js` (the people in the café), `gaze.js`, `flow.js` (the scenes),
  `score.js` (arithmetic + rubric), `tablet.js`, `memo.js`, `debrief.js`; `js/ui/view.js` (seat / inside the replay /
  director camera), `hotspots.js` (rings + the dock of buttons).
- Voices: `data/lines.ar.json`, `python -I tools/gen_voice.py ar`.

Historical facts: Harvard Business Publishing case 504-016 (premise only, from the public listing) and the Starbucks
FY2002 Form 10-K (5,886 stores). Everything else — the store, its recording, people, dialogue, figures — is
illustrative.
