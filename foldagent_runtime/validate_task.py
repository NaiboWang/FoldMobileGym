"""Strict static admission checks for FoldAgentBench L1 task v2."""

from __future__ import annotations

import argparse
import copy
import json
import sys
from collections import Counter, defaultdict
from pathlib import Path

# Resolve imports from the repository root during direct execution.
if __package__ in {None, ""} and sys.path and Path(sys.path[0]).resolve() == Path(__file__).resolve().parent:
    sys.path.pop(0)

from jsonschema import Draft202012Validator


TASK_SCHEMA_VERSIONS = ("foldmobilegym.task.v2", "foldagentgym.task.v2")
CONDITIONS = {"static", "pre_transition", "mid_transition", "multi_transition", "recovery"}
EVENT_FIELDS = ["trigger_step", "trigger_state_hash", "posture_before", "posture_after", "layout_before", "layout_after"]
FORBIDDEN_AGENT_ACTIONS = {"fold", "unfold", "set_posture", "set_hinge_angle"}
SCHEMA_DIR = Path(__file__).resolve().parent / "schema"
TASK_SCHEMA = json.loads((SCHEMA_DIR / "task.schema.json").read_text(encoding="utf-8"))
# Inline the sibling event schema. Its own $id would otherwise change the JSON
# Reference base and make task-local #/$defs/rule references resolve against it.
TASK_SCHEMA = copy.deepcopy(TASK_SCHEMA)
TASK_SCHEMA["properties"]["event_plan"]["items"] = json.loads(
    (SCHEMA_DIR / "controller_event.schema.json").read_text(encoding="utf-8")
)
SCHEMA_VALIDATOR = Draft202012Validator(TASK_SCHEMA)


def validate_price_note_contract(task: dict) -> list[str]:
    """Match the browser's explicit opt-in contract; do not infer legacy intent.

    Schema checks handle marker/quantity shape. These checks enforce identities
    and mandatory business gates, not fixture truth or runtime qualification.
    """
    seed = task.get("seed_contract", {})
    if not isinstance(seed, dict) or "price_note" not in seed:
        return []
    marker = seed["price_note"]
    if not isinstance(marker, dict):
        return ["price_note: marker must be an object"]
    errors = []
    if task.get("apps") != ["meituan_waimai", "calculator", "notes"]:
        errors.append("price_note: ordered source/calculator/notes apps are required")
    shop = marker.get("shopId")
    if not isinstance(shop, str) or not shop or seed.get("shop_id") != shop:
        errors.append("price_note: source shop identities must match")
    quantities, dishes = marker.get("quantities"), seed.get("dish_ids")
    if (not isinstance(quantities, dict) or not isinstance(dishes, list)
            or not all(isinstance(dish, str) for dish in dishes)
            or len(dishes) != len(quantities) or len(set(dishes)) != len(dishes)
            or set(dishes) != set(quantities)):
        errors.append("price_note: dish_ids must exactly match unique quantity keys")
    rules = task.get("evaluator", {}).get("success_all", [])
    source_path = f"benchmark.anchors.{task.get('pair_id')}.source_facts_verified"
    if not any(isinstance(rule, dict) and rule.get("path") == source_path
               and rule.get("op") == "eq" and rule.get("value") is True for rule in rules):
        errors.append("price_note: source delivery equality guard is required")
    if not any(isinstance(rule, dict) and rule.get("path") == "apps.notes.created_count"
               and rule.get("op") == "delta_eq" and type(rule.get("value")) in (int, float)
               and rule["value"] == 1 for rule in rules):
        errors.append("price_note: exactly one newly created note guard is required")
    return errors


