# Provenance and audit — Motion Reel Kit

Third-party tool vendored into this repository as a local development tool.

| | |
|---|---|
| Source archive | `motion-reel-kit.zip` (2,167,374 bytes), 72 entries / 56 files |
| Upstream author | Lukas / Weekly 10x (<https://www.weekly10x.com>) — see `README.md` |
| Vendored | 2026-10-05, unmodified |
| Audited by | Claude Engineering Agent (`claude-engineering`) |
| Scope | Repo-local tool. **Not** part of the `hutchrok-solutions-group` plugin release. |

## Audit result — accepted with the caveats below

Checked: remote network calls, dynamic code execution, secret and credential
access, destructive filesystem operations, path traversal, shell injection,
archive layout and binary payloads.

**Clean:**

- No secrets, credentials, tokens or `.env` material. No reads of
  `process.env` / `os.environ` anywhere in the pipeline.
- No `eval`, `new Function`, `__import__`, base64-decoded payloads or
  obfuscated code. Every file is plain readable source.
- Every subprocess call is `ffmpeg` / `ffprobe` invoked with an argument array
  (`scripts/mix.py`, `vo.py`, `review.py`, `render.mjs`) — no shell string
  interpolation, so no command injection.
- No exfiltration path. The only outbound traffic is: the product URL the
  operator passes to `scripts/capture.mjs`, and the package downloads that
  `install.sh` performs (npm, Playwright Chromium, pip).
- `scripts/render.mjs` serves the film from `127.0.0.1` on an ephemeral port.
- Destructive filesystem work is bounded: the only delete loop clears
  `review/sheets/<format>/` inside a scaffolded project, and `install.sh`
  moves — never removes — a previous install to a timestamped `.bak`.
- `scripts/init.sh` refuses to scaffold into an existing non-empty directory.
- Downloaded font filenames are slugified before use; logo, favicon and OG
  filenames take only an extension from the remote URL. No path traversal.
- Binaries are what they claim: `cover.png` is a 1600x1200 PNG,
  `examples/blank-preset-5s-test.mp4` is ISO Media MP4, `geist.woff2` is WOFF2.
- No local user paths, symlinks or `node_modules` in the archive.

**Caveats — owner decisions, not defects:**

1. **No license file.** The kit ships no LICENSE, so upstream terms are
   unstated. Treat it as internal tooling only; do not redistribute it, resell
   it or bundle it into a Hutchrok deliverable without written permission from
   the upstream author. The bundled Geist font is separately licensed under the
   SIL OFL (`presets/lukas-yt/fonts/OFL-Geist.txt`).
2. **Third-party branding.** `README.md`, `cover.png` and
   `presets/lukas-yt/` carry another company's brand, copy and site. Build
   Hutchrok reels from `presets/blank/`, not from `presets/lukas-yt/`.
3. **`install.sh` installs dependencies.** It runs `npm install`,
   `npx playwright install chromium` and `pip install`, and it writes to
   `~/.claude/skills/` unless given `--project`. Read it before running it.
4. **Optional external voiceover.** `scripts/vo.py` and the preset's
   `voiceover` block can route narration through Fish Audio. Script text sent
   that way leaves this machine, so keep it PUBLIC-classified only.
5. **POSIX toolchain.** `install.sh`, `test-render.sh` and `scripts/init.sh`
   are `/bin/sh` and need `node`, `ffmpeg`, `python3`. On Windows run them from
   Git Bash; the `ln -s` fallback in `init.sh` may fail without developer mode.

## Activating the skill in this repo

The kit's own copy lives at `tools/motion-reel-kit/.claude/skills/motion-reel/`,
which Claude Code does not load from a subdirectory. To make `/motion-reel`
available in this project:

```sh
sh tools/motion-reel-kit/install.sh --project .
```

That copies the skill to `./.claude/skills/motion-reel/` and installs
Playwright beside it. Start a new session afterwards.
