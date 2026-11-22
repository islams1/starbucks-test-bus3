# Interactive Books — JSON Contract Proposal v0.1

**Status:** Draft for team review (input to IB-02 / IB-03)  
**Date:** 22 November 2026  
**Relates to:** AI Agent Engineering Execution Plan v1.0, Section 3 ("Contracts FIRST")

This document proposes a concrete shape for each contract file listed in the plan. Every example uses **one
running scenario** so the files can be read together and every ID cross-references correctly:

> *"A new warehouse employee on their first shift notices smoke at the electrical panel. They must identify the
> hazard, raise the alarm, and choose the right extinguisher (CO2, not water)."*

Everything below is a proposal to argue with, not a decision. Open questions are collected in Section 8.

## Contents

| Part | Sections | What it covers |
|---|---|---|
| **A. Overview and shared rules** | 0, 1 | Which stage writes which file; the envelope, IDs, units, and the closed vocabulary for conditions and effects |
| **B. Planning** (pipeline steps 1–2) | 2.1–2.3 | `scenario_spec`, `experience_graph`, `assessment_spec` |
| **C. World and assets** (steps 3–6) | 3.1–3.3 | `world_spec`, `asset_plan`, `asset_manifest` |
| **D. Interactions** (step 7) | 4.1 | `interaction_graph` |
| **E. Package and QA** (steps 8–10) | 5.1–5.3, 6 | `experience_manifest`, `.ibook` layout, `strings`, `qa_report` |
| **F. Validation and open questions** | 7, 8 | Cross-file validation rules; questions for the team |

Each contract section follows the same order: **who writes it and who reads it → example JSON → key rules**.

---

# Part A — Overview and shared rules

## 0. Which stage writes which file

| File | Written by (plan step) | Read by |
|---|---|---|
| `scenario_spec.json` | 1 Scenario Analyst | Experience Designer, World Planner, Retrieval |
| `experience_graph.json` | 2 Experience Designer | World Planner, Interaction Planner, Compiler, QA |
| `assessment_spec.json` | 2 Experience / Learning Designer | Compiler, runtime LearningFeedback, QA |
| `world_spec.json` | 3 World Planner | Retrieval, Asset Decision, Compiler, QA |
| `asset_plan.json` | 4 + 5 Retrieval + Asset Decision | Asset Workers |
| `asset_manifest.json` | 6 Asset Workers | Interaction Planner, Compiler |
| `interaction_graph.json` | 7 Interaction Planner | Compiler, QA |
| `experience_manifest.json` | 8 Compiler | Runtime (ExperienceLoader), Publisher |
| `qa_report.json` | 9 Playthrough QA | Orchestrator (repair), Publisher |
| `strings/<locale>.json` *(proposed addition)* | 2 + 7 (keys), localisation step (text) | Runtime |

## 1. Shared conventions (apply to every file)

### 1.1 Envelope

Every contract file starts with the same envelope. The full `produced_by` shape is shown once here; later examples
show a shortened version.

```json
{
  "schema": "scenario_spec",
  "schema_version": "0.1.0",
  "experience_id": "warehouse-electrical-fire",
  "revision": 1,
  "produced_by": {
    "stage": "scenario_analysis",
    "job_id": "job_8f3a2c",
    "attempt": 1,
    "agent": "scenario_analyst@0.1.0",
    "model": { "provider": "<llm-provider>", "id": "<model-id>", "version": "<pinned-version>" },
    "prompt_version": "scenario_analyst.prompt@0.3.0",
    "started_at": "2026-11-22T10:00:00Z",
    "finished_at": "2026-11-22T10:00:41Z",
    "cost": { "usd": 0.042, "input_tokens": 6120, "output_tokens": 2310 }
  },
  "inputs": [
    { "ref": "input:scenario.txt", "sha256": "sha256:4be1c0d9" }
  ]
}
```

| Field | Rule |
|---|---|
| `schema` + `schema_version` | Which JSON Schema validates this file. Semver; a major bump means the runtime must reject old files it cannot migrate. |
| `experience_id` | kebab-case slug, stable for the life of the experience. |
| `revision` | Starts at 1. A targeted repair writes a **new file with revision + 1**; files are never edited in place (immutable stage output). |
| `produced_by.model` | `null` for deterministic stages (compiler, publisher, QA harness). |
| `produced_by.repair_of` | Present only on repaired revisions: points at the QA check that caused the repair. |
| `inputs` | Every upstream document this file was built from, pinned by revision and hash. This is what makes "resume from checkpoint" and "targeted repair" possible: if an input hash did not change, the stage does not need to re-run. |

### 1.2 IDs and references

- Local IDs match `^[a-z][a-z0-9_]*$` and are **unique across the whole experience**, so a bare ID is always an
  unambiguous reference across files.
- Prefixes make the type obvious to people and to validators:

| Prefix | Type | Prefix | Type |
|---|---|---|---|
| `obj_` | learning objective | `st_` | state |
| `act_` | actor (NPC) | `tr_` | transition |
| `ent_` | entity / object | `ix_` | interaction |
| `ra_` | required action | `var_` | variable |
| `fact_` | fact | `zone_` | zone |
| `con_` | constraint | `spawn_` | spawn point |
| `unk_` | unknown / ambiguity | `light_`, `vfx_` | lights, effects |
| `req_` | asset requirement | `evd_` | assessment evidence |
| `chk_` | QA check | `path_` | QA playthrough path |

- External references are typed URIs with an **exact** version pin (no ranges):

| Form | Meaning |
|---|---|
| `asset:<slug>@<x.y.z>` | Library asset (model, audio, VFX). |
| `proc:<generator>@<x.y.z>` | Procedural generator in the runtime / asset pipeline. |
| `rule:<domain>/<name>@<x.y.z>` | Approved domain rule (source of truth for sensitive facts). |
| `loc:<namespace>.<key>` | Localised, player-facing text. |
| `<file>@r<n>` / `<file>@r<n>#<id>` | A specific revision of a contract file, optionally one item in it. |
| `lib://...` | Storage URI resolved by the library service (never a raw bucket URL). |

### 1.3 Units, axes, text

- Meters, seconds, degrees. Colours as `#rrggbb`. Time as ISO 8601 UTC. Hashes as `sha256:<hex>`.
- Right-handed, **+Y up**, floor at `y = 0`, world-space positions `[x, y, z]` (same as glTF).
- Rotation is `yaw_deg` around +Y; `yaw_deg: 0` faces **+Z** (glTF "front"). Full rotation, if ever needed,
  is `rot_deg: [x, y, z]` (Euler, XYZ order).
- **Every player-facing string is a `loc:` key.** Plain text is allowed only in author-facing fields
  (`statement`, `rationale`, `summary`, `detail`, `notes`), which the runtime never displays.

### 1.4 No code: conditions and effects are a closed vocabulary

No file may contain executable code or expression strings. Conditions and effects are JSON objects from the closed
lists below; any other key is a schema error (`additionalProperties: false`).

**Conditions**

| Form | True when |
|---|---|
| `{ "all": [C, ...] }` / `{ "any": [C, ...] }` / `{ "not": C }` | Logical combination. |
| `{ "var": "var_x", "eq": V }` (also `ne`, `lt`, `lte`, `gt`, `gte`) | Variable comparison. |
| `{ "in_state": "st_x" }` | The scenario is currently in that state. |
| `{ "visited": "st_x" }` | That state was entered at least once. |
| `{ "holding": "ent_x" }` / `{ "holding_any": true }` | Player's hands. |
| `{ "entity_state": "ent_x", "eq": "out" }` | An entity's declared state. |
| `{ "did": { "verb": "...", "target": "ent_x", "item": "ent_y" } }` | That action happened at least once. |
| `{ "evidence": "evd_x" }` | *(assessment only)* That evidence item was satisfied. |

**Effects**

