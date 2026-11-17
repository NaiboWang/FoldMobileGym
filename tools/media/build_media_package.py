#!/usr/bin/env python3
"""Build a verified media Release: legacy supplement or standalone local bundle."""
from __future__ import annotations
import argparse
import gzip
import hashlib
import io
import json
import os
import re
import tarfile
import tempfile
from pathlib import Path
from media_inventory import ROOT, checked_file, digest, local_inventory, safe_name

PREFIX = "foldagent-gui-media/"
INDEX = PREFIX + "package-index.json"
VERSION = "v0.2.0"
DOCUMENTS = ("media_sources/manifest.json", "media_sources/README.md",
             "mobilegym/LICENSE", "mobilegym/LICENSE-DATA", "mobilegym/NOTICE", "mobilegym/DISCLAIMER.md")


def inputs(root: Path) -> tuple[dict, list[dict]]:
    manifest = json.loads(checked_file(root, "media_sources/manifest.json").read_text(encoding="utf-8"))
    if manifest.get("schema_version") != 2:
        raise RuntimeError("Regenerate the v2 media manifest before packaging")
    if manifest.get("local_layers") != local_inventory(root):
        raise RuntimeError("Stale media manifest: tracked local files differ; regenerate it")
    records = [row for layer in manifest["local_layers"].values() for row in layer["entries"]]
    for name in DOCUMENTS:
        file = checked_file(root, name)
        records.append({"path": name, "bytes": file.stat().st_size, "sha256": digest(file)})
    records.sort(key=lambda row: row["path"])
    if len({row["path"] for row in records}) != len(records):
        raise RuntimeError("Duplicate packaged path")
    return manifest, records


def valid_records(records: list) -> dict:
    if not isinstance(records, list) or not records:
        raise RuntimeError("Missing package entries")
    result = {}
    for row in records:
        if (not isinstance(row, dict) or not safe_name(row.get("path"))
                or type(row.get("bytes")) is not int or row["bytes"] < 0
                or not isinstance(row.get("sha256"), str)
                or not re.fullmatch(r"[a-f0-9]{64}", row["sha256"])
                or row["path"] in result):
            raise RuntimeError("Invalid/duplicate package entry")
        result[row["path"]] = row
    return result


def verify_archive(archive: Path, release: dict | None = None) -> dict:
    if release is not None and (archive.stat().st_size != release.get("bytes") or digest(archive) != release.get("sha256")):
        raise RuntimeError("Release archive size/SHA-256 mismatch")
    with tarfile.open(archive, "r|gz") as bundle:
        first = bundle.next()
        if first is None or first.name != INDEX or not first.isfile() or first.size > 16 * 1024 * 1024:
            raise RuntimeError("Package index must be the first regular member")
        index = json.load(bundle.extractfile(first))
        if index.get("schema_version") != 1:
            raise RuntimeError("Unknown package index version")
        expected = valid_records(index.get("entries"))
        seen = set()
        # next() consumed the index; TarFile iteration returns it once more.
        for member in bundle:
            if member is first:
                continue
            if not member.isfile() or not member.name.startswith(PREFIX):
                raise RuntimeError("Non-regular or out-of-root archive member")
            name = member.name[len(PREFIX):]
            if not safe_name(name) or name not in expected or name in seen:
                raise RuntimeError("Unsafe/unlisted/duplicate archive member: " + name)
            seen.add(name)
            row = expected[name]
            if member.size != row["bytes"]:
                raise RuntimeError("Member size mismatch: " + name)
            checksum = hashlib.file_digest(bundle.extractfile(member), "sha256").hexdigest()
            if checksum != row["sha256"]:
                raise RuntimeError("Member SHA-256 mismatch: " + name)
        if seen != set(expected):
            raise RuntimeError("Archive is missing indexed files")
    return {"passed": True, "files": len(seen), "uncompressed_bytes": sum(row["bytes"] for row in expected.values())}


