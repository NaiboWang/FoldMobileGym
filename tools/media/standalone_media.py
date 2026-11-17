"""Complete pinned local-media bundle: content-addressed bytes, no upstream download."""
from __future__ import annotations
import gzip
import hashlib
import json
import os
import re
import shutil
import stat
import subprocess
import tarfile
import tempfile
from pathlib import Path
from build_media_package import inputs, valid_records, add_bytes, DOCUMENTS
from media_inventory import checked_file, checkout_name, digest, safe_name

VERSION = "v0.3.0"
KIND = "project-standalone-local-media"
PREFIX = "foldagent-gui-media-full/"
INDEX = PREFIX + "package-index.json"
DATA = "mobilegym/mobilegym-data/"
SNAPSHOT = "mobilegym/DATA_SNAPSHOT.json"
MAX_ARCHIVE_BYTES = 2 * 1024**3 - 1
MAX_INDEX_BYTES = 128 * 1024**2
MAX_FILES = 400000
PATCHES = ("mobilegym_overlay/mobilegym-data/", "mobilegym/media_patch/", "media_sources/overrides/")
# These checkout-owned documents can change independently of the pinned media.
# They must already exist and are never installed or overwritten from the archive.
# Runtime files, the code LICENSE and media provenance remain pinned.
MUTABLE_CHECKOUT_DOCUMENTS = frozenset({
    "media_sources/README.md",
    "mobilegym/NOTICE",
    "mobilegym/LICENSE-DATA",
    "mobilegym/DISCLAIMER.md",
})


def strict_json(stream):
    def unique(pairs):
        out = {}
        for key, value in pairs:
            if key in out:
                raise RuntimeError("Duplicate JSON key")
            out[key] = value
        return out
    return json.load(stream, object_pairs_hook=unique)


def required(root: Path) -> tuple[list[dict], dict[str, str], dict]:
    manifest, local = inputs(root)
    snapshot_file = checked_file(root, SNAPSHOT)
    with snapshot_file.open(encoding="utf-8") as stream:
        snapshot = strict_json(stream)
    pinned = valid_records(snapshot.get("files"))
    if (snapshot.get("bytes") != sum(x["bytes"] for x in pinned.values())
            or snapshot.get("release") != manifest["upstream"]["release"]
            or snapshot.get("archive_sha256") != manifest["upstream"]["archive_sha256"]):
        raise RuntimeError("Dataset snapshot and source manifest disagree")
    records, sources = {}, {}
    def insert(row, source):
        prior = records.get(row["path"])
        if prior and prior != row:
            raise RuntimeError("Reviewed patch conflicts with pinned snapshot; review/update snapshot: " + row["path"])
        records[row["path"]] = row
        sources[row["path"]] = source
    for row in pinned.values():
        name = DATA + row["path"]
        insert({**row, "path": name}, name)
    for row in local:
        insert(dict(row), row["path"])
        for prefix in PATCHES:
            if row["path"].startswith(prefix):
                insert({**row, "path": DATA + row["path"][len(prefix):]}, row["path"])
                break
    insert({"path": SNAPSHOT, "bytes": snapshot_file.stat().st_size, "sha256": digest(snapshot_file)}, SNAPSHOT)
    folded = [name.casefold() for name in records]
    if len(set(folded)) != len(folded) or len(records) > MAX_FILES:
        raise RuntimeError("Portable target path collision or excessive inventory")
    rows = sorted(records.values(), key=lambda x: x["path"])
    return rows, sources, {"release": snapshot["release"], "snapshot_sha256": digest(snapshot_file),
                           "manifest_sha256": digest(checked_file(root, "media_sources/manifest.json"))}


def filesystem_path(path: Path) -> Path:
    """Use extended Windows names without registry/admin changes."""
    value = os.path.abspath(os.fspath(path))
    prefix = chr(92) * 2 + "?" + chr(92)
    if os.name == "nt" and not value.startswith(prefix):
        value = prefix + "UNC" + chr(92) + value[2:] if value.startswith(chr(92) * 2) else prefix + value
    return Path(value)