| Op | Does |
|---|---|
| `set` `{ "var", "value" }` / `inc` `{ "var", "by" }` | Change a variable. |
| `entity_state` `{ "entity", "value" }` | Change an entity's state. |
| `objective` `{ "objective", "status": "active \| done \| failed" }` | Update the objective tracker. |
| `say` `{ "actor", "line" }` | Voiced line + subtitle. |
| `feedback` `{ "kind": "info \| success \| warning \| error", "text" }` | Feedback panel. |
| `hint` `{ "text" }` | Hint toast. |
| `play_anim` `{ "entity", "clip" }` | Animation clip on an entity. |
| `play_sfx` `{ "sfx", "at", "loop" }` | Sound effect. |
| `vfx` `{ "vfx", "at", "action": "start \| stop" }` | Visual effect. |
| `checkpoint` `{}` | Save a resumable checkpoint. |

**Verbs (`actions:core@0.1.0`)** — the plan's minimum set `inspect, select, open, pick_up, use, place, trigger`,
plus proposed `close, put_down, activate, talk`. `trigger` fires when the player enters a volume declared in
`world_spec`. A verb outside the registry version named in the file is a validation error, not something the
runtime tries to interpret.

**System events** a transition may wait for: `narrative_done`, `feedback_closed`, `timeout`.

---

# Part B — Planning (pipeline steps 1–2)

*What the scenario says, how the story flows, and how learning is measured. Written before any 3D work starts.*

## 2. Planning files

### 2.1 `scenario_spec.json` — what the source text actually says

> **Written by:** step 1, Scenario Analyst (LLM) · **Read by:** Experience Designer, World Planner, Retrieval

```json
{
  "schema": "scenario_spec",
  "schema_version": "0.1.0",
  "experience_id": "warehouse-electrical-fire",
  "revision": 1,
  "produced_by": { "stage": "scenario_analysis", "job_id": "job_8f3a2c", "attempt": 1 },
  "inputs": [{ "ref": "input:scenario.txt", "sha256": "sha256:4be1c0d9" }],

  "title": "loc:exp.title",
  "summary": "A new warehouse employee notices smoke at an electrical panel, raises the alarm and must choose the right extinguisher.",
  "domain": "workplace_safety",
  "sensitivity": "safety_critical",
  "audience": { "role": "new_warehouse_employee", "level": "beginner", "locales": ["en", "ar"] },
  "player_role": "New warehouse employee on their first shift",
  "source": { "kind": "text", "ref": "input:scenario.txt", "language": "en" },

  "learning_objectives": [
    { "id": "obj_identify_hazard", "statement": "Recognise the electrical panel as the source of the hazard before acting.", "observable_as": "Player inspects the electrical panel.", "source_span": [112, 168] },
    { "id": "obj_raise_alarm", "statement": "Raise the alarm promptly once the hazard is found.", "observable_as": "Player activates the fire alarm call point.", "source_span": [169, 214] },
    { "id": "obj_choose_extinguisher", "statement": "Choose an extinguisher suitable for an electrical fire.", "observable_as": "Player uses the CO2 extinguisher, not the water one, on the fire.", "source_span": [215, 290] }
  ],

  "setting": { "location_type": "warehouse", "indoor": true, "time_of_day": "day", "notes": "Size not stated in source; see unk_warehouse_size." },

  "actors": [
    { "id": "act_supervisor", "role": "shift_supervisor", "speaks": true, "present": "start_and_end", "origin": "from_input", "source_span": [60, 111] }
  ],

  "entities": [
    { "id": "ent_panel", "kind": "equipment", "name": "electrical distribution panel", "required": true, "interactive": true, "origin": "from_input", "source_span": [112, 140] },
    { "id": "ent_fire", "kind": "hazard", "name": "small electrical fire at the panel", "required": true, "interactive": true, "origin": "from_input", "source_span": [141, 168] },
    { "id": "ent_alarm", "kind": "equipment", "name": "fire alarm call point", "required": true, "interactive": true, "origin": "from_input", "source_span": [169, 214] },
    { "id": "ent_ext_co2", "kind": "tool", "name": "CO2 fire extinguisher", "required": true, "interactive": true, "origin": "from_input", "source_span": [215, 250] },
    { "id": "ent_ext_water", "kind": "tool", "name": "water fire extinguisher", "required": true, "interactive": true, "origin": "from_input", "source_span": [251, 290] },
    { "id": "ent_door_main", "kind": "structure", "name": "main entrance door", "required": true, "interactive": false, "origin": "inferred", "source_span": null },
    { "id": "ent_shelf_row_a", "kind": "furniture", "name": "pallet shelving row", "required": false, "interactive": false, "origin": "inferred", "source_span": null }
  ],

  "required_actions": [
    { "id": "ra_inspect_panel", "verb": "inspect", "target": "ent_panel", "objective": "obj_identify_hazard" },
    { "id": "ra_raise_alarm", "verb": "activate", "target": "ent_alarm", "objective": "obj_raise_alarm" },
    { "id": "ra_use_co2", "verb": "use", "item": "ent_ext_co2", "target": "ent_fire", "objective": "obj_choose_extinguisher" }
  ],

  "facts": [
    { "id": "fact_no_water_on_electrical", "statement": "Water must not be used on a live electrical fire.", "origin": "approved_rule", "rule_ref": "rule:fire-safety/electrical-fire@1.0.0", "critical": true },
    { "id": "fact_co2_suitable", "statement": "A CO2 extinguisher is suitable for fires involving live electrical equipment.", "origin": "approved_rule", "rule_ref": "rule:fire-safety/electrical-fire@1.0.0", "critical": true },
    { "id": "fact_alarm_first", "statement": "Raise the alarm before attempting to fight the fire.", "origin": "from_input", "source_span": [169, 214], "critical": true }
  ],

  "constraints": [
    { "id": "con_no_injury_depiction", "kind": "content_policy", "statement": "No depiction of injury; failure is shown through feedback, not harm." },
    { "id": "con_session_length", "kind": "design", "statement": "Target session length 5 to 8 minutes." }
  ],

  "unknowns": [
    { "id": "unk_warehouse_size", "question": "Warehouse dimensions are not given.", "blocking": false, "resolution": "assumption", "assumption": "Single hall of about 20 x 12 m with a 6 m ceiling." },
    { "id": "unk_extinguisher_location", "question": "Where the extinguishers are kept is not stated.", "blocking": false, "resolution": "assumption", "assumption": "Extinguisher station near the middle of the south wall." }
  ]
}
```

**Key rules**
- `source_span` = `[start, end)` character offsets in the input text. This is the plan's "source evidence".
- `facts[].origin` is one of `from_input` (needs `source_span`), `approved_rule` (needs `rule_ref`) or
  `assumption`. **A `critical` fact may never be an `assumption`**; that is how "no silently invented critical
  facts" becomes a machine check.
- `entities[].origin: "inferred"` marks things the analyst added for the setting. They are allowed, but visible.
- An `unknowns` item with `"blocking": true` moves the job to `paused_for_review`.

### 2.2 `experience_graph.json` — the story as a state machine

> **Written by:** step 2, Experience Designer (LLM + rule validators) · **Read by:** World Planner, Interaction Planner, Compiler, QA

