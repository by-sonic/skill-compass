#!/usr/bin/env node
// skill-compass — UserPromptSubmit hook.
// Detects project composition (stack + cross-cutting directions) and injects a
// context block recommending which skills to invoke. Shows once per project per
// session; re-shows only when the detected set changes. Edit directions.json to tune.
// Disable: env SKILL_COMPASS=off. Force re-emit: pass --force. Self-test: --self-test.

const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

const CFG = JSON.parse(fs.readFileSync(path.join(__dirname, 'directions.json'), 'utf8'));
const DEP_FILES = ['package.json', 'requirements.txt', 'requirements-dev.txt', 'pyproject.toml',
  'Cargo.toml', 'go.mod', 'composer.json', 'Gemfile', 'pubspec.yaml'];

function globToRe(g) {
  return new RegExp('^' + g.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$', 'i');
}

// Scan the project ROOT (not a container of projects). Stack manifests must sit at
// depth 0 — this keeps a junk-drawer cwd (e.g. a Desktop full of projects) from
// matching siblings' manifests. Directions may look one level deep (src/, app/...).
function scan(root) {
  const rootFilePaths = [];          // depth-0 files only — for stack indicators
  const names = new Set(), exts = new Set();  // depth<=1 — for direction paths/ext
  let depText = '';
  const SKIP = new Set(['node_modules', '.git', 'target', 'dist', 'build', '.next', 'vendor', '__pycache__']);
  (function walk(dir, depth) {
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (e.name.startsWith('.git')) continue;
      names.add(e.name);
      if (e.isDirectory()) {
        if (depth < 1 && !SKIP.has(e.name)) walk(path.join(dir, e.name), depth + 1);
      } else {
        const ext = path.extname(e.name).toLowerCase();
        if (ext) exts.add(ext);
        if (depth === 0) {
          rootFilePaths.push(path.join(dir, e.name));
          if (DEP_FILES.includes(e.name)) {
            try { depText += '\n' + fs.readFileSync(path.join(dir, e.name), 'utf8').toLowerCase(); } catch {}
          }
        }
      }
    }
  })(root, 0);
  return { names, exts, rootFilePaths, depText };
}

function indicatorHit(ind, s) {
  const re = globToRe(ind.file);
  const match = s.rootFilePaths.find(p => re.test(path.basename(p)));
  if (!match) return false;
  if (!ind.contains) return true;
  try { return fs.readFileSync(match, 'utf8').toLowerCase().includes(ind.contains.toLowerCase()); } catch { return false; }
}

function detect(root) {
  const s = scan(root);
  const stacks = (CFG.stacks || []).filter(st => st.indicators.some(i => indicatorHit(i, s)));
  const directions = (CFG.directions || []).filter(d =>
    (d.deps || []).some(dep => s.depText.includes(dep.toLowerCase())) ||
    (d.paths || []).some(p => s.names.has(p)) ||
    (d.ext || []).some(x => s.exts.has(x))
  );
  return { stacks, directions, always: CFG.always || [] };
}

function render({ stacks, directions, always }) {
  // No root-level manifest => cwd is not a single project (e.g. a folder of projects). Stay silent.
  if (!stacks.length) return '';
  const lines = [];
  for (const st of stacks) lines.push(`- ${st.name}: ${st.skills.join(', ')}`);
  for (const d of directions) lines.push(`- ${d.name}: ${d.skills.join(', ')}`);
  for (const a of always) lines.push(`- ${a.name}: ${a.skills.join(', ')}`);
  if (!lines.length) return '';
  return [
    'skill-compass — направления для этого проекта (по составу файлов/зависимостей).',
    'Релевантные скиллы для текущей задачи (process-скиллы вперёд implementation, §0):',
    ...lines,
    'Инвокай через Skill tool ДО написания кода, если задача затрагивает эти области.'
  ].join('\n');
}

function signature(d) {
  const skills = [...d.stacks, ...d.directions, ...d.always].flatMap(x => x.skills).sort();
  return crypto.createHash('sha1').update(skills.join('|')).digest('hex');
}

function markerPath(root, sessionId) {
  const key = crypto.createHash('sha1').update((sessionId || '') + '|' + root).digest('hex').slice(0, 16);
  return path.join(os.tmpdir(), 'skill-compass', key + '.txt');
}

