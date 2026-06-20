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

**Scan → Match → Inject**, за единицы миллисекунд.

1. **Scan** — читает корень проекта на один уровень вглубь: манифесты зависимостей, папки, расширения. Без глубоких обходов дерева и сети.
2. **Match** — сопоставляет найденное со *стеками* (Rust, Next.js, Django…) и сквозными *направлениями* (UI, API, БД, auth, LLM, инфра) из одного редактируемого конфига.
3. **Inject** — добавляет в промт компактную заметку с именами скиллов. Показывается раз на проект за сессию; повторно — только если состав изменился.

Если в корне нет манифеста — значит cwd не отдельный проект (это папка *с* проектами), и компас молчит, а не угадывает.

## Азимуты, которые он читает

| Азимут | Триггеры | Какие скиллы подключает |
|---|---|---|
| **UI** | `react`, `vue`, `next`, `.tsx`, `components/` | `frontend-design`, `make-interfaces-feel-better` |
| **API** | `express`, `fastapi`, `app/api/`, `routes/` | `api-design`, `backend-patterns` |
| **БД** | `prisma`, `drizzle`, `sqlalchemy`, `*.sql` | `database-migrations`, `postgres-patterns` |
| **AUTH** | `next-auth`, `stripe`, `jwt`, `auth/` | `security-review` |
| **LLM** | `anthropic`, `openai`, `langchain` | `claude-api`, `agent-harness-construction` |
| **INFRA** | `Dockerfile`, `compose.yml`, `k8s/` | `docker-patterns`, `deployment-patterns` |

Плюс **16 языковых стеков** (Rust, Go, Python, TypeScript, Next.js, React, Vue, Java, Spring Boot, Kotlin, Swift, Dart/Flutter, PHP/Laravel, C#, C/C++). Каждая строка живёт в [`directions.json`](directions.json).

## Установка

Нужны **Node.js** и **Claude Code**.

```bash
git clone https://github.com/by-sonic/skill-compass
node skill-compass/install.js
```

Установщик копирует два файла в `~/.claude/skill-compass/` и регистрирует один хук `UserPromptSubmit`. **Перезапусти Claude Code**, чтобы он загрузился.

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
    ]
  }
}
```
</details>

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