```json
{
  "schema": "experience_graph",
  "schema_version": "0.1.0",
  "experience_id": "warehouse-electrical-fire",
  "revision": 1,
  "produced_by": { "stage": "experience_design", "job_id": "job_8f3a2c", "attempt": 1 },
  "inputs": [{ "ref": "scenario_spec@r1", "sha256": "sha256:a91d22f0" }],

  "pattern": "observe_decide_act_evaluate",
  "start_state": "st_intro",

  "variables": [
    { "id": "var_hazard_seen", "type": "bool", "initial": false },
    { "id": "var_wrong_attempts", "type": "int", "initial": 0, "min": 0, "max": 10 }
  ],

  "states": [
    { "id": "st_intro", "type": "narrative",
      "on_enter": [{ "op": "say", "actor": "act_supervisor", "line": "loc:line.sup_intro" }] },
    { "id": "st_observe", "type": "task", "objective": "obj_identify_hazard",
      "on_enter": [{ "op": "objective", "objective": "obj_identify_hazard", "status": "active" }],
      "hints": [
        { "after_s": 25, "text": "loc:hint.smell_smoke" },
        { "after_s": 60, "text": "loc:hint.check_east_wall" }
      ] },
    { "id": "st_report", "type": "task", "objective": "obj_raise_alarm",
      "on_enter": [{ "op": "objective", "objective": "obj_raise_alarm", "status": "active" }],
      "hints": [{ "after_s": 20, "text": "loc:hint.find_call_point" }] },
    { "id": "st_choose", "type": "decision", "objective": "obj_choose_extinguisher",
      "checkpoint": true,
      "on_enter": [{ "op": "objective", "objective": "obj_choose_extinguisher", "status": "active" }],
      "options": ["tr_use_co2", "tr_use_water"] },
    { "id": "st_fb_water", "type": "feedback", "outcome": "negative",
      "on_enter": [{ "op": "feedback", "kind": "error", "text": "loc:fb.water_on_electrical" }] },
    { "id": "st_end_success", "type": "end", "outcome": "success",
      "on_enter": [
        { "op": "objective", "objective": "obj_choose_extinguisher", "status": "done" },
        { "op": "say", "actor": "act_supervisor", "line": "loc:line.sup_well_done" }
      ] },
    { "id": "st_end_fail", "type": "end", "outcome": "failure",
      "on_enter": [
        { "op": "objective", "objective": "obj_choose_extinguisher", "status": "failed" },
        { "op": "feedback", "kind": "info", "text": "loc:fb.evacuate_instead" }
      ] }
  ],

  "transitions": [
    { "id": "tr_intro_done", "from": "st_intro", "to": "st_observe", "on": { "system": "narrative_done" } },
    { "id": "tr_hazard_found", "from": "st_observe", "to": "st_report",
      "on": { "action": { "verb": "inspect", "target": "ent_panel" } },
      "effects": [
        { "op": "set", "var": "var_hazard_seen", "value": true },
        { "op": "objective", "objective": "obj_identify_hazard", "status": "done" }
      ] },
    { "id": "tr_alarm_raised", "from": "st_report", "to": "st_choose",
      "on": { "action": { "verb": "activate", "target": "ent_alarm" } },
      "effects": [{ "op": "objective", "objective": "obj_raise_alarm", "status": "done" }] },
    { "id": "tr_use_co2", "from": "st_choose", "to": "st_end_success",
      "on": { "action": { "verb": "use", "item": "ent_ext_co2", "target": "ent_fire" } } },
    { "id": "tr_use_water", "from": "st_choose", "to": "st_fb_water",
      "on": { "action": { "verb": "use", "item": "ent_ext_water", "target": "ent_fire" } },
      "effects": [{ "op": "inc", "var": "var_wrong_attempts", "by": 1 }] },
    { "id": "tr_retry", "from": "st_fb_water", "to": "st_choose",
      "on": { "system": "feedback_closed" },
      "when": { "var": "var_wrong_attempts", "lt": 2 } },
    { "id": "tr_give_up", "from": "st_fb_water", "to": "st_end_fail",
      "on": { "system": "feedback_closed" },
      "when": { "var": "var_wrong_attempts", "gte": 2 } }
  ]
}
```

**Key rules**
- State `type` ∈ `narrative | task | decision | feedback | end`. `end` states need `outcome`.
- A transition fires when its `on` event happens **and** its optional `when` condition holds. If several match,
  the first in file order wins; the validator warns on overlapping conditions.
- `on.action` is an *abstract* action pattern. This file is written at step 2, before objects are bound. The
  Interaction Planner (step 7) must provide a concrete interaction for every pattern used here (rule V07).
- A `decision` state lists its `options` (transition IDs); there must be at least two, leading to
  distinguishable outcomes. This is the plan's "at least one decision branch".

### 2.3 `assessment_spec.json` — how learning is measured

> **Written by:** step 2, Experience / Learning Designer · **Read by:** Compiler, runtime LearningFeedback, QA

```json
{
  "schema": "assessment_spec",
  "schema_version": "0.1.0",
  "experience_id": "warehouse-electrical-fire",
  "revision": 1,
  "produced_by": { "stage": "experience_design", "job_id": "job_8f3a2c", "attempt": 1 },
  "inputs": [
    { "ref": "scenario_spec@r1", "sha256": "sha256:a91d22f0" },
    { "ref": "experience_graph@r1", "sha256": "sha256:5c07be19" }
  ],

  "mode": "scored",
  "max_score": 100,
  "pass": { "min_score": 70, "require_end": "st_end_success" },

  "objectives": [
    {
      "objective": "obj_identify_hazard",
      "points": 20,
      "evidence": [
        { "id": "evd_panel_inspected", "did": { "verb": "inspect", "target": "ent_panel" } }
      ],
      "scoring": { "type": "binary", "if": { "evidence": "evd_panel_inspected" } },
      "feedback": { "met": "loc:fb.obj_hazard_met", "not_met": "loc:fb.obj_hazard_missed" }
    },
    {
      "objective": "obj_raise_alarm",
      "points": 30,
      "evidence": [
        { "id": "evd_alarm_fast", "did": { "verb": "activate", "target": "ent_alarm" }, "within_s": 20, "from": { "entered": "st_report" } },
        { "id": "evd_alarm_any", "did": { "verb": "activate", "target": "ent_alarm" } }
      ],
      "scoring": {
        "type": "tiered",
        "tiers": [
          { "if": { "evidence": "evd_alarm_fast" }, "points": 30 },
          { "if": { "evidence": "evd_alarm_any" }, "points": 15 }
        ],
        "otherwise": 0
      },
      "feedback": { "met": "loc:fb.obj_alarm_met", "partial": "loc:fb.obj_alarm_slow", "not_met": "loc:fb.obj_alarm_missed" }
    },
    {
      "objective": "obj_choose_extinguisher",
      "points": 50,
      "evidence": [
        { "id": "evd_co2_used", "did": { "verb": "use", "item": "ent_ext_co2", "target": "ent_fire" } }
      ],
      "scoring": {
        "type": "tiered",
        "tiers": [
          { "if": { "all": [{ "evidence": "evd_co2_used" }, { "var": "var_wrong_attempts", "eq": 0 }] }, "points": 50 },
          { "if": { "all": [{ "evidence": "evd_co2_used" }, { "var": "var_wrong_attempts", "eq": 1 }] }, "points": 25 }
        ],
        "otherwise": 0
      },
      "feedback": { "met": "loc:fb.obj_ext_met", "partial": "loc:fb.obj_ext_second_try", "not_met": "loc:fb.obj_ext_missed" },
      "explains_facts": ["fact_no_water_on_electrical", "fact_co2_suitable"]
    }
  ],

  "completion": { "on_end_states": ["st_end_success", "st_end_fail"] },
  "debrief": { "title": "loc:debrief.title", "show": ["score", "objectives", "facts"], "retry_allowed": true }
}
```

**Key rules**
- `mode` ∈ `scored | qualitative`. In `qualitative` mode, `points` are omitted and only `feedback` is used.
- Evidence is computed from the runtime's telemetry stream (every interaction emits an `action` event), so
  scoring needs no extra code in the runtime.
- The `points` of all objectives add up to `max_score`. Every `obj_` in `scenario_spec` appears here (rule V03).

---

# Part C — World and assets (pipeline steps 3–6)

*Where everything goes, which assets are reused, adapted, built or generated, and what was actually resolved.*

## 3. World and assets

