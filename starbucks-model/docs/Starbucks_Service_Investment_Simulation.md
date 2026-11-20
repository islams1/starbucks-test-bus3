# Starbucks | The $40 Million Service Decision

**Format** · Interactive case book with a playable café and a branching investment meeting  
**Audience** · Product, service operations and business learners  
**Learner role** · Service operations lead presenting a decision to an investment committee  
**Run time** · Approximately 12–15 minutes, including the debrief

## What we are building

Open on a busy coffee counter. The learner observes what happens when orders arrive faster than drinks leave, checks what customers actually report, then recommends where to spend. The deliverable is a short investment memo generated from learner choices. Learners should be able to name the service problem, calculate the order lift needed to cover added labor, and explain what evidence would change their recommendation.

### Historical basis

| Verified fact | Use in the experience | Source |
| --- | --- | --- |
| The published case describes research suggesting a service gap and a proposed labor investment costing $40 million annually. The financial effect was uncertain. | One factual context card before the reenactment. | [Harvard Business Publishing case 504-016](https://store.hbr.org/product/starbucks-delivering-customer-service/504016) |
| Starbucks reported 5,886 retail stores as of September 29, 2002. | Optional context card to convey scale. Keep the reported worldwide store count separate from the illustrative store model below. | [Starbucks FY2002 Form 10-K, Item 2](https://www.sec.gov/Archives/edgar/data/829224/000089102002002061/v86608e10vk.htm) |

The Harvard case is by Youngme Moon and John A. Quelch. The public listing supplies the premise. All named characters, café observations, numerical inputs, dialogue, and investment paths below are original teaching material. Put **Illustrative scenario** in the scene header and **From the published case** on the historical card. Secure the publisher's permission for any case text, exhibits, or licensed media that the team elects to incorporate. [Harvard Business Publishing copyright information](https://www.harvardbusiness.org/copyright-information/)

## Cast and setting

| Character | Function and direction | First appearance |
| --- | --- | --- |
| Learner, service operations lead | First-person at the counter, then seated at the review table. Show hands only when interacting with the tablet. | Counter |
| Noor, shift lead | Breaks down the rush and points to the backlog at handoff. Speak quickly during the rush, then slow down when reviewing evidence. | Counter |
| Ben, customer | Visibly checks the time, then leaves quietly before ordering. One other customer waits and receives an order. | Counter |
| Ellis, finance partner | Opens the cost worksheet and asks which assumptions drive the break-even result. | Model |
| Priya, committee chair | Asks the learner to recommend a decision and name the evidence needed to review it. | Decision |

Build one period-neutral café set and one small meeting area using the same furniture and material palette. Use unbranded cups, signage, uniforms, and customer designs in the teaching scenes. The source card carries the factual Starbucks name.

## Interactive objects

| Object | What to build | Interaction and states |
| --- | --- | --- |
| Order rail | Counter rail with a short stack of numbered tickets. A clock and a separate pickup shelf make the flow readable. | Activate **Inspect order flow**. An animation and text summary show a queue at pickup. Idle → inspected, and the cue is pinned to the evidence tray. |
| Queue observation card | Two rows marked **Peak** and **Off-peak**. Simulated median waits are 7 min and 2 min. | Toggle either row to replay the corresponding static view. The two periods remain comparable and labeled in the text version. |
| Customer card | Two short authored comments, “I left because I was running late” and “My drink usually comes out right.” | Tap to open each comment. Tag as **Speed** or **Order accuracy**. Feedback describes each as a qualitative observation. |
| Cost tablet | Three controls and a result panel next to Ellis. | Edit contribution and additional purchases with sliders or numeric steppers. **Reset model** restores the default. Label every input and result **Illustrative**. |
| Decision memo | Form with recommendation, two evidence fields, and a success-condition field. | Use buttons or keyboard to select evidence already opened. Confirm locks a copy for the debrief. **Revise recommendation** opens a separate practice attempt. |

## Scene direction and learner flow

### 1. Watch the counter · 2–3 minutes

Start on a wide eye-level counter shot. Play 10 seconds of café ambience with a ticket printer and restrained queue chatter. Ben checks the time and leaves. Captions and the static state list carry the same information. Noor says, “The queue looks long now. Pull up the slower and quieter periods before we decide what to change.”

Prompt **“Which service problem would you investigate first?”** After opening both queue views and at least one customer comment, allow **Peak wait at pickup**, **Order accuracy**, or **A storewide service problem**. Peak wait is the strongest inference from the supplied data. For order accuracy show “The comment describes order accuracy positively. What other accuracy evidence would you want?” For storewide problems show “The busiest and quietest periods differ. Which period would you measure again?” All selections continue to the model. Keep the first hypothesis visible in the memo.

### 2. Price the improvement · 4 minutes

Camera faces the cost tablet and Ellis together. Ellis says, “A shorter line helps customers. What additional completed orders would cover the added labor?”

| Input | Default | Accepted range or value |
| --- | ---: | --- |
| Added annual labor per illustrative store | $21,600 | Fixed |
| Operating days per year | 360 days | Fixed |
| Net contribution per additional completed purchase | $3.00 | $2.00–$5.00, in $0.50 steps |
| Additional completed purchases per operating day | 20 | Whole numbers, 0–40 |

Compute **yearly added contribution** as additional purchases per day × operating days × contribution per purchase. Compute **annual effect** as added contribution less the added labor cost. Compute **whole purchases/day to cover labor** as the ceiling of yearly cost ÷ (operating days × contribution). Display **Above cost**, **Covers cost exactly**, or **Below cost** with the signed amount. Recalculate after committed input changes. The model holds all other costs and benefits constant and treats purchase lift as an assumption.

At the defaults, **Low** (12) produces −$8,640, **Break-even** (20) produces $0 and **High** (26) produces +$6,480. Buttons set those purchase assumptions and leave the selected contribution unchanged. They always appear as **12 more orders**, **20 more orders**, and **26 more orders**, since the break-even point can move. The learner must compare two distinct purchase assumptions before the decision opens. The accessible model table remains available at the committee screen.

### 3. Make a recommendation · 3 minutes

Show Priya, Noor, and Ellis at a three-quarter meeting angle. Priya says, “We need a recommendation today. What would make you keep or reverse it?”

All routes ask for one **customer evidence** item, one **cost evidence** item, and one **review condition**. Offer **Peak wait at pickup**, **Off-peak wait as a comparison**, and **One customer comment** for the customer field. Offer **Break-even target with current assumptions**, **Low-lift annual result**, and **Sales revenue alone** for the cost field. Provide the route conditions in the table, plus the distractor **Roll forward if people say it feels faster**. A one-line explanation records why the condition fits.

| Choice | Immediate consequence to show | Review condition that earns credit |
| --- | --- | --- |
| **Add staffing across stores now** | Noor can schedule for rollout in the fictional scenario. Ellis highlights the negative low-lift result and the cost of acting everywhere on limited evidence. Display **High commitment**. | **Stage the rollout and pause expansion if comparable stores miss their break-even order lift or order accuracy worsens.** |
| **Run a matched-store pilot first** | Two adjacent calendar cards show test and comparison stores over the same weeks. Display **Limited commitment**. | **Compare comparable peak periods and expand only if wait improves, order accuracy holds, and added contribution covers labor.** |
| **Keep staffing steady and test the pickup step** | Noor pilots a simpler handoff on a small scale before any staffing decision. Display **Lower cost and slower evidence on staffing**. | **Reopen staffing if peak waits remain high after the handoff test, using a labor pilot to test the remaining bottleneck.** |

Generate the memo in plain language with the recommendation, linked evidence cards, latest model values, and proposed review condition. The coaching rubric awards one point each for a peak-specific observation, a cost measure tied to contribution, and the matched review condition. A score of 3 means **Evidence and review condition complete**. The route itself earns zero points.

### 4. Compare the decisions · 2–3 minutes

Show the historical premise again beside the learner memo. Use narration, “The published case asks managers to weigh service improvement against a $40 million yearly labor commitment. The store model you explored let you test how sensitive that decision can be to a change in purchase volume.” The record used here confirms the dilemma. End the historical panel at the documented decision premise and keep learner results in the teaching panel.

| Debrief check | Expected answer and feedback |
| --- | --- |
| What is the break-even lift at $3.00 per purchase? | **20 per day**. $21,600 ÷ (360 × $3.00) is 20. |
| Does a shorter line on its own establish financial payback? | **Measure additional completed purchases and their contribution**. Service and financial effects need their own measures. |
| Which comparison would strengthen the pilot? | **Similar stores and peak periods, with staffing changed in the test group**. Track accuracy as well as wait. |

## Build and QA

- **Produce** one café loop with peak and off-peak variations, two café characters with seated/standing and gestures, two meeting characters, one worksheet view, three calendar/status inserts, and original café ambience. Use a still frame plus captions for each scene on lower-power devices.
- **State** stores scene, opened evidence, first hypothesis, model inputs, distinct assumptions compared, committed memo and debrief answers. Score the committed snapshot. Back keeps choices and inputs. Reopening the memo after commit creates a practice attempt with the original result still reviewable.
- **Controls** use focusable object names, tap/keyboard alternatives, captioned lines, a readable model at narrow widths, and text labels for financial states. Pause ambience independently. Reduced motion swaps pan and queue animation for stills.
- **Acceptance** at defaults, 19 purchases yields −$1,080, 20 yields $0 and 21 yields +$1,080. At $2.50, the displayed break-even requirement is 24. Choosing a reasonable route with irrelevant evidence earns fewer points. Refresh after commit restores the same memo. Historical cards and teaching figures carry their distinct labels everywhere, including print or export of the memo.
