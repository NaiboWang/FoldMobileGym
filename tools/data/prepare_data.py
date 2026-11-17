"""Reconstruct the companion dataset from a pinned public release plus tracked patches."""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import shutil
import stat
import tarfile
import tempfile
import urllib.request
from pathlib import Path, PurePosixPath

REPO = Path(__file__).resolve().parents[2]
PROJECT = REPO / "foldmobilegym"
URL = "https://github.com/Purewhiter/mobilegym/releases/download/data-v0.1.0/mobilegym-data-v0.1.0.tar.gz"
SHA256 = "933a8499c71450f135eda70f9107af72b56b42181fc62de76ed1aa4c513a603c"
SIZE = 1952615278


def digest(file: Path) -> str:
    with file.open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def required_files() -> dict:
    manifest = json.loads((PROJECT / "DATA_SNAPSHOT.json").read_text(encoding="utf-8"))
    if not isinstance(manifest, dict):
        raise RuntimeError("Invalid dataset manifest: expected object")
    entries = manifest.get("files")
    if not isinstance(entries, list) or not entries:
        raise RuntimeError("Invalid dataset manifest: empty/missing file list")
    seen = set()
    total = 0
    for item in entries:
        name = item.get("path") if isinstance(item, dict) else None
        if (not isinstance(name, str) or not name or "\\" in name or ":" in name
                or "\0" in name or PurePosixPath(name).is_absolute()
                or any(part in ("", ".", "..") for part in name.split("/"))
                or name in seen):
            raise RuntimeError("Invalid dataset manifest: unsafe/duplicate path")
        if (type(item.get("bytes")) is not int or item["bytes"] < 0
                or not isinstance(item.get("sha256"), str)
                or not re.fullmatch(r"[0-9a-f]{64}", item["sha256"])):
            raise RuntimeError("Invalid dataset manifest: size/hash")
        seen.add(name)
        total += item["bytes"]
    if type(manifest.get("bytes")) is not int or manifest["bytes"] != total:
        raise RuntimeError("Invalid dataset manifest: total bytes")
    return manifest


def refuse_link(file: Path) -> None:
    info = os.lstat(file)
    # Python 3.11 is_symlink() does not identify Windows directory junctions.
    if (stat.S_ISLNK(info.st_mode)
            or getattr(info, "st_file_attributes", 0) & getattr(stat, "FILE_ATTRIBUTE_REPARSE_POINT", 0x400)):
        raise RuntimeError("Dataset contains a link/reparse point; verification refused")


def download_archive(archive: Path) -> None:
    """Resume only validated HTTP ranges; publish only a size/hash-verified file."""
    partial = archive.with_suffix(".partial")
    # Validate cache ancestors before mkdir/open, including Windows junctions.
    for file in (archive, partial):
        try:
            parts = file.relative_to(REPO).parts
        except ValueError as error:
            raise RuntimeError("Download cache must stay inside repository") from error
        if ".." in parts:
            raise RuntimeError("Download cache must stay inside repository")
        current = REPO
        for part in ("", *parts):
            current = current / part
            if current.exists() or current.is_symlink():
                refuse_link(current)
    if archive.exists():
        if not archive.is_file() or archive.stat().st_size != SIZE or digest(archive) != SHA256:
            raise RuntimeError("Cached release archive size/SHA-256 mismatch; existing file preserved")
        return
    archive.parent.mkdir(parents=True, exist_ok=True)
    if partial.exists() and not partial.is_file():
        raise RuntimeError("Download partial must be an ordinary file")
    offset = partial.stat().st_size if partial.exists() else 0
    if offset > SIZE:
        raise RuntimeError("Download partial exceeds release size; existing file preserved")
    if offset < SIZE:
        headers = {"Accept-Encoding": "identity"}
        if offset:
            headers["Range"] = f"bytes={offset}-"
        print(f"Downloading pinned release from byte {offset} of {SIZE}", flush=True)
        with urllib.request.urlopen(urllib.request.Request(URL, headers=headers), timeout=60) as response:
            expected_response = SIZE - offset
            if offset:
                match = re.fullmatch(r"bytes (\d+)-(\d+)/(\d+)", response.headers.get("Content-Range", ""))
                if (response.status != 206 or not match or int(match[1]) != offset
                        or int(match[3]) != SIZE or not offset <= int(match[2]) < SIZE):
                    raise RuntimeError("Server did not return the requested release range; partial preserved")
                expected_response = int(match[2]) - offset + 1
            elif response.status != 200:
                raise RuntimeError("Unexpected initial download response")
            length = response.headers.get("Content-Length")
            if length is not None and (not length.isdigit() or int(length) != expected_response):
                raise RuntimeError("Download Content-Length mismatch; partial preserved")
            if response.headers.get("Content-Encoding", "identity").lower() != "identity":
                raise RuntimeError("Encoded release response refused; partial preserved")
            if (partial.stat().st_size if partial.exists() else 0) != offset:
                raise RuntimeError("Partial changed during download setup; concurrent downloads refused")
            received = 0
            with partial.open("ab" if partial.exists() else "xb") as output:
                while chunk := response.read(min(1024 * 1024, expected_response - received + 1)):
                    if received + len(chunk) > expected_response:
                        raise RuntimeError("Download exceeds declared range; partial preserved")
                    output.write(chunk)
                    received += len(chunk)
    if partial.stat().st_size != SIZE:
        raise RuntimeError("Download incomplete; rerun the same command to resume the preserved partial")
    if digest(partial) != SHA256:
        raise RuntimeError("Downloaded release SHA-256 mismatch; partial preserved, extraction refused")
    # Exclusive publication: never replace an existing destination, even on POSIX.
    # Same-directory hard link followed by removal of the temporary name preserves bytes.
    os.link(partial, archive)
    partial.unlink()


