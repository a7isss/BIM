---
name: codebase-audit-and-improvement-plan
description: How to perform a comprehensive codebase review and produce a structured improvement plan (report, roadmap, sprints, vision) with prioritized fixes and parallelizable sprint phases.
source: auto-skill
extracted_at: '2026-06-29T13:38:58.357Z'
---

# Codebase Audit & Improvement Plan

## When to use

The user asks you to review/audit a codebase, understand it fully, and give a critical opinion — then asks for actionable next steps (where to start, sprint plan, final vision).

## Procedure

### Step 1: Exhaustive parallel exploration

Split the codebase by **architectural layer or major directory**. Dispatch one exploration agent per layer. For a typical full-stack project:

- Agent 1: Backend / engine / core logic (read every source file)
- Agent 2: Frontend / UI (read every component, config, style file)
- Agent 3: Data layer / config / docs / tests (read all JSON, schemas, markdown)

Each agent must read **every file** in its area, not just skim. Tell each agent to report:
- Full file inventory with line counts
- What each file does
- Code quality assessment (naming, structure, error handling, dead code)
- Red flags (hardcoded paths, missing validation, inconsistencies, dummy data)
- Whether the file follows the stated architecture

**Critical:** Agent outputs may exceed 2000 chars and get saved to temp files. Always `read_file` the full temp output — never work from the truncated preview. Read in chunks (offset/limit) if the file is large.

### Step 2: Read documentation first

Before dispatching agents, read the project's own docs (README, ARCHITECTURE, DATA_MODELS, etc.) to understand the **intended** design. The audit compares intended vs. actual — you need both sides.

### Step 3: Produce a report (report.md)

Structure:
1. **Project overview** — stated goals, architecture summary
2. **Layer-by-layer analysis** — file inventory tables, formula/logic compliance tables, critical issues grouped by severity (CRITICAL / HIGH / MEDIUM / LOW)
3. **Goal-by-goal scorecard** — does each stated goal pass, fail, or partial? One-line reason.
4. **Developer assessment** — The Good (what they got right), The Bad (chronic issues), The Ugly (process red flags)
5. **Bottom line** — one-paragraph verdict: is the architecture sound? Is the implementation trustworthy?

### Step 4: Produce a roadmap (roadmap.md)

Prioritize starting points in this order:

| Priority tier | What goes here |
|---|---|
| **Blocking** | Things that must be fixed before anything else can be trusted (config drift, broken paths, wrong constants) |
| **Safety net** | Tests for existing logic — needed before refactoring anything |
| **Correctness** | Engineering/logic bugs that produce wrong results silently |
| **Foundation** | Type systems, dead code removal — needed before feature work |
| **Feature** | New capabilities (editing tools, export improvements) |
| **Advanced** | Major upgrades (real FEA, production backend) |

Each starting point gets: why start here, what to do (specific steps), effort estimate (hours).

### Step 5: Produce a sprint plan (sprints.md)

- Each sprint = 1 week, sequential or parallelizable
- Each sprint has: goal, deliverable, task table (task / detail / hours), **exit criteria checklist**
- Sprint 0 is always stabilization (fix blocking issues + add safety-net tests)
- Include a dependency diagram showing which sprints can run in parallel
- Total the hours and show the parallelization graph as ASCII

### Step 6: Produce a vision (vision.md) — only if asked

The end-state document:
1. What the project IS (one-sentence definition)
2. Who uses it (user roles table)
3. What it should be capable of (grouped by domain: input, analysis, sizing, visualization, project management, integration)
4. What the end-state repo structure looks like
5. Technology stack table (layer / tech / why)
6. Quality bar (measurable targets: test coverage %, linting, validation criteria)
7. What it is NOT (boundaries)
8. Success definition (numbered end-to-end user flow)

## Key lessons

- **Read full agent outputs from temp files.** The 2000-char preview is never enough for a real audit. Always follow up with `read_file` on the persisted output path.
- **Compare intended vs. actual.** Read the docs first, then check if the code matches. The gaps between documentation and implementation are often the most important findings.
- **Check for dummy/placeholder data.** Identical values across all elements (e.g., every column has the same forces) is a major red flag that results are fake.
- **Verify formula compliance against authoritative sources.** For engineering/scientific code, check each formula against the stated standard (ACI, SBC, etc.) and build a compliance table.
- **User may scope down the vision.** If the user says "no X integration, only Y," grep all produced documents for X references and fix them. Don't assume the correction only applies to the current document.

