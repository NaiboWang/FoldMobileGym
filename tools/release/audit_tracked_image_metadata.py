#!/usr/bin/env python3
"""Read-only image-metadata triage for one Git tree; never prints metadata values."""
from __future__ import annotations

import argparse
import collections
import io
import json
import math
import os
import re
import struct
import subprocess
import warnings
from pathlib import Path

try:
    from PIL import Image, UnidentifiedImageError
except ImportError as error:
    raise SystemExit('Pillow is required; install the project benchmark dependencies or Pillow separately.') from error

ROOT = Path(__file__).resolve().parents[2]
RASTER = re.compile(r'(?i)\.(?:jpe?g|png|webp|gif|tiff?|avif|bmp)$')
MAX_BYTES = 64 * 1024 * 1024
XMP_MARKERS = (b'gpslatitude', b'gpslongitude', b'exif:gps', b'photoshop:city', b'photoshop:country')
IMAGE_ERRORS = (UnidentifiedImageError, OSError, ValueError, TypeError, SyntaxError, EOFError, IndexError, KeyError,
                OverflowError, ZeroDivisionError, struct.error, Warning, Image.DecompressionBombError)


def coordinates_present(gps: dict) -> bool:
    def reference(value, allowed):
        if isinstance(value, bytes):
            value = value.decode('ascii', 'ignore')
        return isinstance(value, str) and value.strip('\x00 ').upper() in allowed

    def angle(value, maximum):
        try:
            if len(value) != 3:
                return False
            degrees, minutes, seconds = (float(part) for part in value)
            return (all(math.isfinite(x) for x in (degrees, minutes, seconds))
                    and 0 <= degrees <= maximum and 0 <= minutes < 60 and 0 <= seconds < 60
                    and (degrees < maximum or (minutes == 0 and seconds == 0)))
        except (TypeError, ValueError, ZeroDivisionError, OverflowError):
            return False

    return (reference(gps.get(1), {'N', 'S'}) and reference(gps.get(3), {'E', 'W'})
            and angle(gps.get(2), 90) and angle(gps.get(4), 180))


def inspect_image_metadata(data: bytes) -> tuple[bool, bool, bool]:
    """Return only presence flags. Parser warnings are unresolved, never printed."""
    with warnings.catch_warnings():
        warnings.simplefilter('error')
        with Image.open(io.BytesIO(data)) as image:
            exif = image.getexif()
            has_gps_tag = 34853 in exif
            gps = exif.get_ifd(34853) if has_gps_tag else {}
            xmp = image.info.get('xmp') or image.info.get('XML:com.adobe.xmp') or b''
            if isinstance(xmp, str):
                xmp = xmp.encode('utf-8')
            if not isinstance(xmp, bytes):
                raise ValueError('Unsupported XMP representation')
            return has_gps_tag, coordinates_present(gps), any(marker in xmp.lower() for marker in XMP_MARKERS)


