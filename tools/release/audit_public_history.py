#!/usr/bin/env python3
"""Bounded, local-only history screening. Counts only; not a release clearance."""
import argparse
import collections
import json
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
LIMIT = 2 * 1024 * 1024
MEDIA = re.compile(r"(?i)\.(png|jpe?g|webp|gif|avif|ico|woff2?|ttf|otf|pdf|zip|gz|mp3|wav|mp4|mov|mkv|avi|webm|svg)$")
PATH_RULES = {
    "private_key_like": re.compile(r"(?i)(?:^|/)(?:id_rsa|id_ed25519|\.env(?:\.(?!example|sample|template)[^/]*)?|[^/]+\.(?:pem|p12|pfx|key|kdbx))$"),
    "video": re.compile(r"(?i)\.(?:mp4|mov|mkv|avi|webm)$"),
    "generated_or_private_directory": re.compile(r"(?i)(?:^|/)(?:artifacts|private|screenshots-private|node_modules|__pycache__)(?:/|$)"),
    "binary_installer_or_weights": re.compile(r"(?i)\.(?:msi|exe|dll|onnx|safetensors|pt|pth)$"),
}
CONTENT_RULES = {
    "private_key_header": re.compile(rb"-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----"),
    "github_token_shape": re.compile(rb"\b(?:ghp_[A-Za-z0-9]{36}|github_pat_[A-Za-z0-9_]{50,})\b"),
    "aws_access_id_shape": re.compile(rb"\b(?:AKIA|ASIA)[A-Z0-9]{16}\b"),
}


