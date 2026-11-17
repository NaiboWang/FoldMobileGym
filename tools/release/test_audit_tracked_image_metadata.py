import importlib.util
import io
import json
import subprocess
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

try:
    from PIL import Image, PngImagePlugin, TiffImagePlugin
except ImportError:
    Image = None

if Image is not None:
    spec = importlib.util.spec_from_file_location('audit_tracked_image_metadata', Path(__file__).with_name('audit_tracked_image_metadata.py'))
    scanner = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(scanner)


@unittest.skipIf(Image is None, 'Pillow is needed for image metadata tests')
class TrackedImageMetadataTests(unittest.TestCase):
    def git(self, root, *args):
        return subprocess.run(['git', '-C', str(root), *args], check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)

    def init(self, root):
        self.git(root, 'init', '-q')
        self.git(root, 'config', 'user.name', 'Synthetic Test')
        self.git(root, 'config', 'user.email', 'synthetic@example.invalid')

    def gps_jpeg(self):
        rational = TiffImagePlugin.IFDRational
        exif = Image.Exif()
        exif[34853] = {1: 'N', 2: (rational(12, 1), rational(30, 1), rational(0, 1)),
                       3: 'E', 4: (rational(45, 1), rational(15, 1), rational(0, 1))}
        output = io.BytesIO()
        Image.new('RGB', (2, 2), 'red').save(output, format='JPEG', exif=exif)
        return output.getvalue()

    def xmp_png(self):
        metadata = PngImagePlugin.PngInfo()
        metadata.add_itxt('XML:com.adobe.xmp', '<x>exif:GPSLatitude=synthetic-value</x>')
        output = io.BytesIO()
        Image.new('RGB', (2, 2), 'blue').save(output, format='PNG', pnginfo=metadata)
        return output.getvalue()

    def empty_gps_jpeg(self):
        exif = Image.Exif()
        exif[34853] = {}
        output = io.BytesIO()
        Image.new('RGB', (2, 2), 'green').save(output, format='JPEG', exif=exif)
        return output.getvalue()

    def test_counts_shared_paths_invalid_images_and_xmp_without_values(self):
        with tempfile.TemporaryDirectory(prefix='foldmobile-image-audit-') as tmp:
            root = Path(tmp)
            self.init(root)
            for name in ('first.jpg', 'second.jpg'):
                (root / name).write_bytes(self.gps_jpeg())
            (root / 'xmp.png').write_bytes(self.xmp_png())
            (root / 'empty-gps.jpg').write_bytes(self.empty_gps_jpeg())
            (root / 'broken.jpg').write_bytes(b'<html>404</html>')
            (root / 'empty.webp').write_bytes(b'')
            (root / 'untracked.jpg').write_bytes(self.gps_jpeg())
            self.git(root, 'add', '--', 'first.jpg', 'second.jpg', 'xmp.png', 'empty-gps.jpg', 'broken.jpg', 'empty.webp')
            self.git(root, 'commit', '-qm', 'synthetic images')
            result = scanner.audit(root, 'HEAD')
            self.assertTrue(result['scan_completed'])
            counts = result['counts']
            self.assertEqual(counts['tracked_paths'], 6)
            self.assertEqual(counts['distinct_objects'], 5)
            self.assertEqual(counts['readable_paths'], 4)
            self.assertEqual(counts['unreadable_paths'], 1)
            self.assertEqual(counts['empty_paths'], 1)
            self.assertEqual(counts['gps_coordinate_pair_paths'], 2)
            self.assertEqual(counts['gps_coordinate_pair_objects'], 1)
            self.assertEqual(counts['gps_tag_paths'], 3)
            self.assertEqual(counts['xmp_location_marker_paths'], 1)
            self.assertEqual(result['public_clearance'], 'not_assessed')
            rendered = json.dumps(result)
            for private_text in ('synthetic-value', 'first.jpg', 'untracked.jpg', '12.5', '45.25'):
                self.assertNotIn(private_text, rendered)

    def test_zero_coordinates_and_invalid_coordinates(self):
        self.assertTrue(scanner.coordinates_present({1: 'N', 2: (0, 0, 0), 3: 'E', 4: (0, 0, 0)}))
        self.assertFalse(scanner.coordinates_present({1: 'N', 2: (91, 0, 0), 3: 'E', 4: (0, 0, 0)}))
        self.assertFalse(scanner.coordinates_present({1: 'N', 2: (0, 60, 0), 3: 'E', 4: (0, 0, 0)}))
        self.assertFalse(scanner.coordinates_present({1: 'N', 2: (0, 0, 0), 3: 'invalid', 4: (0, 0, 0)}))

    def test_selected_commit_and_oversized_skip(self):
        with tempfile.TemporaryDirectory(prefix='foldmobile-image-ref-') as tmp:
            root = Path(tmp)
            self.init(root)
            (root / 'old.jpg').write_bytes(self.gps_jpeg())
            self.git(root, 'add', '--', 'old.jpg')
            self.git(root, 'commit', '-qm', 'first')
            old = self.git(root, 'rev-parse', 'HEAD').stdout.decode().strip()
            self.git(root, 'rm', '-q', '--', 'old.jpg')
            (root / 'new.jpg').write_bytes(b'x' * 21)
            self.git(root, 'add', '--', 'new.jpg')
            self.git(root, 'commit', '-qm', 'second')
            self.assertEqual(scanner.audit(root, old)['counts']['gps_coordinate_pair_paths'], 1)
            with patch.object(scanner, 'MAX_BYTES', 20):
                counts = scanner.audit(root, 'HEAD')['counts']
            self.assertEqual(counts['over_limit_paths'], 1)
            self.assertEqual(counts['readable_paths'], 0)

    def test_history_finds_location_in_replaced_and_deleted_shared_images(self):
        with tempfile.TemporaryDirectory(prefix='foldmobile-image-history-') as tmp:
            root = Path(tmp)
            self.init(root)
            for name in ('first.jpg', 'second.jpg'):
                (root / name).write_bytes(self.gps_jpeg())
            self.git(root, 'add', '--', 'first.jpg', 'second.jpg')
            self.git(root, 'commit', '-qm', 'old synthetic images')
            self.git(root, 'rm', '-q', '--', 'second.jpg')
            safe = io.BytesIO()
            Image.new('RGB', (2, 2), 'black').save(safe, format='JPEG')
            (root / 'first.jpg').write_bytes(safe.getvalue())
            self.git(root, 'add', '--', 'first.jpg')
            self.git(root, 'commit', '-qm', 'replace and remove')
            self.assertEqual(scanner.audit(root, 'HEAD')['counts']['gps_coordinate_pair_paths'], 0)
            result = scanner.audit(root, 'HEAD', include_history=True)
            self.assertEqual(result['counts']['candidate_paths'], 2)
            self.assertEqual(result['counts']['candidate_path_versions'], 3)
            self.assertEqual(result['counts']['gps_coordinate_pair_path_versions'], 2)
            self.assertEqual(result['counts']['gps_coordinate_pair_objects'], 1)
            self.assertNotIn('first.jpg', json.dumps(result))
            self.assertEqual(result['public_clearance'], 'not_assessed')

    def test_empty_raster_set_and_shallow_history_are_explicit(self):
        with tempfile.TemporaryDirectory(prefix='foldmobile-image-shallow-') as tmp:
            root = Path(tmp) / 'source'
            root.mkdir()
            self.init(root)
            (root / 'old.jpg').write_bytes(self.gps_jpeg())
            self.git(root, 'add', '--', 'old.jpg')
            self.git(root, 'commit', '-qm', 'old image')
            self.git(root, 'rm', '-q', '--', 'old.jpg')
            (root / 'readme.txt').write_text('synthetic', encoding='utf-8')
            self.git(root, 'add', '--', 'readme.txt')
            self.git(root, 'commit', '-qm', 'remove old image')
            clone = Path(tmp) / 'clone'
            subprocess.run(['git', 'clone', '-q', '--depth=1', root.as_uri(), str(clone)],
                           check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
            current = scanner.audit(clone, 'HEAD')
            self.assertEqual(current['counts']['tracked_paths'], 0)
            history = scanner.audit(clone, 'HEAD', include_history=True)
            self.assertTrue(history['shallow_repository'])
            self.assertEqual(history['counts']['candidate_path_versions'], 0)
            self.assertEqual(history['public_clearance'], 'not_assessed')

    def test_history_counts_renamed_paths_once_per_shared_object(self):
        with tempfile.TemporaryDirectory(prefix='foldmobile-image-rename-') as tmp:
            root = Path(tmp)
            self.init(root)
            (root / 'old.jpg').write_bytes(self.gps_jpeg())
            self.git(root, 'add', '--', 'old.jpg')
            self.git(root, 'commit', '-qm', 'old image')
            self.git(root, 'mv', '--', 'old.jpg', 'new.jpg')
            self.git(root, 'commit', '-qm', 'rename image')
            result = scanner.audit(root, 'HEAD', include_history=True)
            self.assertEqual(result['counts']['candidate_paths'], 2)
            self.assertEqual(result['counts']['candidate_path_versions'], 2)
            self.assertEqual(result['counts']['gps_coordinate_pair_path_versions'], 2)
            self.assertEqual(result['counts']['gps_coordinate_pair_objects'], 1)

    def test_rejects_option_like_ref(self):
        with self.assertRaises(ValueError):
            scanner.audit(Path('.'), '--all')


if __name__ == '__main__':
    unittest.main()
