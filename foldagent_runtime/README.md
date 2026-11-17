# FoldMobileGym Agent Runtime

`foldagent_runtime` is the small shared runtime used by [`foldagent/`](../foldagent/README_ZH.md). It replaces the old `foldagentgym` package name and has no import dependency on the source research checkout.

| File | Responsibility |
| --- | --- |
| `browser_executor.mjs` | Browser/Python discovery, task startup, screen capture, action execution, interaction checks and legacy prompt compatibility |
| `validate_task.py` | Task admission and business-contract checks |
| `task_instantiator.py` | Deterministic posture protocols and immutable task/seed hashes |
| `materialize_episode.py` | Optional registered-task loading and episode generation |
| `schema/` | Task, controller-event and frozen-episode schemas |

Install Python dependencies with `python -m pip install -r foldagent_runtime/requirements.txt`. Run the agent from the repository root; Puppeteer is resolved from `foldmobilegym/package.json`. Python supports direct script execution and package imports from this checkout.

Only the execution path used by the screenshot agent was retained from `foldagent-gui/agent` and `foldagent-gui/foldagentgym`. The browser executor omits the old standalone model client and browser-process launcher. The old servers, platform, design tools, batch runners, catalog and run outputs are not included. Source project notices remain at the repository root.

Tasks accept both `foldmobilegym.task.v2` and the compatible `foldagentgym.task.v2` identifier. Frozen episodes retain `foldagentgym.episode.v1`; controller-event identifiers are unchanged. They identify compatible data formats, not Python modules. Existing frontend interfaces such as `__FOLDAGENT_BENCH__` are also preserved.

The published task suite is in [`tasks/unfolded_static/`](../tasks/unfolded_static/); its manifest paths and `initial_state` fields are relative to the repository root. Load these files with explicit `--task-file` and `--seed-file` arguments; see the [task guide](../tasks/README.md). This suite and its manifests are separate from the optional runtime-local registration catalog below.

Custom tasks use explicit `--task-file` and `--seed-file`. Optional `--task ID` registration expects `tasks/converted/<ID>.json`, `tasks/instances/<pair>/<instance>.json`, and the seed path declared by that instance, relative to this runtime directory. Registration must include the original task/seed hashes and complete instance contracts. No catalog is bundled.

Run runtime regressions from the repository root:

```powershell
python -m unittest discover -s foldagent_runtime/tests -v
node --test foldagent/tests/*.test.mjs
```
