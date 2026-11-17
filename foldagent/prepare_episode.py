"""Admit and materialize registered tasks, custom v2 tasks, or frozen episodes."""
from __future__ import annotations

import argparse
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from jsonschema import Draft202012Validator, ValidationError
from foldagent_runtime.materialize_episode import build_episode
from foldagent_runtime.task_instantiator import _digest, materialize_task, validate_fixed_unfolded_profile
from foldagent_runtime.validate_task import TASK_SCHEMA_VERSIONS, validate


def read_json(file: Path):
    return json.loads(file.read_text(encoding="utf-8-sig"))


def load_episode(args):
    if args.episode_file:
        if args.seed_file or args.instance is not None or args.run_seed is not None:
            raise ValueError("--episode-file is already frozen; do not also supply seed/instance/run-seed")
        episode = read_json(args.episode_file)
    elif args.task_file:
        if not args.seed_file:
            raise ValueError("--task-file requires --seed-file (an explicit fixture, not an action list)")
        task, seed = read_json(args.task_file), read_json(args.seed_file)
        if not isinstance(task, dict) or task.get("schema_version") not in TASK_SCHEMA_VERSIONS:
            raise ValueError("Expected a foldmobilegym.task.v2 or foldagentgym.task.v2 task; v1 JSON/action lists/design-only cards are not executable web tasks")
        if not isinstance(seed, dict):
            raise ValueError("Seed must be a JSON object")
        episode = materialize_task(task, seed, run_seed=args.run_seed or 0, instance_id=args.instance or "custom")
        episode["schema_version"] = "foldagentgym.episode.v1"
    else:
        if args.seed_file:
            raise ValueError("--seed-file is only valid with --task-file")
        episode = build_episode(args.task, args.instance or "base", args.run_seed or 0)
    schema = read_json(ROOT / "foldagent_runtime/schema/episode.schema.json")
    Draft202012Validator(schema).validate(episode)
    errors = validate(episode["task"])
    if errors:
        raise ValueError("Task admission failed: " + "; ".join(errors))
    for field, hash_field in [("task", "task_hash"), ("seed_state", "seed_hash")]:
        if _digest(episode[field]) != episode[hash_field]:
            raise ValueError(f"{hash_field} mismatch; regenerate the episode after editing a task/seed")
    task = episode["task"]
    if validate_fixed_unfolded_profile(task, episode['run_metadata'].get('run_seed')):
        device = episode["seed_state"].get("device", {})
        if (device.get("posture") != "unfolded" or device.get("active_display") != "inner"
                or device.get("layout_id") != "inner_wide"):
            raise ValueError("Frozen fixed-unfolded episode must preserve the unfolded inner display")
    if task["initial_window"]["mode"] not in {"fullscreen", "split"}:
        raise ValueError("The web controller initializes fullscreen or configured two-app split tasks")
    if task["initial_window"]["focused_app"] not in task["apps"]:
        raise ValueError("Initial focused_app must belong to task.apps")
    if episode["seed_state"].get("pair_id", task["pair_id"]) != task["pair_id"]:
        raise ValueError("Seed pair_id does not match task")
    return episode


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    parser = argparse.ArgumentParser(description=__doc__)
    source = parser.add_mutually_exclusive_group(required=True)
    source.add_argument("--task")
    source.add_argument("--task-file", type=Path)
    source.add_argument("--episode-file", type=Path)
    parser.add_argument("--seed-file", type=Path)
    parser.add_argument("--instance")
    parser.add_argument("--run-seed", type=int)
    args = parser.parse_args()
    if args.run_seed is not None and not 0 <= args.run_seed <= 9007199254740991:
        parser.error("run-seed must be a non-negative safe integer")
    try:
        print(json.dumps(load_episode(args), ensure_ascii=False))
    except (ValueError, KeyError, TypeError, OSError, ValidationError) as error:
        parser.exit(1, str(error) + "\n")


if __name__ == "__main__":
    main()

