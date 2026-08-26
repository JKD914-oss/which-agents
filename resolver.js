'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const PRIMARY_NAMES = ['AGENTS.override.md', 'AGENTS.md'];
const DEFAULT_MAX_BYTES = 32 * 1024;

function isFile(filePath) {
  try {
    return fs.statSync(filePath).isFile();
  } catch {
    return false;
  }
}

function isDirectory(directoryPath) {
  try {
    return fs.statSync(directoryPath).isDirectory();
  } catch {
    return false;
  }
}

function targetDirectory(targetPath) {
  const absolute = path.resolve(targetPath || '.');
  try {
    const stat = fs.statSync(absolute);
    return stat.isDirectory() ? absolute : path.dirname(absolute);
  } catch {
    return path.dirname(absolute);
  }
}

function findProjectRoot(startDirectory) {
  let current = path.resolve(startDirectory);
  while (true) {
    if (fs.existsSync(path.join(current, '.git'))) return current;
    const parent = path.dirname(current);
    if (parent === current) return startDirectory;
    current = parent;
  }
}

function directoryChain(root, leaf) {
  const relative = path.relative(root, leaf);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`Target is outside project root: ${leaf}`);
  }

  const directories = [root];
  if (!relative) return directories;

  let current = root;
  for (const segment of relative.split(path.sep)) {
    current = path.join(current, segment);
    directories.push(current);
  }
  return directories;
}

function readCandidate(filePath) {
  if (!isFile(filePath)) return null;
  const buffer = fs.readFileSync(filePath);
  if (buffer.toString('utf8').trim().length === 0) {
    return { path: filePath, buffer, empty: true };
  }
  return { path: filePath, buffer, empty: false };
}

function selectInstruction(directory, fallbackNames = []) {
  const names = [...PRIMARY_NAMES, ...fallbackNames];
  const skipped = [];

  for (let index = 0; index < names.length; index += 1) {
    const candidate = readCandidate(path.join(directory, names[index]));
    if (!candidate) continue;
    if (candidate.empty) {
      skipped.push({ path: candidate.path, reason: 'empty' });
      continue;
    }

    for (const ignoredName of names.slice(index + 1)) {
      const ignoredPath = path.join(directory, ignoredName);
      if (isFile(ignoredPath)) skipped.push({ path: ignoredPath, reason: 'shadowed' });
    }

    return { selected: candidate, skipped };
  }

  return { selected: null, skipped };
}

function takeUtf8(buffer, maxBytes) {
  if (buffer.length <= maxBytes) return buffer.toString('utf8');
  if (maxBytes <= 0) return '';

  let end = maxBytes;
  while (end > 0 && (buffer[end] & 0xc0) === 0x80) end -= 1;
  return buffer.subarray(0, end).toString('utf8');
}

function normalizeFallbacks(fallbackNames) {
  const unique = [];
  for (const name of fallbackNames || []) {
    const clean = String(name).trim();
    if (!clean || clean.includes('/') || clean.includes('\\')) {
      if (clean) throw new Error(`Fallback must be a filename, not a path: ${clean}`);
      continue;
    }
    if (!PRIMARY_NAMES.includes(clean) && !unique.includes(clean)) unique.push(clean);
  }
  return unique;
}

function resolveInstructions(options = {}) {
  const target = path.resolve(options.target || '.');
  const directory = targetDirectory(target);
  const root = path.resolve(options.root || findProjectRoot(directory));
  const fallbackNames = normalizeFallbacks(options.fallbackNames);
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;

  if (!Number.isInteger(maxBytes) || maxBytes < 1) {
    throw new Error('--max-bytes must be a positive integer');
  }
  if (!isDirectory(root)) throw new Error(`Project root is not a directory: ${root}`);

  const files = [];
  const skipped = [];

  if (options.includeGlobal !== false) {
    const codexHome = path.resolve(
      options.codexHome || process.env.CODEX_HOME || path.join(os.homedir(), '.codex')
    );
    const global = selectInstruction(codexHome);
    skipped.push(...global.skipped.map(item => ({ ...item, scope: 'global' })));
    if (global.selected) {
      files.push({
        scope: 'global',
        directory: codexHome,
        path: global.selected.path,
        relativePath: path.basename(global.selected.path),
        bytes: global.selected.buffer.length,
        includedBytes: global.selected.buffer.length,
        truncated: false,
        content: global.selected.buffer.toString('utf8')
      });
    }
  }

  let remaining = maxBytes;
  for (const current of directoryChain(root, directory)) {
    const result = selectInstruction(current, fallbackNames);
    skipped.push(...result.skipped.map(item => ({ ...item, scope: 'project' })));
    if (!result.selected) continue;

    const buffer = result.selected.buffer;
    const includedBytes = Math.min(buffer.length, remaining);
    files.push({
      scope: 'project',
      directory: current,
      path: result.selected.path,
      relativePath: path.relative(root, result.selected.path) || path.basename(result.selected.path),
      bytes: buffer.length,
      includedBytes,
      truncated: includedBytes < buffer.length,
      content: takeUtf8(buffer, includedBytes)
    });
    remaining -= includedBytes;
  }

  return {
    target,
    targetDirectory: directory,
    projectRoot: root,
    maxBytes,
    projectBytesUsed: maxBytes - remaining,
    fallbackNames,
    files,
    skipped
  };
}

module.exports = {
  DEFAULT_MAX_BYTES,
  findProjectRoot,
  resolveInstructions,
  selectInstruction,
  targetDirectory
};
