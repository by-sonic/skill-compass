#!/usr/bin/env node
// skill-compass installer. Copies compass.js + directions.json into ~/.claude/skill-compass
// and registers two hooks in ~/.claude/settings.json:
//   UserPromptSubmit — routes on your prompt text + the project's stack/files
//   PostToolUse      — routes on keywords the AI surfaces mid-turn (Bash|Grep|Glob|Read|Task)
// Idempotent. Run: node install.js   (uninstall: node install.js --uninstall)

const fs = require('fs');
const path = require('path');
const os = require('os');

const SRC = __dirname;
const HOME = os.homedir();
const DEST = path.join(HOME, '.claude', 'skill-compass');
const SETTINGS = path.join(HOME, '.claude', 'settings.json');
const COMPASS = path.join(DEST, 'compass.js').replace(/\\/g, '/');
const HOOK_CMD = 'node "' + COMPASS + '"';
const POST_CMD = HOOK_CMD + ' --post';
const POST_MATCHER = 'Bash|Grep|Glob|Read|Task';
const uninstall = process.argv.includes('--uninstall');

function readSettings() {
  try { return JSON.parse(fs.readFileSync(SETTINGS, 'utf8').replace(/^﻿/, '')); }
  catch { return {}; }
}
function writeSettings(s) {
  fs.mkdirSync(path.dirname(SETTINGS), { recursive: true });
  fs.writeFileSync(SETTINGS, JSON.stringify(s, null, 2) + '\n');
}
function hasHook(arr, cmd) {
  return (arr || []).some(g => (g.hooks || []).some(h => (h.command || '') === cmd));
}
function clean(arr) {
  return (arr || [])
    .map(g => ({ ...g, hooks: (g.hooks || []).filter(h => !(h.command || '').includes('skill-compass')) }))
    .filter(g => (g.hooks || []).length);
}

if (uninstall) {
  const s = readSettings();
  if (s.hooks) {
    if (s.hooks.UserPromptSubmit) s.hooks.UserPromptSubmit = clean(s.hooks.UserPromptSubmit);
    if (s.hooks.PostToolUse) s.hooks.PostToolUse = clean(s.hooks.PostToolUse);
    writeSettings(s);
  }
  console.log('skill-compass: hooks removed from settings.json. Files left in', DEST);
  process.exit(0);
}

// 1. copy files
fs.mkdirSync(DEST, { recursive: true });
fs.copyFileSync(path.join(SRC, 'compass.js'), path.join(DEST, 'compass.js'));
const dj = path.join(DEST, 'directions.json');
if (fs.existsSync(dj)) console.log('• directions.json already present — keeping your edits');
else fs.copyFileSync(path.join(SRC, 'directions.json'), dj);
console.log('• copied to', DEST);

// 2. register hooks
const s = readSettings();
s.hooks = s.hooks || {};
s.hooks.UserPromptSubmit = s.hooks.UserPromptSubmit || [];
s.hooks.PostToolUse = s.hooks.PostToolUse || [];

if (hasHook(s.hooks.UserPromptSubmit, HOOK_CMD)) {
  console.log('• UserPromptSubmit hook already registered');
} else {
  const group = s.hooks.UserPromptSubmit.find(g => g.matcher === '' || g.matcher == null);
  if (group) { group.hooks = group.hooks || []; group.hooks.push({ type: 'command', command: HOOK_CMD }); }
  else s.hooks.UserPromptSubmit.push({ matcher: '', hooks: [{ type: 'command', command: HOOK_CMD }] });
  console.log('• registered UserPromptSubmit hook');
}

if (hasHook(s.hooks.PostToolUse, POST_CMD)) {
  console.log('• PostToolUse hook already registered');
} else {
  s.hooks.PostToolUse.push({ matcher: POST_MATCHER, hooks: [{ type: 'command', command: POST_CMD }] });
  console.log('• registered PostToolUse hook');
}
writeSettings(s);

console.log('\nDone. Restart Claude Code to load the hooks.');
console.log('Test it:  node "' + COMPASS + '" --self-test');
