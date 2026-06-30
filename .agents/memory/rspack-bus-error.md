---
name: Rspack binary bus error fix
description: rspack native .node binding causes Bus error crash on Replit NixOS; fix is a clean reinstall.
---

The rspack native binding (`@rspack/binding-linux-x64-gnu/rspack.linux-x64-gnu.node`) sometimes installs in a corrupted/incompatible state showing "missing section headers" on `file` inspection. Loading it via Node causes exit code 135 (Bus error / SIGBUS).

**Why:** The pre-built binary is incompatible with the specific glibc version or memory layout in the Replit sandbox at install time.

**How to apply:** When `node node_modules/@rsbuild/core/bin/rsbuild.js dev` crashes with Bus error or exits silently:
1. `rm -rf node_modules/@rspack/binding-linux-x64-gnu node_modules/@rspack/core`
2. `npm install @rspack/core@<version> @rspack/binding-linux-x64-gnu@<version> --legacy-peer-deps`
3. Test: `node -e "require('./node_modules/@rspack/binding-linux-x64-gnu/rspack.linux-x64-gnu.node'); console.log('ok')"`
