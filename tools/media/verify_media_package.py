#!/usr/bin/env python3
"""Verify release SHA-256 and every indexed archive member without extracting."""
import argparse
import json
from pathlib import Path
from build_media_package import verify_archive
from media_inventory import ROOT


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("archive", type=Path)
    parser.add_argument("--release-record", type=Path, default=ROOT / "media_sources" / "supplement-release.json")
    args = parser.parse_args()
    release = json.loads(args.release_record.read_text(encoding="utf-8"))
    if release.get("kind") == "project-standalone-local-media":
        from standalone_media import scan
        report = scan(args.archive, release)
    else:
        report = verify_archive(args.archive, release)
    print(json.dumps(report))


if __name__ == "__main__":
    main()
