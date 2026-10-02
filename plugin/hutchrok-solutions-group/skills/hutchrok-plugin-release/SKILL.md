---
name: hutchrok-plugin-release
description: Build and verify the Hutchrok Solutions Group plugin from the hutchrok_os repository, then update the exact owned plugin release after approval and validation.
---

# Hutchrok plugin release

Use this repository's `plugin/hutchrok-solutions-group/` as the source for plugin Skills and manifests. Never edit an installed cache copy as the release source.

1. Confirm repository remote, branch, clean diff scope, source manifest version, and current owned plugin ID, release ID, version, scope, and audience. Compare the remote release files before replacing them.
2. Edit Skills and manifest in this repository. Include only workflows backed by current behavior or explicitly labeled guidance. A Skill grants no connector, role, approval, or runtime capability. Keep secrets, case records, credentials, internal access methods, and sensitive client data out of the package.
3. Run repository tests plus `python scripts/build_hutchrok_plugin.py --check`. Build the archive twice and compare SHA-256. Extract and validate a fresh copy. Review the archive file list and diff against the current release.
4. Update the exact owned `hutchrok-solutions-group` plugin using its current release ID as the concurrency guard only after the package is reviewable and release is authorized. Preserve audience. Verify the returned version and release ID; report any upload failure separately.
5. Record source commit, package hash, plugin release ID, and validation evidence. A local ZIP, upload, approval, and publication are separate states.

Stop on unknown plugin identity, unexpected remote changes, failed validation, secret exposure, missing authority, or any claimed live MCP capability that the package does not implement.