def directory(path: Path) -> Path:
    path = filesystem_path(path)
    current = Path(path.anchor)
    for part in path.parts[1:]:
        current /= part
        if not current.exists() and not current.is_symlink():
            current.mkdir()
        info = os.lstat(current)
        if (not stat.S_ISDIR(info.st_mode) or stat.S_ISLNK(info.st_mode)
                or getattr(info, "st_file_attributes", 0) & 0x400):
            raise RuntimeError("Linked/non-directory output refused")
    return path


def index_records(index):
    if index.get("schema_version") != 1 or index.get("kind") != KIND:
        raise RuntimeError("Unknown standalone media format")
    records = valid_records(index.get("entries"))
    if len(records) > MAX_FILES or len({p.casefold() for p in records}) != len(records):
        raise RuntimeError("Excessive inventory or portable target collision")
    blobs = index.get("blobs")
    if not isinstance(blobs, list) or not blobs or len(blobs) > len(records):
        raise RuntimeError("Invalid payload inventory")
    expected = {}
    for row in blobs:
        if (not isinstance(row, dict) or not re.fullmatch(r"[0-9a-f]{64}", str(row.get("sha256", "")))
                or type(row.get("bytes")) is not int or not 0 <= row["bytes"] <= 1024**3
                or row["sha256"] in expected):
            raise RuntimeError("Invalid/duplicate payload")
        expected[row["sha256"]] = row["bytes"]
    used = {}
    for row in records.values():
        checksum = row["sha256"]
        if checksum not in expected or expected[checksum] != row["bytes"]:
            raise RuntimeError("Missing/conflicting target payload")
        used[checksum] = row["bytes"]
    if used != expected or sum(expected.values()) > 8 * 1024**3:
        raise RuntimeError("Unused payload or excessive expanded bytes")
    return records, expected


def scan(archive: Path, release: dict | None = None, prepare=None, consume=None, progress=None):
    archive = filesystem_path(archive)
    info = os.lstat(archive)
    if not stat.S_ISREG(info.st_mode) or stat.S_ISLNK(info.st_mode) or getattr(info, "st_file_attributes", 0) & 0x400:
        raise RuntimeError("Archive must be a regular unlinked file")
    if release is not None:
        if progress:
            progress("archive_checksum", 0, 1)
        if (release.get("kind") != KIND or info.st_size != release.get("bytes")
                or digest(archive) != release.get("sha256")):
            raise RuntimeError("Trusted release checksum/kind mismatch")
        if progress:
            progress("archive_checksum", 1, 1)
    with tarfile.open(archive, "r|gz") as bundle:
        first = bundle.next()
        if first is None or first.name != INDEX or not first.isfile() or first.size > MAX_INDEX_BYTES:
            raise RuntimeError("Standalone index must be the first bounded regular member")
        index = strict_json(bundle.extractfile(first))
        records, expected = index_records(index)
        if prepare:
            prepare(index, records)
        seen = set()
        if progress:
            progress("payloads", 0, len(expected))
        for member in bundle:
            if member is first:
                continue
            name = member.name.removeprefix(PREFIX + "blobs/")
            if (not member.isfile() or member.name != PREFIX + "blobs/" + name
                    or name not in expected or name in seen or member.size != expected[name]):
                raise RuntimeError("Unsafe/unlisted/duplicate/mismatched payload member")
            stream = bundle.extractfile(member)
            checksum = hashlib.sha256()
            if consume:
                consume(name, stream, checksum)
            else:
                while block := stream.read(1024 * 1024):
                    checksum.update(block)
            if checksum.hexdigest() != name:
                raise RuntimeError("Payload SHA-256 mismatch")
            seen.add(name)
            if progress and (len(seen) % 10000 == 0 or len(seen) == len(expected)):
                progress("payloads", len(seen), len(expected))
        if seen != set(expected):
            raise RuntimeError("Archive payloads are incomplete")
    return {"passed": True, "kind": KIND, "files": len(records), "payloads": len(expected),
            "uncompressed_bytes": sum(x["bytes"] for x in records.values()), "unique_bytes": sum(expected.values())}