function emit(text) {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: { hookEventName: 'UserPromptSubmit', additionalContext: text }
  }));
}

// ---- self-test ----
function selfTest() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'compass-test-'));
  const mk = (rel, body) => {
    const p = path.join(tmp, rel);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, body || '');
  };
  let fails = 0;
  const check = (name, cond) => { if (!cond) { fails++; console.error('FAIL: ' + name); } else console.log('ok: ' + name); };

  // react + prisma + stripe project
  const a = path.join(tmp, 'webapp');
  fs.mkdirSync(a, { recursive: true });
  fs.writeFileSync(path.join(a, 'package.json'), JSON.stringify({
    dependencies: { react: '18', next: '14', '@prisma/client': '5', stripe: '14' }
  }));
  fs.mkdirSync(path.join(a, 'components'), { recursive: true });
  fs.writeFileSync(path.join(a, 'components', 'Btn.tsx'), 'x');
  const da = detect(a);
  check('react detected', da.stacks.some(s => s.id === 'react'));
  check('nextjs detected', da.stacks.some(s => s.id === 'nextjs'));
  check('ui direction', da.directions.some(d => d.id === 'ui'));
  check('db direction (prisma)', da.directions.some(d => d.id === 'db'));
  check('auth-pay direction (stripe)', da.directions.some(d => d.id === 'auth-pay'));
  check('always verify', da.always.length > 0);

  // rust + docker project
  const b = path.join(tmp, 'engine');
  fs.mkdirSync(b, { recursive: true });
  fs.writeFileSync(path.join(b, 'Cargo.toml'), '[package]\nname="x"\n[dependencies]\nsqlx="0.7"');
  fs.writeFileSync(path.join(b, 'Dockerfile'), 'FROM rust');
  const db = detect(b);
  check('rust detected', db.stacks.some(s => s.id === 'rust'));
  check('db direction (sqlx)', db.directions.some(d => d.id === 'db'));
  check('infra direction (Dockerfile)', db.directions.some(d => d.id === 'infra'));
  check('no ui in rust engine', !db.directions.some(d => d.id === 'ui'));

  // python + fastapi + anthropic
  const c = path.join(tmp, 'svc');
  fs.mkdirSync(c, { recursive: true });
  fs.writeFileSync(path.join(c, 'requirements.txt'), 'fastapi\nsqlalchemy\nanthropic');
  const dc = detect(c);
  check('python detected', dc.stacks.some(s => s.id === 'python'));
  check('api direction (fastapi)', dc.directions.some(d => d.id === 'api'));
  check('llm direction (anthropic)', dc.directions.some(d => d.id === 'llm'));

  // empty dir -> only "always"
  const e = path.join(tmp, 'empty');
  fs.mkdirSync(e, { recursive: true });
  const de = detect(e);
  check('empty: no stacks', de.stacks.length === 0);
  check('empty: no directions', de.directions.length === 0);
  check('empty render is empty', render(de).indexOf('- ') === -1 ? render(de) === '' : true);

  // junk-drawer: tmp itself contains child projects but has NO root manifest -> must stay silent
  const dtmp = detect(tmp);
  check('junk drawer: no stacks at root', dtmp.stacks.length === 0);
  check('junk drawer: render empty (gated on stacks)', render(dtmp) === '');

  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED');
  process.exit(fails ? 1 : 0);
}

// ---- main ----
function main() {
  if (process.argv.includes('--self-test')) return selfTest();
  if ((process.env.SKILL_COMPASS || '').toLowerCase() === 'off') return;

  let input = {};
  try { input = JSON.parse((fs.readFileSync(0, 'utf8') || '{}').replace(/^﻿/, '')); } catch {}
  const root = input.cwd || process.env.CLAUDE_PROJECT_DIR || process.cwd();
  const force = process.argv.includes('--force');

  const d = detect(root);
  const text = render(d);
  if (!text) return;

  const mp = markerPath(root, input.session_id);
  const sig = signature(d);
  if (!force) {
    try { if (fs.readFileSync(mp, 'utf8') === sig) return; } catch {}
  }
  try { fs.mkdirSync(path.dirname(mp), { recursive: true }); fs.writeFileSync(mp, sig); } catch {}

  emit(text);
}

main();
