#!/usr/bin/env python3
"""Verify a pinned media archive and count selected image metadata; no extraction."""
from __future__ import annotations

import argparse
import collections
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'tools' / 'media'))
sys.path.insert(0, str(ROOT / 'tools' / 'release'))
from standalone_media import scan  # noqa: E402
from media_inventory import checked_file  # noqa: E402
from audit_tracked_image_metadata import IMAGE_ERRORS, MAX_BYTES, RASTER, inspect_image_metadata  # noqa: E402


def audit(archive: Path, release: dict, *, progress=None) -> dict:
    if not isinstance(release, dict) or not release.get('sha256') or not release.get('bytes'):
        raise ValueError('A pinned release record is required')
    selected = {}
    counts = collections.Counter({
        'raster_paths': 0, 'raster_objects': 0, 'readable_paths': 0, 'empty_paths': 0,
        'over_limit_paths': 0, 'unreadable_paths': 0, 'gps_tag_paths': 0,
        'gps_coordinate_pair_paths': 0, 'xmp_location_marker_paths': 0,
        'gps_tag_objects': 0, 'gps_coordinate_pair_objects': 0, 'xmp_location_marker_objects': 0,
    })

    def prepare(_index, records):
        for row in records.values():
            if RASTER.search(row['path']):
                entry = selected.setdefault(row['sha256'], {'bytes': row['bytes'], 'paths': 0})
                if entry['bytes'] != row['bytes']:
                    raise RuntimeError('Inconsistent indexed payload size')
                entry['paths'] += 1
        counts['raster_paths'] = sum(entry['paths'] for entry in selected.values())
        counts['raster_objects'] = len(selected)

    def consume(sha, stream, checksum):
        entry = selected.get(sha)
        buffer = bytearray() if entry and 0 < entry['bytes'] <= MAX_BYTES else None
        while block := stream.read(1024 * 1024):
            checksum.update(block)
            if buffer is not None:
                buffer.extend(block)
        if not entry:
            return
        paths = entry['paths']
        if not entry['bytes']:
            counts['empty_paths'] += paths
            return
        if entry['bytes'] > MAX_BYTES:
            counts['over_limit_paths'] += paths
            return
        try:
            has_tag, has_coordinates, has_xmp = inspect_image_metadata(buffer)
            counts['readable_paths'] += paths
            counts['gps_tag_paths'] += paths * has_tag
            counts['gps_coordinate_pair_paths'] += paths * has_coordinates
            counts['xmp_location_marker_paths'] += paths * has_xmp
            counts['gps_tag_objects'] += has_tag
            counts['gps_coordinate_pair_objects'] += has_coordinates
            counts['xmp_location_marker_objects'] += has_xmp
        except IMAGE_ERRORS:
            counts['unreadable_paths'] += paths

    report = scan(archive, release=release, prepare=prepare, consume=consume, progress=progress)
    if not report.get('passed'):
        raise RuntimeError('Archive verification did not complete')
    if counts['raster_paths'] != sum(counts[key] for key in ('readable_paths', 'empty_paths', 'over_limit_paths', 'unreadable_paths')):
        raise RuntimeError('Incomplete raster accounting')
    return {
        'scan_completed': True, 'archive_verified': True, 'archive_sha256': release['sha256'],
        'indexed_targets': report['files'], 'verified_payloads': report['payloads'],
        'counts': dict(counts), 'public_clearance': 'not_assessed',
        'scope': 'Verified pinned archive raster headers/metadata only; no extracted files, paths, coordinates or metadata values. Not image-integrity, image-content, history, privacy or rights clearance.',
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--archive', type=Path, required=True, help='Local archive matching the checked-in standalone release record')
    args = parser.parse_args()
    try:
        release = json.loads(checked_file(ROOT, 'media_sources/standalone-release.json').read_text(encoding='utf-8'))
        def progress(stage, done, total):
            print(f'[media] {stage}: {done}/{total}', file=sys.stderr, flush=True)
        print(json.dumps(audit(args.archive, release, progress=progress), ensure_ascii=True))
    except (OSError, ValueError, RuntimeError, KeyError):
        print(json.dumps({'scan_completed': False, 'archive_verified': False,
                          'error': 'Archive verification or metadata inspection failed', 'public_clearance': 'not_assessed'}))
        raise SystemExit(1)


if __name__ == '__main__':
    main()
