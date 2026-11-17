import json
import subprocess
import tempfile
import unittest
from pathlib import Path
from publication_inventory import build_inventory, authority, demo_identity, text_digest


class PublicationInventoryTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.names = []
        self.put('media_sources/manifest.json', json.dumps({
            'local_layers': {'pinned': {'files': 1, 'bytes': 3, 'sha256': 'a' * 64}},
            'external_image_hosts': [{'host': 'images.example.org', 'count': 4}, {'host': 'localhost:3000', 'count': 2}],
        }))
        self.put('media_sources/readme-screenshots/first.png', b'local fixture image bytes')
        self.put('media_sources/readme-screenshots/unused.png', b'unreferenced tracked fixture')
        self.put('README.md', '![Example](media_sources/readme-screenshots/first.png)\n[Video](https://github.com/owner/repo/releases/download/v1/current.mp4)\n')

    def put(self, name, value, tracked=True):
        file = self.root / name
        file.parent.mkdir(parents=True, exist_ok=True)
        file.write_bytes(value if isinstance(value, bytes) else value.encode('utf-8'))
        if tracked and name not in self.names:
            self.names.append(name)
        return file

    def build(self):
        return build_inventory(self.root, self.names)

    def test_tracks_exact_bytes_references_and_unreferenced_showcase_without_untracked_files(self):
        self.put('media_sources/readme-screenshots/private-local.png', b'not part of Git', tracked=False)
        result = self.build()
        self.assertEqual(len(result['showcase_assets']), 2)
        first, unused = result['showcase_assets']
        self.assertEqual(first['referenced_by'], ['README.md'])
        self.assertEqual(unused['referenced_by'], [])
        self.assertEqual(first['review_required'], ['capture_provenance', 'privacy', 'rights'])
        self.assertEqual(result['public_clearance'], 'not_assessed')
        before = first['sha256']
        self.put(first['path'], b'changed image')
        self.assertNotEqual(self.build()['showcase_assets'][0]['sha256'], before)

    def test_missing_untracked_or_escaping_readme_images_fail(self):
        for target in ['missing.png', '../outside.png', 'media_sources/readme-screenshots/untracked.png']:
            self.put('README.md', f'![Example]({target})')
            with self.assertRaises(RuntimeError):
                self.build()

    def test_handles_research_without_standalone_release_record(self):
        self.put('README.md', '![Example](media_sources/readme-screenshots/first.png)')
        result = self.build()
        self.assertEqual(result['demo']['local_receipts'], [])
        self.assertIsNone(result['demo']['readme_links_have_matching_local_receipt'])

    def test_old_receipt_does_not_clear_new_demo_link_and_new_receipt_must_match_repo_tag_and_name(self):
        self.put('media_sources/simulator-release.json', json.dumps({'repository': 'https://github.com/owner/repo', 'release': {'tag': 'v1', 'asset_name': 'old.mp4'}}))
        self.assertFalse(self.build()['demo']['readme_links_have_matching_local_receipt'])
        for repo, tag, expected in [('owner/wrong', 'v1', False), ('owner/repo', 'v0', False), ('owner/repo', 'v1', True)]:
            self.put('media_sources/showcase-release.json', json.dumps({'repository': 'https://github.com/' + repo, 'release': {'tag': tag, 'asset_name': 'current.mp4'}}))
            self.assertEqual(self.build()['demo']['readme_links_have_matching_local_receipt'], expected)
        self.assertFalse(self.build()['demo']['network_or_media_content_verified'])

    def test_url_credentials_and_queries_are_not_copied_from_authority_records(self):
        category, label = authority('user:do-not-copy@images.example.org')
        self.assertEqual((category, label), ('non_loopback', 'images.example.org'))
        self.assertEqual(authority('localhost:3000'), ('loopback', 'localhost:3000'))
        self.assertEqual(authority('[::1]:80')[0], 'loopback')
        self.assertEqual(authority('192.168.10.20')[0], 'redacted')
        self.assertEqual(authority('host.example:bad-port')[0], 'invalid')
        self.assertNotIn('do-not-copy', json.dumps(authority('user:do-not-copy@images.example.org')))
        self.assertEqual(demo_identity('https://github.com/owner/repo/releases/download/v1/current.mp4?access=do-not-copy'), ('owner/repo', 'v1', 'current.mp4'))
        self.put('README.md', '[Video](https://user:do-not-copy@github.com/owner/repo/releases/download/v1/current.mp4)')
        with self.assertRaises(RuntimeError):
            self.build()

    def test_text_and_receipt_hashes_are_portable_across_crlf_checkouts(self):
        readme = self.root / 'README.md'
        before = text_digest(readme)
        readme.write_bytes(readme.read_bytes().replace(b'\n', b'\r\n'))
        self.assertEqual(text_digest(readme), before)
        record = self.put('media_sources/showcase-release.json', '{"repository":"owner/repo","release":{"tag":"v1","asset_name":"current.mp4"}}\n')
        first = self.build()['demo']['local_receipts'][0]['canonical_json_sha256']
        record.write_bytes(record.read_bytes().replace(b'\n', b'\r\n'))
        self.assertEqual(self.build()['demo']['local_receipts'][0]['canonical_json_sha256'], first)

    def test_rejects_symlinked_showcase_input(self):
        outside = self.put('not-for-publication.png', b'private fixture', tracked=False)
        link = self.root / 'media_sources/readme-screenshots/linked.png'
        try:
            link.symlink_to(outside)
        except OSError:
            self.skipTest('Host does not permit creating symlinks')
        self.names.append('media_sources/readme-screenshots/linked.png')
        with self.assertRaises(RuntimeError):
            self.build()

    def test_repository_write_and_check_refuse_foreign_output_and_detect_changed_inputs(self):
        subprocess.run(['git', 'init', '-q', str(self.root)], check=True, capture_output=True)
        subprocess.run(['git', '-C', str(self.root), 'add', '.'], check=True, capture_output=True)
        script = Path(__file__).with_name('publication_inventory.py')
        import sys
        def run(*args):
            return subprocess.run([sys.executable, str(script), '--root', str(self.root), *args], capture_output=True, text=True)
        self.put('media_sources/publication-inventory.json', '{"generated_by":"not-this-tool"}', tracked=False)
        self.assertNotEqual(run('--write').returncode, 0)
        self.put('media_sources/publication-inventory.json', '{"generated_by":"tools/media/publication_inventory.py"}', tracked=False)
        self.assertEqual(run('--write').returncode, 0)
        self.assertNotIn(b'\r\n', (self.root / 'media_sources/publication-inventory.json').read_bytes())
        self.assertEqual(run('--check').returncode, 0)
        self.put('media_sources/readme-screenshots/first.png', b'changed')
        self.assertNotEqual(run('--check').returncode, 0)


if __name__ == '__main__':
    unittest.main()