### 3.1 `world_spec.json` — where everything is

> **Written by:** step 3, World Planner (LLM + spatial validator) · **Read by:** Retrieval, Asset Decision, Compiler, QA

```json
{
  "schema": "world_spec",
  "schema_version": "0.1.0",
  "experience_id": "warehouse-electrical-fire",
  "revision": 1,
  "produced_by": { "stage": "world_planning", "job_id": "job_8f3a2c", "attempt": 1 },
  "inputs": [
    { "ref": "scenario_spec@r1", "sha256": "sha256:a91d22f0" },
    { "ref": "experience_graph@r1", "sha256": "sha256:5c07be19" }
  ],

  "units": "m",
  "axes": { "up": "+Y", "handedness": "right", "yaw_zero_faces": "+Z" },
  "style": "stylized_realistic",

  "added_entities": [
    { "id": "ent_shelf_row_b", "kind": "furniture", "name": "pallet shelving row", "interactive": false, "reason": "Second row so the panel is not in plain view from the spawn point; supports the observe task." }
  ],

  "zones": [
    {
      "id": "zone_hall",
      "kind": "indoor_room",
      "bounds": { "min": [0, 0, 0], "max": [20, 6, 12] },
      "shell": { "generator": "proc:room_shell@0.2.0", "floor": "mat:concrete_sealed", "walls": "mat:painted_block_grey", "ceiling": "mat:metal_deck" },
      "openings": [
        { "id": "open_main", "wall": "south", "offset_m": 2.0, "width_m": 1.2, "height_m": 2.2, "entity": "ent_door_main" }
      ]
    }
  ],

  "spawns": [
    { "id": "spawn_entrance", "zone": "zone_hall", "pos": [2.6, 0, 1.0], "yaw_deg": 0, "player": true }
  ],

  "placements": [
    { "entity": "ent_door_main", "pos": [2.6, 0, 0], "yaw_deg": 0, "anchor": "opening:open_main" },
    { "entity": "ent_panel", "pos": [19.85, 1.1, 6.0], "yaw_deg": -90, "anchor": "wall:east", "expected_size_m": [0.8, 1.2, 0.3] },
    { "entity": "ent_fire", "pos": [19.6, 0.9, 6.0], "yaw_deg": -90, "anchor": "attach:ent_panel" },
    { "entity": "ent_alarm", "pos": [4.2, 1.4, 0.05], "yaw_deg": 0, "anchor": "wall:south" },
    { "entity": "ent_ext_co2", "pos": [9.6, 0, 0.3], "yaw_deg": 0, "anchor": "floor" },
    { "entity": "ent_ext_water", "pos": [10.4, 0, 0.3], "yaw_deg": 0, "anchor": "floor" },
    { "entity": "ent_shelf_row_a", "pos": [6.0, 0, 4.0], "yaw_deg": 0, "anchor": "floor", "repeat": { "count": 4, "step": [3.0, 0, 0] }, "expected_size_m": [2.7, 4.0, 1.1] },
    { "entity": "ent_shelf_row_b", "pos": [6.0, 0, 8.0], "yaw_deg": 0, "anchor": "floor", "repeat": { "count": 4, "step": [3.0, 0, 0] }, "expected_size_m": [2.7, 4.0, 1.1] }
  ],

  "lighting": {
    "preset": "light:industrial_day@1.0.0",
    "sources": [
      { "id": "light_bay_1", "type": "area", "pos": [10, 5.8, 6], "size_m": [8, 2], "intensity_lux": 300, "color": "#fff4e5" }
    ]
  },
  "vfx": [
    { "id": "vfx_smoke_panel", "effect": "asset:vfx-smoke-light@1.0.0", "attach": "ent_panel", "offset": [0, 1.3, 0.2], "starts": "on_load" }
  ],
  "audio": { "ambience": "asset:amb-warehouse-hum@1.0.0", "volume": 0.4 },
  "volumes": [],

  "player": { "mode": "first_person", "eye_height_m": 1.65, "walk_speed_mps": 1.4, "reach_m": 1.8, "fov_deg": 70 },

  "navigation": {
    "agent": { "radius_m": 0.3, "height_m": 1.8, "max_step_m": 0.25, "max_slope_deg": 30 },
    "min_clearance_m": 0.9,
    "must_reach": [
      { "target": "ent_panel", "within_m": 1.5 },
      { "target": "ent_alarm", "within_m": 1.2 },
      { "target": "ent_ext_co2", "within_m": 1.2 },
      { "target": "ent_ext_water", "within_m": 1.2 },
      { "target": "ent_fire", "within_m": 3.0 }
    ]
  },

  "budgets": { "triangles": 500000, "draw_calls": 150, "texture_mb": 96 },

  "spatial_validation": {
    "tool": "spatial-validator@0.1.0",
    "reachability": "pass",
    "overlaps": "pass",
    "out_of_bounds": "pass"
  }
}
```

**Key rules**
- Every `required` entity in `scenario_spec` has exactly one placement. Extra entities the planner adds go in
  `added_entities`, each with a `reason`.
- `anchor` tells the runtime how to snap: `floor`, `wall:<side>`, `ceiling`, `opening:<id>`, `attach:<entity>`.
- `expected_size_m` is the planner's assumption; the compiler compares it to the real asset bounds from
  `asset_manifest` and fails if the difference exceeds the requirement's tolerance.
- `spatial_validation` is written by a **deterministic** tool, not the LLM. Per the plan (Section 7), the
  geometry check has the final say over the LLM's layout.
- `volumes` (trigger areas for the `trigger` verb) are empty in this scenario.

### 3.2 `asset_plan.json` — reuse / adapt / procedural / generate, with reasons

> **Written by:** steps 4–5, Library Retrieval + Asset Decision Engine · **Read by:** Asset Workers

The example is trimmed to six requirements (door, pallets, water extinguisher and audio are omitted).

