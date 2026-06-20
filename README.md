<div align="center">

# 🧭 skill-compass

### Point your project at the right Claude Code skills.

A [Claude Code](https://claude.com/claude-code) hook that reads your repo, works out what it's actually made of — **UI, API, database, auth, LLM, infra** — and tells Claude which skills to load *before it writes a single line*.

[![License: MIT](https://img.shields.io/badge/License-MIT-57E0C7?style=flat-square)](LICENSE)
[![Node](https://img.shields.io/badge/Node.js-required-FF5A4D?style=flat-square)](https://nodejs.org)
[![Claude Code](https://img.shields.io/badge/Claude%20Code-hook-EAEEF6?style=flat-square)](https://claude.com/claude-code)
[![Dependencies](https://img.shields.io/badge/dependencies-0-57E0C7?style=flat-square)](#)

**[Website](https://by-sonic.github.io/skill-compass/)** · **[Install](#install)** · **[How it works](#how-it-works)** · **[Configure](#configure)**

**English** · **[Русский](README.ru.md)**

</div>

---

## Why

A loaded Claude Code has a huge skill library — design, API, database, security, every language stack. The right skill for the task is in there. The problem is *remembering to reach for it*.

`skill-compass` removes the remembering. On every prompt it inspects the project in front of Claude and hands over a short, accurate list of the skills that match — so the design skill fires on UI work, the security skill fires on auth work, the migration skill fires on schema work, automatically.

## How it works

**Scan → Match → Inject**, in single-digit milliseconds.

1. **Scan** — reads the project root one level deep: dependency manifests, folders, file extensions. No deep tree walks, no network.
2. **Match** — maps what it found to *stacks* (Rust, Next.js, Django…) and cross-cutting *directions* (UI, API, DB, auth, LLM, infra) from one editable config.
3. **Inject** — adds a compact note to the prompt naming the skills to load. Shown once per project per session; re-shown only when the project changes.

If there's no manifest at the root, the cwd isn't a single project (it's a folder *of* projects) and the compass stays silent instead of guessing.

## The bearings it reads

| Bearing | Triggers | Skills it routes |
|---|---|---|
| **UI** | `react`, `vue`, `next`, `.tsx`, `components/` | `frontend-design`, `make-interfaces-feel-better` |
| **API** | `express`, `fastapi`, `app/api/`, `routes/` | `api-design`, `backend-patterns` |
| **DB** | `prisma`, `drizzle`, `sqlalchemy`, `*.sql` | `database-migrations`, `postgres-patterns` |
| **AUTH** | `next-auth`, `stripe`, `jwt`, `auth/` | `security-review` |
| **LLM** | `anthropic`, `openai`, `langchain` | `claude-api`, `agent-harness-construction` |
| **INFRA** | `Dockerfile`, `compose.yml`, `k8s/` | `docker-patterns`, `deployment-patterns` |

Plus **16 language stacks** (Rust, Go, Python, TypeScript, Next.js, React, Vue, Java, Spring Boot, Kotlin, Swift, Dart/Flutter, PHP/Laravel, C#, C/C++). Every row lives in [`directions.json`](directions.json).

## Install

Needs **Node.js** and **Claude Code**.

```bash
git clone https://github.com/by-sonic/skill-compass
node skill-compass/install.js
```

The installer copies two files to `~/.claude/skill-compass/` and registers one `UserPromptSubmit` hook. **Restart Claude Code** to load it.

<details>
<summary>Manual install</summary>

Copy `compass.js` and `directions.json` to `~/.claude/skill-compass/`, then add to `~/.claude/settings.json`:

```json
{
  "hooks": {
    "UserPromptSubmit": [
      { "matcher": "", "hooks": [
        { "type": "command", "command": "node \"~/.claude/skill-compass/compass.js\"" }
      ]}
    ]
  }
}
```
</details>

## Install as a skill

skill-compass also ships as an [Agent Skill](https://github.com/by-sonic/skill-compass/tree/master/skill/skill-compass) so Claude can install and operate the hook for you on request. Point Claude Code at [`skill/skill-compass/`](skill/skill-compass/) (copy it into your project's `.claude/skills/` or your global `~/.claude/skills/`). Then just ask:

> "Install skill-compass" · "show my directions.json" · "add a mobile bearing" · "run the compass self-test"

The skill knows how to run `install.js`, edit `directions.json`, and verify with `--self-test`.

## Configure

Open [`directions.json`](directions.json). Add a stack or a direction by appending one object.

```jsonc
{
  "id": "mobile",
  "name": "Mobile",
  "deps": ["react-native", "expo"],   // matched in dependency manifests
  "paths": ["ios", "android"],         // folder/file names at the root level
  "ext": [".kt", ".swift"],            // file extensions present
  "skills": ["ecc:react-native-patterns"]
}
```

Any of `deps` / `paths` / `ext` matching triggers the direction. `skills` are plain strings — point a bearing at whatever skill names you have installed.

## Commands

```bash
node compass.js --self-test    # run detection against fixture projects
node compass.js --force        # ignore the once-per-session guard
SKILL_COMPASS=off              # env var — disable without uninstalling
node install.js --uninstall    # remove the hook (keeps your files)
```

## What it sends anywhere

Nothing. It runs locally, reads files in your project, and writes a note to your own prompt. Zero dependencies, zero telemetry, ~200 lines of Node you can read in a sitting.

## Contributing

New stacks and directions are the most useful PRs — add a tested entry to `directions.json` and a matching case in the `--self-test` fixtures in `compass.js`. Keep it dependency-free.

## License

MIT — see [LICENSE](LICENSE).
