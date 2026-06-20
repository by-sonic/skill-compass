<div align="center">

# 🧭 skill-compass

### Наводит проект на нужные скиллы Claude Code.

Хук для [Claude Code](https://claude.com/claude-code), который читает репозиторий, понимает из чего он реально собран — **UI, API, база, авторизация, LLM, инфра** — и подсказывает Claude, какие скиллы подключить *до того, как написана первая строка*.

[![License: MIT](https://img.shields.io/badge/License-MIT-57E0C7?style=flat-square)](LICENSE)
[![Node](https://img.shields.io/badge/Node.js-required-FF5A4D?style=flat-square)](https://nodejs.org)
[![Claude Code](https://img.shields.io/badge/Claude%20Code-hook-EAEEF6?style=flat-square)](https://claude.com/claude-code)
[![Dependencies](https://img.shields.io/badge/dependencies-0-57E0C7?style=flat-square)](#)

**[Сайт](https://by-sonic.github.io/skill-compass/ru.html)** · **[Установка](#установка)** · **[Как работает](#как-работает)** · **[Настройка](#настройка)**

**[English](README.md)** · **Русский**

</div>

---

## Зачем

В загруженном Claude Code огромная библиотека скиллов — дизайн, API, базы, безопасность, все языковые стеки. Нужный под задачу там есть. Проблема — *вовремя о нём вспомнить*.

`skill-compass` убирает «вспомнить». На каждом промте он осматривает проект перед Claude и отдаёт короткий точный список подходящих скиллов — так дизайн-скилл срабатывает на UI-работе, security-скилл на авторизации, миграционный скилл на изменении схемы, автоматически.

## Как работает

**Match → Inject**, за единицы миллисекунд. Читает три сигнала:

1. **Файлы проекта** — корень на один уровень вглубь: манифесты зависимостей, папки, расширения. Сопоставляются со *стеками* (Rust, Next.js, Django…) и сквозными *направлениями* (UI, API, БД, auth, LLM, инфра).
2. **Твой промт** — ловит *ключевые слова* проекта/темы в тексте запроса, поэтому срабатывает даже из «junk-drawer» cwd (рабочий стол с кучей проектов). Пишешь *«найди clickhouse-миграцию и почини»* — и он направляет на нужные скиллы ещё до открытия файлов.
3. **Что ИИ находит во время работы** — хук `PostToolUse` смотрит результаты `Bash`/`Grep`/`Glob`/`Read`/`Task`; как только инструмент выдаёт известное ключевое слово (путь, зависимость, строку совпадения) — вбрасывает подходящие скиллы прямо рядом с этим результатом.

Найденные скиллы вставляются компактной заметкой — раз на набор-сигнал за сессию, повторно при смене состава. Если нет ни манифеста, ни ключевого слова в промте, ни находки инструментом — компас молчит, а не угадывает.

## Азимуты, которые он читает

| Азимут | Триггеры | Какие скиллы подключает |
|---|---|---|
| **UI** | `react`, `vue`, `next`, `.tsx`, `components/` | `frontend-design`, `make-interfaces-feel-better` |
| **API** | `express`, `fastapi`, `app/api/`, `routes/` | `api-design`, `backend-patterns` |
| **БД** | `prisma`, `drizzle`, `sqlalchemy`, `*.sql` | `database-migrations`, `postgres-patterns` |
| **AUTH** | `next-auth`, `stripe`, `jwt`, `auth/` | `security-review` |
| **LLM** | `anthropic`, `openai`, `langchain` | `claude-api`, `agent-harness-construction` |
| **INFRA** | `Dockerfile`, `compose.yml`, `k8s/` | `docker-patterns`, `deployment-patterns` |

Плюс **16 языковых стеков** (Rust, Go, Python, TypeScript, Next.js, React, Vue, Java, Spring Boot, Kotlin, Swift, Dart/Flutter, PHP/Laravel, C#, C/C++) и блок **`keywords`**, который маршрутизирует по имени проекта/темы (SEO, a11y, research, video, Claude API, homelab, …) прямо из твоего промта или находки инструментом. Каждая строка живёт в [`directions.json`](directions.json).

## Установка

Нужны **Node.js** и **Claude Code**.

```bash
git clone https://github.com/by-sonic/skill-compass
node skill-compass/install.js
```

Установщик копирует два файла в `~/.claude/skill-compass/` и регистрирует два хука — `UserPromptSubmit` (промт + проект) и `PostToolUse` (находки инструментов во время работы). **Перезапусти Claude Code**, чтобы они загрузились.

<details>
<summary>Установка вручную</summary>

Скопируй `compass.js` и `directions.json` в `~/.claude/skill-compass/`, затем добавь в `~/.claude/settings.json`:

```json
{
  "hooks": {
    "UserPromptSubmit": [
      { "matcher": "", "hooks": [
        { "type": "command", "command": "node \"~/.claude/skill-compass/compass.js\"" }
      ]}
    ],
    "PostToolUse": [
      { "matcher": "Bash|Grep|Glob|Read|Task", "hooks": [
        { "type": "command", "command": "node \"~/.claude/skill-compass/compass.js\" --post" }
      ]}
    ]
  }
}
```
</details>

## Установка как скилл

skill-compass поставляется и как [Agent Skill](https://github.com/by-sonic/skill-compass/tree/master/skill/skill-compass) — тогда Claude сам ставит и обслуживает хук по твоей просьбе. Укажи Claude Code на [`skill/skill-compass/`](skill/skill-compass/) (скопируй в `.claude/skills/` проекта или в глобальный `~/.claude/skills/`). Дальше просто проси:

> «Поставь skill-compass» · «покажи directions.json» · «добавь азимут mobile» · «прогони self-test компаса»

Скилл умеет запускать `install.js`, править `directions.json` и проверять через `--self-test`.

## Настройка

Открой [`directions.json`](directions.json). Новый стек или направление добавляется одним объектом.

```jsonc
{
  "id": "mobile",
  "name": "Mobile",
  "deps": ["react-native", "expo"],   // ищется в манифестах зависимостей
  "paths": ["ios", "android"],         // имена папок/файлов в корне
  "ext": [".kt", ".swift"],            // присутствующие расширения
  "skills": ["ecc:react-native-patterns"]
}
```

Срабатывает любое совпадение из `deps` / `paths` / `ext`. `skills` — просто строки: наведи азимут на любое имя установленного у тебя скилла.

## Команды

```bash
node compass.js --self-test    # прогнать детекцию на фикстурах-проектах
node compass.js --force        # игнорировать «раз за сессию»
SKILL_COMPASS=off              # env-переменная — выключить без удаления
node install.js --uninstall    # снять хук (файлы остаются)
```

## Что он куда-нибудь отправляет

Ничего. Работает локально, читает файлы в твоём проекте и пишет заметку в твой же промт. Ноль зависимостей, ноль телеметрии, ~200 строк Node, которые читаются за один присест.

## Вклад

Самые полезные PR — новые стеки и направления: добавь протестированную запись в `directions.json` и соответствующий кейс в фикстуры `--self-test` внутри `compass.js`. Без зависимостей.

## Лицензия

MIT — см. [LICENSE](LICENSE).