```json
{
  "schema": "asset_plan",
  "schema_version": "0.1.0",
  "experience_id": "warehouse-electrical-fire",
  "revision": 1,
  "produced_by": { "stage": "resolving_assets", "job_id": "job_8f3a2c", "attempt": 1 },
  "inputs": [{ "ref": "world_spec@r1", "sha256": "sha256:0d4e6a73" }],

  "budget": { "max_generated_assets": 3, "max_cost_usd": 5.0, "style": "stylized_realistic" },

  "requirements": [
    {
      "id": "req_room_shell",
      "for": ["zone_hall"],
      "decision": "procedural",
      "generator": "proc:room_shell@0.2.0",
      "params": { "bounds_from": "zone_hall", "openings_from": "zone_hall" },
      "rationale": "Walls, floor and ceiling are fully defined by dimensions."
    },
    {
      "id": "req_shelving",
      "for": ["ent_shelf_row_a", "ent_shelf_row_b"],
      "need": { "semantic": "industrial pallet shelving bay", "kind": "prop", "capabilities": [], "size_m": [2.7, 4.0, 1.1], "size_tolerance": 0.15, "collider": "box" },
      "candidates": [
        { "asset": "asset:shelving-pallet-bay@2.1.0", "scores": { "semantic": 0.93, "visual": 0.84, "size": 0.97, "capabilities": 1.0 }, "tris": 11800, "license": "internal" },
        { "asset": "asset:shelving-light-duty@1.0.0", "scores": { "semantic": 0.71, "visual": 0.79, "size": 0.52, "capabilities": 1.0 }, "tris": 4200, "license": "cc-by-4.0", "rejected_because": "Too small for pallet storage (size score below threshold)." }
      ],
      "decision": "reuse",
      "selected": "asset:shelving-pallet-bay@2.1.0",
      "rationale": "Exact type; size within tolerance; internal licence."
    },
    {
      "id": "req_ext_co2",
      "for": ["ent_ext_co2"],
      "need": { "semantic": "CO2 fire extinguisher with discharge horn", "kind": "prop", "capabilities": ["inspect", "pick_up", "put_down", "use"], "size_m": [0.2, 0.62, 0.25], "size_tolerance": 0.2, "animations": ["spray"] },
      "candidates": [
        { "asset": "asset:extinguisher-co2@1.0.0", "scores": { "semantic": 0.97, "visual": 0.9, "size": 0.95, "capabilities": 1.0 }, "tris": 9800, "license": "internal" },
        { "asset": "asset:extinguisher-water@1.2.0", "scores": { "semantic": 0.41, "visual": 0.88, "size": 0.96, "capabilities": 1.0 }, "tris": 9100, "license": "internal", "rejected_because": "Wrong extinguisher type despite high visual similarity." }
      ],
      "decision": "reuse",
      "selected": "asset:extinguisher-co2@1.0.0",
      "rationale": "Semantic type and the spray animation both match."
    },
    {
      "id": "req_alarm",
      "for": ["ent_alarm"],
      "need": { "semantic": "red wall-mounted fire alarm call point", "kind": "prop", "capabilities": ["inspect", "activate"], "size_m": [0.1, 0.1, 0.05], "size_tolerance": 0.3 },
      "candidates": [
        { "asset": "asset:button-wall-red@1.0.0", "scores": { "semantic": 0.68, "visual": 0.74, "size": 0.9, "capabilities": 1.0 }, "tris": 600, "license": "internal" }
      ],
      "decision": "adapt",
      "base": "asset:button-wall-red@1.0.0",
      "adaptations": [
        { "op": "decal", "material": "face", "text": "loc:sign.fire_alarm_push", "icon": "icon:fire" },
        { "op": "set_color", "material": "housing", "color": "#c8102e" }
      ],
      "produces": "asset:fire-alarm-call-point@0.1.0",
      "rationale": "Same mechanism and size; only the face label and colour differ."
    },
    {
      "id": "req_panel",
      "for": ["ent_panel"],
      "need": { "semantic": "industrial electrical distribution panel, closed metal door, high-voltage warning sticker", "kind": "prop", "capabilities": ["inspect"], "size_m": [0.8, 1.2, 0.3], "size_tolerance": 0.2, "collider": "box" },
      "candidates": [
        { "asset": "asset:metal-cabinet-wall@1.0.0", "scores": { "semantic": 0.44, "visual": 0.62, "size": 0.81, "capabilities": 1.0 }, "tris": 900, "license": "internal", "rejected_because": "Generic cabinet; learners must recognise it as electrical equipment." }
      ],
      "decision": "generate",
      "provider_request": {
        "capability": "text_to_3d",
        "providers": ["tripo", "meshy"],
        "prompt": "Industrial wall-mounted electrical distribution panel, grey painted steel, closed door with handle, yellow high-voltage warning sticker, stylized realistic, PBR",
        "negative": "text, logos, open door, people",
        "target": { "format": "glb", "max_tris": 20000, "size_m": [0.8, 1.2, 0.3], "pivot": "bottom_center", "front": "+Z", "textures": "ktx2", "max_texture_px": 2048 },
        "est_cost_usd": 0.6
      },
      "fallback": { "decision": "procedural", "generator": "proc:wall_cabinet@0.1.0", "params": { "size_m": [0.8, 1.2, 0.3], "decal": "asset:decal-high-voltage@1.0.0" } },
      "rationale": "No library asset reads clearly as an electrical panel."
    },
    {
      "id": "req_supervisor",
      "for": ["act_supervisor"],
      "need": { "semantic": "adult warehouse supervisor in a high-visibility vest", "kind": "actor", "rig": "humanoid-std@1", "clips": ["idle", "talk", "point"], "lipsync": true },
      "candidates": [
        { "asset": "asset:character-worker-hivis@2.0.0", "scores": { "semantic": 0.9, "visual": 0.85, "size": 1.0, "capabilities": 1.0 }, "tris": 38000, "license": "internal" }
      ],
      "decision": "reuse",
      "selected": "asset:character-worker-hivis@2.0.0",
      "rationale": "Standard rig; all three clips and visemes present."
    }
  ],

  "totals": { "reuse": 3, "adapt": 1, "procedural": 1, "generate": 1, "est_cost_usd": 0.6 }
}
```

**Key rules**
- `decision` ∈ `reuse | adapt | procedural | generate`, evaluated in that order (plan Section 5).
- `scores` are kept **separately** (semantic / visual / size / capabilities). A high `visual` score alone can
  never select an asset; the CO2-vs-water candidate shows why.
- Every rejected candidate records `rejected_because`, and every decision records a `rationale`.
- `adapt` always `produces` a **new** asset ID/version. The base asset is never modified.
- `generate` always carries a `fallback` (usually procedural), so a provider outage does not block the job.
- The sum of `est_cost_usd` must stay within `budget.max_cost_usd`, or the job pauses for review.

### 3.3 `asset_manifest.json` — the resolved, measured assets

> **Written by:** step 6, Asset Workers · **Read by:** Interaction Planner, Compiler

The example is trimmed to three assets (one per origin type) plus one procedural entry.

```json
{
  "schema": "asset_manifest",
  "schema_version": "0.1.0",
  "experience_id": "warehouse-electrical-fire",
  "revision": 1,
  "produced_by": { "stage": "generating_assets", "job_id": "job_8f3a2c", "attempt": 1 },
  "inputs": [{ "ref": "asset_plan@r1", "sha256": "sha256:77b0e1c4" }],

  "assets": [
    {
      "asset": "asset:extinguisher-co2@1.0.0",
      "kind": "prop",
      "uri": "lib://assets/extinguisher-co2/1.0.0/model.glb",
      "sha256": "sha256:c3f9a8e2",
      "format": "glb",
      "bytes": 845123,
      "bounds_m": { "min": [-0.1, 0, -0.12], "max": [0.1, 0.62, 0.13] },
      "pivot": "bottom_center",
      "front": "+Z",
      "collider": { "type": "capsule", "radius_m": 0.1, "height_m": 0.62 },
      "hotspots": [
        { "id": "grip", "pos": [0, 0.55, 0] },
        { "id": "nozzle", "pos": [0, 0.48, 0.13] }
      ],
      "animations": [{ "id": "spray", "clip": "Spray", "loop": true, "duration_s": 1.0 }],
      "capabilities": ["inspect", "pick_up", "put_down", "use"],
      "metrics": { "tris": 9800, "materials": 2, "texture_mb": 3.1 },
      "lods": [{ "level": 1, "uri": "lib://assets/extinguisher-co2/1.0.0/lod1.glb", "tris": 2400, "switch_m": 8 }],
      "license": { "id": "internal", "redistribution": "allowed", "attribution": null },
      "provenance": { "origin": "library", "first_ingested_by": "asset-pipeline@0.3.0", "source": "demo:fire-safety-v0" },
      "status": "approved"
    },
    {
      "asset": "asset:electrical-panel-industrial@0.1.0",
      "kind": "prop",
      "uri": "lib://quarantine/electrical-panel-industrial/0.1.0/model.glb",
      "sha256": "sha256:19ae55d0",
      "format": "glb",
      "bytes": 1320444,
      "bounds_m": { "min": [-0.41, 0, -0.15], "max": [0.41, 1.22, 0.15] },
      "pivot": "bottom_center",
      "front": "+Z",
      "collider": { "type": "box", "size_m": [0.82, 1.22, 0.3] },
      "hotspots": [{ "id": "front", "pos": [0, 0.7, 0.16] }],
      "animations": [],
      "capabilities": ["inspect"],
      "metrics": { "tris": 17650, "materials": 1, "texture_mb": 5.4 },
      "lods": [],
      "license": { "id": "provider-generated", "terms_ref": "terms:<provider>@<date>", "redistribution": "pending_legal", "attribution": null },
      "provenance": {
        "origin": "generated",
        "requirement": "asset_plan@r1#req_panel",
        "provider": "tripo",
        "provider_task_id": "<provider-task-id>",
        "provider_model_version": "<pinned-version>",
        "post_processing": ["normalize_scale", "pivot_bottom_center", "decimate:20000", "ktx2:2048", "collider:box"],
        "pipeline": "asset-pipeline@0.4.0",
        "cost_usd": 0.55
      },
      "checks": { "glb_valid": "pass", "scale": "pass", "pivot": "pass", "tris_budget": "pass", "rights": "pending", "visual_review": "pending" },
      "status": "validated"
    },
    {
      "asset": "asset:fire-alarm-call-point@0.1.0",
      "kind": "prop",
      "uri": "lib://quarantine/fire-alarm-call-point/0.1.0/model.glb",
      "sha256": "sha256:8e4410ab",
      "format": "glb",
      "bytes": 61210,
      "bounds_m": { "min": [-0.05, -0.05, 0], "max": [0.05, 0.05, 0.05] },
      "pivot": "back_center",
      "front": "+Z",
      "collider": { "type": "box", "size_m": [0.1, 0.1, 0.05] },
      "hotspots": [{ "id": "button", "pos": [0, 0, 0.05] }],
      "animations": [{ "id": "press", "clip": "Press", "loop": false, "duration_s": 0.3 }],
      "capabilities": ["inspect", "activate"],
      "metrics": { "tris": 640, "materials": 2, "texture_mb": 0.4 },
      "lods": [],
      "license": { "id": "internal", "redistribution": "allowed", "attribution": null },
      "provenance": { "origin": "adapted", "base": "asset:button-wall-red@1.0.0", "requirement": "asset_plan@r1#req_alarm", "pipeline": "asset-pipeline@0.4.0", "adaptations_sha256": "sha256:2c71f0e9" },
      "checks": { "glb_valid": "pass", "scale": "pass", "pivot": "pass", "tris_budget": "pass", "rights": "pass", "visual_review": "pending" },
      "status": "validated"
    }
  ],

  "procedural": [
    { "id": "proc_hall_shell", "generator": "proc:room_shell@0.2.0", "for": "zone_hall", "params_sha256": "sha256:e01b7c55", "deterministic": true }
  ]
}
```

