import hashlib
import importlib.util
import io
import json
import tarfile
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

try:
    from PIL import Image, TiffImagePlugin
except ImportError:
    Image = None

if Image is not None:
    spec = importlib.util.spec_from_file_location('audit_media_archive_metadata', Path(__file__).with_name('audit_media_archive_metadata.py'))
    scanner = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(scanner)


@unittest.skipIf(Image is None, 'Pillow is needed for archive metadata tests')
class ArchiveMetadataTests(unittest.TestCase):
    def gps_jpeg(self):
        rational = TiffImagePlugin.IFDRational
        exif = Image.Exif()
        exif[34853] = {1: 'N', 2: (rational(12, 1), rational(30, 1), rational(0, 1)),
                       3: 'E', 4: (rational(45, 1), rational(15, 1), rational(0, 1))}
        output = io.BytesIO()
        Image.new('RGB', (2, 2), 'red').save(output, format='JPEG', exif=exif)
        return output.getvalue()

    def package(self, root, destinations, *, tamper=False):
        payloads = {hashlib.sha256(value).hexdigest(): value for value in destinations.values()}
        entries = [{'path': name, 'bytes': len(value), 'sha256': hashlib.sha256(value).hexdigest()}
                   for name, value in sorted(destinations.items())]
        blobs = [{'sha256': sha, 'bytes': len(value)} for sha, value in sorted(payloads.items())]
        index = json.dumps({'schema_version': 1, 'kind': 'project-standalone-local-media',
                            'entries': entries, 'blobs': blobs}).encode()
        archive = root / 'synthetic.tar.gz'
        with tarfile.open(archive, 'w:gz') as tar:
            def add(name, value):
                info = tarfile.TarInfo(name)
                info.size = len(value)
                tar.addfile(info, io.BytesIO(value))
            add('foldagent-gui-media-full/package-index.json', index)
            for sha, value in sorted(payloads.items()):
                if tamper and value:
                    value = bytes([value[0] ^ 1]) + value[1:]
                    tamper = False
                add('foldagent-gui-media-full/blobs/' + sha, value)
        data = archive.read_bytes()
        release = {'kind': 'project-standalone-local-media', 'bytes': len(data),
                   'sha256': hashlib.sha256(data).hexdigest()}
        return archive, release

    def test_verified_archive_counts_aliases_without_extraction_or_private_values(self):
        with tempfile.TemporaryDirectory(prefix='foldmobile-archive-audit-') as tmp:
            root = Path(tmp)
            image = self.gps_jpeg()
            archive, release = self.package(root, {
                'data/first.jpg': image, 'data/second.jpg': image,
                'data/broken.jpg': b'<html>404</html>', 'data/empty.png': b'',
                'data/note.txt': b'synthetic non-image',
            })
            before = {p.name for p in root.iterdir()}
            result = scanner.audit(archive, release)
            self.assertEqual({p.name for p in root.iterdir()}, before)
            self.assertTrue(result['archive_verified'])
            self.assertEqual(result['counts']['raster_paths'], 4)
            self.assertEqual(result['counts']['raster_objects'], 3)
            self.assertEqual(result['counts']['readable_paths'], 2)
            self.assertEqual(result['counts']['gps_coordinate_pair_paths'], 2)
            self.assertEqual(result['counts']['gps_coordinate_pair_objects'], 1)
            self.assertEqual(result['counts']['unreadable_paths'], 1)
            self.assertEqual(result['counts']['empty_paths'], 1)
            self.assertEqual(result['public_clearance'], 'not_assessed')
            rendered = json.dumps(result)
            for private_text in ('first.jpg', 'second.jpg', '12.5', '45.25'):
                self.assertNotIn(private_text, rendered)

    def test_wrong_archive_checksum_and_tampered_payload_are_rejected(self):
        with tempfile.TemporaryDirectory(prefix='foldmobile-archive-corrupt-') as tmp:
            root = Path(tmp)
            archive, release = self.package(root, {'data/synthetic.jpg': self.gps_jpeg()})
            with self.assertRaises(RuntimeError):
                scanner.audit(archive, {**release, 'sha256': '0' * 64})
            archive, release = self.package(root, {'data/synthetic.jpg': self.gps_jpeg()}, tamper=True)
            with self.assertRaises(RuntimeError):
                scanner.audit(archive, release)

    def test_oversized_image_is_reported_without_parsing(self):
        with tempfile.TemporaryDirectory(prefix='foldmobile-archive-limit-') as tmp:
            archive, release = self.package(Path(tmp), {'data/large.jpg': b'x' * 21})
            with patch.object(scanner, 'MAX_BYTES', 20):
                counts = scanner.audit(archive, release)['counts']
            self.assertEqual(counts['over_limit_paths'], 1)
            self.assertEqual(counts['readable_paths'], 0)

    def test_unsafe_index_path_is_rejected(self):
        with tempfile.TemporaryDirectory(prefix='foldmobile-archive-path-') as tmp:
            archive, release = self.package(Path(tmp), {'../private.jpg': self.gps_jpeg()})
            with self.assertRaises(RuntimeError):
                scanner.audit(archive, release)


if __name__ == '__main__':
    unittest.main()
