"""Build one immutable FoldAgentBench episode manifest from registered inputs."""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
from pathlib import Path

if __package__ in {None, ""}:
    # Resolve the package from the repository root during direct execution.
    if sys.path and Path(sys.path[0]).resolve() == Path(__file__).resolve().parent:
        sys.path.pop(0)
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from foldagent_runtime.task_instantiator import materialize_task


ROOT = Path(__file__).resolve().parent


def _load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def _ground_truth_hash(success_all: list[dict]) -> str:
    payload = json.dumps(success_all, sort_keys=True, ensure_ascii=False).encode("utf-8")
    return hashlib.sha256(payload).hexdigest()


def _seed_hash(seed: dict) -> str:
    payload = json.dumps(seed, sort_keys=True, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    return hashlib.sha256(payload).hexdigest()


def build_episode(task_id: str, instance_id: str, run_seed: int) -> dict:
    task_path = ROOT / "tasks" / "converted" / f"{task_id}.json"
    if not task_path.exists():
        raise ValueError(
            f"unknown task_id: {task_id}; this runtime does not bundle the old task catalog. "
            "Use --task-file with --seed-file, or install registered tasks in "
            f"{ROOT / 'tasks' / 'converted'}"
        )
    task = _load_json(task_path)

    instance_path = ROOT / "tasks" / "instances" / task["pair_id"] / f"{instance_id}.json"
    if not instance_path.exists():
        raise ValueError(f"unknown instance_id for {task['pair_id']}: {instance_id}")
    instance = _load_json(instance_path)
    if instance.get("pair_id") != task["pair_id"]:
        raise ValueError("instance pair_id does not match task")
    if instance.get("ground_truth_hash") != _ground_truth_hash(instance.get("success_all", [])):
        raise ValueError("instance ground_truth_hash mismatch")

    seed_path = ROOT / instance["seed_state"]
    if not seed_path.exists():
        raise ValueError(f"instance seed_state does not exist: {instance['seed_state']}")
    seed = _load_json(seed_path)
    if seed.get("pair_id") != task["pair_id"]:
        raise ValueError("seed pair_id does not match task")
    if instance.get("seed_hash") != _seed_hash(seed):
        raise ValueError("instance seed_hash mismatch")

    episode = materialize_task(
        task,
        seed,
        run_seed=run_seed,
        instance_id=instance_id,
        instance=instance,
    )
    episode["schema_version"] = "foldagentgym.episode.v1"
    return episode


def main() -> None:
    # The Node screenshot runner reads stdout as UTF-8. Windows' locale default
    # may otherwise encode Chinese JSON as GBK even though file output is UTF-8.
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("task_id", help="Converted task id, for example A01-004")
    parser.add_argument("--instance", default="base", help="Registered instance id")
    parser.add_argument("--run-seed", type=int, required=True, help="Shared seed for all five paired conditions")
    parser.add_argument("--output", type=Path, help="Write JSON here; stdout when omitted")
    args = parser.parse_args()

    episode = build_episode(args.task_id, args.instance, args.run_seed)
    encoded = json.dumps(episode, ensure_ascii=False, indent=2) + "\n"
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(encoded, encoding="utf-8")
    else:
        print(encoded, end="")


if __name__ == "__main__":
    main()
