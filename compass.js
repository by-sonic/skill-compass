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

// Prompt-driven routing: match keywords in the user's prompt so compass fires even
// when cwd is a junk-drawer (Desktop) with no root manifest. Single-word matches use
// unicode word boundaries (no false hit on substrings); phrases match as substrings.
function keywordHit(term, prompt) {
  const t = term.toLowerCase();
  if (/\s/.test(t)) return prompt.includes(t);
  const esc = t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  try { return new RegExp('(^|[^\\p{L}\\p{N}])' + esc + '([^\\p{L}\\p{N}]|$)', 'iu').test(prompt); }
  catch { return prompt.includes(t); }
}
function detectKeywords(prompt) {
  const p = (prompt || '').toLowerCase();
  if (!p) return [];
  return (CFG.keywords || []).filter(k => (k.match || []).some(m => keywordHit(m, p)));
}

function render({ stacks, directions, always }, keywords = []) {
  // Fire if either a root manifest was found OR the prompt matched a project/topic keyword.
  // No manifest and no keyword => cwd is a junk-drawer with no signal. Stay silent.
  if (!stacks.length && !keywords.length) return '';
  const lines = [];
  for (const k of keywords) lines.push(`- ${k.name} (по тексту задачи): ${k.skills.join(', ')}`);
  // stacks/directions describe the scanned cwd. In a junk-drawer (no root manifest) they
  // reflect sibling folders, not the target project — emit them only when a real root exists.
  if (stacks.length) {
    for (const st of stacks) lines.push(`- ${st.name}: ${st.skills.join(', ')}`);
    for (const d of directions) lines.push(`- ${d.name}: ${d.skills.join(', ')}`);
  }
  for (const a of always) lines.push(`- ${a.name}: ${a.skills.join(', ')}`);
  if (!lines.length) return '';
  return [
    'skill-compass — направления для текущей задачи (по составу проекта и тексту запроса).',
    'Релевантные скиллы (process-скиллы вперёд implementation, §0):',
    ...lines,
    'Инвокай через Skill tool ДО написания кода, если задача затрагивает эти области.'
  ].join('\n');
}

function signature(d, keywords = []) {
  const skills = [...d.stacks, ...d.directions, ...d.always, ...keywords].flatMap(x => x.skills).sort();
  return crypto.createHash('sha1').update(skills.join('|')).digest('hex');
}

function markerPath(root, sessionId) {
  const key = crypto.createHash('sha1').update((sessionId || '') + '|' + root).digest('hex').slice(0, 16);
  return path.join(os.tmpdir(), 'skill-compass', key + '.txt');
}

function emit(text, eventName = 'UserPromptSubmit') {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: { hookEventName: eventName, additionalContext: text }
  }));
}

// PostToolUse: flatten tool name + args + result into one searchable string so keyword
// routing can fire on what the AI just discovered (e.g. a Glob/Grep/Read surfacing a clickhouse migration).
function toolText(input) {
  const parts = [];
  if (input.tool_name) parts.push(String(input.tool_name));
  try { parts.push(JSON.stringify(input.tool_input || {})); } catch {}
  const r = input.tool_response;
  if (typeof r === 'string') parts.push(r);
  else if (r && typeof r === 'object') parts.push(typeof r.text === 'string' ? r.text : JSON.stringify(r));
  // ponytail: cap at 50k chars — bounds regex cost on huge file reads; truncation only
  // risks missing a keyword near the very end of a giant output, which is acceptable.
  return parts.join('\n').slice(0, 50000);
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
  check('junk drawer: render empty when no prompt keyword', render(dtmp) === '');

  // prompt-driven keyword routing (junk-drawer Desktop case)
  check('keyword: seo from prompt', detectKeywords('почини sitemap и robots.txt для SEO').some(k => k.id === 'seo'));
  check('keyword: clickhouse from prompt', detectKeywords('зайди в проект и проверь clickhouse схему').some(k => k.id === 'clickhouse'));
  check('keyword: empty prompt -> none', detectKeywords('').length === 0);
  check('keyword: no false-positive substring (redis in redistribute)', !keywordHit('redis', 'redistribute the load'));
  check('keyword: cyrillic word boundary (сео)', keywordHit('сео', 'нужно сео для лендинга'));
  check('keyword: junk-drawer fires when keyword matches', render(dtmp, detectKeywords('почини redis')) !== '');
  check('keyword: junk-drawer hides directions (no project root)', !/UI \/ Frontend|Database|Infra/.test(render(dtmp, detectKeywords('почини redis'))));
  check('keyword: signature changes with keywords', signature(dtmp) !== signature(dtmp, detectKeywords('почини redis')));

  // PostToolUse: keyword routing off the tool result the AI just got
  const globResp = { tool_name: 'Glob', tool_input: { pattern: '**/*clickhouse*' }, tool_response: { type: 'text', text: 'C:/Users/dev/project/clickhouse/schema.sql' } };
  check('post: clickhouse from tool_response path', detectKeywords(toolText(globResp)).some(k => k.id === 'clickhouse'));
  const bashResp = { tool_name: 'Bash', tool_input: { command: 'grep -ri redis .' }, tool_response: 'src/cache.rs: redis client init' };
  check('post: redis from bash result (string response)', detectKeywords(toolText(bashResp)).some(k => k.id === 'redis'));
  check('post: no keyword -> empty text', detectKeywords(toolText({ tool_name: 'Read', tool_input: { file_path: 'a.txt' }, tool_response: { type: 'text', text: 'hello world' } })).length === 0);
  check('post: toolText caps at 50k', toolText({ tool_response: 'x'.repeat(60000) }).length === 50000);

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
  const isPost = process.argv.includes('--post') || input.hook_event_name === 'PostToolUse';

  let d, kw, text, ev;
  if (isPost) {
    // Mid-turn: route on keywords surfaced by the tool the AI just ran (no project scan).
    ev = 'PostToolUse';
    d = { stacks: [], directions: [], always: CFG.always || [] };
    kw = detectKeywords(toolText(input));
  } else {
    ev = 'UserPromptSubmit';
    d = detect(root);
    kw = detectKeywords(input.prompt);
  }
  text = render(d, kw);
  if (!text) return;

  const mp = markerPath(root, input.session_id);
  const sig = signature(d, kw);
  if (!force) {
    try { if (fs.readFileSync(mp, 'utf8') === sig) return; } catch {}
  }
  try { fs.mkdirSync(path.dirname(mp), { recursive: true }); fs.writeFileSync(mp, sig); } catch {}

  emit(text, ev);
}

main();
