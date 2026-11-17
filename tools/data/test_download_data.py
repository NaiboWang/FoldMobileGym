"""Resumable-download tests against real loopback HTTP, without public downloads."""
import contextlib
import hashlib
import io
import os
import subprocess
import tempfile
import threading
import unittest
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from unittest.mock import patch

import prepare_data as data


class DownloadTests(unittest.TestCase):
    def fixture(self, responses):
        temporary = tempfile.TemporaryDirectory(prefix="foldagent-download-test-")
        self.addCleanup(temporary.cleanup)
        repo = Path(temporary.name)
        archive = repo / "cache" / "release.tar.gz"
        archive.parent.mkdir()
        payload = b"synthetic public archive bytes" * 4
        requests = []

        class Handler(BaseHTTPRequestHandler):
            def do_GET(self):
                requests.append(self.headers.get("Range"))
                status, headers, body = responses.pop(0)
                self.send_response(status)
                for name, value in headers.items():
                    self.send_header(name, str(value))
                self.end_headers()
                self.wfile.write(body)

            def log_message(self, *args):
                pass

        server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()

        def stop():
            server.shutdown()
            server.server_close()
            thread.join(timeout=2)

        self.addCleanup(stop)
        settings = patch.multiple(data, REPO=repo, URL=f"http://127.0.0.1:{server.server_port}/release",
                                  SIZE=len(payload), SHA256=hashlib.sha256(payload).hexdigest())
        return repo, archive, payload, requests, settings

    def test_interrupted_transfer_resumes_exact_http_range_and_reuses_verified_cache(self):
        responses = []
        _, archive, payload, requests, settings = self.fixture(responses)
        responses.extend([(200, {"Content-Length": len(payload)}, payload[:17]),
                          (206, {"Content-Length": len(payload) - 17,
                                 "Content-Range": f"bytes 17-{len(payload)-1}/{len(payload)}"}, payload[17:])])
        with settings, contextlib.redirect_stdout(io.StringIO()):
            with self.assertRaisesRegex(RuntimeError, "incomplete"):
                data.download_archive(archive)
            self.assertEqual(archive.with_suffix(".partial").read_bytes(), payload[:17])
            self.assertFalse(archive.exists())
            data.download_archive(archive)
            data.download_archive(archive)
        self.assertEqual(requests, [None, "bytes=17-"])
        self.assertEqual(archive.read_bytes(), payload)
        self.assertFalse(archive.with_suffix(".partial").exists())

    def test_invalid_range_responses_preserve_partial_without_appending(self):
        for kind in ["ignored", "wrong_offset", "wrong_total", "wrong_length", "encoded"]:
            with self.subTest(kind=kind):
                responses = []
                _, archive, payload, _, settings = self.fixture(responses)
                partial = archive.with_suffix(".partial")
                partial.write_bytes(payload[:17])
                headers = {"Content-Length": len(payload)-17,
                           "Content-Range": f"bytes 17-{len(payload)-1}/{len(payload)}"}
                status = 206
                if kind == "ignored":
                    status = 200
                if kind == "wrong_offset":
                    headers["Content-Range"] = f"bytes 0-{len(payload)-1}/{len(payload)}"
                if kind == "wrong_total":
                    headers["Content-Range"] = f"bytes 17-{len(payload)-1}/{len(payload)+1}"
                if kind == "wrong_length":
                    headers["Content-Length"] = 1
                if kind == "encoded":
                    headers["Content-Encoding"] = "gzip"
                responses.append((status, headers, payload[17:]))
                with settings, contextlib.redirect_stdout(io.StringIO()), self.assertRaises(RuntimeError):
                    data.download_archive(archive)
                self.assertEqual(partial.read_bytes(), payload[:17])
                self.assertFalse(archive.exists())

    def test_corrupt_complete_download_is_not_published(self):
        responses = []
        _, archive, payload, _, settings = self.fixture(responses)
        responses.append((200, {"Content-Length": len(payload)}, b"x" * len(payload)))
        with settings, contextlib.redirect_stdout(io.StringIO()), self.assertRaisesRegex(RuntimeError, "SHA-256"):
            data.download_archive(archive)
        self.assertFalse(archive.exists())
        self.assertEqual(archive.with_suffix(".partial").read_bytes(), b"x" * len(payload))

    def test_complete_partial_is_published_without_network_and_bad_cache_is_preserved(self):
        _, archive, payload, requests, settings = self.fixture([])
        archive.with_suffix(".partial").write_bytes(payload)
        with settings:
            data.download_archive(archive)
            archive.write_bytes(b"user file")
            with self.assertRaisesRegex(RuntimeError, "existing file preserved"):
                data.download_archive(archive)
        self.assertEqual(requests, [])
        self.assertEqual(archive.read_bytes(), b"user file")

    def test_zero_byte_partial_can_restart_without_overwriting_data(self):
        responses = []
        _, archive, payload, requests, settings = self.fixture(responses)
        archive.with_suffix(".partial").touch()
        responses.append((200, {"Content-Length": len(payload)}, payload))
        with settings, contextlib.redirect_stdout(io.StringIO()):
            data.download_archive(archive)
        self.assertEqual(requests, [None])
        self.assertEqual(archive.read_bytes(), payload)

    def test_oversized_partial_or_response_is_not_published(self):
        responses = []
        _, archive, payload, requests, settings = self.fixture(responses)
        partial = archive.with_suffix(".partial")
        partial.write_bytes(payload + b"extra")
        with settings, self.assertRaisesRegex(RuntimeError, "exceeds"):
            data.download_archive(archive)
        self.assertEqual(requests, [])
        self.assertEqual(partial.read_bytes(), payload + b"extra")
        partial.write_bytes(b"")  # Owned synthetic fixture only.
        responses.append((200, {}, payload + b"extra"))
        with settings, contextlib.redirect_stdout(io.StringIO()), self.assertRaisesRegex(RuntimeError, "exceeds"):
            data.download_archive(archive)
        self.assertFalse(archive.exists())

    def test_publication_collision_preserves_verified_partial_and_new_destination(self):
        _, archive, payload, requests, settings = self.fixture([])
        archive.with_suffix(".partial").write_bytes(payload)

        def collision(*args):
            archive.write_bytes(b"concurrent destination")
            raise FileExistsError("exclusive publication refused")

        with settings, patch.object(data.os, "link", side_effect=collision), self.assertRaises(FileExistsError):
            data.download_archive(archive)
        self.assertEqual(requests, [])
        self.assertEqual(archive.read_bytes(), b"concurrent destination")
        self.assertEqual(archive.with_suffix(".partial").read_bytes(), payload)

    @unittest.skipUnless(os.name == "nt", "Actual Windows cache junction regression")
    def test_cache_junction_is_refused_before_network_or_external_write(self):
        repo, archive, _, requests, settings = self.fixture([])
        external = repo / "external"
        external.mkdir()
        linked = repo / "linked-cache"
        result = subprocess.run(["cmd.exe", "/c", "mklink", "/J", str(linked), str(external)],
                                capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stderr)
        with settings, self.assertRaisesRegex(RuntimeError, "reparse"):
            data.download_archive(linked / archive.name)
        self.assertEqual(requests, [])
        self.assertEqual(list(external.iterdir()), [])


if __name__ == "__main__":
    unittest.main()
