'use strict';

// Source regression guards, not a substitute for the MuMu lifecycle checks.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '../android/danmemore-launcher/app/src/main');
const activity = fs.readFileSync(path.join(root, 'kotlin/dev/danmemore/launcher/MainActivity.kt'), 'utf8');
const manifest = fs.readFileSync(path.join(root, 'AndroidManifest.xml'), 'utf8');
const gradle = fs.readFileSync(path.join(root, '../../build.gradle.kts'), 'utf8');
const pending = ['danmemore_server.cjs'], checked = new Set();
while (pending.length) {
  const name = pending.pop(); if (checked.has(name)) continue; checked.add(name);
  assert(gradle.includes(`from("$repositoryRoot/tools/${name}")`), `The embedded server must include ${name}`);
  const source = fs.readFileSync(path.join(__dirname, name), 'utf8');
  assert.doesNotMatch(source,/\bjson_(?:extract|each|tree|valid|array|object)\s*\(/i,
    `The embedded ${name} must not require SQLite JSON extensions absent on MuMu`);
  for (const [, dependency] of source.matchAll(/require\(['"]\.\/([^'"]+\.cjs)['"]\)/g)) pending.push(dependency);
}
assert.match(activity, /addFlags\(Intent\.FLAG_ACTIVITY_CLEAR_TOP or Intent\.FLAG_ACTIVITY_SINGLE_TOP\)/);
assert.match(activity, /if \(running\) openGame\(\) else \{\s*stopGame\(\)/);
assert.match(activity, /"stop" -> \{[^}]*stopping = true; busy = true;[^}]*stopGame\(\)/);
assert.match(activity, /if \(stopping && !active\) \{\s*stopping = false; busy = false/);
assert.match(activity, /killBackgroundProcesses\(GAME_PACKAGE\)/);
assert.match(manifest, /android\.permission\.KILL_BACKGROUND_PROCESSES/);
for (const action of ['select', 'create', 'create-historical', 'change-clock', 'rename', 'reset'])
  assert.match(activity, new RegExp(`"${action}" -> if \\(idle\\)`));
console.log('Launcher lifecycle source guards: OK (native acceptance required separately)');
