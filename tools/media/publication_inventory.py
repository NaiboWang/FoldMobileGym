"""Tracked showcase inventory only; never downloads media or grants clearance."""
from __future__ import annotations
import argparse
import hashlib
import ipaddress
import json
import re
import subprocess
from pathlib import Path
from urllib.parse import unquote, urlsplit
from media_inventory import ROOT, checked_file, digest, safe_name, tracked_names, IMAGE_EXTS

OUTPUT = 'media_sources/publication-inventory.json'
GENERATOR = 'tools/media/publication_inventory.py'
LINK = re.compile(r'!?\[[^\]\n]*\]\(([^)\n]+)\)')


def text_digest(file):
    return hashlib.sha256(file.read_bytes().replace(b'\r\n', b'\n')).hexdigest()


def json_digest(value):
    return hashlib.sha256(json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(',', ':')).encode('utf-8')).hexdigest()


def authority(value):
    """Keep host/port only; do not copy URL credentials, paths or queries."""
    try:
        parsed = urlsplit('https://' + value)
        host = parsed.hostname or ''
        port = parsed.port
        if not host or '/' in value or '?' in value or '#' in value:
            return 'invalid', '<invalid authority>'
        host = host.lower()
        try:
            address = ipaddress.ip_address(host)
        except ValueError:
            address = None
        if host == 'localhost' or address and address.is_loopback:
            category = 'loopback'
        elif address and not address.is_global or '.' not in host:
            return 'redacted', '<nonpublic authority>'
        else:
            category = 'non_loopback'
        label = ('[' + host + ']') if ':' in host else host
        return category, label + (':' + str(port) if port is not None else '')
    except (ValueError, TypeError):
        return 'invalid', '<invalid authority>'


def demo_identity(url):
    parsed = urlsplit(url)
    if parsed.hostname != 'github.com':
        return None
    parts = parsed.path.strip('/').split('/')
    if len(parts) != 6 or parts[2:4] != ['releases', 'download']:
        return None
    owner, repo, _, _, tag, filename = map(unquote, parts)
    if not all(safe_name(value) and '/' not in value for value in (owner, repo, tag, filename)):
        raise RuntimeError('Unsafe demo reference')
    return owner.lower() + '/' + repo.lower(), tag, filename