def audit(root: Path, ref: str, *, include_history: bool = False) -> dict:
    if not re.fullmatch(r'[A-Za-z0-9_./-]+', ref) or ref.startswith('-') or '..' in ref:
        raise ValueError('Expected a plain local commit or ref name')
    git = ['git', '-C', str(root)]
    git_env = {**os.environ, 'GIT_NO_LAZY_FETCH': '1', 'GIT_TERMINAL_PROMPT': '0'}
    commit = subprocess.check_output(git + ['rev-parse', '--verify', ref + '^{commit}'], text=True, env=git_env).strip()
    tree = subprocess.check_output(git + ['ls-tree', '-r', '-z', '--full-tree', commit], env=git_env)
    objects: dict[str, set[str]] = {}
    for record in tree.split(b'\0'):
        if not record:
            continue
        metadata, raw_name = record.split(b'\t', 1)
        _, kind, raw_oid = metadata.split()
        name = raw_name.decode('utf-8', 'replace')
        if kind != b'blob' or not RASTER.search(name):
            continue
        oid = raw_oid.decode('ascii')
        objects.setdefault(oid, set()).add(name)

    if include_history:
        # Diff both parents of merges and disable rename detection so historical
        # path/object pairs are retained even when an image is removed or renamed.
        history = subprocess.check_output(git + [
            'log', '--format=', '--raw', '-z', '--root', '--no-renames', '-m',
            '--full-history', '--no-abbrev', commit,
        ], env=git_env)
        records = history.split(b'\0')
        if records[-1] != b'' or (len(records) - 1) % 2:
            raise RuntimeError('Unexpected Git history output')
        for index in range(0, len(records) - 1, 2):
            header, raw_name = records[index:index + 2]
            fields = header.split(b' ')
            if len(fields) != 5 or not fields[0].startswith(b':') or not raw_name:
                raise RuntimeError('Unexpected Git history record')
            name = raw_name.decode('utf-8', 'replace')
            if not RASTER.search(name):
                continue
            for mode, raw_oid in ((fields[0][1:], fields[2]), (fields[1], fields[3])):
                if mode in (b'100644', b'100755', b'120000') and any(ch != 48 for ch in raw_oid):
                    objects.setdefault(raw_oid.decode('ascii'), set()).add(name)

    suffix = 'path_versions' if include_history else 'paths'
    count_key = lambda prefix: f'{prefix}_{suffix}'
    counts = collections.Counter({
        ('candidate_path_versions' if include_history else 'tracked_paths'): sum(len(paths) for paths in objects.values()),
        'distinct_objects': len(objects), count_key('readable'): 0, count_key('empty'): 0,
        count_key('over_limit'): 0, count_key('unreadable'): 0, count_key('missing'): 0,
        count_key('gps_tag'): 0, count_key('gps_coordinate_pair'): 0,
        count_key('xmp_location_marker'): 0,
        'gps_tag_objects': 0, 'gps_coordinate_pair_objects': 0, 'xmp_location_marker_objects': 0,
    })
    if include_history:
        counts['candidate_paths'] = len({name for paths in objects.values() for name in paths})

    # Check object sizes first so oversized objects are never streamed into memory.
    lines = []
    if objects:
        batch = subprocess.run(git + ['cat-file', '--batch-check=%(objectname) %(objecttype) %(objectsize)'],
                               input=('\n'.join(objects) + '\n').encode('ascii'), stdout=subprocess.PIPE,
                               check=True, env=git_env)
        lines = batch.stdout.splitlines()
    if len(lines) != len(objects):
        raise RuntimeError('Unexpected Git object count')
    sizes = {}
    for oid, line in zip(objects, lines):
        fields = line.split()
        if len(fields) == 2 and fields[0].decode('ascii') == oid and fields[1] == b'missing':
            counts[count_key('missing')] += len(objects[oid])
            continue
        if len(fields) != 3 or fields[0].decode('ascii') != oid or fields[1] != b'blob':
            raise RuntimeError('Unexpected Git object metadata')
        sizes[oid] = int(fields[2])
    proc = subprocess.Popen(git + ['cat-file', '--batch'], stdin=subprocess.PIPE, stdout=subprocess.PIPE, env=git_env)
    try:
        for oid, size in sizes.items():
            paths = len(objects[oid])
            if not size:
                counts[count_key('empty')] += paths
                continue
            if size > MAX_BYTES:
                counts[count_key('over_limit')] += paths
                continue
            proc.stdin.write((oid + '\n').encode('ascii'))
            proc.stdin.flush()
            header = proc.stdout.readline().split()
            if len(header) != 3 or header[0].decode('ascii') != oid or header[1] != b'blob' or int(header[2]) != size:
                raise RuntimeError('Unexpected Git object response')
            data = proc.stdout.read(size)
            if len(data) != size or proc.stdout.read(1) != b'\n':
                raise RuntimeError('Truncated Git object')
            try:
                has_gps_tag, has_coordinates, has_xmp_location = inspect_image_metadata(data)
                counts[count_key('readable')] += paths
                counts[count_key('gps_tag')] += paths * has_gps_tag
                counts[count_key('gps_coordinate_pair')] += paths * has_coordinates
                counts[count_key('xmp_location_marker')] += paths * has_xmp_location
                counts['gps_tag_objects'] += has_gps_tag
                counts['gps_coordinate_pair_objects'] += has_coordinates
                counts['xmp_location_marker_objects'] += has_xmp_location
            except IMAGE_ERRORS:
                counts[count_key('unreadable')] += paths
    finally:
        proc.stdin.close()
        proc.stdout.close()
        code = proc.wait()
    if code:
        raise RuntimeError('git cat-file failed')
    shallow = subprocess.check_output(git + ['rev-parse', '--is-shallow-repository'], text=True, env=git_env).strip()
    if shallow not in ('true', 'false'):
        raise RuntimeError('Unexpected Git shallow repository response')
    return {
        'scan_completed': True, 'commit': commit, 'ref': ref, 'counts': dict(counts),
        'mode': 'reachable_history' if include_history else 'current_tree',
        'shallow_repository': shallow == 'true',
        'public_clearance': 'not_assessed',
        'scope': ('Selected raster headers/metadata in the current tree and locally reachable historical changes; shallow clones may truncate history. '
                  if include_history else 'Current tracked raster headers/metadata only. ')
                 + 'Selected EXIF GPS/XMP markers, no metadata values or paths. Not image-integrity, media package, image-content, privacy or rights clearance.',
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--ref', default='HEAD', help='Existing local commit or ref; default HEAD')
    parser.add_argument('--history', action='store_true', help='Also scan locally reachable historical image versions')
    args = parser.parse_args()
    try:
        print(json.dumps(audit(ROOT, args.ref, include_history=args.history), ensure_ascii=True))
    except (OSError, ValueError, RuntimeError, subprocess.CalledProcessError):
        # Do not echo Git errors or path/metadata values from potentially private inputs.
        print(json.dumps({'scan_completed': False, 'error': 'Could not inspect selected Git tree', 'public_clearance': 'not_assessed'}))
        raise SystemExit(1)


if __name__ == '__main__':
    main()
