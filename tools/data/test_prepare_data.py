"""Small, local reconstruction regression tests; no downloads or model calls."""
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

import prepare_data as data


class ReconstructionDataTests(unittest.TestCase):
    def fixture(self):
        owned = tempfile.TemporaryDirectory(prefix="foldagent-data-unit-")
        self.addCleanup(owned.cleanup)
        repo = Path(owned.name)
        project = repo / "foldmobilegym"
        project.mkdir()
        (repo / "mobilegym_overlay" / "mobilegym-data").mkdir(parents=True)
        payload = b"public synthetic fixture"
        archive = repo / "fixture.tar.gz"
        with tarfile.open(archive, "w:gz") as bundle:
            member = tarfile.TarInfo("mobilegym-data/redbook/default.jpg")
            member.size = len(payload)
            bundle.addfile(member, io.BytesIO(payload))
            alias = tarfile.TarInfo("mobilegym-data/redbook/unneeded.jpg")
            alias.type = tarfile.SYMTYPE
            alias.linkname = "default.jpg"
            bundle.addfile(alias)
        manifest = {"bytes": len(payload), "files": [{"path": "redbook/default.jpg", "bytes": len(payload),
                     "sha256": hashlib.sha256(payload).hexdigest()}]}
        (project / "DATA_SNAPSHOT.json").write_text(json.dumps(manifest), encoding="utf-8")
        return repo, project, archive, payload

    def test_streaming_rebuild_omits_unneeded_symlink_and_is_repeatable(self):
        repo, project, archive, payload = self.fixture()
        with patch.multiple(data, REPO=repo, PROJECT=project, SHA256=data.digest(archive), SIZE=archive.stat().st_size), \
             patch("sys.argv", ["prepare_data.py", "--archive", str(archive)]), contextlib.redirect_stdout(io.StringIO()) as output:
            data.main()
            data.main()
        self.assertIn("Archive extraction complete", output.getvalue())
        self.assertIn("Verifying complete media inventory", output.getvalue())
        root = project / "mobilegym-data"
        self.assertEqual((root / "redbook/default.jpg").read_bytes(), payload)
        self.assertFalse((root / "redbook/unneeded.jpg").exists())

    def test_bad_archive_is_rejected_before_creating_target(self):
        repo, project, archive, _ = self.fixture()
        with patch.multiple(data, REPO=repo, PROJECT=project), \
             patch("sys.argv", ["prepare_data.py", "--archive", str(archive)]):
            with self.assertRaisesRegex(RuntimeError, "mismatch"):
                data.main()
        self.assertFalse((project / "mobilegym-data").exists())

    def test_default_rebuild_resumes_then_extracts_a_verified_archive(self):
        repo, project, archive, payload = self.fixture()
        encoded = archive.read_bytes()
        cache = repo / "artifacts" / "rebuild_downloads"
        cache.mkdir(parents=True)
        partial = cache / "mobilegym-data-v0.1.0.tar.partial"
        partial.write_bytes(encoded[:17])
        response = io.BytesIO(encoded[17:])
        response.status = 206
        response.headers = {"Content-Range": f"bytes 17-{len(encoded)-1}/{len(encoded)}",
                            "Content-Length": str(len(encoded)-17)}
        with patch.multiple(data, REPO=repo, PROJECT=project, SHA256=data.digest(archive), SIZE=len(encoded)), \
             patch("sys.argv", ["prepare_data.py"]), patch.object(data.urllib.request, "urlopen", return_value=response) as request, \
             contextlib.redirect_stdout(io.StringIO()):
            data.main()
        self.assertEqual(request.call_args.args[0].get_header("Range"), "bytes=17-")
        self.assertEqual((project / "mobilegym-data/redbook/default.jpg").read_bytes(), payload)
        self.assertFalse(partial.exists())
        self.assertEqual((cache / "mobilegym-data-v0.1.0.tar.gz").read_bytes(), encoded)

    def test_existing_user_data_is_not_overwritten(self):
        repo, project, archive, _ = self.fixture()
        root = project / "mobilegym-data"
        root.mkdir()
        sentinel = root / "user.txt"
        sentinel.write_text("preserve", encoding="utf-8")
        with patch.multiple(data, REPO=repo, PROJECT=project), \
             patch("sys.argv", ["prepare_data.py", "--archive", str(archive)]):
            with self.assertRaisesRegex(RuntimeError, "incomplete"):
                data.main()
        self.assertEqual(sentinel.read_text(encoding="utf-8"), "preserve")

    def test_manifest_rejects_unsafe_and_duplicate_paths(self):
        _, project, _, _ = self.fixture()
        file = project / "DATA_SNAPSHOT.json"
        original = json.loads(file.read_text(encoding="utf-8"))
        for name in ["../outside.jpg", "/outside.jpg", "C:/outside.jpg", "redbook\\outside.jpg",
                     "redbook//default.jpg", "redbook/./default.jpg", "redbook/../default.jpg"]:
            with self.subTest(path=name):
                manifest = json.loads(json.dumps(original))
                manifest["files"][0]["path"] = name
                file.write_text(json.dumps(manifest), encoding="utf-8")
                with patch.object(data, "PROJECT", project), self.assertRaisesRegex(RuntimeError, "unsafe"):
                    data.required_files()
        original["files"].append(dict(original["files"][0]))
        file.write_text(json.dumps(original), encoding="utf-8")
        with patch.object(data, "PROJECT", project), self.assertRaisesRegex(RuntimeError, "duplicate"):
            data.required_files()

    def test_manifest_rejects_empty_list_and_inconsistent_total(self):
        _, project, _, _ = self.fixture()
        file = project / "DATA_SNAPSHOT.json"
        original = json.loads(file.read_text(encoding="utf-8"))
        for manifest in [[], {"files": [], "bytes": 0}, {**original, "bytes": original["bytes"] + 1}]:
            file.write_text(json.dumps(manifest), encoding="utf-8")
            with patch.object(data, "PROJECT", project), self.assertRaisesRegex(RuntimeError, "manifest"):
                data.required_files()

    def test_manifest_rejects_invalid_file_sizes_and_hashes(self):
        _, project, _, _ = self.fixture()
        file = project / "DATA_SNAPSHOT.json"
        original = json.loads(file.read_text(encoding="utf-8"))
        for key, value in [("bytes", True), ("bytes", -1), ("bytes", 1.5), ("sha256", "not-a-hash")]:
            with self.subTest(field=key, value=value):
                manifest = json.loads(json.dumps(original))
                manifest["files"][0][key] = value
                file.write_text(json.dumps(manifest), encoding="utf-8")
                with patch.object(data, "PROJECT", project), self.assertRaisesRegex(RuntimeError, "size/hash"):
                    data.required_files()

    @unittest.skipUnless(os.name == "nt", "Actual Windows junction regression")
    def test_parent_junction_is_refused_before_reading_external_data(self):
        repo, project, _, payload = self.fixture()
        root = project / "mobilegym-data"
        root.mkdir()
        external = repo / "external"
        external.mkdir()
        sentinel = external / "default.jpg"
        sentinel.write_bytes(payload)
        created = subprocess.run(["cmd.exe", "/c", "mklink", "/J", str(root / "redbook"), str(external)],
                                 capture_output=True, text=True, check=False)
        self.assertEqual(created.returncode, 0, created.stderr)
        with patch.object(data, "PROJECT", project), patch.object(data, "digest") as read:
            with self.assertRaisesRegex(RuntimeError, "reparse"):
                data.verify(root)
            read.assert_not_called()
        self.assertEqual(sentinel.read_bytes(), payload)


if __name__ == "__main__":
    unittest.main()
