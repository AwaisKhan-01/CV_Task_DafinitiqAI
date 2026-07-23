# Research behind the thresholds

Every number in `frontend/src/thresholds.js` is derived from the sources below
rather than guessed. This file records what was found, what it implies, and
where each threshold came from.

The overriding principle: **thresholds are set to favour missing a real
incident over falsely flagging an innocent one.** A missed flag costs a
reviewer nothing. A false flag can cost a candidate their application.

---

## 1. Blink duration and rate — sets the noise floor

A face detector loses the eyes during a blink, and any threshold shorter than
a blink would flag ordinary blinking.

| Finding | Value | Source |
|---|---|---|
| Mean blink duration while reading | **129 ms** (SD 56, range 10–347) | Scientific Reports 2025 |
| Blink kinematics: closing phase | 50–100 ms; total ~280 ms | Kwon et al., optoelectronic study |
| Blink rate during screen/VDT work | **6.6/min** (vs 16.8 conversing) | Graefes Arch Clin Exp Ophthalmol |
| Blink rate while reading | 4–14/min | Scientific Reports 2025 |

**Implication.** Any eye-closure or face-loss under ~350 ms is inside the
normal spontaneous-blink envelope and must never be flagged. Blink rate also
*drops* on screens, so inter-blink gaps of 9–10 s are physiologically normal
for someone staring at an exam — a "not blinking enough" heuristic would be
badly miscalibrated.

Sources:
- https://www.nature.com/articles/s41598-025-04839-y
- https://pubmed.ncbi.nlm.nih.gov/18565090/
- https://pubmed.ncbi.nlm.nih.gov/14747951/
- https://pubmed.ncbi.nlm.nih.gov/30893187/
- https://www.medrxiv.org/content/10.1101/2022.11.19.22282503.full.pdf
- https://onlinelibrary.wiley.com/doi/10.1097/OPX.0b013e31828f09a7

---

## 2. Gaze aversion — the finding that changed the design

This is the most important result in the whole research pass.

**Acta Psychologica (2023)** eye-tracked 33 participants answering 48
autobiographical questions. **30 of 32 participants averted their gaze** while
retrieving the answer, with a **median aversion duration of ~3.9 seconds**,
beginning ~1.09 s after the question. The authors defined an aversion as gaze
being off-screen for **>500 ms**, a cut-off chosen explicitly to exclude blinks.

**Doherty-Sneddon & Phelps (2005)** established *why*: gaze aversion is a
cognitive load management strategy. Aversion peaks during the thinking phase
and increases with question difficulty.

**Implication — and it is uncomfortable.** Looking away while answering a hard
question is not evidence of dishonesty; it is evidence of *thinking*. A
gaze-away signal therefore measures question difficulty as much as integrity.
Our original 3 s threshold would have flagged the median honest candidate.
It was raised to **6 s** on this basis.

**Fairness note.** Doherty-Sneddon et al. (2012) show the same load-management
aversion in autistic individuals and those with Williams syndrome. Gaze-based
flagging systematically disadvantages neurodivergent candidates.

Sources:
- https://www.sciencedirect.com/science/article/pii/S0001691823002172
- https://link.springer.com/article/10.3758/BF03195338
- https://pmc.ncbi.nlm.nih.gov/articles/PMC3627297/
- https://www.sciencedirect.com/science/article/abs/pii/S001002771730183X
- http://wexler.free.fr/library/files/rayner%20(1998)%20eye%20movements%20in%20reading%20and%20information%20processing.%2020%20years%20of%20research.pdf
- https://www.frontiersin.org/journals/computer-science/articles/10.3389/fcomp.2021.733531/full

---

## 3. Typing speed — sets the "implausibly fast" ceiling

The threshold must sit above the fastest *legitimate* typist, not above the
average one, or it punishes skill.

| Finding | Value | Source |
|---|---|---|
| Mean typing speed (168,000 people, 136M keystrokes) | **51.6 WPM** (SD ~20) | CHI 2018 |
| Fastest 5% | >80 WPM | CHI 2018 |
| Maximum observed | **~120 WPM** | CHI 2018 |
| Independent replication (n=1,301) | mean 52 WPM; top third 80 WPM | Cognitive Research 2022 |
| Professional touch-typists | 70–80 WPM | Cognitive Research 2022 |

**Implication.** 120 WPM at ~5 characters/word is ~10 cps — and that was the
*maximum across 168,000 people*. `MAX_PLAUSIBLE_CPS = 12` sits above the
fastest human in that sample.

The n=1,301 study also reports that typing speed is **unimodally distributed** —
there is no naturally separate "fast typist" population — which is an honest
argument that any single cut-off is somewhat arbitrary.

**A better approach we did not have time to build:** genuine human
inter-keystroke intervals vary with bigram frequency and hand alternation,
while injected text shows unnaturally low latency variance. A
variance/entropy-based check is more principled than a raw speed cut-off.