def audit(root: Path, ref: str) -> dict:
    if not re.fullmatch(r"[A-Za-z0-9_./-]+", ref) or ref.startswith('-') or '..' in ref:
        raise ValueError("Expected a plain local commit or ref name")
    git = ['git', '-C', str(root)]
    shallow = subprocess.check_output(git + ['rev-parse', '--is-shallow-repository'], text=True).strip()
    if shallow not in ('true', 'false'):
        raise RuntimeError('Unexpected git shallow repository response')
    commit = subprocess.check_output(git + ['rev-parse', '--verify', ref + '^{commit}'], text=True).strip()
    boundaries_with_parents = 0
    if shallow == 'true':
        shallow_path = Path(subprocess.check_output(git + ['rev-parse', '--git-path', 'shallow'], text=True).strip())
        if not shallow_path.is_absolute():
            shallow_path = root / shallow_path
        boundaries = set(shallow_path.read_text(encoding='ascii').splitlines())
        reachable = set(subprocess.check_output(git + ['rev-list', commit], text=True).splitlines())
        for boundary in boundaries & reachable:
            raw_commit = subprocess.check_output(git + ['cat-file', 'commit', boundary])
            headers = raw_commit.split(b'\n\n', 1)[0].splitlines()
            boundaries_with_parents += any(line.startswith(b'parent ') for line in headers)
    output = subprocess.check_output(git + ['rev-list', '--objects', commit]).decode('utf-8', 'replace')
    by_oid = collections.defaultdict(set)
    for row in output.splitlines():
        if ' ' in row:
            oid, name = row.split(' ', 1)
            by_oid[oid].add(name)
    names = {name for values in by_oid.values() for name in values}
    path_matches = {key: sum(bool(pattern.search(name)) for name in names) for key, pattern in PATH_RULES.items()}
    # rev-list --objects may emit only one path for several entries sharing an
    # object. Read the requested commit's complete tree separately using NUL
    # delimiters, so current filenames with newlines or shared blobs are counted.
    tree_output = subprocess.check_output(git + ['ls-tree', '-r', '-z', '--full-tree', commit])
    tree_names = []
    for record in tree_output.split(b'\0'):
        if not record:
            continue
        metadata, raw_name = record.split(b'\t', 1)
        _, kind, raw_oid = metadata.split(b' ')
        name = raw_name.decode('utf-8', 'replace')
        tree_names.append(name)
        oid = raw_oid.decode('ascii')
        if kind == b'blob' and oid in by_oid:
            by_oid[oid].add(name)
    tree_matches = {key: sum(bool(pattern.search(name)) for name in tree_names) for key, pattern in PATH_RULES.items()}
    # Raw commit diffs enumerate changed paths and their old/new object IDs.
    # Disable rename detection to retain both old and new paths; include the root,
    # all reachable merge parents and the current tree. A shallow checkout can
    # still omit older commits, so this is not a whole-repository clearance.
    history_output = subprocess.check_output(git + [
        'log', '--format=', '--raw', '-z', '--root', '--no-renames', '-m', '--full-history', '--no-abbrev', commit,
    ])
    history_names = set(tree_names)
    records = history_output.split(b'\0')
    if records[-1] != b'' or (len(records) - 1) % 2:
        raise RuntimeError('Unexpected NUL-delimited Git history output')
    for index in range(0, len(records) - 1, 2):
        header, raw_name = records[index:index + 2]
        fields = header.split(b' ')
        if len(fields) != 5 or not fields[0].startswith(b':') or not raw_name:
            raise RuntimeError('Unexpected raw Git history record')
        name = raw_name.decode('utf-8', 'replace')
        history_names.add(name)
        for raw_oid in fields[2:4]:
            oid = raw_oid.decode('ascii')
            if oid in by_oid:
                by_oid[oid].add(name)
    history_matches = {key: sum(bool(pattern.search(name)) for name in history_names) for key, pattern in PATH_RULES.items()}
    check = subprocess.run(git + ['cat-file', '--batch-check=%(objectname) %(objecttype) %(objectsize)'],
                           input=('\n'.join(by_oid) + '\n').encode(), stdout=subprocess.PIPE, check=True)
    chosen, skipped = [], collections.Counter()
    for row in check.stdout.decode('ascii').splitlines():
        oid, kind, size = row.split(); size = int(size)
        if kind != 'blob':
            continue
        if size > LIMIT:
            skipped['over_2MiB'] += 1
        elif all(MEDIA.search(name) for name in by_oid[oid]):
            skipped['media_or_font'] += 1
        else:
            chosen.append((oid, size))
    counts = {key: 0 for key in CONTENT_RULES}
    scanned = 0
    proc = subprocess.Popen(git + ['cat-file', '--batch'], stdin=subprocess.PIPE, stdout=subprocess.PIPE)
    try:
        for oid, size in chosen:
            proc.stdin.write((oid + '\n').encode()); proc.stdin.flush()
            header = proc.stdout.readline().split()
            if len(header) != 3 or header[0].decode() != oid or header[1] != b'blob' or int(header[2]) != size:
                raise RuntimeError('Unexpected git object response')
            content = proc.stdout.read(size)
            if len(content) != size or proc.stdout.read(1) != b'\n':
                raise RuntimeError('Truncated git object response')
            if b'\0' in content[:8192]:
                skipped['binary'] += 1
                continue
            scanned += 1
            for key, pattern in CONTENT_RULES.items():
                counts[key] += bool(pattern.search(content))
    finally:
        proc.stdin.close()
        proc.stdout.close()
        code = proc.wait()
    if code:
        raise RuntimeError('git cat-file failed')
    return {'commit': commit, 'ref': ref, 'is_shallow_repository': shallow == 'true',
            'reachable_shallow_boundaries_with_parents': boundaries_with_parents, 'unique_named_paths': len(names), 'path_matches': path_matches,
            'current_tree_paths': len(tree_names), 'current_tree_path_matches': tree_matches,
            'history_diff_paths': len(history_names), 'history_diff_path_matches': history_matches,
            'text_blobs_scanned': scanned, 'text_blob_matches': counts, 'skipped_blobs': dict(skipped),
            'scope': 'Current tree and changed paths in locally reachable commit diffs, plus reachable named objects; shallow boundaries can truncate history. Object-name counts can omit shared-object paths. This limited screen is not privacy, rights, asset or secret clearance. Values and paths are not printed.'}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--ref', default='HEAD', help='Existing local commit/ref; default HEAD')
    args = parser.parse_args()
    print(json.dumps(audit(ROOT, args.ref), ensure_ascii=True))


if __name__ == '__main__':
    main()