def build_inventory(root: Path, names=None):
    names = set(tracked_names(root) if names is None else names)
    manifest_path = checked_file(root, 'media_sources/manifest.json')
    manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
    references, readmes, demo_names, demo_refs = {}, [], set(), set()
    unsupported_demos = 0
    remote_images = 0
    for name in ('README.md', 'README.en.md'):
        if name not in names:
            continue
        file = checked_file(root, name)
        text = file.read_text(encoding='utf-8')
        readmes.append({'path': name, 'text_sha256_lf': text_digest(file)})
        for match in LINK.finditer(text):
            target = match.group(1).strip()
            if not target:
                raise RuntimeError('Empty Markdown target')
            target = target[1:target.find('>')] if target.startswith('<') and '>' in target else target.split()[0]
            parsed = urlsplit(target)
            is_image = match.group(0).startswith('!')
            if parsed.scheme in ('http', 'https'):
                if parsed.username is not None or parsed.password is not None:
                    raise RuntimeError('Credentials in a published Markdown URL')
                if is_image:
                    remote_images += 1
                if Path(parsed.path).suffix.lower() == '.mp4':
                    filename = unquote(Path(parsed.path).name)
                    if not safe_name(filename) or '/' in filename:
                        raise RuntimeError('Unsafe demo filename')
                    demo_names.add(filename)
                    identity = demo_identity(target)
                    if identity is None:
                        unsupported_demos += 1
                    else:
                        demo_refs.add(identity)
                continue
            if not is_image or parsed.scheme:
                continue
            local = unquote(parsed.path)
            if not safe_name(local) or local not in names:
                raise RuntimeError('README image must be a safe tracked local file')
            checked_file(root, local)
            references.setdefault(local, set()).add(name)
    candidates = sorted(name for name in names if name.startswith('media_sources/readme-screenshots/') and Path(name).suffix.lower() in IMAGE_EXTS)
    assets = []
    for name in sorted(set(candidates) | set(references)):
        file = checked_file(root, name)
        assets.append({'path': name, 'bytes': file.stat().st_size, 'sha256': digest(file), 'referenced_by': sorted(references.get(name, set())), 'review_required': ['capture_provenance', 'privacy', 'rights']})
    authorities = []
    for row in manifest.get('external_image_hosts', []):
        if not isinstance(row.get('count'), int) or isinstance(row['count'], bool) or row['count'] < 0:
            raise RuntimeError('Invalid URL occurrence count')
        category, label = authority(row.get('host'))
        authorities.append({'authority': label, 'category': category, 'recorded_occurrences': row['count']})
    layers = {name: {field: value[field] for field in ('files', 'bytes', 'sha256')} for name, value in manifest['local_layers'].items()}
    receipts, receipt_refs = [], set()
    for record_path in ('media_sources/simulator-release.json', 'media_sources/showcase-release.json'):
        if record_path not in names:
            continue
        record_file = checked_file(root, record_path)
        record = json.loads(record_file.read_text(encoding='utf-8'))
        release = record.get('release', {})
        repo = record.get('repository', '').removeprefix('https://github.com/').strip('/').lower()
        tag, asset = release.get('tag'), release.get('asset_name')
        if isinstance(tag, str) and isinstance(asset, str) and repo:
            receipt_refs.add((repo, tag, asset))
        receipts.append({'path': record_path, 'canonical_json_sha256': json_digest(record), 'recorded_asset_name': asset})
    return {'schema_version': 1, 'generated_by': GENERATOR,
            'scope': 'Tracked paths read from this worktree. Presence/hash/reference inventory only; no network, pixel, history or rights audit.',
            'public_clearance': 'not_assessed', 'input_media_manifest_sha256': digest(manifest_path),
            'readmes': readmes, 'showcase_assets': assets, 'remote_readme_image_references': remote_images,
            'pinned_media_snapshot_layers': layers,
            'recorded_source_url_authorities': sorted(authorities, key=lambda row: (row['category'], row['authority'])),
            'source_url_scope': 'Occurrences from the pinned manifest, not live requests, active-app reachability or a fresh source scan. Loopback examples are separate.',
            'demo': {'readme_filenames': sorted(demo_names), 'local_receipts': receipts,
                     'unsupported_remote_demo_references': unsupported_demos,
                     'readme_links_have_matching_local_receipt': (unsupported_demos == 0 and demo_refs <= receipt_refs) if demo_names else None,
                     'network_or_media_content_verified': False}}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, default=ROOT)
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument('--write', action='store_true', help='Regenerate the tool-owned inventory, not a review decision')
    mode.add_argument('--check', action='store_true', help='Fail if the committed inventory differs from the current inputs')
    args = parser.parse_args()
    try:
        result = build_inventory(args.root)
        output = args.root / OUTPUT
        if args.check:
            if json.loads(checked_file(args.root, OUTPUT).read_text(encoding='utf-8')) != result:
                raise RuntimeError('Publication inventory is stale; regenerate and review the changed inputs')
        elif args.write:
            try:
                output.lstat()
                exists = True
            except FileNotFoundError:
                exists = False
            if exists:
                existing = json.loads(checked_file(args.root, OUTPUT).read_text(encoding='utf-8'))
                if existing.get('generated_by') != GENERATOR:
                    raise RuntimeError('Refusing to overwrite a file not owned by this generator')
            output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n', encoding='utf-8', newline='\n')
        print(json.dumps({'inventory_valid': True, 'record_matches_inputs': True if args.check else None,
                          'showcase_assets': len(result['showcase_assets']), 'readme_local_images': sum(bool(row['referenced_by']) for row in result['showcase_assets']),
                          'recorded_url_authority_rows': len(result['recorded_source_url_authorities']),
                          'demo_receipt_matches': result['demo']['readme_links_have_matching_local_receipt'],
                          'public_clearance': 'not_assessed', 'scope': result['scope']}))
    except (OSError, ValueError, RuntimeError, KeyError, TypeError, subprocess.CalledProcessError) as error:
        print(json.dumps({'inventory_valid': False, 'error': str(error), 'public_clearance': 'not_assessed'}))
        raise SystemExit(1)


if __name__ == '__main__':
    main()
