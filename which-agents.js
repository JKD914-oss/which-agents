#!/usr/bin/env node
'use strict';

const path = require('node:path');
const pkg = require('./package.json');
const { DEFAULT_MAX_BYTES, resolveInstructions } = require('./resolver');

const HELP = `which-agents ${pkg.version}

Show which AGENTS.md instructions apply to a file or directory.

Usage:
  which-agents [options] [path]

Options:
  -p, --print            Print the effective instruction content
  -j, --json             Output machine-readable JSON
      --root <path>      Set the project root instead of finding .git
      --fallback <name>  Add a fallback filename (repeatable or comma-separated)
      --max-bytes <n>    Project instruction budget (default: ${DEFAULT_MAX_BYTES})
      --no-global        Do not inspect the Codex home directory
  -v, --version          Print version
  -h, --help             Print help

Examples:
  which-agents src/api/user.ts
  which-agents --print services/payments
  which-agents --json --fallback TEAM_GUIDE.md .
`;

function fail(message) {
  process.stderr.write(`which-agents: ${message}\n`);
  process.exitCode = 1;
}

function valueAfter(args, index, flag) {
  if (index + 1 >= args.length) throw new Error(`${flag} requires a value`);
  return args[index + 1];
}

function parseArgs(args) {
  const options = {
    target: '.',
    print: false,
    json: false,
    includeGlobal: true,
    fallbackNames: []
  };
  const positionals = [];

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '-h' || arg === '--help') return { help: true };
    if (arg === '-v' || arg === '--version') return { version: true };
    if (arg === '-p' || arg === '--print') options.print = true;
    else if (arg === '-j' || arg === '--json') options.json = true;
    else if (arg === '--no-global') options.includeGlobal = false;
    else if (arg === '--root') {
      options.root = valueAfter(args, index, arg);
      index += 1;
    } else if (arg === '--fallback') {
      options.fallbackNames.push(
        ...valueAfter(args, index, arg).split(',').map(value => value.trim()).filter(Boolean)
      );
      index += 1;
    } else if (arg === '--max-bytes') {
      options.maxBytes = Number(valueAfter(args, index, arg));
      index += 1;
    } else if (arg.startsWith('-')) {
      throw new Error(`unknown option: ${arg}`);
    } else {
      positionals.push(arg);
    }
  }

  if (positionals.length > 1) throw new Error('only one target path is allowed');
  if (positionals.length === 1) options.target = positionals[0];
  if (options.print && options.json) throw new Error('--print and --json cannot be used together');
  return options;
}

function displayPath(filePath, root) {
  const relative = path.relative(root, filePath);
  return !relative.startsWith('..') && !path.isAbsolute(relative) ? relative || '.' : filePath;
}

function printHuman(result) {
  process.stdout.write(`Target:       ${displayPath(result.target, result.projectRoot)}\n`);
  process.stdout.write(`Project root: ${result.projectRoot}\n`);
  process.stdout.write(`Budget:       ${result.projectBytesUsed}/${result.maxBytes} project bytes\n\n`);

  if (result.files.length === 0) {
    process.stdout.write('No active instruction files found.\n');
    return;
  }

  process.stdout.write('Effective chain (low -> high precedence):\n');
  result.files.forEach((file, index) => {
    const label = file.scope === 'global' ? 'global' : displayPath(file.directory, result.projectRoot);
    const state = file.truncated ? `, truncated to ${file.includedBytes}` : '';
    process.stdout.write(`${index + 1}. [${label}] ${displayPath(file.path, result.projectRoot)} (${file.bytes} bytes${state})\n`);
  });

  if (result.skipped.length > 0) {
    process.stdout.write('\nIgnored:\n');
    for (const item of result.skipped) {
      process.stdout.write(`- ${displayPath(item.path, result.projectRoot)} (${item.reason})\n`);
    }
  }
}

function printContent(result) {
  const active = result.files.filter(file => file.includedBytes > 0);
  for (let index = 0; index < active.length; index += 1) {
    const file = active[index];
    const label = file.scope === 'global' ? 'global' : displayPath(file.directory, result.projectRoot);
    if (index > 0) process.stdout.write('\n\n');
    process.stdout.write(`# Instructions from ${label} (${file.path})\n\n`);
    process.stdout.write(file.content.replace(/\s+$/, ''));
    if (file.truncated) process.stdout.write('\n\n[truncated by --max-bytes]');
  }
  if (active.length > 0) process.stdout.write('\n');
}

function jsonView(result) {
  return {
    ...result,
    files: result.files.map(({ content, ...file }) => file)
  };
}

try {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) process.stdout.write(HELP);
  else if (options.version) process.stdout.write(`${pkg.version}\n`);
  else {
    const result = resolveInstructions(options);
    if (options.json) process.stdout.write(`${JSON.stringify(jsonView(result), null, 2)}\n`);
    else if (options.print) printContent(result);
    else printHuman(result);
  }
} catch (error) {
  fail(error.message);
}
