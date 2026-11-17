"""Local synthetic package/inventory regressions; no external media or downloads."""
import contextlib
import hashlib
import io
import json
import os
import subprocess
import tarfile
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
import build_media_manifest as manifest_builder
import build_media_package as package
import media_inventory as inventory


class MediaPackageTests(unittest.TestCase):
    def fixture(self):
        temp = tempfile.TemporaryDirectory(prefix="foldagent-media-test-")
        self.addCleanup(temp.cleanup)
        root = Path(temp.name)
        subprocess.run(["git", "init", "-q", str(root)], check=True, capture_output=True)
        files = {name: b"Synthetic rights notice" for name in package.DOCUMENTS if not name.endswith("manifest.json")}
        for name in ("mobilegym/apps/Demo/assets/icon.png", "mobilegym/system/Clock/res/icon.png",
                     "mobilegym/assets/wallpaper.webp", "mobilegym/web/logo.svg", "mobilegym/public/icon.png",
                     "mobilegym/media_patch/local.json", "mobilegym_overlay/mobilegym-data/photo.png",
                     "mobilegym_overlay/mobilegym-data/NOTICE", "media_sources/overrides/new.png"):
            files[name] = ("Synthetic fixture: " + name).encode()
        for name, value in files.items():
            file = root / name
            file.parent.mkdir(parents=True, exist_ok=True)
            file.write_bytes(value)
        subprocess.run(["git", "-C", str(root), "add", "."], check=True, capture_output=True)
        private = root / "mobilegym/apps/Demo/assets/private.png"
        private.write_bytes(b"Unreviewed fixture must never be packaged")
        manifest = {"schema_version": 2, "upstream": {"release": "fixture", "archive_sha256": "0" * 64},
                    "local_layers": inventory.local_inventory(root)}
        (root / "media_sources/manifest.json").write_text(json.dumps(manifest), encoding="utf-8")
        return root, files

    def output(self, root, name="fixture.tar.gz"):
        return root / "artifacts" / name

    def rewrite(self, root, archive, transform):
        with tarfile.open(archive, "r:gz") as source:
            rows = [(m, source.extractfile(m).read() if m.isfile() else b"") for m in source]
        target = self.output(root, "modified.tar.gz")
        with tarfile.open(target, "w:gz") as dest:
            transform(rows, dest)
        return target

    def test_all_local_layers_include_system_shell_indexes_and_notices_but_not_untracked(self):
        root, _ = self.fixture()
        layers = inventory.local_inventory(root)
        names = {row["path"] for group in layers.values() for row in group["entries"]}
        self.assertIn("mobilegym/system/Clock/res/icon.png", names)
        self.assertIn("mobilegym/assets/wallpaper.webp", names)
        self.assertIn("mobilegym/web/logo.svg", names)
        self.assertIn("mobilegym/media_patch/local.json", names)
        self.assertIn("mobilegym_overlay/mobilegym-data/NOTICE", names)
        self.assertNotIn("mobilegym/apps/Demo/assets/private.png", names)

    def test_manifest_separates_download_archive_and_runtime_sizes(self):
        root, _ = self.fixture()
        (root / "mobilegym/DATA_SNAPSHOT.json").write_text(json.dumps({"release": "fixture", "bytes": 7, "files": []}))
        source = root / "mobilegym/apps/Demo/image.ts"
        source.write_text('export const image = "https://images.example.invalid/photo.png";')
        subprocess.run(["git", "-C", str(root), "add", "mobilegym/apps/Demo/image.ts"], check=True)
        with patch.multiple(manifest_builder, ROOT=root, PROJECT=root / "mobilegym", OUT=root / "media_sources/manifest.json"), contextlib.redirect_stdout(io.StringIO()):
            manifest_builder.main()
        data = json.loads((root / "media_sources/manifest.json").read_text())
        self.assertEqual(data["upstream"]["archive_bytes"], manifest_builder.SIZE)
        self.assertEqual(data["upstream"]["runtime_bytes"], 7)
        self.assertEqual(data["policy"]["local_inventory"], "git-tracked-only")
        self.assertEqual(data["external_image_hosts"][0]["host"], "images.example.invalid")

    def test_package_contains_every_indexed_local_file_and_its_rights(self):
        root, files = self.fixture()
        output = self.output(root)
        release = package.build(root, output)
        result = package.verify_archive(output, release)
        with tarfile.open(output) as bundle:
            names = set(bundle.getnames())
            for name, data in files.items():
                self.assertEqual(bundle.extractfile(package.PREFIX + name).read(), data)
            self.assertNotIn(package.PREFIX + "mobilegym/apps/Demo/assets/private.png", names)
        self.assertEqual(result["files"], len(files) + 1)  # generated manifest
        self.assertFalse(release["published"])

    def test_packaging_is_byte_reproducible(self):
        root, _ = self.fixture()
        first = package.build(root, self.output(root, "first.tar.gz"))
        second = package.build(root, self.output(root, "second.tar.gz"))
        self.assertEqual(first["sha256"], second["sha256"])

    def test_changed_tracked_file_refuses_stale_manifest(self):
        root, _ = self.fixture()
        (root / "mobilegym/public/icon.png").write_bytes(b"changed")
        with self.assertRaisesRegex(RuntimeError, "Stale"):
            package.build(root, self.output(root))
        self.assertFalse(self.output(root).exists())

    def test_new_staged_media_refuses_stale_manifest(self):
        root, _ = self.fixture()
        subprocess.run(["git", "-C", str(root), "add", "mobilegym/apps/Demo/assets/private.png"], check=True)
        with self.assertRaisesRegex(RuntimeError, "Stale"):
            package.build(root, self.output(root))

    def test_old_schema_is_not_silently_packaged(self):
        root, _ = self.fixture()
        file = root / "media_sources/manifest.json"
        data = json.loads(file.read_text()); data["schema_version"] = 1; file.write_text(json.dumps(data))
        with self.assertRaisesRegex(RuntimeError, "v2"):
            package.build(root, self.output(root))

    def test_existing_output_is_never_overwritten(self):
        root, _ = self.fixture()
        output = self.output(root); output.parent.mkdir(); output.write_bytes(b"keep")
        with self.assertRaisesRegex(RuntimeError, "overwrite"):
            package.build(root, output)
        self.assertEqual(output.read_bytes(), b"keep")

    def test_outputs_cannot_escape_artifacts(self):
        root, _ = self.fixture()
        for name in (root / "bad.tar.gz", root / "artifacts/../bad.tar.gz", root.parent / "escape.tar.gz"):
            with self.subTest(path=name), self.assertRaises(RuntimeError):
                package.build(root, name)

    def test_outer_release_checksum_is_enforced(self):
        root, _ = self.fixture(); output = self.output(root); release = package.build(root, output)
        release["sha256"] = "f" * 64
        with self.assertRaisesRegex(RuntimeError, "Release archive"):
            package.verify_archive(output, release)

    def test_tampered_payload_is_detected_without_extraction(self):
        root, _ = self.fixture(); output = self.output(root); package.build(root, output)
        def transform(rows, dest):
            for index, (member, value) in enumerate(rows):
                if index == 1: value = b"x" * len(value)
                dest.addfile(member, io.BytesIO(value))
        tampered = self.rewrite(root, output, transform)
        with self.assertRaisesRegex(RuntimeError, "SHA-256"):
            package.verify_archive(tampered)

    def test_missing_member_is_detected(self):
        root, _ = self.fixture(); output = self.output(root); package.build(root, output)
        def transform(rows, dest):
            for member, value in rows[:-1]: dest.addfile(member, io.BytesIO(value))
        with self.assertRaisesRegex(RuntimeError, "missing"):
            package.verify_archive(self.rewrite(root, output, transform))

    def test_unlisted_duplicate_and_link_members_are_rejected(self):
        for kind in ("extra", "duplicate", "link"):
            with self.subTest(kind=kind):
                root, _ = self.fixture(); output = self.output(root); package.build(root, output)
                def transform(rows, dest):
                    for member, value in rows: dest.addfile(member, io.BytesIO(value))
                    member = tarfile.TarInfo(package.PREFIX + ("unknown.png" if kind != "duplicate" else rows[1][0].name[len(package.PREFIX):]))
                    if kind == "link": member.type = tarfile.SYMTYPE; member.linkname = "../../private"
                    dest.addfile(member, io.BytesIO())
                with self.assertRaises(RuntimeError):
                    package.verify_archive(self.rewrite(root, output, transform))

    def test_unsafe_cross_platform_paths_and_duplicate_index_entries_are_rejected(self):
        for name in ("../private", "/outside", "C:/private", "a\\b", "a//b", "a/./b", "a/NUL.txt", "a/b. ", "a/COM1", ""):
            with self.subTest(name=name), self.assertRaises(RuntimeError):
                package.valid_records([{"path": name, "bytes": 0, "sha256": "0" * 64}])
        row = {"path": "a.png", "bytes": 0, "sha256": "0" * 64}
        with self.assertRaisesRegex(RuntimeError, "duplicate"):
            package.valid_records([row, row])

    @unittest.skipUnless(os.name == "nt", "Actual Windows junction regression")
    def test_junction_source_and_output_are_refused(self):
        root, _ = self.fixture()
        external = root / "external"; external.mkdir(); sentinel = external / "icon.png"; sentinel.write_bytes(b"keep")
        junction = root / "artifacts"
        result = subprocess.run(["cmd.exe", "/c", "mklink", "/J", str(junction), str(external)], capture_output=True)
        self.assertEqual(result.returncode, 0)
        self.addCleanup(junction.rmdir)
        with self.assertRaisesRegex(RuntimeError, "reparse"):
            inventory.checked_file(root, "artifacts/icon.png")
        with self.assertRaisesRegex(RuntimeError, "Linked"):
            package.build(root, junction / "fixture.tar.gz")
        self.assertEqual(sentinel.read_bytes(), b"keep")


if __name__ == "__main__":
    unittest.main()