def checked_source(root: Path, name: str, directories: set) -> tuple[Path, os.stat_result]:
    if not safe_name(name):
        raise RuntimeError("Unsafe source path")
    current = root
    parts = checkout_name(root, name).split("/")
    for part in (None, *parts[:-1]):
        if part is not None:
            current /= part
        if current not in directories:
            info = os.lstat(current)
            if (not stat.S_ISDIR(info.st_mode) or stat.S_ISLNK(info.st_mode)
                    or getattr(info, "st_file_attributes", 0) & 0x400):
                raise RuntimeError("Linked source directory refused")
            directories.add(current)
    source = current / parts[-1]
    info = os.lstat(source)
    if (not stat.S_ISREG(info.st_mode) or stat.S_ISLNK(info.st_mode)
            or getattr(info, "st_file_attributes", 0) & 0x400):
        raise RuntimeError("Linked/nonregular source refused")
    return source, info


class HashingReader:
    def __init__(self, stream):
        self.stream, self.hash = stream, hashlib.sha256()
    def read(self, size=-1):
        value = self.stream.read(size)
        self.hash.update(value)
        return value


def build(root: Path, output: Path) -> dict:
    root, output = Path(root).resolve(), filesystem_path(output)
    directory(output.parent)
    if output.exists() or output.is_symlink():
        raise RuntimeError("Refusing to overwrite an existing standalone archive")
    records, sources, provenance = required(root)
    blobs, directories = {}, set()
    for number, row in enumerate(records, 1):
        source, source_info = checked_source(root, sources[row["path"]], directories)
        if source_info.st_size != row["bytes"] or digest(source) != row["sha256"]:
            raise RuntimeError("Changed/missing reviewed source: " + row["path"])
        blobs.setdefault(row["sha256"], {"bytes": row["bytes"], "source": source})
        if number % 20000 == 0:
            print(f"Verified {number}/{len(records)} source files", flush=True)
    if shutil.disk_usage(output.parent).free < sum(b["bytes"] for b in blobs.values()) + 1024**3:
        raise RuntimeError("At least unique input bytes plus 1GiB output headroom required")
    try:
        commit = subprocess.check_output(["git", "-C", str(root), "rev-parse", "HEAD"], stderr=subprocess.DEVNULL).decode().strip()
    except subprocess.CalledProcessError:
        commit = None
    if commit is not None:
        tracked = set(subprocess.check_output(["git", "-C", str(root), "ls-files", "--cached", "-z"]).decode().rstrip("\0").split("\0"))
        reviewed = {checkout_name(root, source) for source in sources.values() if not source.startswith(DATA)}
        if not reviewed <= tracked:
            raise RuntimeError("Untracked input metadata/local media refused")
        dirty = set(subprocess.check_output(["git", "-C", str(root), "diff", "HEAD", "--name-only", "-z"]).decode().rstrip("\0").split("\0"))
        if dirty & reviewed:
            raise RuntimeError("Commit reviewed package inputs before building a source-pinned release")
    index = {"schema_version": 1, "kind": KIND, "version": VERSION, "inputs_commit": commit,
             "provenance": provenance, "entries": records,
             "blobs": [{"sha256": sha, "bytes": blobs[sha]["bytes"]} for sha in sorted(blobs)],
             "scope": "Complete pinned local runtime and tracked images/patches; remote images remain external. No upstream archive required."}
    encoded = (json.dumps(index, ensure_ascii=False, sort_keys=True, separators=(",", ":")) + "\n").encode()
    if len(encoded) > MAX_INDEX_BYTES:
        raise RuntimeError("Standalone index exceeds bounded size")
    fd, name = tempfile.mkstemp(prefix="foldagent-full-", suffix=".partial", dir=output.parent)
    partial = Path(name)
    try:
        with os.fdopen(fd, "wb") as raw, gzip.GzipFile(filename="", fileobj=raw, mode="wb", mtime=0, compresslevel=6) as compressed:
            with tarfile.open(fileobj=compressed, mode="w|") as bundle:
                add_bytes(bundle, INDEX, encoded)
                for number, sha in enumerate(sorted(blobs), 1):
                    row = blobs[sha]
                    member = tarfile.TarInfo(PREFIX + "blobs/" + sha)
                    member.size, member.mode = row["bytes"], 0o644
                    with row["source"].open("rb") as source:
                        reader = HashingReader(source)
                        bundle.addfile(member, reader)
                        if reader.hash.hexdigest() != sha or os.fstat(source.fileno()).st_size != row["bytes"]:
                            raise RuntimeError("Source changed during packaging")
                    if number % 20000 == 0:
                        print(f"Packed {number}/{len(blobs)} unique media payloads", flush=True)
        report = scan(partial)
        if partial.stat().st_size > MAX_ARCHIVE_BYTES:
            raise RuntimeError("Standalone archive exceeds the conservative single-asset publication guard")
        release = {"name": output.name, "bytes": partial.stat().st_size, "sha256": digest(partial), "kind": KIND,
                   "version": VERSION, "package_files": report["files"], "payloads": report["payloads"],
                   "uncompressed_bytes": report["uncompressed_bytes"], "unique_bytes": report["unique_bytes"],
                   "inputs_commit": commit, "upstream_release": provenance["release"], "published": False}
        os.link(partial, output)  # Exclusive publication; never replace another file.
        return release
    finally:
        partial.unlink(missing_ok=True)