def verify(root: Path, *, progress: bool = False) -> dict:
    manifest = required_files()
    if root.exists() or root.is_symlink():
        refuse_link(root)
    checked_directories = set()
    errors = []
    for index, item in enumerate(manifest["files"], 1):
        file = root / item["path"]
        parent = root
        for part in PurePosixPath(item["path"]).parts[:-1]:
            parent = parent / part
            if parent not in checked_directories and (parent.exists() or parent.is_symlink()):
                refuse_link(parent)
                checked_directories.add(parent)
        if file.exists() or file.is_symlink():
            refuse_link(file)
        if (not file.is_file() or file.stat().st_size != item["bytes"]
                or digest(file) != item["sha256"]):
            errors.append(item["path"])
        if progress and index % 20000 == 0:
            print(f"Verified {index}/{len(manifest['files'])} media files", flush=True)
    if errors:
        raise RuntimeError(f"Dataset incomplete/different: {len(errors)} files; first: {errors[:8]}")
    return {"passed": True, "files": len(manifest["files"]), "bytes": manifest["bytes"]}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--archive", type=Path, help="Use an already downloaded original release archive")
    parser.add_argument("--check-only", action="store_true")
    args = parser.parse_args()
    target = PROJECT / "mobilegym-data"
    if args.check_only:
        print(json.dumps(verify(target)))
        return
    if target.exists():
        # Never merge into or erase an unknown/user-owned dataset.
        print(json.dumps(verify(target)))
        return
    archive = args.archive
    if archive is None:
        cache = REPO / "artifacts" / "rebuild_downloads"
        archive = cache / "mobilegym-data-v0.1.0.tar.gz"
        download_archive(archive)
    if archive.stat().st_size != SIZE or digest(archive) != SHA256:
        raise RuntimeError("Release archive size/SHA-256 mismatch; extraction refused")
    print("Archive verified; extracting into a new staging directory", flush=True)
    expected = {item["path"] for item in required_files()["files"]}
    # Python 3.11.8+ has the data extraction filter; no unsafe fallback.
    with tempfile.TemporaryDirectory(prefix="data-stage-", dir=PROJECT) as stage_name:
        stage = Path(stage_name)
        # Streaming avoids repeated gzip seeks across ~180k small files.
        with tarfile.open(archive, "r|gz") as bundle:
            count = 0
            for member in bundle:
                name = member.name.removeprefix("./").removeprefix("mobilegym-data/")
                # The release also contains placeholder symlink aliases absent
                # from the actual Windows mirror. The app's missing-avatar index
                # expects those to remain absent. Never create links or request
                # administrator/Developer Mode privileges on a new computer.
                if not member.isfile() or name not in expected:
                    continue
                bundle.extract(member, stage, filter="data")
                count += 1
                if count % 20000 == 0:
                    print(f"Extracted {count} regular files", flush=True)
        root = stage / "mobilegym-data"
        if not root.is_dir():
            if (stage / "redbook").is_dir():
                root = stage
            else:
                raise RuntimeError("Unexpected archive layout")
        print(f"Archive extraction complete ({count} regular files); merging tracked media", flush=True)
        # The existing tracked image package also supplies its original notices.
        legacy_media = REPO / "mobilegym_overlay" / "mobilegym-data"
        shutil.copytree(legacy_media, root, dirs_exist_ok=True)
        for patch in (PROJECT / "media_patch", REPO / "media_sources" / "overrides"):
            if patch.exists():
                shutil.copytree(patch, root, dirs_exist_ok=True)
        print("Verifying complete media inventory (sizes and SHA-256)", flush=True)
        report = verify(root, progress=True)
        if root == stage:
            # Preserve TemporaryDirectory ownership while publishing the validated tree.
            target.mkdir()
            for item in list(root.iterdir()):
                shutil.move(str(item), target / item.name)
        else:
            root.rename(target)
        print(json.dumps(report))


if __name__ == "__main__":
    main()
