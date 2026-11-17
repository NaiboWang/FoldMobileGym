"""Deterministically materialize a paired task under a posture protocol.

All five conditions for a workflow must be materialized with the same
``run_seed``. This keeps content, initial posture, model, and randomness paired;
only the controller event schedule differs.
"""

from __future__ import annotations

import copy
import hashlib
import json
from typing import Any

from foldagent_runtime.validate_task import validate

PROTOCOLS = (
    {
        "id": "inner_to_cover",
        "posture": "unfolded", "layout": "inner_wide",
        "map": {"unfolded": "unfolded", "folded": "folded", "tabletop": "tabletop"},
    },
    {
        "id": "cover_to_inner",
        "posture": "folded", "layout": "cover_single",
        "map": {"unfolded": "folded", "folded": "unfolded", "tabletop": "tabletop"},
    },
    {
        "id": "tabletop_to_cover",
        "posture": "tabletop", "layout": "inner_book",
        "map": {"unfolded": "tabletop", "folded": "folded", "tabletop": "unfolded"},
    },
    {
        "id": "cover_to_tabletop",
        "posture": "folded", "layout": "cover_single",
        "map": {"unfolded": "folded", "folded": "tabletop", "tabletop": "unfolded"},
    },
)


def _digest(value: Any) -> str:
    # Matches JSON.stringify(stable(value)) in the web controller.
    encoded = json.dumps(value, sort_keys=True, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


def validate_fixed_unfolded_profile(task: dict[str, Any], run_seed: int) -> bool:
    """Validate both fixed-unfolded protocols, also for already frozen episodes."""
    profile = task.get('metadata', {}).get('benchmark_profile')
    if profile not in {'unfolded_static_v1', 'unfolded_static_multi_window_v1'}:
        return False
    if run_seed != 0:
        raise ValueError(f'{profile} requires run_seed=0; changing the posture protocol is not allowed')
    w, evaluator = task['initial_window'], task['evaluator']
    contract = task.get('seed_contract', {}).get('workflow_v1', {})
    window = contract.get('window')
    if (task['condition'] != 'static' or task.get('event_plan') or task.get('recovery')
            or w['posture'] != 'unfolded' or w['layout'] != 'inner_wide'
            or evaluator.get('must_have_events') or evaluator.get('require_post_transition_action')):
        raise ValueError(f'Invalid {profile} initial state or event policy')
    if profile == 'unfolded_static_v1':
        if w['mode'] != 'fullscreen' or window:
            raise ValueError(f'Invalid {profile} fullscreen policy')
    elif (not window or window.get('orientation') not in {'side_by_side', 'stacked'}
          or w['mode'] != ('fullscreen' if window.get('create_split') else 'split')
          or (not window.get('create_split') and
              (w.get('split_orientation') != window['orientation']
               or w.get('split_apps') != [contract['source']['app'], contract['target']['app']]))):
        raise ValueError(f'Invalid {profile} window contract')
    return True


def materialize_task(task: dict[str, Any], seed_state: dict[str, Any], *, run_seed: int, instance_id: str = "base", instance: dict[str, Any] | None = None) -> dict[str, Any]:
    """Return an immutable episode manifest; inputs are never modified."""
    errors = validate(task)
    if errors:
        raise ValueError(f"Source task admission failed: {errors}")
    validate_fixed_unfolded_profile(task, run_seed)
    concrete_task = copy.deepcopy(task)
    concrete_seed = copy.deepcopy(seed_state)
    if instance is not None:
        if instance.get("pair_id") != task.get("pair_id"):
            raise ValueError("instance pair_id does not match task")
        instance_id = str(instance["instance_id"])
        concrete_task["instruction"] = instance["instruction"]
        concrete_task["seed_contract"] = copy.deepcopy(instance["seed_contract"])
        concrete_task["evaluator"]["success_all"] = copy.deepcopy(instance["success_all"])
        if not isinstance(concrete_task["seed_contract"], dict):
            raise ValueError("Instance seed_contract must be an object")
        if "price_note" in task["seed_contract"] and "price_note" not in concrete_task["seed_contract"]:
            raise ValueError("Instance cannot remove the price_note business contract")
    validate_fixed_unfolded_profile(concrete_task, run_seed)
    protocol = PROTOCOLS[run_seed % len(PROTOCOLS)]
    if task["initial_window"]["mode"] == "split" and protocol["posture"] == "tabletop":
        raise ValueError("Split initialization does not support tabletop; use run_seed % 4 = 0, 1, or 3")
    posture_map = protocol["map"]

    concrete_task["initial_window"]["posture"] = protocol["posture"]
    concrete_task["initial_window"]["layout"] = protocol["layout"]
    for event in concrete_task.get("event_plan", []):
        transition = event["transition"]
        transition["from_posture"] = posture_map[transition["from_posture"]]
        transition["to_posture"] = posture_map[transition["to_posture"]]
        if (transition["from_posture"] == transition["to_posture"]
                and not (concrete_task.get("condition") == "recovery"
                         and event.get("fault", {}).get("type") == "recreate_app"
                         and event.get("fault", {}).get("preserve_persisted_state") is True)):
            raise ValueError(f"protocol {protocol['id']} collapses event {event['event_id']}")

    device = concrete_seed.setdefault("device", {})
    device.update({
        "posture": protocol["posture"],
        "hinge_angle": 0 if protocol["posture"] == "folded" else 90 if protocol["posture"] == "tabletop" else 180,
        "active_display": "cover" if protocol["posture"] == "folded" else "inner",
        "layout_id": protocol["layout"],
    })
    for display_id, display in concrete_seed.get("displays", {}).items():
        display["visible"] = display_id == device["active_display"]
    active = concrete_seed.get("displays", {}).get(device["active_display"], {})
    for window in concrete_seed.get("windows", []):
        window["display"] = device["active_display"]
        window["bounds"] = [0, 0, active.get("width", 0), active.get("height", 0)]

    run_metadata = {
        "instance_id": instance_id,
        "run_seed": run_seed,
        "protocol_id": protocol["id"],
        "initial_posture": protocol["posture"],
        "transition_directions": [
            f"{event['transition']['from_posture']}->{event['transition']['to_posture']}"
            for event in concrete_task.get("event_plan", [])
        ],
    }
    concrete_task.setdefault("metadata", {})["materialization"] = copy.deepcopy(run_metadata)
    # Instances replace instruction/source/business rules, and posture mapping
    # changes events. Validate the actual task that will reach the controller,
    # not only the previously admitted template, before issuing manifest hashes.
    errors = validate(concrete_task)
    if errors:
        raise ValueError(f"Materialized task admission failed: {errors}")
    return {
        "task": concrete_task,
        "seed_state": concrete_seed,
        "run_metadata": run_metadata,
        "task_hash": _digest(concrete_task),
        "seed_hash": _digest(concrete_seed),
    }
