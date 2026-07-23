"""Turns raw events into an advisory risk band.

Deliberately computed at read time, never stored. The events table holds
observations; this file holds today's opinion about them. A reviewer who
disagrees with the weighting still has the underlying evidence intact.

Output is a band plus written reasons -- not a percentage. A number like
"87% likely cheating" implies a precision this system does not have.
"""

# Weight per event type. Paste is weighted highest because it is the most
# reliable signal (a direct browser event, not an inference from pixels).
# Multi-face outranks gaze because a second person is harder to explain away
# than a head turn.
WEIGHTS = {
    "paste": 3,
    "multi_face": 3,
    "no_face": 2,
    "gaze_away": 1,
}

# Band cut-offs. Chosen so that a couple of look-aways -- which are normal --
# stay LOW, while any paste or second face immediately reaches MEDIUM.
MEDIUM_AT = 3
HIGH_AT = 7

LABELS = {
    "paste": "pasted answer",
    "multi_face": "second face in frame",
    "no_face": "left the frame",
    "gaze_away": "looked away",
}


def assess(events):
    """events: list of dicts from the events table."""
    counts = {}
    for e in events:
        counts[e["type"]] = counts.get(e["type"], 0) + 1

    score = sum(WEIGHTS.get(t, 0) * n for t, n in counts.items())

    if score >= HIGH_AT:
        band = "high"
    elif score >= MEDIUM_AT:
        band = "medium"
    else:
        band = "low"

    reasons = [
        f"{n} x {LABELS.get(t, t)}"
        for t, n in sorted(counts.items(), key=lambda kv: -WEIGHTS.get(kv[0], 0))
    ]

    return {
        "band": band,
        "score": score,
        "counts": counts,
        "reasons": reasons,
        # Stated on every response so it travels with the data, not just the UI.
        "note": "Advisory only. Flags indicate moments worth a human review, "
                "not misconduct. Do not reject a candidate on this basis.",
    }