def existing(root: Path, name: str, row: dict) -> bool:
    if not safe_name(name):
        raise RuntimeError("Unsafe destination")
    name = checkout_name(root, name)
    current = root
    for part in name.split("/"):
        current /= part
        if not current.exists() and not current.is_symlink():
            return False
        info = os.lstat(current)
        if stat.S_ISLNK(info.st_mode) or getattr(info, "st_file_attributes", 0) & 0x400:
            raise RuntimeError("Linked destination refused")
    if not current.is_file() or current.stat().st_size != row["bytes"] or digest(current) != row["sha256"]:
        raise RuntimeError("Existing user/source file differs; no overwrite: " + name)
    return True


def install(archive: Path, root: Path, release: dict, check_only=False, progress=None) -> dict:
    root = directory(root)
    stage = None
    pending, skipped, rows = {}, [], {}
    if progress:
        progress("metadata", 0, 1)
    expected_records, _, provenance = required_metadata(root)
    if progress:
        progress("metadata", 1, 1)
    def prepare(index, records):
        nonlocal stage, rows
        if (index.get("provenance") != provenance or records.keys() != expected_records.keys()
                or any(records[name] != expected_records[name] for name in records
                       if name not in MUTABLE_CHECKOUT_DOCUMENTS)):
            raise RuntimeError("Package does not match this checkout's pinned media metadata")
        # The archive and every payload are still verified by scan(); only the
        # existing checkout copies of these non-runtime documents take precedence.
        rows = {**records, **{name: expected_records[name] for name in MUTABLE_CHECKOUT_DOCUMENTS}}
        if progress:
            progress("existing", 0, len(rows))
        for number, (name, row) in enumerate(rows.items(), 1):
            if existing(root, name, row):
                skipped.append(name)
            elif name in MUTABLE_CHECKOUT_DOCUMENTS:
                raise RuntimeError("Required checkout documentation missing: " + name)
            elif check_only:
                raise RuntimeError("Required installed media missing: " + name)
            else:
                pending.setdefault(row["sha256"], []).append(name)
            if progress and (number % 10000 == 0 or number == len(rows)):
                progress("existing", number, len(rows))
        if not check_only:
            missing = sum(records[name]["bytes"] for names in pending.values() for name in names)
            if shutil.disk_usage(root).free < missing + 512 * 1024**2:
                raise RuntimeError("Insufficient free space for verified staging plus 512MiB headroom")
            stage = Path(tempfile.mkdtemp(prefix=".foldagent-media-stage-", dir=root))
    def consume(sha, stream, checksum):
        names = pending.get(sha, [])
        target = stage / names[0] if names else None
        if target:
            target.parent.mkdir(parents=True, exist_ok=True)
        output = target.open("xb") if target else None
        try:
            while block := stream.read(1024 * 1024):
                checksum.update(block)
                if output:
                    output.write(block)
        finally:
            if output:
                output.close()
        if target:
            for name in names[1:]:
                alias = stage / name
                alias.parent.mkdir(parents=True, exist_ok=True)
                with target.open("rb") as source, alias.open("xb") as destination:
                    shutil.copyfileobj(source, destination)
    try:
        report = scan(archive, release, prepare, consume, progress)
        # Recheck files skipped before streaming, so edits during staging are not silently accepted.
        if progress:
            progress("recheck", 0, len(skipped))
        for number, name in enumerate(skipped, 1):
            if not existing(root, name, rows[name]):
                raise RuntimeError("Existing destination changed during install")
            if progress and (number % 10000 == 0 or number == len(skipped)):
                progress("recheck", number, len(skipped))
        installed = 0
        processed = 0
        total_pending = sum(len(names) for names in pending.values())
        if progress:
            progress("publish", 0, total_pending)
        for names in pending.values():
            for name in names:
                destination = root / checkout_name(root, name)
                directory(destination.parent)
                try:
                    os.link(stage / name, destination)  # Same-filesystem, exclusive, no cross-target aliasing.
                    installed += 1
                except FileExistsError:
                    if not existing(root, name, rows[name]):
                        raise RuntimeError("Destination changed during exclusive publication")
                processed += 1
                if progress and (processed % 10000 == 0 or processed == total_pending):
                    progress("publish", processed, total_pending)
        return {**report, "installed": installed, "already_present": len(skipped), "check_only": check_only,
                "scope": "Pinned local media only; no original archive download, external mirroring or browser fidelity claim"}
    finally:
        if stage:
            # This private directory was created by this invocation, below this explicitly selected root.
            if stage.resolve().parent != root.resolve() or stage.is_symlink():
                raise RuntimeError("Refusing cleanup outside the owned staging root")
            shutil.rmtree(stage)