**Asset status lifecycle**

```text
quarantined ──automated checks pass──▶ validated ──human / library review──▶ approved
     │                                     │                                    │
     └──────────── fail ──▶ rejected ◀─────┘                     later ──▶ deprecated
```

- `validated`: passed the automated technical checks and may be used **in this experience's preview**.
- `approved`: passed rights and quality review and is promoted to the shared library for every experience.
- A published (non-preview) package must not depend on `quarantined` or `rejected` assets (rule V10).
  Whether `validated` is enough to publish is an open question (Section 8).

---

# Part D — Interactions (pipeline step 7)

*How the story's abstract actions are bound to real objects in the scene.*

## 4. Interactions

### 4.1 `interaction_graph.json` — binding actions to objects

> **Written by:** step 7, Interaction Planner (LLM + component registry) · **Read by:** Compiler, QA

This example is **revision 2**, the result of the targeted repair shown in the QA report (Section 6): revision 1 had
no way to put an extinguisher down.

```json
{
  "schema": "interaction_graph",
  "schema_version": "0.1.0",
  "experience_id": "warehouse-electrical-fire",
  "revision": 2,
  "produced_by": { "stage": "interaction_planning", "job_id": "job_8f3a2c", "attempt": 2, "repair_of": "qa_report@r1#chk_path_water_then_co2" },
  "inputs": [
    { "ref": "experience_graph@r1", "sha256": "sha256:5c07be19" },
    { "ref": "asset_manifest@r1", "sha256": "sha256:2aa9f310" },
    { "ref": "qa_report@r1", "sha256": "sha256:f0c3d871" }
  ],

  "registry": "actions:core@0.1.0",

  "entities": [
    { "entity": "ent_panel", "label": "loc:ent.panel", "capabilities": ["inspect"], "hotspot": "front" },
    { "entity": "ent_fire", "label": "loc:ent.fire", "capabilities": ["use_target"], "states": { "initial": "burning", "values": ["burning", "spreading", "out"] } },
    { "entity": "ent_alarm", "label": "loc:ent.alarm", "capabilities": ["inspect", "activate"], "hotspot": "button", "states": { "initial": "idle", "values": ["idle", "ringing"] } },
    { "entity": "ent_ext_co2", "label": "loc:ent.ext_co2", "capabilities": ["inspect", "pick_up", "put_down", "use"], "hotspot": "grip", "use_range_m": 3.0 },
    { "entity": "ent_ext_water", "label": "loc:ent.ext_water", "capabilities": ["inspect", "pick_up", "put_down", "use"], "hotspot": "grip", "use_range_m": 3.0 }
  ],

  "interactions": [
    {
      "id": "ix_inspect_panel", "verb": "inspect", "target": "ent_panel",
      "presentation": { "mode": "closeup", "text": "loc:inspect.panel_smoke" }
    },
    {
      "id": "ix_activate_alarm", "verb": "activate", "target": "ent_alarm",
      "requires": { "var": "var_hazard_seen", "eq": true },
      "denied": { "text": "loc:hint.why_alarm" },
      "effects": [
        { "op": "play_anim", "entity": "ent_alarm", "clip": "press" },
        { "op": "entity_state", "entity": "ent_alarm", "value": "ringing" },
        { "op": "play_sfx", "sfx": "asset:sfx-alarm-bell@1.0.0", "at": "ent_alarm", "loop": true }
      ]
    },
    {
      "id": "ix_pick_up_extinguisher", "verb": "pick_up", "targets": ["ent_ext_co2", "ent_ext_water"],
      "allowed_in": ["st_choose"],
      "requires": { "not": { "holding_any": true } },
      "denied": { "text": "loc:hint.hands_full" }
    },
    {
      "id": "ix_put_down_extinguisher", "verb": "put_down", "targets": ["ent_ext_co2", "ent_ext_water"],
      "requires": { "holding_any": true },
      "place": "nearest_floor"
    },
    {
      "id": "ix_use_co2_on_fire", "verb": "use", "item": "ent_ext_co2", "target": "ent_fire",
      "requires": { "all": [{ "holding": "ent_ext_co2" }, { "in_state": "st_choose" }] },
      "duration_s": 3,
      "effects": [
        { "op": "play_anim", "entity": "ent_ext_co2", "clip": "spray" },
        { "op": "vfx", "vfx": "asset:vfx-co2-cloud@1.0.0", "at": "ent_ext_co2:nozzle", "action": "start" },
        { "op": "entity_state", "entity": "ent_fire", "value": "out" }
      ]
    },
    {
      "id": "ix_use_water_on_fire", "verb": "use", "item": "ent_ext_water", "target": "ent_fire",
      "requires": { "all": [{ "holding": "ent_ext_water" }, { "in_state": "st_choose" }] },
      "duration_s": 2,
      "effects": [
        { "op": "play_anim", "entity": "ent_ext_water", "clip": "spray" },
        { "op": "entity_state", "entity": "ent_fire", "value": "spreading" }
      ]
    }
  ]
}
```

**Key rules**
- `target` (one entity) or `targets` (the same interaction on several entities).
- `requires` is checked when the player tries the action. If it is false, `denied.text` is shown and nothing else
  happens. `allowed_in` limits the states in which the interaction is offered at all (omitted = any state).
- Every successful interaction automatically emits an `action` telemetry event `{ verb, item, target, t }`. That
  event is what `experience_graph` transitions and `assessment_spec` evidence listen to, so the three files connect
  without any code.
- Every `capabilities` entry must exist on the resolved asset in `asset_manifest` (rule V08). The interaction
  layer cannot invent a capability the model does not support (for example "spray" with no spray clip).

