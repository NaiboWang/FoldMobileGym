"""Shared tracked-only media inventory and safe path validation."""
from __future__ import annotations
import hashlib
import os
import re
import stat
import subprocess
from pathlib import Path, PurePosixPath

ROOT = Path(__file__).resolve().parents[2]
IMAGE_EXTS = {".png", ".jpg", ".jpeg", ".webp", ".gif", ".avif", ".svg"}


def safe_name(name: str) -> bool:
    return (isinstance(name, str) and bool(name) and not re.search(r"[\\:\x00]", name)
            and not PurePosixPath(name).is_absolute()
            and all(part not in ("", ".", "..") and part.rstrip(" .") == part
                    and part.split(".")[0].upper() not in {"CON", "PRN", "AUX", "NUL", *["COM"+str(i) for i in range(1,10)], *["LPT"+str(i) for i in range(1,10)]}
                    for part in name.split("/")))


def checkout_name(root: Path, name: str) -> str:
    """Keep published package IDs stable while locating the renamed source tree."""
    if not name.startswith("mobilegym/"):
        return name
    legacy = root / "mobilegym"
    renamed = root / "foldmobilegym"
    legacy_snapshot = (legacy / "DATA_SNAPSHOT.json").is_file()
    renamed_snapshot = (renamed / "DATA_SNAPSHOT.json").is_file()
    if legacy_snapshot and renamed_snapshot:
        raise RuntimeError("Ambiguous frontend: both mobilegym and foldmobilegym contain DATA_SNAPSHOT.json")
    if renamed_snapshot or (not legacy.exists() and renamed.is_dir()):
        return "foldmobilegym/" + name[len("mobilegym/"):]
    return name


def checked_file(root: Path, name: str) -> Path:
    if not safe_name(name):
        raise RuntimeError("Unsafe media path: " + str(name))
    name = checkout_name(root, name)
    current = root
    for part in (None, *name.split("/")):
        if part is not None:
            current = current / part
        info = os.lstat(current)
        if (stat.S_ISLNK(info.st_mode) or getattr(info, "st_file_attributes", 0)
                & getattr(stat, "FILE_ATTRIBUTE_REPARSE_POINT", 0x400)):
            raise RuntimeError("Media link/reparse point refused: " + name)
    if not current.is_file():
        raise RuntimeError("Media path is not a regular file: " + name)
    return current


def tracked_names(root: Path = ROOT) -> list[str]:
    output = subprocess.check_output(["git", "-C", str(root), "ls-files", "--cached", "-z"])
    names = sorted(set(output.decode("utf-8").rstrip("\0").split("\0")))
    return [name for name in names if name]


def digest(file: Path) -> str:
    with file.open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def media_layer(name: str) -> str | None:
    # Include the complete tracked patch tree, not just its images: JSON media
    # indexes and original rights notices are necessary for reconstruction.
    for prefix, layer in (("mobilegym_overlay/mobilegym-data/", "tracked_legacy_media_supplement"),
                          ("mobilegym/media_patch/", "tracked_media_patch"),
                          ("media_sources/overrides/", "future_overrides")):
        if name.startswith(prefix):
            return layer
    if not name.startswith("mobilegym/") or PurePosixPath(name).suffix.lower() not in IMAGE_EXTS:
        return None
    if name.startswith(("mobilegym/apps/", "mobilegym/system/")):
        return "tracked_app_and_system_assets"
    if name.startswith("mobilegym/public/"):
        return "tracked_public_images"
    return "tracked_shell_images"


def local_inventory(root: Path = ROOT, names: list[str] | None = None) -> dict:
    layers = {key: [] for key in ("tracked_app_and_system_assets", "tracked_shell_images",
        "tracked_public_images", "tracked_media_patch", "tracked_legacy_media_supplement", "future_overrides")}
    for name in tracked_names(root) if names is None else sorted(set(names)):
        # Preserve the immutable release manifest logical IDs after the rename.
        if name.startswith("foldmobilegym/"):
            name = "mobilegym/" + name[len("foldmobilegym/"):]
        layer = media_layer(name)
        if layer is None:
            continue
        file = checked_file(root, name)
        layers[layer].append({"path": name, "bytes": file.stat().st_size, "sha256": digest(file)})
    import json
    return {key: {"files": len(rows), "bytes": sum(row["bytes"] for row in rows),
                  "sha256": hashlib.sha256(json.dumps(rows, separators=(",", ":")).encode()).hexdigest(),
                  "entries": rows} for key, rows in layers.items()}
