"""Maintainer-only: compare pinned archive bytes to the audited actual dataset."""
import argparse
import hashlib
import json
import shutil
import tarfile
from pathlib import Path

from prepare_data import PROJECT, REPO, SHA256, SIZE, digest


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("archive", type=Path)
    parser.add_argument("actual_dataset", type=Path)
    args = parser.parse_args()
    if args.archive.stat().st_size != SIZE or digest(args.archive) != SHA256:
        raise RuntimeError("Original archive hash mismatch")
    manifest = json.loads((PROJECT / "DATA_SNAPSHOT.json").read_text(encoding="utf-8"))
    expected = {item["path"]: item for item in manifest["files"]}
    matching = set()
    with tarfile.open(args.archive, "r|gz") as archive:
        for member in archive:
            if not member.isfile():
                continue
            name = member.name.removeprefix("./").removeprefix("mobilegym-data/")
            if name in expected:
                stream = archive.extractfile(member)
                checksum = hashlib.file_digest(stream, "sha256").hexdigest()
                if member.size == expected[name]["bytes"] and checksum == expected[name]["sha256"]:
                    matching.add(name)
    patches = []
    for name in sorted(expected.keys() - matching):
        original = args.actual_dataset / name
        if digest(original) != expected[name]["sha256"]:
            raise RuntimeError(f"Actual source changed: {name}")
        existing = REPO / "mobilegym_overlay" / "mobilegym-data" / name
        if existing.is_file() and digest(existing) == expected[name]["sha256"]:
            continue
        target = PROJECT / "media_patch" / name
        target.parent.mkdir(parents=True, exist_ok=True)
        if target.exists() and digest(target) != expected[name]["sha256"]:
            raise RuntimeError(f"Patch conflict: {name}")
        if not target.exists():
            shutil.copyfile(original, target)
        patches.append(expected[name])
    result = {"archive_sha256": SHA256, "matching_files": len(matching),
              "patches": patches, "patch_bytes": sum(item["bytes"] for item in patches)}
    (PROJECT / "MEDIA_PATCH_MANIFEST.json").write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"matching": len(matching), "patches": len(patches), "patch_bytes": result["patch_bytes"]}))


if __name__ == "__main__":
    main()
