# Flight 1549 — 208 seconds

The Hudson ditching as a real-time 3D game, on its own: this folder has everything the game uses (its own copies of the
engine, the people and their animations) and nothing of the other games in this repository.

- Run: `python -I tools/devserver.py` (inside this folder), then open http://localhost:8790
  (`?dev=1&mode=real` skips the menu).
- The city is Google Photorealistic 3D Tiles only. The keys go in `.env.local` (`CESIUM_ION_TOKEN`, `GOOGLE_MAPS_KEY`);
  `python -I tools/flight_config.py` writes the git-ignored `flight.local.json` the page reads. Without them the game
  keeps trying to connect.
- Deploy (own Vercel project): `python -I tools/build_flight_site.py`, then `npx vercel@latest deploy --prod --yes`
  inside `_build/site`.
