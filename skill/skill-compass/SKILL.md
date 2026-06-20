---
name: skill-compass
description: >-
  Install, configure, and operate the skill-compass UserPromptSubmit hook for
  Claude Code — a hook that scans the current project's composition (languages,
  frameworks, config files) on every prompt and suggests which skills/agents to
  engage (UI → design, API → api-design, DB → db-patterns, Auth, LLM, infra…).
  Use this skill whenever the user wants to install, set up, enable, disable, or
  uninstall skill-compass; edit or inspect its routing rules in directions.json;
  add a new stack→direction mapping; run its --self-test; or debug why the hook
  is/isn't suggesting skills. Trigger on mentions of "skill-compass", "the
  compass hook", "skill router/dispatcher", "directions.json", "UserPromptSubmit
  hook that suggests skills", or "auto-suggest skills based on my project" — even
  if the user doesn't name the file explicitly.
---

# skill-compass

A `UserPromptSubmit` hook for Claude Code. On every user prompt it scans the
working directory's composition — detected languages, frameworks, and telltale
config files — and emits a short note suggesting which skills/agents fit the
project (e.g. UI files → frontend-design, API routes → api-design, a
`Dockerfile` → infra, `anthropic` imports → LLM). It nudges the model toward the
right skill instead of relying on memory.

## Layout (this repo)

Run paths are relative to the repo root (the parent of `skill/`):

- `compass.js` — the hook engine. Flags: `--self-test`, `--force`. Disable per-session with env `SKILL_COMPASS=off`.
- `directions.json` — the routing table: maps detected stacks/files → suggested directions. **This is the file users edit.**
- `install.js` — installer. Copies `compass.js` + `directions.json` into `~/.claude/skill-compass/` and registers the `UserPromptSubmit` hook in `~/.claude/settings.json`. Idempotent. `--uninstall` removes the hook.

After install the live copy runs from `~/.claude/skill-compass/`, so edits to the
installed `directions.json` survive re-installs (the installer keeps an existing
one).

## Tasks

### Install / enable the hook

Run from the repo root:

```
node install.js
```

It copies files, registers the hook, and prints the test command. Tell the user
to **restart Claude Code** afterward — the hook is loaded at process start. If
they re-run it, it's a no-op (idempotent), which is the expected, safe outcome.

### Uninstall / disable

- Permanent removal: `node install.js --uninstall` (strips the hook from `settings.json`, leaves files in place).
- Temporary, one session: set `SKILL_COMPASS=off` in the environment before launching Claude Code.

### Inspect or edit routing rules

`directions.json` is the source of truth for what gets suggested. To see current
rules, read it. To change behavior, edit it directly. After editing the
*installed* copy at `~/.claude/skill-compass/directions.json`, no reinstall is
needed — the running hook reads it fresh.

When adding a new stack→direction mapping, match the existing entries' shape (a
detector for the stack and the direction text it emits). After any edit, always
run the self-test below to confirm nothing broke.

### Run the self-test

This is the verification step before claiming any change works:

```
node compass.js --self-test
```

It exercises stack detection, direction routing, and the empty-project guard,
then prints `ALL PASSED` (non-zero exit on failure). If a user reports the hook
mis-suggesting, reproduce by adding or adjusting a case here first — a failing
self-test case localizes the bug before you touch the engine.

### Debug "it's not suggesting anything"

Walk these in order:
1. Hook registered? Check `~/.claude/settings.json` → `hooks.UserPromptSubmit` contains a command with `skill-compass`.
2. Disabled? Check the `SKILL_COMPASS` env var isn't `off`.
3. Restarted? The hook only loads at Claude Code startup.
4. Empty/at-root project? The engine intentionally stays silent when no stacks are detected (junk-drawer guard) — `cd` into a real project to see output, or pass `--force`.
