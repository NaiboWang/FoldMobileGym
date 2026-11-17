import contextlib
import importlib.util
import io
import json
import subprocess
import tempfile
import unittest
from pathlib import Path

spec = importlib.util.spec_from_file_location('audit_public_history', Path(__file__).with_name('audit_public_history.py'))
audit = importlib.util.module_from_spec(spec)
spec.loader.exec_module(audit)


class AuditHistoryTests(unittest.TestCase):
    def git(self, root, *args):
        return subprocess.run(['git', '-C', str(root), *args], check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)

    def test_reachable_deleted_files_and_secrets_are_counted_without_exposing_values(self):
        with tempfile.TemporaryDirectory(prefix='foldmobile-history-screen-') as tmp:
            root = Path(tmp)
            self.git(root, 'init', '-q')
            self.git(root, 'config', 'user.name', 'Synthetic Test')
            self.git(root, 'config', 'user.email', 'synthetic@example.invalid')
            secret = 'ghp_' + 'A' * 36
            (root / 'settings.txt').write_text('example ' + secret, encoding='utf-8')
            (root / '.env').write_text('synthetic', encoding='utf-8')
            (root / 'clip.mp4').write_bytes(b'synthetic video')
            self.git(root, 'add', '--', 'settings.txt', '.env', 'clip.mp4')
            self.git(root, 'commit', '-qm', 'synthetic first')
            (root / 'settings.txt').write_text('removed secret', encoding='utf-8')
            self.git(root, 'rm', '-q', '--', '.env', 'clip.mp4')
            self.git(root, 'add', '--', 'settings.txt')
            self.git(root, 'commit', '-qm', 'synthetic second')
            result = audit.audit(root, 'HEAD')
            self.assertFalse(result['is_shallow_repository'])
            self.assertEqual(result['reachable_shallow_boundaries_with_parents'], 0)
            self.assertEqual(result['path_matches']['private_key_like'], 1)
            self.assertEqual(result['path_matches']['video'], 1)
            self.assertEqual(result['text_blob_matches']['github_token_shape'], 1)
            rendered = json.dumps(result)
            self.assertNotIn(secret, rendered)
            self.assertNotIn('settings.txt', rendered)
            self.assertGreaterEqual(result['skipped_blobs']['media_or_font'], 1)

    def test_shallow_clone_reports_incomplete_history(self):
        with tempfile.TemporaryDirectory(prefix='foldmobile-shallow-screen-') as tmp:
            root = Path(tmp) / 'source'
            root.mkdir()
            self.git(root, 'init', '-q')
            self.git(root, 'config', 'user.name', 'Synthetic Test')
            self.git(root, 'config', 'user.email', 'synthetic@example.invalid')
            (root / 'sample.txt').write_text('first', encoding='utf-8')
            self.git(root, 'add', '--', 'sample.txt')
            self.git(root, 'commit', '-qm', 'first')
            (root / 'sample.txt').write_text('second', encoding='utf-8')
            self.git(root, 'commit', '-qam', 'second')
            clone = Path(tmp) / 'clone'
            subprocess.run(['git', 'clone', '-q', '--depth=1', root.as_uri(), str(clone)],
                           check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
            result = audit.audit(clone, 'HEAD')
            self.assertTrue(result['is_shallow_repository'])
            self.assertEqual(result['reachable_shallow_boundaries_with_parents'], 1)

    def test_current_tree_counts_all_paths_even_when_content_is_shared(self):
        with tempfile.TemporaryDirectory(prefix='foldmobile-current-tree-') as tmp:
            root = Path(tmp)
            self.git(root, 'init', '-q')
            self.git(root, 'config', 'user.name', 'Synthetic Test')
            self.git(root, 'config', 'user.email', 'synthetic@example.invalid')
            for name in ('shared.txt', '.env', 'first.mp4', 'second.mp4'):
                (root / name).write_bytes(b'')
            self.git(root, 'add', '--', 'shared.txt', '.env', 'first.mp4', 'second.mp4')
            self.git(root, 'commit', '-qm', 'shared empty blob')
            result = audit.audit(root, 'HEAD')
            self.assertEqual(result['current_tree_paths'], 4)
            self.assertEqual(result['current_tree_path_matches']['private_key_like'], 1)
            self.assertEqual(result['current_tree_path_matches']['video'], 2)
            self.assertNotIn('first.mp4', json.dumps(result))

    def test_history_counts_deleted_paths_even_when_blob_is_still_shared(self):
        with tempfile.TemporaryDirectory(prefix='foldmobile-history-shared-') as tmp:
            root = Path(tmp)
            self.git(root, 'init', '-q')
            self.git(root, 'config', 'user.name', 'Synthetic Test')
            self.git(root, 'config', 'user.email', 'synthetic@example.invalid')
            for name in ('shared.txt', 'first.mp4', 'second.mp4'):
                (root / name).write_bytes(b'')
            self.git(root, 'add', '--', 'shared.txt', 'first.mp4', 'second.mp4')
            self.git(root, 'commit', '-qm', 'shared empty blob')
            self.git(root, 'rm', '-q', '--', 'first.mp4', 'second.mp4')
            self.git(root, 'commit', '-qm', 'remove old names')
            result = audit.audit(root, 'HEAD')
            self.assertEqual(result['current_tree_path_matches']['video'], 0)
            self.assertEqual(result['history_diff_path_matches']['video'], 2)
            self.assertNotIn('first.mp4', json.dumps(result))

    def test_shared_media_named_blob_still_scans_text_alias_for_secret(self):
        with tempfile.TemporaryDirectory(prefix='foldmobile-history-alias-') as tmp:
            root = Path(tmp)
            self.git(root, 'init', '-q')
            self.git(root, 'config', 'user.name', 'Synthetic Test')
            self.git(root, 'config', 'user.email', 'synthetic@example.invalid')
            secret = 'ghp_' + 'A' * 36
            for name in ('a.jpg', 'z.txt'):
                (root / name).write_text(secret, encoding='utf-8')
            self.git(root, 'add', '--', 'a.jpg', 'z.txt')
            self.git(root, 'commit', '-qm', 'shared synthetic content')
            result = audit.audit(root, 'HEAD')
            self.assertEqual(result['text_blob_matches']['github_token_shape'], 1)
            self.assertNotIn(secret, json.dumps(result))
            self.git(root, 'rm', '-q', '--', 'z.txt')
            self.git(root, 'commit', '-qm', 'remove text alias')
            historical_result = audit.audit(root, 'HEAD')
            self.assertEqual(historical_result['text_blob_matches']['github_token_shape'], 1)
            self.assertNotIn(secret, json.dumps(historical_result))

    def test_history_includes_merged_branch_then_deleted_path(self):
        with tempfile.TemporaryDirectory(prefix='foldmobile-history-merge-') as tmp:
            root = Path(tmp)
            self.git(root, 'init', '-q')
            self.git(root, 'config', 'user.name', 'Synthetic Test')
            self.git(root, 'config', 'user.email', 'synthetic@example.invalid')
            (root / 'base.txt').write_bytes(b'')
            self.git(root, 'add', '--', 'base.txt')
            self.git(root, 'commit', '-qm', 'root')
            main = self.git(root, 'branch', '--show-current').stdout.decode().strip()
            self.git(root, 'checkout', '-qb', 'feature')
            (root / 'merged.mp4').write_bytes(b'')
            self.git(root, 'add', '--', 'merged.mp4')
            self.git(root, 'commit', '-qm', 'feature')
            self.git(root, 'checkout', '-q', main)
            self.git(root, 'merge', '-q', '--no-ff', '-m', 'merge', 'feature')
            self.git(root, 'rm', '-q', '--', 'merged.mp4')
            self.git(root, 'commit', '-qm', 'remove')
            result = audit.audit(root, 'HEAD')
            self.assertEqual(result['current_tree_path_matches']['video'], 0)
            self.assertEqual(result['history_diff_path_matches']['video'], 1)

    def test_shallow_boundary_at_root_does_not_hide_parent_history(self):
        with tempfile.TemporaryDirectory(prefix='foldmobile-shallow-root-') as tmp:
            root = Path(tmp) / 'source'
            root.mkdir()
            self.git(root, 'init', '-q')
            self.git(root, 'config', 'user.name', 'Synthetic Test')
            self.git(root, 'config', 'user.email', 'synthetic@example.invalid')
            (root / 'sample.txt').write_text('only commit', encoding='utf-8')
            self.git(root, 'add', '--', 'sample.txt')
            self.git(root, 'commit', '-qm', 'root')
            clone = Path(tmp) / 'clone'
            subprocess.run(['git', 'clone', '-q', '--depth=1', root.as_uri(), str(clone)],
                           check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
            result = audit.audit(clone, 'HEAD')
            self.assertTrue(result['is_shallow_repository'])
            self.assertEqual(result['reachable_shallow_boundaries_with_parents'], 0)

    def test_rejects_ref_option_injection(self):
        with self.assertRaises(ValueError):
            audit.audit(Path('.'), '--all')


if __name__ == '__main__':
    unittest.main()
