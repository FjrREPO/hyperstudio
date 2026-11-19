---
name: hyperstudio-review
description: Review a HyperStudio film from its real frames against a ten-point rubric, and say plainly whether it is ready. Use when asked to review, critique, QA or check the quality of a film or a Creative IR in a repo that has HyperStudio, or before reporting any film as finished.
---

# HyperStudio review

A film is reviewed from frames, never from its source. A passing `hyperframes check` means the film is valid;
it does not mean it is good.

## 1. Get the frames

```bash
pnpm -s hyperstudio review <film>/video.json
```

It compiles, runs HyperFrames' check, takes two frames from every shot (early and late), and writes
`<film>/REVIEW.md` if there is none. Over MCP, `review_video` does the same and returns the sheets as images.

Run it with `--motion`. That renders a draft, reports the share of still frames and the longest freeze, and
writes one strip per shot at eight frames a second; open them. Warnings in the check that start with
`hyperstudio:` come from the film's own audit: a line outside the safe area, a line on top of the interface,
or a camera move that crops its subject. Each is a fault to fix in the IR, not to wave through.

Open every contact sheet. Then open at least one full-size frame per shot: small frames hide clipped text,
labels sitting on interface text, and soft images.

## 2. Answer the rubric from what you see

For each row write **pass** or **revise**, and the evidence: which shot, what in the frame.

| | Look for |
| --- | --- |
| Storytelling | A shot that could be deleted without loss. Copy that the next shot does not show |
| Art direction | A change of background, light or palette between shots |
| Typography | Text that is too large for the frame, too small to read, or two things competing to be read first |
| Composition | Subjects off-centre by accident, voids, elements cut by the frame edge, anything on top of text |
| Shot variety | Neighbours with the same subject at the same scale |
| Motion | More than one thing moving for attention; movement with no reason |
| Transitions | A cut that lands mid-action or mid-word |
| Assets | Every placeholder, by name. A drawn stand-in where the real product should be |
| Brand | Colours or typefaces that are not the brand's own |
| Coherence | Any shot that looks like it came from a different film |

Then answer one more question in a sentence: **does it read as a template?** If two films with different
products would look the same, it does.

## 3. Decide

- Any row is **revise**: say what to change in the IR, in order of importance. Do not render.
- Every row passes: say so, list the placeholders and the credits owed, and say what would still improve it.

Do not write "looks good". Write what you saw. If you could not look at something (sound, motion between the
two frames of a shot), say that you did not check it.
