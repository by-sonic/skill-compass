#!/usr/bin/env node
// skill-compass installer. Copies compass.js + directions.json into ~/.claude/skill-compass
// and registers the UserPromptSubmit hook in ~/.claude/settings.json. Idempotent.
// Run: node install.js   (uninstall: node install.js --uninstall)

const fs = require('fs');
const path = require('path');
const os = require('os');

const SRC = __dirname;
const HOME = os.homedir();
const DEST = path.join(HOME, '.claude', 'skill-compass');
const SETTINGS = path.join(HOME, '.claude', 'settings.json');
const HOOK_CMD = 'node "' + path.join(DEST, 'compass.js').replace(/\\/g, '/') + '"';
const uninstall = process.argv.includes('--uninstall');

function readSettings() {
  try { return JSON.parse(fs.readFileSync(SETTINGS, 'utf8').replace(/^﻿/, '')); }
  catch { return {}; }
}
function writeSettings(s) {
  fs.mkdirSync(path.dirname(SETTINGS), { recursive: true });
  fs.writeFileSync(SETTINGS, JSON.stringify(s, null, 2) + '\n');
}
function hasHook(arr) {
  return (arr || []).some(group => (group.hooks || []).some(h => (h.command || '').includes('skill-compass')));
}

if (uninstall) {
  const s = readSettings();
  const ups = s.hooks && s.hooks.UserPromptSubmit;
  if (ups) {
    s.hooks.UserPromptSubmit = ups
      .map(g => ({ ...g, hooks: (g.hooks || []).filter(h => !(h.command || '').includes('skill-compass')) }))
      .filter(g => (g.hooks || []).length);
    writeSettings(s);
  }
  console.log('skill-compass: hook removed from settings.json. Files left in', DEST);
  process.exit(0);
}

// 1. copy files
fs.mkdirSync(DEST, { recursive: true });
fs.copyFileSync(path.join(SRC, 'compass.js'), path.join(DEST, 'compass.js'));
const dj = path.join(DEST, 'directions.json');
if (fs.existsSync(dj)) console.log('• directions.json already present — keeping your edits');
else fs.copyFileSync(path.join(SRC, 'directions.json'), dj);
console.log('• copied to', DEST);

// 2. register hook
const s = readSettings();
s.hooks = s.hooks || {};
s.hooks.UserPromptSubmit = s.hooks.UserPromptSubmit || [];
if (hasHook(s.hooks.UserPromptSubmit)) {
  console.log('• hook already registered — nothing to do');
} else {
  let group = s.hooks.UserPromptSubmit.find(g => g.matcher === '' || g.matcher == null);
  if (group) { group.hooks = group.hooks || []; group.hooks.push({ type: 'command', command: HOOK_CMD }); }
  else s.hooks.UserPromptSubmit.push({ matcher: '', hooks: [{ type: 'command', command: HOOK_CMD }] });
  writeSettings(s);
  console.log('• registered UserPromptSubmit hook in', SETTINGS);
}

console.log('\nDone. Restart Claude Code to load the hook.');
console.log('Test it:  node "' + path.join(DEST, 'compass.js').replace(/\\/g, '/') + '" --self-test');