Sources:
- https://userinterfaces.aalto.fi/136Mkeystrokes/
- https://pmc.ncbi.nlm.nih.gov/articles/PMC9356123/
- https://www.cs.cmu.edu/~keystroke/
- https://arxiv.org/html/2510.02374v1
- https://arxiv.org/html/2604.15845v1
- https://www.ncbi.nlm.nih.gov/pmc/articles/PMC10474054/

---

## 4. Reading speed — why the gaze signal has a hole in it

Brysbaert's meta-analysis (190 studies, 18,573 participants) gives adult
silent reading at **238 WPM** for non-fiction (typical range 175–300).
A separate meta-analysis of 54 studies finds reading *speed* shows no
significant screen-vs-paper difference, so these figures transfer.

**Implication — a known limitation we state openly.** A 15-word sentence takes
roughly **3.8 s** to read at the mean, ~3.0 s at the fast end. Our gaze
threshold is **6 s**. Therefore *a candidate can read a sentence off a phone
and never trip the detector.*

This gap is unavoidable given finding #2: lowering the threshold to catch it
would flag the median honest candidate. The signal catches sustained
disengagement, not brief glances at a second source. That is a real weakness
of the approach, not an implementation bug.

Sources:
- https://www.sciencedirect.com/science/article/abs/pii/S0749596X19300786
- https://reader.ku.edu/sites/reader/files/2024-01/How%20many%20words%20do%20we%20read%20per%20minute%20(1).pdf
- https://users.ugent.be/~wduyck/articles/BrysbaertSuiDuyckDirixInPress.pdf
- https://www.sciencedirect.com/science/article/abs/pii/S0360131518301052
- https://biblio.ugent.be/publication/8647789

---

## 5. Bias and fairness — why flags are advisory only

**Yoder-Himes et al. (2022), Frontiers in Education** — peer-reviewed audit of
a commercial proctoring product (Proctorio). Students with darker and medium
skin tones on the Fitzpatrick scale were **flagged for a significantly greater
percentage of their assessment duration** than White peers. Sex disparities
were also found.

**NIST IR 8280 (FRVT Part 3: Demographic Effects)** — the authoritative
government benchmark. False-positive differentials across demographic groups
vary by up to a factor of **~7,203**, far exceeding false-negative
differentials (~3×). Highest false-positive rates for West/East African and
East Asian faces, highest overall for American Indian; elevated for women,
children and the elderly.

**Implication.** The *same threshold* produces systematically different flag
rates by skin tone. A face-based integrity score is therefore not a
uniform-accuracy component and cannot be treated as one. This is the direct
evidential basis for three design decisions:

1. Flags are advisory and never auto-reject.
2. The risk band is computed at display time, never stored as a verdict.
3. The advisory note ships inside the API response, not just the UI.

Also relevant: surveillance-and-disability research documents how proctoring
systems disadvantage disabled students, and the Coghlan et al. ethics analysis
covers the broader "good proctor or Big Brother" framing.

Sources:
- https://www.frontiersin.org/articles/10.3389/feduc.2022.881449/full
- https://nvlpubs.nist.gov/nistpubs/ir/2019/nist.ir.8280.pdf
- https://pages.nist.gov/frvt/reports/demographics/nistir_8429.pdf
- https://arxiv.org/html/2511.10826v1
- https://pmc.ncbi.nlm.nih.gov/articles/PMC8407138/
- https://www.vice.com/en/article/proctorio-is-using-racist-algorithms-to-detect-faces/
- https://arxiv.org/abs/2409.16923

---

## Threshold derivation summary

| Threshold | Value | Derived from |
|---|---|---|
| `GAZE_AWAY_SUSTAIN_MS` | 6000 | above the 3.9 s median innocent aversion (§2) |
| `NO_FACE_SUSTAIN_MS` | 3000 | ~23× the 129 ms mean blink; past the 347 ms max (§1) |
| `MULTI_FACE_SUSTAIN_MS` | 2000 | shorter — stronger signal, but detectors misfire briefly |
| `RECOVERY_MS` | 1000 | ~2× the 500 ms blink-exclusion window used in §2 |
| `MAX_PLAUSIBLE_CPS` | 12 | above ~10 cps = 120 WPM, the max of 168,000 people (§3) |
| `BULK_INSERT_CHARS` | 30 | ~2.5 s of typing at mean speed appearing in one tick |

## Caveat on these sources

These were gathered by an automated research pass and the figures above were
read from source abstracts and summaries. The headline numbers (3.9 s median
aversion, 129 ms blink, 51.6 WPM mean / 120 WPM max, 238 WPM reading, the NIST
and Proctorio findings) should be confirmed against the primary papers before
being quoted as settled fact in any external document.