def add_bytes(bundle: tarfile.TarFile, name: str, value: bytes) -> None:
    member = tarfile.TarInfo(name)
    member.size = len(value)
    member.mode = 0o644
    bundle.addfile(member, io.BytesIO(value))


def build(root: Path, output: Path) -> dict:
    # No overwrite, no user-chosen source directory, no links/junction ancestors.
    output = output.absolute()
    try:
        relative = output.relative_to(root.absolute()).as_posix()
    except ValueError as error:
        raise RuntimeError("Package output must be inside this checkout's artifacts directory") from error
    if not safe_name(relative) or not relative.startswith("artifacts/"):
        raise RuntimeError("Package output must be inside artifacts")
    current = root
    for part in relative.split("/")[:-1]:
        current = current / part
        if current.exists() or current.is_symlink():
            # Reuse checked_file's ancestor guard with a harmless regular child
            # only for actual input files; output directories need lstat directly.
            import stat
            info = os.lstat(current)
            if stat.S_ISLNK(info.st_mode) or getattr(info, "st_file_attributes", 0) & 0x400:
                raise RuntimeError("Linked output directory refused")
        else:
            current.mkdir()
    if output.exists() or output.is_symlink():
        raise RuntimeError("Refusing to overwrite an existing media archive")
    manifest, records = inputs(root)
    index = {"schema_version": 1, "kind": "project-local-media-supplement", "version": VERSION,
             "layout": "repository-relative paths under foldagent-gui-media/", "upstream": manifest["upstream"],
             "scope": "all tracked bundled images and media patches; not a minimal runtime-usage trace", "entries": records}
    fd, temporary = tempfile.mkstemp(prefix="media-package-", suffix=".partial", dir=output.parent)
    partial = Path(temporary)
    try:
        with os.fdopen(fd, "wb") as raw, gzip.GzipFile(filename="", fileobj=raw, mode="wb", mtime=0, compresslevel=6) as compressed:
            with tarfile.open(fileobj=compressed, mode="w|") as bundle:
                add_bytes(bundle, INDEX, (json.dumps(index, ensure_ascii=False, sort_keys=True) + "\n").encode())
                for row in records:
                    source = checked_file(root, row["path"])
                    if source.stat().st_size != row["bytes"] or digest(source) != row["sha256"]:
                        raise RuntimeError("Media changed while packaging: " + row["path"])
                    member = tarfile.TarInfo(PREFIX + row["path"])
                    member.size, member.mode = row["bytes"], 0o644
                    with source.open("rb") as stream:
                        bundle.addfile(member, stream)
        report = verify_archive(partial)
        release = {"name": output.name, "bytes": partial.stat().st_size, "sha256": digest(partial),
                   "kind": index["kind"], "version": VERSION, "package_files": report["files"],
                   "upstream_release": manifest["upstream"]["release"],
                   "upstream_sha256": manifest["upstream"]["archive_sha256"],
                   "publish_target": "GitHub Release asset (not committed to Git history)", "published": False}
        # A hard link publishes only into a previously absent path, never replaces.
        os.link(partial, output)
        return release
    finally:
        partial.unlink(missing_ok=True)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--mode", choices=["supplement", "standalone"], default="supplement")
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    if args.mode == "standalone":
        from standalone_media import build as build_full, VERSION as full_version
        output = args.output or ROOT / "artifacts" / ("foldagent-gui-media-full-" + full_version + ".tar.gz")
        release = build_full(ROOT, output)
        record = "standalone-release.json"
    else:
        output = args.output or ROOT / "artifacts" / ("foldagent-gui-media-supplement-" + VERSION + ".tar.gz")
        release = build(ROOT, output)
        record = "supplement-release.json"
    (ROOT / "media_sources" / record).write_text(json.dumps(release, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"passed": True, "output": str(output), **release}))


if __name__ == "__main__":
    main()