## Reviewing a coder's sprint output (feedback loop)

When another coder implements work from the sprint plan and says "finished first pass":

1. **Pull latest changes.** `git fetch origin && git log -n 10 --oneline origin/main`. Check if they pushed to main or another branch (`git branch -r`). If no new commits, check `git status` for uncommitted local changes — the coder may have worked without committing.
2. **Diff against the last known commit.** `git diff --stat` for overview, then `git diff <file1> <file2> ...` for full content of changed files. Read every changed file's full content — don't rely on diff context alone.
3. **Check for new files.** `git status` shows untracked files (e.g., a new `tests/` directory). Read all new files completely.
4. **Run the tests.** If the coder added a test suite, run it (`python -m pytest tests/ -v` or equivalent). Passing tests are necessary but not sufficient.
5. **Map changes back to the sprint plan.** Build a table: roadmap/sprint item → status (done/partial/not done) → notes. This shows the user exactly what was accomplished.
6. **Flag remaining issues.** Even when a task is marked done, verify:
   - Are the **library JSON files regenerated** after generator code changes? (Common miss: coder updates the generator but doesn't re-run it.)
   - Are **stale comments** left behind? (e.g., test checks for `.md` output but actual output is `.json`)
   - Are **hardcoded values** truly removed, or just moved to a config file with a hacky conversion? (e.g., `density_kg_m3 / 100.0` to get kN/m³ — works for round numbers, drifts for others)
   - Are **manifest/dict keys** correct? (e.g., code reads `proj['files']['types']` but manifest uses key `'architectural_types'` — silently falls back to default)
   - Did they fix the **specific bugs** called out in the report, or only the broad task? (e.g., `os.makedirs` indentation bug inside a loop — easy to miss)
7. **Run the linter, not just tests.** Tests verify behavior; lint reveals dead imports, unused variables, and missing useEffect dependencies that tests won't catch. Run `npx oxlint .` (or eslint/ruff/etc.) and report warning counts. Distinguish pre-existing warnings (for future sprints) from new ones introduced by the current sprint.
8. **Verify manifest path values resolve to real files.** A manifest key may be correct but point to a filename that doesn't exist (e.g., manifest says `architectural_types.json` but the actual file is `architectural.json`). After checking key names, also check that the path values resolve: `dir /b` the referenced directory and compare. This catches silent load failures that fallback to defaults.
9. **Check if build/lint scripts were weakened.** A coder under time pressure may remove `tsc -b &&` from the build script to avoid type errors, or disable lint rules. Compare the `scripts` section of `package.json` (or `pyproject.toml`) against the previous commit. Note any removals as "temporary — restore after Sprint N."
10. **Give a verdict per sprint.** "Substantially complete" / "partial" / "not done" with the specific remaining issues listed. State whether remaining issues are blocking for the next sprint.
11. **Ask the user how to proceed.** Commit as-is and move on, or have the coder fix issues first. Don't assume — the user is directing the work.

## Common codebase audit patterns (recurring findings)

- **Config drift across generators:** In a multi-generator system, some generators read a central config file while others hardcode the same values. Always check every generator against the single source of truth. Fix: make all generators read the config, then regenerate all output tables.
- **Material/parameter mismatch between files:** The assumptions file says fc=28 but the type catalog says fc=25. These are often written at different times and never reconciled. Fix: pick one set of values, update all files, regenerate all derived artifacts.
- **Broken paths after project rename:** Hardcoded absolute paths (e.g., `D:/OldProjectName/...`) survive renames because they still "look right." Grep for the old name across the entire repo. Fix: use dynamic paths based on `__file__` or a project root constant.
- **Selector that accepts a parameter but ignores it:** A function signature includes `required_load` but the body only checks deflection. This is the most dangerous silent failure — the caller believes strength was checked. Fix: add the missing check, add a test that verifies rejection on strength failure.
- **Dummy uniform data in analysis output:** Every element has identical forces/utilization. This means the analysis isn't differentiating by location (tributary area, position). Fix: implement real tributary area logic (corner vs edge vs interior).
- **Cross-sprint issue carry-forward:** When reviewing Sprint N, always check if issues flagged in Sprint N-1's review were addressed. Coders often move to the next sprint's tasks without fixing review feedback from the prior sprint. Maintain a running list of open issues and explicitly verify each one at the start of the next sprint review. Example: a missing `phi_Mn` field on waffle slabs flagged in Sprint 1 was fixed in Sprint 2 — verify and acknowledge the fix.