---

# Part E — Package and QA (pipeline steps 8–10)

*What the compiler packs into the `.ibook`, and what the automated playthrough reports before publishing.*

## 5. Package files

### 5.1 `experience_manifest.json` — the root of the `.ibook`

> **Written by:** step 8, Compiler (deterministic) · **Read by:** Runtime (ExperienceLoader), Publisher

```json
{
  "schema": "experience_manifest",
  "schema_version": "0.1.0",
  "experience_id": "warehouse-electrical-fire",
  "version": "1.0.0",
  "build": 7,
  "produced_by": { "stage": "assembling", "job_id": "job_8f3a2c", "attempt": 1, "agent": "ib-compiler@0.1.0", "model": null },

  "title": "loc:exp.title",
  "runtime": { "mode": "first_person", "min_version": "0.1.0", "features": ["actions:core@0.1.0", "physics:basic", "audio:spatial"] },

  "locales": {
    "default": "en",
    "available": ["en", "ar"],
    "rtl": ["ar"],
    "files": {
      "en": { "path": "strings/en.json", "sha256": "sha256:51aa09c2" },
      "ar": { "path": "strings/ar.json", "sha256": "sha256:9b3e7d14" }
    }
  },

  "documents": {
    "scenario_spec": { "path": "specs/scenario_spec.json", "revision": 1, "schema_version": "0.1.0", "sha256": "sha256:a91d22f0" },
    "experience_graph": { "path": "specs/experience_graph.json", "revision": 1, "schema_version": "0.1.0", "sha256": "sha256:5c07be19" },
    "assessment_spec": { "path": "specs/assessment_spec.json", "revision": 1, "schema_version": "0.1.0", "sha256": "sha256:3e81c6aa" },
    "world_spec": { "path": "specs/world_spec.json", "revision": 1, "schema_version": "0.1.0", "sha256": "sha256:0d4e6a73" },
    "asset_plan": { "path": "specs/asset_plan.json", "revision": 1, "schema_version": "0.1.0", "sha256": "sha256:77b0e1c4" },
    "asset_manifest": { "path": "specs/asset_manifest.json", "revision": 1, "schema_version": "0.1.0", "sha256": "sha256:2aa9f310" },
    "interaction_graph": { "path": "specs/interaction_graph.json", "revision": 2, "schema_version": "0.1.0", "sha256": "sha256:c4d2981e" },
    "compiled": { "path": "compiled/experience.runtime.json", "schema_version": "0.1.0", "sha256": "sha256:7f10b3d6" }
  },

  "dependencies": {
    "delivery": "thin",
    "assets": [
      { "asset": "asset:extinguisher-co2@1.0.0", "sha256": "sha256:c3f9a8e2", "uri": "lib://assets/extinguisher-co2/1.0.0/model.glb" },
      { "asset": "asset:electrical-panel-industrial@0.1.0", "sha256": "sha256:19ae55d0", "uri": "lib://quarantine/electrical-panel-industrial/0.1.0/model.glb" },
      { "asset": "asset:fire-alarm-call-point@0.1.0", "sha256": "sha256:8e4410ab", "uri": "lib://quarantine/fire-alarm-call-point/0.1.0/model.glb" }
    ],
    "procedural": ["proc:room_shell@0.2.0"],
    "rules": ["rule:fire-safety/electrical-fire@1.0.0"]
  },

  "content_sha256": "sha256:6d2f0b91",
  "created_at": "2026-11-22T10:14:05Z"
}
```

**Key rules**
- `content_sha256` is the hash of the sorted list of `path + sha256` for every other file in the package.
  The manifest does not try to hash itself.
- The Publisher writes a separate `signature.json` that signs the manifest hash and the QA report hash, so the
  manifest does not change after QA.
- `delivery: "thin"` = assets are fetched from the library at load time; `"bundled"` = they are inside the
  package (needed only if offline use is required; see Section 8).

### 5.2 `.ibook` layout (proposed)

```text
warehouse-electrical-fire-1.0.0.ibook        (zip)
├── manifest.json                 experience_manifest
├── signature.json                written by the Publisher
├── specs/                        the planning files, kept for traceability and targeted repair
│   ├── scenario_spec.json
│   ├── experience_graph.json
│   ├── assessment_spec.json
│   ├── world_spec.json
│   ├── asset_plan.json
│   ├── asset_manifest.json
│   └── interaction_graph.json
├── compiled/
│   └── experience.runtime.json   the ONLY spec file the runtime reads (see below)
├── strings/
│   ├── en.json
│   └── ar.json
├── assets/                       empty for "thin" delivery
└── qa/
    └── qa_report.json
```

**Proposal: a compiled runtime file.** The compiler merges the spec files into one denormalised
`experience.runtime.json` with every reference already resolved (entity + placement + asset URI + interactions in
one object). The runtime then has one simple input to validate and load, and Phase 1 ("loads `experience.json`")
can start before the AI pipeline exists by hand-writing that file directly. The `specs/` files stay in the package
for audit and repair but are never interpreted by the runtime.

### 5.3 `strings/<locale>.json` *(proposed addition)*

> **Written by:** keys from steps 2 and 7, text from the localisation step · **Read by:** Runtime

```json
{
  "schema": "strings",
  "schema_version": "0.1.0",
  "experience_id": "warehouse-electrical-fire",
  "locale": "en",
  "strings": {
    "exp.title": "Smoke at the Panel",
    "line.sup_intro": "First shift? Take a walk round the hall and get to know it.",
    "line.sup_well_done": "Good call. Alarm first, then the right extinguisher.",
    "hint.smell_smoke": "Something smells like burning plastic.",
    "hint.check_east_wall": "Check the equipment on the east wall.",
    "hint.find_call_point": "Find the red fire alarm call point.",
    "hint.why_alarm": "Find what is wrong before raising the alarm.",
    "hint.hands_full": "Put down what you are holding first.",
    "fb.water_on_electrical": "Water conducts electricity. On a live electrical fire it can cause a shock and spread the fire.",
    "fb.evacuate_instead": "If you are not sure which extinguisher to use, leave the area and wait for the fire team.",
    "inspect.panel_smoke": "Smoke is coming from behind the panel door.",
    "ent.panel": "Electrical panel",
    "ent.fire": "Fire",
    "ent.alarm": "Fire alarm call point",
    "ent.ext_co2": "CO2 extinguisher",
    "ent.ext_water": "Water extinguisher",
    "sign.fire_alarm_push": "FIRE - PUSH HERE",
    "fb.obj_hazard_met": "You found the source of the smoke.",
    "fb.obj_hazard_missed": "The smoke came from the electrical panel.",
    "fb.obj_alarm_met": "You raised the alarm quickly.",
    "fb.obj_alarm_slow": "You raised the alarm, but it took a while.",
    "fb.obj_alarm_missed": "The alarm was not raised.",
    "fb.obj_ext_met": "CO2 was the right choice for an electrical fire.",
    "fb.obj_ext_second_try": "You got there on the second try. Remember: no water on electrical fires.",
    "fb.obj_ext_missed": "An electrical fire needs CO2, not water.",
    "debrief.title": "How did you do?"
  },
  "voice": {
    "line.sup_intro": { "audio": "asset:vo-sup-intro-en@1.0.0", "duration_s": 3.8 },
    "line.sup_well_done": { "audio": "asset:vo-sup-well-done-en@1.0.0", "duration_s": 3.1 }
  }
}
```

**Key rules:** every `loc:` key used in any spec exists in every available locale (rule V11); `voice` maps a
line to its recorded or generated audio per locale; RTL locales are declared in the manifest.

## 6. `qa_report.json` — what the playthrough found

> **Written by:** step 9, Playthrough QA (deterministic harness) · **Read by:** Orchestrator (targeted repair), Publisher

This example is the report for **build 6** (interaction_graph r1), which found the dead end that led to the r2
repair above.

