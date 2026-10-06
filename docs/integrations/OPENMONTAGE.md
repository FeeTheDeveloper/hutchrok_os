# OpenMontage Integration

OpenMontage (https://github.com/calesthio/OpenMontage) is an open-source, agent-driven video production system (research, scripting, asset generation, editing, Remotion/FFmpeg composition). It is attached to this repository as a **pinned git submodule** at `vendor/openmontage` so every Fee The Developer repository shares the same tool without copying its source into our code.

## License boundary (read before using)

- OpenMontage is licensed **AGPL-3.0**. It is kept as a separate, unmodified tool in `vendor/openmontage`.
- Do **not** import, copy, or link OpenMontage source into this repository's own code, packages, or deployed services. Doing so could extend AGPL obligations to our proprietary code.
- Run it as an external tool (its own Python venv and Node project). Videos it renders are our output, but each provider/stock-footage/music license still applies and must be recorded with the asset.
- Any modification to OpenMontage itself belongs in a fork, not in this repository.

## Setup

Prerequisites: Python 3.10+, FFmpeg, Node.js 18+.

```bash
# fetch the pinned submodule (not fetched by default on clone)
git submodule update --init --depth 1 vendor/openmontage

cd vendor/openmontage
make setup          # creates .venv, installs requirements + remotion-composer, copies .env.example -> .env
```

Then open `vendor/openmontage` in Claude Code (or another agent) and describe the video. OpenMontage's own `CLAUDE.md` / `AGENT_GUIDE.md` govern agent behavior **inside that directory only**; this repository's `CLAUDE.md`/`AGENTS.md` still govern everything else.

## Environment variables

- Provider keys (image/video/voice/music gateways) go in `vendor/openmontage/.env`, which is git-ignored by OpenMontage. All keys are optional; see `vendor/openmontage/.env.example` for names.
- Never commit keys, and never copy them into this repository's `.env.example` or docs.
- Keep each company's provider keys, brand assets, and rendered output separated — do not reuse one company's credentials for another company's videos.

## Output and approvals

- Rendered video, intermediate assets, and project state stay inside the OpenMontage working tree (git-ignored there) or an approved storage location — not committed to this repository.
- Publishing any rendered video publicly requires King Fee's approval.

## Updating the pinned version

```bash
cd vendor/openmontage
git fetch --depth 1 origin main && git checkout FETCH_HEAD
cd ../..
git add vendor/openmontage
git commit -m "chore(openmontage): bump pinned submodule"
```

Review the upstream changelog/diff before bumping. Current pin: `9327439db69021ab4b0e2776729bf3b58fdb5a87` (upstream `main`, 2026-10-03).

## Removal

```bash
git submodule deinit -f vendor/openmontage
git rm -f vendor/openmontage
rm -rf .git/modules/vendor/openmontage
```