def validate(task: dict) -> list[str]:
    errors: list[str] = []
    errors.extend(
        f"schema:{error.json_path}: {error.message}"
        for error in sorted(SCHEMA_VALIDATOR.iter_errors(task), key=lambda item: list(item.path))
    )
    errors.extend(validate_price_note_contract(task))
    modern = task.get('seed_contract', {}).get('single_app_v3')
    if isinstance(modern, dict):
        apps = dict(SA01='notes', SA02='wechat', SA03='mail', SA04='calendar', SA06='browser',
                    SA07='map', SA08='weather', SA09='contacts', SA10='sms', SA11='clock',
                    SA12='settings', SA13='gallery', SA14='file_manager')
        app = apps.get(modern.get('card'))
        expected = [app, 'answer_sheet'] if modern.get('card') == 'SA08' else [app]
        if app != modern.get('app') or task.get('apps') != expected:
            errors.append('single_app_v3: card/app binding mismatch')
        if any(k in task['seed_contract'] for k in ['single_app_v1', 'workflow_v1']):
            errors.append('single_app_v3: incompatible contract markers')
        if task.get('condition') != 'static' or task.get('metadata', {}).get('benchmark_profile') != 'unfolded_static_v1':
            errors.append('single_app_v3: fixed-unfolded Static policy required')
        for group, field in [('success_all', 'business_passed'), ('safety_all', 'safety_passed')]:
            if not any(r.get('path') == 'single_app.' + field and r.get('op') == 'eq' and r.get('value') is True
                       for r in task.get('evaluator', {}).get(group, [])):
                errors.append('single_app_v3: mandatory ' + field + ' gate missing')
    single = task.get('seed_contract', {}).get('single_app_v1')
    if single is not None:
        expected_apps = {'SA01': ['notes'], 'SA02': ['wechat']}.get(single.get('card')) if isinstance(single, dict) else None
        if expected_apps is None or task.get('apps') != expected_apps or 'workflow_v1' in task.get('seed_contract', {}):
            errors.append('single_app_v1: supported card requires its single app and no workflow_v1')
        for group, path in [('success_all', 'single_app.business_passed'), ('safety_all', 'single_app.safety_passed')]:
            if not any(rule.get('path') == path and rule.get('op') == 'eq' and rule.get('value') is True
                       for rule in task.get('evaluator', {}).get(group, [])):
                errors.append(f'single_app_v1: mandatory {path} equality gate missing')
        if task.get('condition') == 'recovery':
            errors.append('single_app_v1: recovery is not yet qualified')
        if task.get('initial_window', {}).get('posture') not in {'folded', 'unfolded'}:
            errors.append('single_app_v1: only folded/unfolded are supported')
        if any(event.get('transition', {}).get(key) not in {'folded', 'unfolded'}
               for event in task.get('event_plan', []) for key in ['from_posture', 'to_posture']):
            errors.append('single_app_v1: tabletop transition is not supported')
    initial = task.get("initial_window", {})
    if isinstance(initial, dict):
        if initial.get("focused_app") not in task.get("apps", []):
            errors.append("Initial focused_app must belong to task.apps")
        panes = initial.get("split_apps", [])
        if initial.get("mode") == "split" and isinstance(panes, list):
            if any(app not in task.get("apps", []) for app in panes):
                errors.append("Initial split_apps must belong to task.apps")
            if initial.get("focused_app") not in panes:
                errors.append("Initial focused_app must belong to split_apps")
    if task.get("schema_version") not in TASK_SCHEMA_VERSIONS:
        errors.append("unsupported task schema")
    if task.get("environment_tier") != "L1-controlled-web":
        errors.append("main-suite task must use L1-controlled-web")
    if task.get("adapter", {}).get("status") != "ready":
        errors.append("app adapter is not ready")
    if task.get("adapter", {}).get("privileged_state_exposed_to_agent") is not False:
        errors.append("privileged judge state must not be exposed to the agent")
    condition = task.get("condition")
    if condition not in CONDITIONS:
        errors.append("invalid paired condition")
    events = task.get("event_plan", [])
    expected_events = 0 if condition == "static" else 2 if condition == "multi_transition" else 1
    if len(events) != expected_events:
        errors.append(f"{condition} must define exactly {expected_events} controller event(s)")
    event_ids = []
    for event in events:
        event_id = event.get("event_id")
        event_ids.append(event_id)
        if event.get("controller") != "benchmark":
            errors.append(f"{event_id}: event is not benchmark-controller-owned")
        trigger = event.get("trigger", {})
        if not trigger.get("all") or "phase" in trigger:
            errors.append(f"{event_id}: trigger must be a concrete state predicate")
        transition = event.get("transition", {})
        if (transition.get("from_posture") == transition.get("to_posture")
                and not (condition == "recovery" and event.get("fault", {}).get("type") == "recreate_app"
                         and event.get("fault", {}).get("preserve_persisted_state") is True)):
            errors.append(f"{event_id}: transition does not change posture")
        if event.get("evidence") != EVENT_FIELDS:
            errors.append(f"{event_id}: incomplete event evidence contract")
        if any(action in json.dumps(event).lower() for action in FORBIDDEN_AGENT_ACTIONS) and event.get("controller") != "benchmark":
            errors.append(f"{event_id}: posture action is agent-owned")
    evaluator = task.get("evaluator", {})
    if not evaluator.get("success_all"):
        errors.append("success assertions are empty")
    if not evaluator.get("safety_all"):
        errors.append("safety assertions are empty")
    for group in ("success_all", "safety_all"):
        for rule in evaluator.get(group, []):
            if not {"path", "op", "value"} <= rule.keys():
                errors.append(f"{group}: malformed predicate")
    if Counter(evaluator.get("must_have_events", [])) != Counter(event_ids):
        errors.append("must_have_events must exactly match event_plan")
    if evaluator.get("require_post_transition_action") != (condition != "static"):
        errors.append("post-transition action requirement does not match condition")
    if condition == "recovery":
        recovery = task.get("recovery")
        if isinstance(recovery, dict) and "retained_apps" in recovery:
            retained = recovery["retained_apps"]
            if (not isinstance(retained, list) or not retained or not all(isinstance(app, str) for app in retained)
                    or len(set(retained)) != len(retained)
                    or any(app not in task.get("apps", []) or app == recovery.get("app_id") for app in retained)):
                errors.append("recovery retained_apps must be unique other task apps")
        if not recovery or not recovery.get("required_context") or recovery.get("no_duplicate_commit") is not True:
            errors.append("recovery condition lacks a strict recovery contract")
        elif recovery.get("capture_strategy") not in ("persisted_plus_visible_form_hash", "persisted_plus_target_form_hash") or recovery.get("completion_condition") != "success_all":
            errors.append("recovery condition lacks executable context/completion semantics")
        elif recovery.get("capture_strategy") == "persisted_plus_target_form_hash" and not task.get("seed_contract", {}).get("workflow_v1"):
            errors.append("target-form recovery requires the versioned workflow_v1 contract")
        if not events or events[0].get("fault", {}).get("type") != "recreate_app":
            errors.append("recovery condition must inject app recreation")
    elif task.get("recovery") is not None:
        errors.append("non-recovery task must not carry a recovery fault contract")
    return errors


