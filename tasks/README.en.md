# Public Task Data

`unfolded_static/` contains the currently released task set for the unfolded state. The Agent and regression tests read the same data directly; `foldagent/examples/` separately retains a small set of introductory validation examples, such as calculator tasks.

| Task directory                         | Type                                                    | Task instances |
| -------------------------------------- | ------------------------------------------------------- | -------------: |
| `unfolded_static/single_app/`           | Single-app tasks                                        |             56 |
| `unfolded_static/cross_app_sequential/` | Sequential cross-app operations                          |             24 |
| `unfolded_static/multi_window/`         | Multi-window operations                                 |             40 |
| Total                                  | Includes different content instances and window orientations |        120 |

Task statuses such as `gui_validation_required` remain unchanged. Passing initialization validation does not mean that a task has passed end-to-end GUI validation, nor does it indicate an actual model success rate.

## Directory Structure and Paths

```text
tasks/
├── README.md
└── unfolded_static/
    ├── manifest.json
    ├── single_app/
    │   ├── manifest.json
    │   └── SA01/instances/base/
    │       ├── static.task.json
    │       ├── seed.json
    │       └── gold.private.json
    ├── cross_app_sequential/
    └── multi_window/
```

The main manifest is [`unfolded_static/manifest.json`](unfolded_static/manifest.json). The `task` and `seed` paths in the manifests, as well as each task's `initial_state` path, are relative to the **repository root**, for example `tasks/unfolded_static/single_app/SA01/instances/base/seed.json`. The single-app submanifest follows the same rule.

- `static.task.json`: Task instructions, initial windows, event configuration, and evaluation criteria.
- `seed.json`: Initial simulated data for apps, the system, files, and related resources.
- `gold.private.json`: Synthetic reference answers for evaluation or regression tests. `private` is a legacy name; these files are part of the currently released public data. They should be used only by the evaluator or tests and should not be included in the Agent's model input.

The task set uses `foldmobilegym.task.v2`; the runtime also supports `foldagentgym.task.v2`.

## Running Tasks

Install the simulator and media by following the [project installation instructions](../README.en.md), and install the Python dependencies by following the [Agent usage guide](../foldagent/README_EN.md). Run all commands below from the repository root.

To check only the task format and initialization configuration, without launching a browser or calling a model:

```powershell
python foldagent/prepare_episode.py --task-file tasks/unfolded_static/single_app/SA01/instances/base/static.task.json --seed-file tasks/unfolded_static/single_app/SA01/instances/base/seed.json --run-seed 0
```

If the dependencies are installed in the project's `.venv`, replace `python` above with `.\.venv\Scripts\python.exe` on Windows or `.venv/bin/python` on Linux/macOS.

After starting the simulator, run the browser preflight check without a model:

```powershell
node foldagent/run.mjs --task-file tasks/unfolded_static/single_app/SA01/instances/base/static.task.json --seed-file tasks/unfolded_static/single_app/SA01/instances/base/seed.json --run-seed 0 --prompt-version v4 --check
```

For other tasks, use the corresponding `task` and `seed` paths from the main manifest. Tasks with a fixed unfolded state require `--run-seed 0` and prompt version v4; multi-window tasks allow split-screen operations according to their protocols. To call a model, configure the model service and credentials as described in the Agent documentation, remove `--check`, and load the configuration file.

## Regression Tests

The frontend task evaluation tests, Agent configuration tests, and Python task validation tests read this directory directly, so no separate copy of the test fixtures is needed. `foldagent_runtime/tests/test_migration.py` checks tasks and their supporting files, manifest paths, and initialization validation for all public tasks.
