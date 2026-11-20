# The Store on the Table — الفرع على الطاولة (Starbucks $40M case, the model version)

The second imagining of `docs/Starbucks_Service_Investment_Simulation.md`. The whole game is in one room: the
investment committee's table at 5:30 pm with a live 1:16 model of the illustrative "Al-Midan" store in the middle.
The learner (service operations lead) sits with Noor (shift lead), Ellis (finance) and Priya (chair):

1. **Watch the counter**: the published premise card, then the camera dives to eye level inside the model (the room's
   lights go down, the replay is lit): the morning peak, Ben joins the line, checks his watch twice and leaves before
   ordering, a drink goes out. Back at the table: the queue observation card replays the 8:10 peak or the 3:30 quiet
   afternoon on the model (the brass dial turns, the light changes, the people change); two comment cards to tag; the
   order rail to inspect. The first hypothesis puts a brass pin (or a ring) on the model.
2. **Price the improvement**: Ellis's tablet in the player's hands, a brass balance beside the model (labor
   $21,600/year against a coin for every $1,080 the extra orders add) and white model-maker's figures on the sidewalk
   for the assumed extra orders a day (observed people are real; assumptions are white). Two distinct order
   assumptions before the decision opens.
3. **Make a recommendation**: route → its consequence on the table (rollout board on the wall screen / two calendar
   cards / a handoff point in the model) → memo: customer evidence, cost evidence (only what was opened), review
   condition (+ distractor) with its one-line explanation; Back keeps choices. Confirming locks the memo
   (localStorage; a refresh offers it again from the menu).
4. **Compare the decisions**: the memo beside the published case and the 10-K store count, three checks, the coaching
   rubric out of 3 (peak-specific observation, cost tied to contribution, matching condition); practice attempts after.

- Run: `python -I tools/devserver.py` (inside this folder), then open http://127.0.0.1:8792/index.html
  - `?lang=en` English subtitles and UI · `?still` still frames (also with prefers-reduced-motion / the no-GPU level)
  - `?dev=view` look at the set with the replay running (`__lean('rail')`, `__seat()`, `__period('off')`)
  - `?dev=s1` / `s2` / `s3` / `debrief` jump to a scene
- Automated play-throughs (headless Edge): `python -I tools/drive.py <outdir> full ""` (the whole game),
  `... restore "?dev=s3"` (a 0/3 memo, a practice attempt, refresh → the memo comes back), `... view "?dev=view"`.
- Code: `js/world/room.js` (the room), `maquette.js` (the model, its dial, figures, marks), `scale.js` (the balance),
  `tableprops.js` (cards, comment box, tablet, memo pad, calendars), `lighting.js` (sunset sky, pendant, the model's
  replay light, house lights that dim); `js/story/replay.js` (the people in the model), `flow.js` (the scenes),
  `score.js` (arithmetic + rubric), `tablet.js`, `memo.js`, `debrief.js`; `js/ui/view.js` (seat / model / director
  camera, tilt-shift, depth range), `hotspots.js` (rings + the dock of buttons).
- Voices: `data/lines.ar.json` (30 lines reused from «سبع دقائق», 5 new), `python -I tools/gen_voice.py ar`.

Historical facts: Harvard Business Publishing case 504-016 (premise only, from the public listing) and the Starbucks
FY2002 Form 10-K (5,886 stores). Everything else — the store, its model, people, dialogue, figures — is illustrative.
