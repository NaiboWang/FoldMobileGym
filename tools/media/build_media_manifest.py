#!/usr/bin/env python3
"""Audit FoldAgent GUI image sources without downloading third-party media."""
from __future__ import annotations
import json
import re
from collections import defaultdict
from pathlib import Path
from urllib.parse import urlparse
import sys
from media_inventory import local_inventory, tracked_names, checked_file, checkout_name, IMAGE_EXTS
sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from tools.data.prepare_data import SIZE, SHA256, URL

ROOT = Path(__file__).resolve().parents[2]
PROJECT = ROOT / checkout_name(ROOT, "mobilegym/")
OUT = ROOT / "media_sources" / "manifest.json"
REMOTE_IMAGE_HOSTS = {
    "api.dicebear.com": "avatar-generation service",
    "pbs.twimg.com": "X/Twitter user media",
    "video.twimg.com": "X/Twitter video media",
    "i.redd.it": "Reddit post media",
    "preview.redd.it": "Reddit preview media",
    "external-preview.redd.it": "Reddit preview media",
    "images.unsplash.com": "Unsplash stock media",
    "sns-avatar-qc.xhscdn.com": "Xiaohongshu avatar media",
}
URL_RE = re.compile(r"https?://[^\s\"'<>`\\]+")
TEXT_SUFFIXES = {".ts", ".tsx", ".js", ".mjs", ".json", ".css", ".html", ".py"}

def source_files():
    for name in tracked_names(ROOT):
        if name.startswith("foldmobilegym/"):
            name = "mobilegym/" + name[len("foldmobilegym/"):]
        if not name.startswith(("mobilegym/apps/", "mobilegym/system/", "mobilegym/public/", "mobilegym/os/", "mobilegym/web/")):
            continue
        if Path(name).suffix.lower() in TEXT_SUFFIXES:
            yield checked_file(ROOT, name)

def main() -> None:
    snapshot = json.loads((PROJECT / "DATA_SNAPSHOT.json").read_text(encoding="utf-8"))
    external = defaultdict(lambda: {"count": 0, "examples": set(), "files": set(), "classification": "unclassified"})
    for file in source_files():
        try:
            text = file.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            continue
        for raw in URL_RE.findall(text):
            raw = raw.rstrip(".,;)]}")
            try:
                parsed = urlparse(raw)
            except ValueError:
                continue
            host = parsed.netloc.lower()
            if not host:
                continue
            if host not in REMOTE_IMAGE_HOSTS and Path(parsed.path.lower()).suffix not in IMAGE_EXTS:
                continue
            row = external[host]
            row["count"] += 1
            row["examples"].add(raw[:500])
            row["files"].add(file.relative_to(ROOT).as_posix())
            row["classification"] = REMOTE_IMAGE_HOSTS.get(host, "external image URL")
    external_rows = []
    for host, row in sorted(external.items(), key=lambda item: (-item[1]["count"], item[0])):
        external_rows.append({"host": host, "count": row["count"], "classification": row["classification"], "files": sorted(row["files"]), "examples": sorted(row["examples"])[:8], "downloaded": False, "reason": "third-party provenance/redistribution or availability is not established"})
    local_roots = local_inventory(ROOT)
    payload = {
        "schema_version": 2,
        "generated_by": "tools/media/build_media_manifest.py",
        "policy": {"external_images_downloaded": False, "upstream_data_embedded_in_git": False, "future_override_directory": "media_sources/overrides", "local_inventory": "git-tracked-only", "usage_scope": "conservative bundled inventory, not per-screen minimal reachability"},
        "upstream": {"release": snapshot["release"], "archive_bytes": SIZE, "archive_sha256": SHA256, "archive_url": URL, "runtime_bytes": snapshot["bytes"], "required_files": len(snapshot["files"]), "runtime_directory": "mobilegym/mobilegym-data"},
        "local_layers": local_roots,
        "external_image_hosts": external_rows,
    }
    OUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"passed": True, "output": str(OUT), "external_hosts": len(external_rows), "upstream_files": len(snapshot["files"]), "local_layers": {key: value["files"] for key, value in local_roots.items()}}, ensure_ascii=False))

if __name__ == "__main__":
    main()
