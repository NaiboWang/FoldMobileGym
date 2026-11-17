"""Synthetic standalone bundle/install tests. No downloads, private media or upstream archive."""
import hashlib
import io
import json
import os
import shutil
import stat
import subprocess
import sys
import tarfile
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
import test_media_package as supplement_tests
import standalone_media as full
import media_inventory


class StandaloneTests(unittest.TestCase):
    def cleanup_owned(self, folder):
        if folder.resolve().parent != Path(tempfile.gettempdir()).resolve() or not folder.name.startswith("foldagent-full-"):
            raise RuntimeError("Refusing cleanup outside owned synthetic temp roots")
        def remove_readonly(function, name, error):
            item=full.filesystem_path(Path(name))
            if not item.resolve().is_relative_to(full.filesystem_path(folder).resolve()) or not item.is_file() or item.is_symlink():
                raise error[1]
            item.chmod(stat.S_IRUSR | stat.S_IWUSR)
            function(name)
        shutil.rmtree(full.filesystem_path(folder), onerror=remove_readonly)

    def fixture(self):
        owner = supplement_tests.MediaPackageTests("runTest")
        self.addCleanup(owner.doCleanups)
        root, _ = owner.fixture()
        data = {"bilibili/synthetic.jpg": (root / "mobilegym/apps/Demo/assets/icon.png").read_bytes(), "LICENSE": b"Synthetic dataset license"}
        rows = []
        for name, value in data.items():
            file = root / full.DATA / name
            file.parent.mkdir(parents=True, exist_ok=True)
            file.write_bytes(value)
            rows.append({"path": name, "bytes": len(value), "sha256": hashlib.sha256(value).hexdigest()})
        snapshot = {"schema_version": 1, "release": "fixture", "archive_sha256": "0" * 64,
                    "bytes": sum(row["bytes"] for row in rows), "files": rows}
        (root / full.SNAPSHOT).write_text(json.dumps(snapshot), encoding="utf-8")
        return root

    def target(self, root, deep=False):
        folder = Path(tempfile.mkdtemp(prefix="foldagent-full-install-"))
        self.addCleanup(self.cleanup_owned, folder)
        if deep:
            folder = folder / ("deep-" * 12) / ("path-" * 8)
            folder.mkdir(parents=True)
        # Only the small trusted code-side metadata/notices; no images or original archive.
        for name in (*full.DOCUMENTS, full.SNAPSHOT):
            source, target = root / name, folder / name
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(source.read_bytes())
        return folder

    def package(self, root):
        archive = root / "artifacts/full.tar.gz"
        return archive, full.build(root, archive)

    def rewrite(self, archive, transform):
        with tarfile.open(archive, "r:gz") as source:
            members = [(m, source.extractfile(m).read()) for m in source]
        output = archive.with_name("modified.tar.gz")
        with tarfile.open(output, "w:gz") as target:
            for member, value in transform(members):
                target.addfile(member, io.BytesIO(value) if member.isfile() else None)
        return output

    def test_complete_targets_deduplicate_payloads_and_exclude_untracked_content(self):
        root = self.fixture()
        archive, release = self.package(root)
        report = full.scan(archive, release)
        self.assertLess(report["payloads"], report["files"])
        with tarfile.open(archive, "r:gz") as bundle:
            index = json.load(bundle.extractfile(full.INDEX))
        names = {r["path"] for r in index["entries"]}
        self.assertIn(full.DATA + "bilibili/synthetic.jpg", names)
        self.assertIn("mobilegym/apps/Demo/assets/icon.png", names)
        self.assertIn(full.DATA + "photo.png", names)
        self.assertIn(full.DATA + "new.png", names)
        self.assertNotIn("mobilegym/apps/Demo/assets/private.png", names)
        self.assertEqual(release["kind"], full.KIND)
        self.assertFalse(release["published"])

    def test_fresh_install_and_check_need_no_original_archive_or_network(self):
        root = self.fixture()
        archive, release = self.package(root)
        target = self.target(root)
        with patch("urllib.request.urlopen", side_effect=AssertionError("No network allowed")) as network:
            report = full.install(archive, target, release)
            self.assertGreater(report["installed"], 0)
            self.assertTrue(full.install(archive, target, release, True)["passed"])
            again = full.install(archive, target, release)
            self.assertEqual(again["installed"], 0)
            network.assert_not_called()
        self.assertEqual((target / full.DATA / "bilibili/synthetic.jpg").read_bytes(), (root / "mobilegym/apps/Demo/assets/icon.png").read_bytes())
        # Deduplicated archive bytes must not couple later edits of two destination paths.
        image = target / full.DATA / "bilibili/synthetic.jpg"
        image.write_bytes(b"Later user edit")
        self.assertNotEqual(image.read_bytes(), (target / "mobilegym/apps/Demo/assets/icon.png").read_bytes())

    def test_installer_cli_keeps_json_on_stdout_and_progress_on_stderr(self):
        root = self.fixture()
        archive, release = self.package(root)
        target = self.target(root)
        record = root / "synthetic-release.json"
        record.write_text(json.dumps(release), encoding="utf-8")
        script = Path(full.__file__).with_name("install_media_package.py")
        result = subprocess.run([sys.executable, str(script), "--archive", str(archive),
                                 "--root", str(target), "--release-record", str(record)],
                                capture_output=True, text=True, check=True)
        self.assertTrue(json.loads(result.stdout)["passed"])
        self.assertIn("[media] archive_checksum: 0/1", result.stderr)
        self.assertIn("[media] payloads:", result.stderr)
        self.assertIn("[media] publish:", result.stderr)
        self.assertNotIn(str(target), result.stderr)
        self.assertNotIn(str(archive), result.stderr)

    def test_install_progress_reports_counts_without_claiming_success(self):
        root = self.fixture()
        archive, release = self.package(root)
        target = self.target(root)
        events = []
        report = full.install(archive, target, release, progress=lambda *event: events.append(event))
        self.assertTrue(report["passed"])
        for phase in ("metadata", "archive_checksum", "existing", "payloads", "recheck", "publish"):
            self.assertIn(phase, [event[0] for event in events])
        self.assertEqual(events[0], ("metadata", 0, 1))
        self.assertTrue(all(isinstance(event[1], int) and isinstance(event[2], int)
                            and 0 <= event[1] <= event[2] for event in events))
        published = [event for event in events if event[0] == "publish"]
        self.assertEqual(published[-1][1], published[-1][2])
        # An entirely installed checkout still reports zero publication cleanly.
        events.clear()
        self.assertTrue(full.install(archive, target, release, True, progress=lambda *event: events.append(event))["passed"])
        self.assertIn(("publish", 0, 0), events)

    def test_original_archive_installs_into_renamed_checkout_without_legacy_directory(self):
        root = self.fixture()
        archive, release = self.package(root)
        target = self.target(root)
        (target / "mobilegym").rename(target / "foldmobilegym")
        report = full.install(archive, target, release)
        self.assertGreater(report["installed"], 0)
        self.assertFalse((target / "mobilegym").exists())
        image = target / "foldmobilegym/mobilegym-data/bilibili/synthetic.jpg"
        self.assertEqual(image.read_bytes(), (root / "mobilegym/apps/Demo/assets/icon.png").read_bytes())
        self.assertTrue(full.install(archive, target, release, True)["passed"])
        self.assertEqual(full.install(archive, target, release)["installed"], 0)
        image.write_bytes(b"Do not overwrite user changes")
        with self.assertRaisesRegex(RuntimeError, "no overwrite"):
            full.install(archive, target, release)

    def test_renamed_checkout_ignores_unrelated_legacy_directory(self):
        root = self.fixture()
        archive, release = self.package(root)
        target = self.target(root)
        (target / "mobilegym").rename(target / "foldmobilegym")
        (target / "mobilegym").mkdir()
        (target / "mobilegym/keep.txt").write_text("unrelated user file", encoding="utf-8")
        self.assertTrue(full.install(archive, target, release)["passed"])
        self.assertTrue((target / "foldmobilegym/mobilegym-data/bilibili/synthetic.jpg").is_file())
        self.assertFalse((target / "mobilegym/mobilegym-data").exists())
        self.assertEqual((target / "mobilegym/keep.txt").read_text(encoding="utf-8"), "unrelated user file")
        self.assertTrue(full.install(archive, target, release, True)["passed"])

    def test_install_rejects_two_frontend_snapshots_before_writing(self):
        root = self.fixture()
        archive, release = self.package(root)
        target = self.target(root)
        (target / "foldmobilegym").mkdir()
        (target / "foldmobilegym/DATA_SNAPSHOT.json").write_bytes((target / full.SNAPSHOT).read_bytes())
        with self.assertRaisesRegex(RuntimeError, "Ambiguous frontend"):
            full.install(archive, target, release)
        self.assertFalse((target / "mobilegym/mobilegym-data").exists())
        self.assertFalse((target / "foldmobilegym/mobilegym-data").exists())

    def test_renamed_tracked_inventory_keeps_published_logical_ids(self):
        root = self.fixture()
        before = media_inventory.local_inventory(root)
        old_names = [name for name in media_inventory.tracked_names(root) if name.startswith("mobilegym/")]
        (root / "mobilegym").rename(root / "foldmobilegym")
        subprocess.run(["git", "-C", str(root), "update-index", "--force-remove", "--", *old_names], check=True, capture_output=True)
        subprocess.run(["git", "-C", str(root), "add", "--", *["foldmobilegym/" + name[len("mobilegym/"):] for name in old_names]], check=True, capture_output=True)
        self.assertEqual(media_inventory.local_inventory(root), before)
        archive, release = self.package(root)
        self.assertTrue(full.scan(archive, release)["passed"])

    def test_renamed_destination_link_is_rejected(self):
        root = self.fixture()
        archive, release = self.package(root)
        target = self.target(root)
        (target / "mobilegym").rename(target / "foldmobilegym")
        # Pre-existing symlinks are rejected rather than followed during installation.
        image = target / "foldmobilegym/apps/Demo/assets/icon.png"
        image.parent.mkdir(parents=True, exist_ok=True)
        try:
            image.symlink_to(target / "foldmobilegym/LICENSE")
        except OSError:
            self.skipTest("Creating symlinks is unavailable on this host")
        with self.assertRaisesRegex(RuntimeError, "Linked destination"):
            full.install(archive, target, release)

    def test_conflicting_user_file_is_never_overwritten_or_silently_skipped(self):
        root = self.fixture()
        archive, release = self.package(root)
        target = self.target(root)
        image = target / full.DATA / "bilibili/synthetic.jpg"
        image.parent.mkdir(parents=True)
        image.write_bytes(b"User-owned modification")
        before = {str(p.relative_to(target)): p.read_bytes() for p in target.rglob("*") if p.is_file()}
        with self.assertRaisesRegex(RuntimeError, "no overwrite"):
            full.install(archive, target, release)
        self.assertEqual(before, {str(p.relative_to(target)): p.read_bytes() for p in target.rglob("*") if p.is_file()})

    def test_updated_checkout_media_guide_is_preserved_during_install_and_check(self):
        root = self.fixture()
        archive, release = self.package(root)
        target = self.target(root)
        guide = target / "media_sources/README.md"
        guide.write_bytes(b"Updated checkout-owned installation guide")
        self.assertTrue(full.install(archive, target, release)["passed"])
        self.assertTrue(full.install(archive, target, release, check_only=True)["passed"])
        self.assertEqual(guide.read_bytes(), b"Updated checkout-owned installation guide")

    def test_updated_distribution_notices_are_preserved_in_both_frontend_layouts(self):
        for frontend in ("mobilegym", "foldmobilegym"):
            with self.subTest(frontend=frontend):
                root = self.fixture()
                archive, release = self.package(root)
                target = self.target(root)
                if frontend == "foldmobilegym":
                    (target / "mobilegym").rename(target / frontend)
                notices = {}
                for name in ("NOTICE", "LICENSE-DATA", "DISCLAIMER.md"):
                    file = target / frontend / name
                    notices[file] = ("Updated checkout distribution document: " + name).encode()
                    file.write_bytes(notices[file])
                self.assertTrue(full.install(archive, target, release)["passed"])
                self.assertTrue(full.install(archive, target, release, check_only=True)["passed"])
                self.assertEqual(full.install(archive, target, release)["installed"], 0)
                for file, value in notices.items():
                    self.assertEqual(file.read_bytes(), value)

    def test_preserved_checkout_notice_does_not_bypass_its_archive_payload_hash(self):
        root = self.fixture()
        archive, release = self.package(root)
        target = self.target(root)
        notice = target / "mobilegym/NOTICE"
        notice.write_bytes(b"Updated checkout distribution notice")
        original_hash = full.digest(root / "mobilegym/NOTICE")
        def corrupt(rows):
            result = []
            for member, value in rows:
                if member.name == full.PREFIX + "blobs/" + original_hash:
                    value = bytes([value[0] ^ 1]) + value[1:]
                result.append((member, value))
            return result
        modified = self.rewrite(archive, corrupt)
        modified_release = {**release, "bytes": modified.stat().st_size, "sha256": full.digest(modified)}
        with self.assertRaisesRegex(RuntimeError, "Payload SHA-256 mismatch"):
            full.install(modified, target, modified_release)
        self.assertEqual(notice.read_bytes(), b"Updated checkout distribution notice")
        self.assertFalse((target / full.DATA).exists())

    def test_changed_code_license_is_still_rejected_before_install(self):
        root = self.fixture()
        archive, release = self.package(root)
        target = self.target(root)
        (target / "mobilegym/LICENSE").write_bytes(b"Different notice")
        with self.assertRaisesRegex(RuntimeError, "pinned media metadata"):
            full.install(archive, target, release)
        self.assertFalse((target / full.DATA).exists())

    def test_wrong_release_checksum_cannot_install_any_image(self):
        root = self.fixture()
        archive, release = self.package(root)
        target = self.target(root)
        with self.assertRaisesRegex(RuntimeError, "checksum"):
            full.install(archive, target, {**release, "sha256": "0" * 64})
        self.assertFalse((target / "mobilegym/apps").exists())

    def test_mismatched_checkout_metadata_is_rejected_before_publication(self):
        root = self.fixture()
        archive, release = self.package(root)
        target = self.target(root)
        file = target / "media_sources/manifest.json"
        file.write_text(file.read_text() + " ")
        with self.assertRaisesRegex(RuntimeError, "checkout"):
            full.install(archive, target, release)
        self.assertFalse((target / full.DATA).exists())

    def test_check_only_does_not_create_missing_images(self):
        root = self.fixture()
        archive, release = self.package(root)
        target = self.target(root)
        with self.assertRaisesRegex(RuntimeError, "missing"):
            full.install(archive, target, release, True)
        self.assertFalse((target / full.DATA).exists())

    def test_stale_runtime_bytes_are_not_packaged_as_reviewed(self):
        root = self.fixture()
        (root / full.DATA / "bilibili/synthetic.jpg").write_bytes(b"Unknown changed image")
        with self.assertRaisesRegex(RuntimeError, "Changed"):
            self.package(root)

    def test_replacing_a_pinned_path_requires_a_reviewed_snapshot_update(self):
        root = self.fixture()
        image = root / "media_sources/overrides/bilibili/synthetic.jpg"
        image.parent.mkdir(parents=True)
        image.write_bytes(b"Reviewed but not pinned replacement")
        subprocess.run(["git", "-C", str(root), "add", "media_sources/overrides"], check=True, capture_output=True)
        manifest = root / "media_sources/manifest.json"
        data = json.loads(manifest.read_text())
        data["local_layers"] = media_inventory.local_inventory(root)
        manifest.write_text(json.dumps(data))
        with self.assertRaisesRegex(RuntimeError, "conflicts"):
            self.package(root)

    def test_existing_output_is_not_replaced(self):
        root = self.fixture()
        archive, _ = self.package(root)
        checksum = media_inventory.digest(archive)
        with self.assertRaisesRegex(RuntimeError, "overwrite"):
            full.build(root, archive)
        self.assertEqual(checksum, media_inventory.digest(archive))

    def test_invalid_payload_bytes_missing_or_duplicate_members_are_rejected(self):
        for mode in ["changed", "missing", "duplicate"]:
            with self.subTest(mode=mode):
                root = self.fixture()
                archive, _ = self.package(root)
                def transform(rows):
                    if mode == "missing": return rows[:-1]
                    if mode == "duplicate": return rows + [rows[-1]]
                    m, value = rows[-1]
                    return rows[:-1] + [(m, bytes([value[0] ^ 1]) + value[1:])]
                bad = self.rewrite(archive, transform)
                with self.assertRaises(RuntimeError): full.scan(bad)

    def test_link_and_unlisted_archive_members_are_rejected(self):
        for mode in ["link", "unlisted"]:
            with self.subTest(mode=mode):
                root = self.fixture()
                archive, _ = self.package(root)
                def transform(rows):
                    m = tarfile.TarInfo(full.PREFIX + "blobs/" + "0" * 64)
                    if mode == "link": m.type, m.linkname = tarfile.SYMTYPE, "outside"
                    return rows + [(m, b"")]
                bad = self.rewrite(archive, transform)
                with self.assertRaises(RuntimeError): full.scan(bad)

    def test_duplicate_json_keys_and_unsafe_portable_targets_are_rejected(self):
        with self.assertRaisesRegex(RuntimeError, "Duplicate JSON"):
            full.strict_json(io.StringIO('{"kind":1,"kind":2}'))
        row = {"path": "../private", "bytes": 0, "sha256": "0" * 64}
        with self.assertRaises(RuntimeError): full.index_records({"schema_version": 1, "kind": full.KIND, "entries": [row], "blobs": []})
        for name in ["a/CON.png", "a/x.", "a\\outside", "a/../b"]:
            with self.subTest(name=name), self.assertRaises(RuntimeError):
                full.index_records({"schema_version": 1, "kind": full.KIND, "entries": [{**row,"path":name}], "blobs": []})

    def test_deterministic_full_archive_does_not_depend_on_output_name(self):
        root = self.fixture()
        archive, release = self.package(root)
        other = root / "artifacts/another.tar.gz"
        second = full.build(root, other)
        self.assertEqual(release["sha256"], second["sha256"])
        self.assertEqual(archive.read_bytes(), other.read_bytes())

    def test_corrupt_payload_with_rehashed_outer_archive_never_publishes_staged_images(self):
        root = self.fixture()
        archive, release = self.package(root)
        target = self.target(root)
        def transform(rows):
            member, value = next((m,v) for m,v in rows[1:] if v)
            return [(m, bytes([v[0]^1])+v[1:] if m is member else v) for m,v in rows]
        bad = self.rewrite(archive, transform)
        forged = {**release,"bytes":bad.stat().st_size,"sha256":media_inventory.digest(bad)}
        with self.assertRaisesRegex(RuntimeError, "Payload SHA"):
            full.install(bad, target, forged)
        self.assertFalse((target / full.DATA).exists())
        self.assertEqual(list(target.glob(".foldagent-media-stage-*")), [])

    def test_a_rehashed_archive_cannot_add_targets_outside_the_checkout_inventory(self):
        root = self.fixture()
        archive, release = self.package(root)
        target = self.target(root)
        def transform(rows):
            member, value = rows[0]
            index = json.loads(value)
            index["entries"].append({**index["entries"][0],"path":"mobilegym/.env"})
            value = json.dumps(index).encode()
            member.size = len(value)
            return [(member,value),*rows[1:]]
        bad = self.rewrite(archive, transform)
        forged = {**release,"bytes":bad.stat().st_size,"sha256":media_inventory.digest(bad)}
        with self.assertRaisesRegex(RuntimeError,"checkout"):
            full.install(bad,target,forged)
        self.assertFalse((target / "mobilegym/.env").exists())

    def test_insufficient_output_space_refuses_before_creating_an_archive(self):
        root = self.fixture()
        with patch.object(full.shutil,"disk_usage",return_value=type("Space",(),{"free":0})()):
            with self.assertRaisesRegex(RuntimeError,"headroom"):
                self.package(root)
        self.assertEqual(list((root / "artifacts").iterdir()),[])

    def test_clean_committed_inputs_produce_a_source_pinned_bundle(self):
        root = self.fixture()
        subprocess.run(["git","-C",str(root),"add","media_sources/manifest.json",full.SNAPSHOT],check=True,capture_output=True)
        subprocess.run(["git","-C",str(root),"-c","user.name=Synthetic Test","-c","user.email=synthetic@example.test","commit","-qm","fixture"],check=True,capture_output=True)
        archive, release = self.package(root)
        commit = subprocess.check_output(["git","-C",str(root),"rev-parse","HEAD"]).decode().strip()
        self.assertEqual(release["inputs_commit"],commit)
        self.assertTrue(full.scan(archive,release)["passed"])

    def test_publication_interruption_leaves_verified_new_files_and_resumes_without_overwrite(self):
        root = self.fixture()
        archive, release = self.package(root)
        target = self.target(root)
        original_link = os.link
        published = []
        def interrupt(source,destination):
            if published:
                raise OSError("Synthetic publication interruption")
            original_link(source,destination)
            published.append(Path(destination))
        with patch.object(full.os,"link",side_effect=interrupt):
            with self.assertRaisesRegex(OSError,"interruption"):
                full.install(archive,target,release)
        self.assertEqual(len(published),1)
        self.assertTrue(published[0].is_file())
        self.assertEqual(list(target.glob(".foldagent-media-stage-*")),[])
        self.assertGreater(full.install(archive,target,release)["installed"],0)
        self.assertTrue(full.install(archive,target,release,True)["passed"])

    def test_uncommitted_source_metadata_cannot_be_claimed_as_a_pinned_release(self):
        root = self.fixture()
        subprocess.run(["git","-C",str(root),"add","media_sources/manifest.json",full.SNAPSHOT],check=True,capture_output=True)
        subprocess.run(["git","-C",str(root),"-c","user.name=Synthetic Test","-c","user.email=synthetic@example.test","commit","-qm","fixture"],check=True,capture_output=True)
        (root / "media_sources/README.md").write_bytes(b"Uncommitted guide")
        with self.assertRaisesRegex(RuntimeError,"Commit reviewed"):
            self.package(root)

    def test_deep_windows_paths_install_without_admin_or_registry_changes(self):
        root = self.fixture()
        source = root / "media_sources/overrides/long-part" / (("icon_" * 18) + ".png")
        source.parent.mkdir(parents=True)
        source.write_bytes(b"Synthetic deep path media")
        subprocess.run(["git","-C",str(root),"add","media_sources/overrides"],check=True,capture_output=True)
        file = root / "media_sources/manifest.json"
        manifest = json.loads(file.read_text())
        manifest["local_layers"] = media_inventory.local_inventory(root)
        file.write_text(json.dumps(manifest))
        archive,release = self.package(root)
        target = self.target(root,deep=True)
        expected = target / full.DATA / "long-part" / source.name
        self.assertGreater(len(str(expected)),260)
        self.assertTrue(full.install(archive,target,release)["passed"])
        self.assertTrue(full.install(archive,target,release,True)["passed"])

    def test_pinned_metadata_survives_real_git_checkout_with_autocrlf_enabled(self):
        root = self.fixture()
        subprocess.run(["git","-C",str(root),"config","core.autocrlf","false"],check=True,capture_output=True)
        (root / "media_sources/README.md").write_bytes(b"Guide line one\nGuide line two\n")
        for name in ["media_sources/manifest.json",full.SNAPSHOT]:
            file = root / name
            file.write_bytes((json.dumps(json.loads(file.read_text()), indent=2) + "\n").encode("utf-8"))
        attributes = (media_inventory.ROOT / ".gitattributes").read_bytes()
        (root / ".gitattributes").write_bytes(attributes)
        snapshot = full.SNAPSHOT
        if b"foldmobilegym/** -text" in attributes:
            # The standalone checkout has a renamed frontend; exercise its actual
            # attributes rather than a legacy fixture that does not exist there.
            shutil.move(str(root / "mobilegym"), str(root / "foldmobilegym"))
            tracked = subprocess.check_output(["git", "-C", str(root), "ls-files", "-z", "mobilegym"]).decode().rstrip("\0").split("\0")
            subprocess.run(["git", "-C", str(root), "add", "-u", "mobilegym"], check=True, capture_output=True)
            renamed = ["foldmobilegym/" + name[len("mobilegym/"):] for name in tracked if name]
            subprocess.run(["git", "-C", str(root), "add", *renamed], check=True, capture_output=True)
            snapshot = "foldmobilegym/DATA_SNAPSHOT.json"
        subprocess.run(["git","-C",str(root),"add","media_sources/manifest.json","media_sources/README.md",snapshot,".gitattributes"],check=True,capture_output=True)
        subprocess.run(["git","-C",str(root),"-c","user.name=Synthetic Test","-c","user.email=synthetic@example.test","commit","-qm","pinned fixture"],check=True,capture_output=True)
        archive,release = self.package(root)
        clone=Path(tempfile.mkdtemp(prefix="foldagent-full-checkout-"));self.addCleanup(self.cleanup_owned,clone)
        subprocess.run(["git","clone","--no-local","--no-checkout",str(root),str(clone)],check=True,capture_output=True)
        subprocess.run(["git","-C",str(clone),"config","core.autocrlf","true"],check=True,capture_output=True)
        subprocess.run(["git","-C",str(clone),"checkout","HEAD"],check=True,capture_output=True)
        self.assertTrue(full.install(archive,clone,release)["passed"])

    def test_linked_runtime_parent_is_refused_by_cached_directory_validation(self):
        root = self.fixture()
        source = root / full.DATA / "bilibili/synthetic.jpg"
        content=source.read_bytes();source.unlink();source.parent.rmdir()
        outside=Path(tempfile.mkdtemp(prefix="foldagent-full-outside-"));self.addCleanup(self.cleanup_owned,outside)
        (outside / "synthetic.jpg").write_bytes(content)
        link=source.parent
        try:
            if os.name == "nt":
                subprocess.run(["cmd","/c","mklink","/J",str(link),str(outside)],check=True,capture_output=True)
                self.addCleanup(lambda:link.rmdir() if link.exists() else None)
            else:
                link.symlink_to(outside,target_is_directory=True)
        except (OSError,subprocess.CalledProcessError):
            self.skipTest("Host cannot create the synthetic source link")
        with self.assertRaisesRegex(RuntimeError,"Linked source"):
            self.package(root)
        self.assertEqual((outside / "synthetic.jpg").read_bytes(),content)

    def test_linked_destination_is_not_followed(self):
        root = self.fixture()
        archive, release = self.package(root)
        target = self.target(root)
        outside = Path(tempfile.mkdtemp(prefix="foldagent-full-outside-"))
        self.addCleanup(self.cleanup_owned, outside)
        link = target / "mobilegym/apps"
        try:
            if os.name == "nt":
                subprocess.run(["cmd", "/c", "mklink", "/J", str(link), str(outside)], check=True, capture_output=True)
                self.addCleanup(lambda: link.rmdir() if link.exists() else None)
            else:
                link.symlink_to(outside, target_is_directory=True)
        except (OSError, subprocess.CalledProcessError):
            self.skipTest("Host cannot create the synthetic link")
        with self.assertRaisesRegex(RuntimeError, "Linked"):
            full.install(archive, target, release)
        self.assertEqual(list(outside.iterdir()), [])


if __name__ == "__main__":
    unittest.main()
