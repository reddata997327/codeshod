/**
 * CODESHOD — LINES wordmark and compact mark for the terminal.
 *
 * Adapted from the sample 8-column / 5-row LINES font to a 4-column grid so the
 * two halves stay at the same width as the previous home-screen mark (20 cells
 * each) and fit the terminal size breakpoints in component/logo.tsx:
 *
 *   - full:   CODE + SHOD side by side -> ~41 cells wide, 6 rows (incl. shadow)
 *   - narrow: CODE / SHOD stacked      -> 20 cells wide
 *   - tiny:   C + S compact mark       -> ~11 cells wide
 *
 * Front strokes use `=`, `|`, `/` and `\`; the 3D shadow is the down-right
 * offset `-` / `:` layer, matching the CODESHOD LINES brand asset.
 */

export const logo = {
  left: ["==== ==== ===| ==== ", "|----|--|-|--|:|----", "|:   |: |:|: |:===  ", "|:   |: |:|: |:|--- ", "==== ====:===|:==== ", " ---- ---- ---: ----"],
  right: ["==== |  | ==== ===| ", "|----|: |:|--|-|--|:", "==== ====:|: |:|: |:", " --|-|--|-|: |:|: |:", "====:|: |:====:===|:", " ---- :  : ---- ---:"],
}

export const go = {
  left: ["==== ", "|----", "|:   ", "|:   ", "==== ", " ----"],
  right: ["==== ", "|----", "==== ", " --|-", "====:", " ----"],
}
