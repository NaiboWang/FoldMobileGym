#!/usr/bin/env python3
"""Install the standalone local-media release without downloading the upstream archive."""
import argparse
import json
import sys
from pathlib import Path
from media_inventory import ROOT
from standalone_media import install


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--archive", type=Path, required=True, help="Downloaded full .tar.gz; not the old supplement")
    parser.add_argument("--root", type=Path, default=ROOT, help="Code checkout to populate; never overwrites differing files")
    parser.add_argument("--release-record", type=Path, default=ROOT / "media_sources/standalone-release.json")
    parser.add_argument("--check-only", action="store_true")
    args = parser.parse_args()
    release = json.loads(args.release_record.read_text(encoding="utf-8"))
    def progress(phase, current, total):
        print(f"[media] {phase}: {current}/{total}", file=sys.stderr, flush=True)
    print(json.dumps(install(args.archive, args.root, release, args.check_only, progress=progress)))


if __name__ == "__main__":
    main()
