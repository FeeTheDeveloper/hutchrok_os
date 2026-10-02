# Hutchrok plugin release source

`plugin/hutchrok-solutions-group/` is the source of truth for the private **Hutchrok Solutions Group** plugin. The installed plugin cache is a release artifact. Change the repository first; build from this path; update the exact owned plugin with the observed current release ID. Keep its existing audience and scope.

The package is Skills-only. It contains service procedures plus OS review, signal triage, approval review, and release workflows. It does not contain a live MCP server or grant access to Hutchrok OS, government systems, payments, mail, or deployment. `packages/mcp` is a scaffold and is excluded from the plugin until an authenticated, tenant-bound, audited server exists.

## Build path

1. Review the repo diff, current plugin file inventory, and source version. Bump both manifests for a release.
2. Run `pnpm typecheck`, `pnpm test`, and `python scripts/build_hutchrok_plugin.py --check`.
3. Run `python scripts/build_hutchrok_plugin.py --output <temporary ZIP>` twice and compare SHA-256 values. Extract one ZIP and inspect the manifest, Skills, exclusions, and file list. Run the plugin validator on the extracted copy.
4. Update the exact owned plugin with its observed `current_release_id` as the concurrency guard. Verify returned release ID and version. Record source commit and ZIP hash.

CI checks the source package and uploads a build artifact for review. CI does not publish plugin releases. Plugin updates require a reviewer to verify the exact target, authorization, and complete package. Never copy files from the installed cache back into the source without comparing the live release and reviewing the change.

Production OS activation remains blocked by the issues in `docs/reviews/FTD-CORE-001-site-autopilot.md`; a plugin release does not change that gate.
