'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const { findProjectRoot, resolveInstructions } = require('../lib/resolver');

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'which-agents-'));
  fs.mkdirSync(path.join(root, '.git'));
  return root;
}

function write(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
}

test('resolves root-to-leaf instruction chain', t => {
  const root = fixture();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  write(path.join(root, 'AGENTS.md'), 'root rule');
  write(path.join(root, 'apps', 'AGENTS.md'), 'app rule');
  write(path.join(root, 'apps', 'web', 'src', 'index.js'), '');

  const result = resolveInstructions({
    target: path.join(root, 'apps', 'web', 'src', 'index.js'),
    includeGlobal: false
  });

  assert.deepEqual(result.files.map(file => file.content), ['root rule', 'app rule']);
  assert.equal(result.projectRoot, root);
});

test('override shadows AGENTS.md in the same directory', t => {
  const root = fixture();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  write(path.join(root, 'AGENTS.md'), 'base');
  write(path.join(root, 'AGENTS.override.md'), 'override');

  const result = resolveInstructions({ target: root, includeGlobal: false });
  assert.equal(result.files[0].content, 'override');
  assert.equal(result.skipped[0].reason, 'shadowed');
});

test('empty preferred file falls through to AGENTS.md', t => {
  const root = fixture();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  write(path.join(root, 'AGENTS.override.md'), '  \n');
  write(path.join(root, 'AGENTS.md'), 'base');

  const result = resolveInstructions({ target: root, includeGlobal: false });
  assert.equal(result.files[0].content, 'base');
  assert.equal(result.skipped[0].reason, 'empty');
});

test('supports custom fallback names after primary names', t => {
  const root = fixture();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  write(path.join(root, 'TEAM_GUIDE.md'), 'team rule');

  const result = resolveInstructions({
    target: root,
    includeGlobal: false,
    fallbackNames: ['TEAM_GUIDE.md']
  });
  assert.equal(result.files[0].relativePath, 'TEAM_GUIDE.md');
});

test('applies byte budget in root-to-leaf order', t => {
  const root = fixture();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  write(path.join(root, 'AGENTS.md'), '12345');
  write(path.join(root, 'child', 'AGENTS.md'), '67890');

  const result = resolveInstructions({
    target: path.join(root, 'child'),
    includeGlobal: false,
    maxBytes: 7
  });
  assert.equal(result.files[0].content, '12345');
  assert.equal(result.files[1].content, '67');
  assert.equal(result.files[1].truncated, true);
  assert.equal(result.projectBytesUsed, 7);
});

test('finds a .git file as a worktree root marker', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'which-agents-worktree-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  write(path.join(root, '.git'), 'gitdir: elsewhere');
  fs.mkdirSync(path.join(root, 'a', 'b'), { recursive: true });
  assert.equal(findProjectRoot(path.join(root, 'a', 'b')), root);
});