```json
{
  "schema": "qa_report",
  "schema_version": "0.1.0",
  "experience_id": "warehouse-electrical-fire",
  "revision": 1,
  "produced_by": { "stage": "validating", "job_id": "job_8f3a2c", "attempt": 1, "agent": "qa-harness@0.1.0", "model": null },
  "inputs": [{ "ref": "experience_manifest@build6", "sha256": "sha256:0b44c9d2" }],

  "environment": { "runtime": "0.1.0", "browser": "chromium-headless", "device_profile": "laptop-integrated-gpu", "seed": 1234 },
  "result": "fail",
  "summary": { "checks": 38, "passed": 36, "warnings": 1, "failed": 1, "blockers": 1 },

  "checks": [
    { "id": "chk_schemas", "category": "schema", "status": "pass" },
    { "id": "chk_references", "category": "references", "status": "pass", "detail": "64 references resolved." },
    { "id": "chk_reach_ent_panel", "category": "reachability", "status": "pass", "measured": { "closest_stand_m": 0.6 } },
    { "id": "chk_perf_frame", "category": "performance", "status": "warn", "measured": { "p95_frame_ms": 21.4 }, "budget": { "p95_frame_ms": 20 } },
    {
      "id": "chk_path_water_then_co2",
      "category": "playthrough",
      "status": "fail",
      "severity": "blocker",
      "detail": "After using the water extinguisher the player cannot pick up the CO2 extinguisher: ix_pick_up_extinguisher requires empty hands and no interaction releases a held item. st_choose has no reachable exit on this path.",
      "owner_stage": "interaction_planning",
      "evidence": ["artifacts/path_water_then_co2.webm", "artifacts/path_water_then_co2.trace.json"]
    }
  ],

  "paths": [
    {
      "id": "path_direct_success", "expect_end": "st_end_success", "status": "pass", "duration_s": 94,
      "steps": [
        { "do": { "verb": "inspect", "target": "ent_panel" } },
        { "do": { "verb": "activate", "target": "ent_alarm" } },
        { "do": { "verb": "pick_up", "target": "ent_ext_co2" } },
        { "do": { "verb": "use", "item": "ent_ext_co2", "target": "ent_fire" } }
      ]
    },
    {
      "id": "path_water_then_co2", "expect_end": "st_end_success", "status": "fail", "stopped_at": { "state": "st_choose", "step": 6 },
      "steps": [
        { "do": { "verb": "inspect", "target": "ent_panel" } },
        { "do": { "verb": "activate", "target": "ent_alarm" } },
        { "do": { "verb": "pick_up", "target": "ent_ext_water" } },
        { "do": { "verb": "use", "item": "ent_ext_water", "target": "ent_fire" } },
        { "system": "feedback_closed" },
        { "do": { "verb": "pick_up", "target": "ent_ext_co2" }, "result": "denied", "denied_text": "loc:hint.hands_full" }
      ]
    },
    {
      "id": "path_fail_twice", "expect_end": "st_end_fail", "status": "pass", "duration_s": 71,
      "steps": [
        { "do": { "verb": "inspect", "target": "ent_panel" } },
        { "do": { "verb": "activate", "target": "ent_alarm" } },
        { "do": { "verb": "pick_up", "target": "ent_ext_water" } },
        { "do": { "verb": "use", "item": "ent_ext_water", "target": "ent_fire" } },
        { "system": "feedback_closed" },
        { "do": { "verb": "use", "item": "ent_ext_water", "target": "ent_fire" } },
        { "system": "feedback_closed" }
      ]
    }
  ],

  "coverage": {
    "states": { "covered": 7, "total": 7 },
    "transitions": { "covered": 7, "total": 7 },
    "objectives": { "covered": 3, "total": 3 },
    "paths": { "passed": 2, "total": 3 }
  },

  "repairs": [
    {
      "attempt": 1,
      "for_check": "chk_path_water_then_co2",
      "stage": "interaction_planning",
      "mode": "rerun_with_feedback",
      "scope": ["interactions"],
      "result": "produced interaction_graph@r2",
      "recheck": ["chk_path_water_then_co2", "chk_references"]
    }
  ],
  "retry_budget": { "used": 1, "max": 3 },
  "unresolved": [],
  "escalations": []
}
```

**Key rules**
- Every check has an `owner_stage` when it fails. That is how the orchestrator knows **which single stage** to
  re-run (targeted repair) instead of regenerating everything.
- `paths` are generated from the experience graph: at least one path to each `end` state plus one path through
  every `decision` option. The `steps` format is replayable, so a failed path is its own reproduction artifact.
- When `retry_budget.used` reaches `max`, the job moves to `paused_for_review` and the issue goes into
  `escalations`.
- Deterministic checks decide `result`. A vision-model judgment may be added as a `warn`-level check but never
  as the only reason for a pass.

---

# Part F — Validation and open questions

## 7. Cross-file validation rules (what the validators enforce)

Schema validation checks each file alone. The rules below check the files **against each other** and are what make
the plan's acceptance conditions machine-checkable. Each one blocks release.

| ID | Rule | Checked after |
|---|---|---|
| V01 | All local IDs are unique across the experience and use the right prefix. | every stage |
| V02 | No `critical` fact has `origin: "assumption"`; `approved_rule` facts point at an existing rule version. | 1 |
| V03 | Every `obj_` appears in at least one experience-graph state and in `assessment_spec`. | 2 |
| V04 | Every state is reachable from `start_state`; every non-`end` state has an exit; at least one `success` end is reachable. | 2 |
| V05 | Every `decision` state has ≥ 2 options leading to different outcomes. | 2 |
| V06 | Every `required` entity has exactly one placement; every `must_reach` target passes the spatial check. | 3 |
| V07 | Every action pattern used in `experience_graph` and `assessment_spec` matches at least one interaction. | 7 |
| V08 | Every interaction verb is in the named registry version, and every capability used exists on the resolved asset. | 7 |
| V09 | Conditions and effects reference only declared variables, states, entities and clips. | 2, 7 |
| V10 | Every `asset:` ref resolves in `asset_manifest` with a hash; none is `quarantined` or `rejected` in a published build. | 8 |
| V11 | Every `loc:` key exists in every available locale. | 8 |
| V12 | Real asset bounds are within `size_tolerance` of `expected_size_m`. | 8 |
| V13 | Scene totals are within `world_spec.budgets`. | 8 |
| V14 | No URL outside the allowlist (`lib://`, approved hosts); no field that contains code. | every stage |
| V15 | Every required QA path reaches its expected end; no blocker is left unresolved without an escalation. | 9 |

## 8. Open questions for the team

1. **Condition language:** the small custom vocabulary above, or a restricted subset of an existing standard such
   as JSON Logic (more tooling, but needs an operator allowlist)?
2. **One compiled file for the runtime** (`experience.runtime.json`, Section 5.2): do we agree the runtime should
   read only that file, with the spec files kept for audit?
3. **Coordinates:** world-space everywhere (proposed; simpler validators) or zone-local (easier when zones are
   reused as modules)?
4. **Assets in a preview vs a published build:** is `validated` enough to publish, or must every asset be
   `approved` first?
5. **Verb set:** are the four proposed additions (`close`, `put_down`, `activate`, `talk`) acceptable for
   `actions:core@0.1.0`?
6. **Scoring:** do we need both `scored` and `qualitative` modes in the first milestone, or only one?
7. **Localisation:** generate all locales during the job, or only the default locale with others added later?
   Who reviews translated safety-critical text?
8. **Schema tooling:** JSON Schema (draft 2020-12) as the source of truth with Pydantic and TypeScript types
   generated from it, or Pydantic first?

**Proposed next step:** once these are answered, turn each example into a JSON Schema in `contracts/`, with one valid
and several invalid fixtures per file in CI (task IB-03).
