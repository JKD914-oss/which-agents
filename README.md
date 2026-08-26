# which-agents

See exactly which `AGENTS.md` instructions apply to any file in a repository.

`which-agents` is a tiny, zero-dependency CLI for debugging nested coding-agent instructions. It follows Codex-style discovery: project root to target directory, one instruction file per directory, `AGENTS.override.md` before `AGENTS.md`, optional fallback filenames, and a configurable byte budget.

## Why

Large repositories often contain several nested `AGENTS.md` files. The effective instruction chain changes with the target directory, while overrides and size limits can silently hide expected guidance. This tool makes the chain visible before an agent edits code.

## Quick start

Requires Node.js 18 or newer.

```bash
node bin/which-agents.js src/api/user.ts
```

After publishing the package to npm, it can also run without cloning:

```bash
npx which-agents-md services/payments
```

Example output:

```text
Target:       services/payments/handler.ts
Project root: /work/acme
Budget:       1840/32768 project bytes

Effective chain (low -> high precedence):
1. [global] /Users/me/.codex/AGENTS.md (320 bytes)
2. [.] AGENTS.md (880 bytes)
3. [services/payments] services/payments/AGENTS.override.md (960 bytes)
```

## Commands

```bash
# Show the active chain
which-agents path/to/file

# Print the merged instruction text
which-agents --print path/to/file

# Return structured data for scripts and CI
which-agents --json path/to/file

# Match custom Codex fallback filenames
which-agents --fallback TEAM_GUIDE.md --fallback .agents.md path/to/file

# Inspect project files only
which-agents --no-global path/to/file
```

Run `which-agents --help` for every option.

## Discovery behavior

For each directory from the Git root to the target directory, the first non-empty file wins:

1. `AGENTS.override.md`
2. `AGENTS.md`
3. filenames supplied with `--fallback`

Selected project files are read root-to-leaf up to `--max-bytes` (32 KiB by default). A global file is also shown from `$CODEX_HOME` or `~/.codex`; disable that with `--no-global`.

The CLI is a transparent resolver, not a Markdown quality grader. It never edits files and makes no network requests.

## Development

```bash
npm test
npm run check
```

## Release

Push a tag such as `v0.1.0`. The included GitHub Actions workflow tests on macOS, Windows, and Linux, builds the npm tarball, and attaches it to a GitHub Release.

```bash
git tag v0.1.0
git push origin v0.1.0
```

## License

MIT
