"""FoldAgent-MobileGym tasks built exclusively on existing MobileGym apps.

The fold transition is an environment event: tasks never expose a fold action
to the agent.  Each task records controller-owned event evidence in the final
structured state and requires that evidence at evaluation time.
"""

from __future__ import annotations

import hashlib
import json
from typing import Any

from bench_env.task.alipay.tasks import CheckBalance
from bench_env.task.ebay.app import EBAY_SEARCH_QUERY_PARAM, EBAY_SORT_PARAM
from bench_env.task.common_tasks import CriteriaTask
from bench_env.task.judge import JudgeInput


class FoldableTaskMixin:
    """Task lifecycle extension for benchmark-controlled form-factor events."""

    event_id = "fold_after_anchor"
    initial_posture = "unfolded"
    target_posture = "folded"

    async def _prepare(self, env: Any) -> None:
        await super()._prepare(env)
        self._fold_event_injected = False
        await env.set_foldable_posture(self.initial_posture, reset_events=True)

    async def should_inject_fold(self, state: dict[str, Any], step: int) -> bool:
        return step >= 1

    async def after_step(self, env: Any, step: int, _action: Any, _observation: Any) -> bool:
        if getattr(self, "_fold_event_injected", False):
            return False
        state = await env.get_state(required_apps=list(self.apps))
        if not await self.should_inject_fold(state, step):
            return False
        before = (state.get("foldagent") or {}).get("posture", self.initial_posture)
        layout_before = (state.get("foldagent") or {}).get("layout_id", "inner_wide")
        trigger_payload = {"apps": state.get("apps", {}), "os": state.get("os", {})}
        digest = hashlib.sha256(
            json.dumps(trigger_payload, ensure_ascii=False, sort_keys=True, default=str).encode("utf-8")
        ).hexdigest()[:16]
        evidence = {
            "event_id": self.event_id,
            "controller": "benchmark",
            "step": step,
            "trigger_state_hash": digest,
            "posture_before": before,
            "posture_after": self.target_posture,
            "layout_before": layout_before,
            "layout_after": "cover_single",
        }
        await env.set_foldable_posture(self.target_posture, event=evidence)
        self._fold_event_injected = True
        return True

    def _fold_event_check(self, input: JudgeInput) -> dict[str, Any]:
        foldagent = input.last_obs.state.get("foldagent") or {}
        events = foldagent.get("events") or []
        found = next((event for event in events if event.get("event_id") == self.event_id), None)
        valid = bool(
            found
            and found.get("controller") == "benchmark"
            and found.get("posture_before") == self.initial_posture
            and found.get("posture_after") == self.target_posture
            and found.get("trigger_state_hash")
            and foldagent.get("posture") == self.target_posture
        )
        return {
            "field": "foldagent.transition_evidence",
            "expected": f"{self.event_id}: {self.initial_posture} -> {self.target_posture}",
            "actual": found,
            "passed": valid,
        }

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        return [*super().check_goals(input), self._fold_event_check(input)]


class FoldableCheckBalance(FoldableTaskMixin, CheckBalance):
    """Read Alipay balance, then continue on the cover display to answer."""

    templates = [
        "查看我的理财总资产。你开始查看后设备会自动折叠；请适应布局变化，并在答题卡中填写金额后提交。",
    ]
    difficulty = "L2"
    composition = "transition_recovery"
    capabilities = ["extract", "layout_adaptation"]
    event_id = "fold_after_first_alipay_action"


class FoldableSortEbaySearch(FoldableTaskMixin, CriteriaTask):
    """Fold after an eBay query is visible; sorting remains to be completed."""

    templates = [
        "在 eBay 搜索「{query}」。搜索结果出现后设备会自动折叠；请适应布局变化，再按{sort}排序。",
    ]
    apps = ["ebay"]
    scope = "S1"
    objective = "operate"
    composition = "transition_recovery"
    difficulty = "L3"
    max_steps = 30
    capabilities = ["search", "layout_adaptation"]
    parameters = {"query": EBAY_SEARCH_QUERY_PARAM, "sort": EBAY_SORT_PARAM}
    criteria = {
        "search.current.query": "{query}",
        "search.current.sortOption": "{sort}",
    }
    expected_changes = ["search.current", "search.history", "search.lastCompare", "recentSearches"]
    event_id = "fold_after_ebay_results_visible"

    async def should_inject_fold(self, state: dict[str, Any], _step: int) -> bool:
        current = ((state.get("apps") or {}).get("ebay") or {}).get("search", {}).get("current") or {}
        return str(current.get("query") or "").strip() == str(self.p.query).strip()