def validate_suite(index_path: Path) -> list[str]:
    index = json.loads(index_path.read_text(encoding="utf-8"))
    tasks = [json.loads((index_path.parent / row["path"]).read_text(encoding="utf-8")) for row in index.get("tasks", [])]
    errors: list[str] = []
    if len(tasks) != 110:
        errors.append(f"suite must contain exactly 110 tasks, got {len(tasks)}")
    grouped: dict[str, list[dict]] = defaultdict(list)
    for task in tasks:
        grouped[task.get("pair_id", "")].append(task)
        errors.extend(f"{task.get('id')}: {error}" for error in validate(task))
    if len(grouped) != 22:
        errors.append(f"suite must contain exactly 22 paired workflows, got {len(grouped)}")
    for pair_id, members in sorted(grouped.items()):
        if Counter(item.get("condition") for item in members) != Counter(CONDITIONS):
            errors.append(f"{pair_id}: paired conditions are incomplete or duplicated")
        if not members:
            continue
        reference = members[0]
        for item in members[1:]:
            for field in ("instruction", "initial_state", "initial_window", "apps", "seed_contract"):
                if item.get(field) != reference.get(field):
                    errors.append(f"{pair_id}: invariant field differs: {field}")
            for field in ("success_all", "safety_all"):
                if item.get("evaluator", {}).get(field) != reference.get("evaluator", {}).get(field):
                    errors.append(f"{pair_id}: invariant evaluator differs: {field}")
        seed = index_path.parent.parent / "seeds" / f"{pair_id}.json"
        if not seed.exists():
            errors.append(f"{pair_id}: seed file is missing")
    return errors


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("path", help="task JSON or converted/index.json")
    args = parser.parse_args()
    path = Path(args.path).resolve()
    doc = json.loads(path.read_text(encoding="utf-8"))
    errors = validate_suite(path) if "tasks" in doc and path.name == "index.json" else validate(doc)
    if errors:
        print("NOT READY")
        for error in errors:
            print(f"- {error}")
        raise SystemExit(1)
    print("READY")


if __name__ == "__main__":
    main()
