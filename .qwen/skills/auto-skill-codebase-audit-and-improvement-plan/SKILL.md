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