def required_metadata(root: Path):
    """Derive the exact allowed target set without requiring the images to exist yet."""
    with checked_file(root, "media_sources/manifest.json").open(encoding="utf-8") as stream:
        manifest = strict_json(stream)
    snapshot_file = checked_file(root, SNAPSHOT)
    with snapshot_file.open(encoding="utf-8") as stream:
        snapshot = strict_json(stream)
    if manifest.get("schema_version") != 2:
        raise RuntimeError("Unsupported checkout media manifest")
    pinned = valid_records(snapshot.get("files"))
    if (snapshot.get("bytes") != sum(x["bytes"] for x in pinned.values())
            or snapshot.get("release") != manifest["upstream"]["release"]
            or snapshot.get("archive_sha256") != manifest["upstream"]["archive_sha256"]):
        raise RuntimeError("Checkout snapshot/manifest mismatch")
    records = {DATA + name: {**row, "path": DATA + name} for name, row in pinned.items()}
    for layer in manifest["local_layers"].values():
        for row in valid_records(layer["entries"]).values():
            records[row["path"]] = row
            for prefix in PATCHES:
                if row["path"].startswith(prefix):
                    target = DATA + row["path"][len(prefix):]
                    value = {**row, "path": target}
                    if target in records and records[target] != value:
                        raise RuntimeError("Checkout patch conflicts with snapshot")
                    records[target] = value
                    break
    # Non-image documentation must already come from the trusted code checkout.
    for name in (*DOCUMENTS, SNAPSHOT):
        source = checked_file(root, name)
        records[name] = {"path": name, "bytes": source.stat().st_size, "sha256": digest(source)}
    provenance = {"release": snapshot["release"], "snapshot_sha256": digest(snapshot_file),
                  "manifest_sha256": digest(checked_file(root, "media_sources/manifest.json"))}
    return records, None, provenance
