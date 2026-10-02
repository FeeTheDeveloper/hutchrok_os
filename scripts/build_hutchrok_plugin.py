#!/usr/bin/env python3
"""Validate and deterministically package the repo-owned Hutchrok plugin."""

import argparse
import hashlib
import json
import re
import sys
import zipfile
from pathlib import Path, PurePosixPath

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "plugin" / "hutchrok-solutions-group"
IDENTITY = "hutchrok-solutions-group"
REPOSITORY = "https://github.com/FeeTheDeveloper/hutchrok_os"
REQUIRED_SKILLS = {
    "hutchrok-command",
    "hutchrok-os-control-review",
    "hutchrok-os-signal-triage",
    "hutchrok-os-approval-review",
    "hutchrok-plugin-release",
    "host-workspace-operator",
}
FORBIDDEN_NAMES = {".env", ".env.local", "id_rsa", "id_ed25519", "credentials.json"}
SECRET_MARKERS = (b"-----BEGIN PRIVATE KEY-----", b"-----BEGIN OPENSSH PRIVATE KEY-----")


def fail(message: str) -> None:
    raise ValueError(message)


def validate() -> list[Path]:
    manifest = json.loads((SOURCE / "plugin.json").read_text(encoding="utf-8"))
    overlay = json.loads((SOURCE / ".codex-plugin" / "plugin.json").read_text(encoding="utf-8"))
    if manifest.get("name") != IDENTITY or overlay.get("name") != IDENTITY:
        fail("Plugin identity does not match the locked Hutchrok name")
    if manifest.get("repository") != REPOSITORY or overlay.get("repository") != REPOSITORY:
        fail("Plugin repository does not match the locked source")
    if not re.fullmatch(r"\d+\.\d+\.\d+", manifest.get("version", "")):
        fail("Plugin version must be semver")
    if overlay.get("version") != manifest["version"]:
        fail("Portable and Codex manifest versions differ")
    if overlay.get("skills") != "./skills":
        fail("Codex manifest must declare the skills directory")
    overlay_interface = {key: value for key, value in overlay.get("interface", {}).items() if key != "capabilities"}
    if manifest.get("extensions", {}).get("com.openai", {}).get("interface") != overlay_interface:
        fail("Portable and Codex listing interfaces differ")
    if any(key in overlay for key in ("mcpServers", "apps")):
        fail("Skills-only package must not declare an app or MCP server")

    skill_root = SOURCE / "skills"
    names = {path.name for path in skill_root.iterdir() if path.is_dir()}
    if not REQUIRED_SKILLS <= names:
        fail(f"Missing required skills: {sorted(REQUIRED_SKILLS - names)}")
    if any(not (skill_root / name / "SKILL.md").is_file() for name in names):
        fail("Every skill directory must contain SKILL.md")
    if any(path.is_file() for path in skill_root.iterdir()):
        fail("Loose files are not valid skills")
    for name in names:
        content = (skill_root / name / "SKILL.md").read_text(encoding="utf-8")
        if not re.match(r"\A---\nname: [^\n]+\ndescription: [^\n]+\n---\n", content):
            fail(f"Invalid skill frontmatter: {name}")

    files = sorted(
        (path for path in SOURCE.rglob("*") if path.is_file()),
        key=lambda path: path.relative_to(SOURCE).as_posix(),
    )
    if not files:
        fail("Plugin has no files")
    for path in files:
        relative = PurePosixPath(path.relative_to(SOURCE).as_posix())
        if path.is_symlink() or ".." in relative.parts or path.name.lower() in FORBIDDEN_NAMES:
            fail(f"Unsafe package path: {relative}")
        if any(part in {"__pycache__", "node_modules", ".git"} for part in relative.parts):
            fail(f"Transient package path: {relative}")
        data = path.read_bytes()
        if any(marker in data for marker in SECRET_MARKERS):
            fail(f"Secret-shaped content: {relative}")
        if re.search(rb"[A-Za-z]:\\Users\\|/Users/[^/]+/|/home/[^/]+/", data):
            fail(f"Local user path in package: {relative}")
    if {path.name for path in (SOURCE / ".codex-plugin").iterdir()} != {"plugin.json"}:
        fail("Only plugin.json belongs in .codex-plugin")
    return files


def package(files: list[Path], output: Path) -> str:
    output.parent.mkdir(parents=True, exist_ok=True)
    # Stored entries avoid host zlib differences, so Windows and Linux builds
    # have the same archive hash for the same repository bytes.
    with zipfile.ZipFile(output, "w", compression=zipfile.ZIP_STORED) as archive:
        for path in files:
            relative = path.relative_to(SOURCE).as_posix()
            info = zipfile.ZipInfo(relative, date_time=(1980, 1, 1, 0, 0, 0))
            info.create_system = 3
            info.compress_type = zipfile.ZIP_STORED
            info.external_attr = 0o100644 << 16
            archive.writestr(info, path.read_bytes())
    return hashlib.sha256(output.read_bytes()).hexdigest()


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="Validate without writing an archive")
    parser.add_argument("--output", type=Path, help="Destination ZIP")
    args = parser.parse_args()
    try:
        files = validate()
        version = json.loads((SOURCE / "plugin.json").read_text(encoding="utf-8"))["version"]
        result = {"name": IDENTITY, "version": version, "files": len(files), "valid": True}
        if not args.check:
            output = args.output or ROOT / "dist" / f"{IDENTITY}-{version}.zip"
            result.update({"archive": str(output), "sha256": package(files, output)})
        print(json.dumps(result, sort_keys=True))
        return 0
    except (ValueError, OSError, json.JSONDecodeError) as exc:
        print(f"plugin build failed: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
