"""Exercise the renamed runtime with actual examples and frozen/registered inputs."""
from __future__ import annotations

import copy
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

from foldagent_runtime import materialize_episode as registry
from foldagent_runtime.task_instantiator import _digest, materialize_task
from foldagent_runtime.validate_task import validate


ROOT = Path(__file__).resolve().parents[2]
EXAMPLES = ROOT / "foldagent/examples"


def read(path):
    return json.loads(path.read_text(encoding="utf-8-sig"))


class RuntimeMigrationTests(unittest.TestCase):
    def setUp(self):
        self.task = read(EXAMPLES / "calculator.task.json")
        self.seed = read(EXAMPLES / "calculator.seed.json")

    def prepare(self, *args, cwd=None):
        # Isolated Python must discover this checkout through prepare_episode.py,
        # rather than the source project or the caller's working directory.
        return subprocess.run(
            [sys.executable, "-I", str(ROOT / "foldagent/prepare_episode.py"), *map(str, args)],
            cwd=cwd or ROOT, capture_output=True, text=True, encoding="utf-8",
        )

    def test_custom_task_imports_from_an_unrelated_working_directory(self):
        with tempfile.TemporaryDirectory() as folder:
            result = self.prepare("--task-file", EXAMPLES / "calculator.task.json",
                                  "--seed-file", EXAMPLES / "calculator.seed.json", cwd=folder)
        self.assertEqual(result.returncode, 0, result.stderr)
        episode = json.loads(result.stdout)
        self.assertEqual(episode["task"]["id"], "J99-001")
        self.assertEqual(episode["task_hash"], _digest(episode["task"]))
        self.assertEqual(episode["schema_version"], "foldagentgym.episode.v1")

    def test_all_bundled_custom_examples_pass_admission(self):
        examples = [
            ("calculator.task.json", "calculator.seed.json"),
            ("calculator_fold.task.json", "calculator.seed.json"),
            ("template_docs_note_static.task.json", "template_docs_note.seed.json"),
            ("template_docs_note_mid_transition.task.json", "template_docs_note.seed.json"),
            ("split_posture/H50-002.task.json", "split_posture/H50-002.seed.json"),
        ]
        for task, seed in examples:
            with self.subTest(task=task):
                result = self.prepare("--task-file", EXAMPLES / task, "--seed-file", EXAMPLES / seed)
                self.assertEqual(result.returncode, 0, result.stderr)

    def test_frozen_episode_round_trip_and_both_hashes(self):
        episode = materialize_task(self.task, self.seed, run_seed=0)
        episode["schema_version"] = "foldagentgym.episode.v1"
        with tempfile.TemporaryDirectory() as folder:
            file = Path(folder) / "episode.json"
            file.write_text(json.dumps(episode), encoding="utf-8")
            result = self.prepare("--episode-file", file)
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertEqual(json.loads(result.stdout), episode)
            for field, expected in [("task", "task_hash"), ("seed_state", "seed_hash")]:
                changed = copy.deepcopy(episode)
                changed[field]["migration_tamper_probe"] = True
                if field == "task":
                    changed[field].pop("migration_tamper_probe")
                    changed[field]["instruction"] += " tampered"
                file.write_text(json.dumps(changed), encoding="utf-8")
                result = self.prepare("--episode-file", file)
                self.assertNotEqual(result.returncode, 0)
                self.assertIn(f"{expected} mismatch", result.stderr)

    def test_published_suite_paths_and_materialization(self):
        rows = read(ROOT / "tasks/unfolded_static/manifest.json")["tasks"]
        self.assertTrue(rows, "The published manifest must not be empty")
        self.assertEqual({row["family"] for row in rows},
                         {"single_app", "cross_app_sequential", "multi_window"})
        single = read(ROOT / "tasks/unfolded_static/single_app/manifest.json")
        self.assertEqual(single["tasks"], [row for row in rows if row["family"] == "single_app"])
        for row in rows:
            with self.subTest(task=row["id"]):
                task_file, seed_file = ROOT / row["task"], ROOT / row["seed"]
                for file in [task_file, seed_file, seed_file.with_name("gold.private.json")]:
                    self.assertTrue(file.resolve().is_relative_to(ROOT / "tasks/unfolded_static"))
                    self.assertTrue(file.is_file(), str(file))
                    read(file)
                task, seed = read(task_file), read(seed_file)
                self.assertEqual(task["id"], row["id"])
                self.assertEqual(task["initial_state"], row["seed"])
                episode = materialize_task(task, seed, run_seed=0, instance_id=row["instance"])
                self.assertEqual(episode["task"]["schema_version"], "foldmobilegym.task.v2")
                self.assertEqual(episode["task_hash"], _digest(episode["task"]))
                self.assertEqual(episode["seed_hash"], _digest(episode["seed_state"]))

    def test_published_tasks_load_through_cli_from_unrelated_directory(self):
        rows = read(ROOT / "tasks/unfolded_static/manifest.json")["tasks"]
        with tempfile.TemporaryDirectory() as folder:
            for family in ["single_app", "cross_app_sequential", "multi_window"]:
                row = next(row for row in rows if row["family"] == family)
                with self.subTest(family=family):
                    result = self.prepare("--task-file", ROOT / row["task"],
                                          "--seed-file", ROOT / row["seed"],
                                          "--run-seed", "0", cwd=folder)
                    self.assertEqual(result.returncode, 0, result.stderr)
                    episode = json.loads(result.stdout)
                    self.assertEqual(episode["task"]["id"], row["id"])
                    self.assertEqual(episode["task"]["initial_state"], row["seed"])

    def test_published_seed_path_rejects_traversal_and_unsupported_schema(self):
        row = read(ROOT / "tasks/unfolded_static/manifest.json")["tasks"][0]
        task = read(ROOT / row["task"])
        for invalid_path in [
            "../tasks/unfolded_static/single_app/SA01/instances/base/seed.json",
            "tasks/unfolded_static/single_app/SA01/instances/../seed.json",
            "tasks/unfolded_static/single_app/SA01/instances/base/seed.json/extra",
        ]:
            with self.subTest(path=invalid_path):
                changed = copy.deepcopy(task)
                changed["initial_state"] = invalid_path
                self.assertTrue(any("initial_state" in error for error in validate(changed)))
        for version in ["foldmobilegym.task.v1", "foldagentgym.task.v1", "unknown.task.v2", None, [], {}]:
            changed = copy.deepcopy(task)
            changed["schema_version"] = version
            self.assertIn("unsupported task schema", validate(changed))

    def test_fold_protocol_and_seed_hashes_are_preserved(self):
        task = read(EXAMPLES / "calculator_fold.task.json")
        original = copy.deepcopy((task, self.seed))
        unfolded = materialize_task(task, self.seed, run_seed=0)
        folded = materialize_task(task, self.seed, run_seed=1)
        self.assertEqual(unfolded["task"]["initial_window"]["posture"], "unfolded")
        self.assertEqual(folded["task"]["initial_window"]["posture"], "folded")
        self.assertEqual(folded["task"]["event_plan"][0]["transition"]["to_posture"], "unfolded")
        self.assertEqual(folded["seed_hash"], _digest(folded["seed_state"]))
        self.assertEqual((task, self.seed), original)

    def test_registered_task_loader_uses_the_new_runtime_root(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            instance = {
                "pair_id": "J99", "instance_id": "base",
                "instruction": self.task["instruction"], "seed_contract": self.task["seed_contract"],
                "success_all": self.task["evaluator"]["success_all"],
                "ground_truth_hash": registry._ground_truth_hash(self.task["evaluator"]["success_all"]),
                "seed_state": "tasks/seeds/J99.json", "seed_hash": _digest(self.seed),
            }
            for name, content in [
                ("tasks/converted/J99-001.json", self.task),
                ("tasks/instances/J99/base.json", instance),
                ("tasks/seeds/J99.json", self.seed),
            ]:
                file = root / name
                file.parent.mkdir(parents=True, exist_ok=True)
                file.write_text(json.dumps(content), encoding="utf-8")
            with patch.object(registry, "ROOT", root):
                episode = registry.build_episode("J99-001", "base", 0)
                self.assertEqual(episode["task"]["id"], "J99-001")
                instance["seed_hash"] = "0" * 64
                (root / "tasks/instances/J99/base.json").write_text(json.dumps(instance), encoding="utf-8")
                with self.assertRaisesRegex(ValueError, "seed_hash mismatch"):
                    registry.build_episode("J99-001", "base", 0)

    def test_missing_catalog_reports_the_custom_task_alternative(self):
        result = self.prepare("--task", "G04-001")
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("--task-file", result.stderr)
        self.assertIn("foldagent_runtime", result.stderr)

    def test_direct_validator_entry_works_after_package_rename(self):
        result = subprocess.run(
            [sys.executable, "-I", str(ROOT / "foldagent_runtime/validate_task.py"),
             str(EXAMPLES / "calculator.task.json")],
            capture_output=True, text=True, encoding="utf-8",
        )
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("READY", result.stdout)


if __name__ == "__main__":
    unittest.main()
