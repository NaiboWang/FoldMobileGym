# FoldMobileGym Screenshot-Based Agent

[简体中文](README_ZH.md) | **English**

The agent reads the interface from screenshots, calls a vision model to choose an action, and executes it through the browser. The simulator independently evaluates the result. The entry point is `foldagent/run.mjs`, and shared code lives in [`foldagent_runtime/`](../foldagent_runtime/README.md).

The migration includes the model client, prompts, screenshot and action loop, task validation, folding and split-screen controls, and run records. It does not include the previous project's complete task set, batch processing platform, private configuration, or historical runs. The examples are for development validation and do not represent official benchmark scores.

## Prepare the Environment

Run all commands from the **foldmobilegym repository root**. The project's reference versions are Node.js 24 and Python 3.11, with Chrome or Edge installed locally.

Follow the root [README](../README.en.md) to install the simulator dependencies and media assets. The agent reuses Puppeteer from `foldmobilegym/node_modules`; it does not require the OpenAI SDK or a separate build.

Create a separate Python environment and install the task validation dependencies (Windows PowerShell):

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r foldagent_runtime/requirements.txt
```

On Linux/macOS, use `.venv/bin/python`. The runner looks for Python in this order: `FOLDAGENT_PYTHON_PATH`, the repository's `.venv`, and system Python. You can explicitly set the interpreter and browser paths through environment variables; see the [configuration template](.env.example).

Start the target simulator in another terminal and keep it running:

```powershell
npm --prefix foldmobilegym run dev -- --host 127.0.0.1 --port 3100 --strictPort
```

## Run a Preflight Check Without a Model

```powershell
node foldagent/run.mjs --task-file foldagent/examples/calculator.task.json --seed-file foldagent/examples/calculator.seed.json --check
```

`--check` opens a separate browser, initializes the task, and saves the initial screenshot. It does not require an API key or call a model. On success, `run_status` is `preflight_passed` and `passed` is `null`. This confirms that initialization and the interfaces work; it does not establish that the task can be completed.

Results are saved to `foldagent/runs/<timestamp>_<taskID>_<processID>/` by default. Use `--headed` to show the separate browser window, or `--env-url` to specify a different simulator port.

## Configure the Model and Run the Agent

Copy the template when configuring the agent for the first time. If `foldagent/.env` already exists, edit it directly:

```powershell
Copy-Item foldagent/.env.example foldagent/.env
```

Set your own `OPENAI_API_KEY`, `OPENAI_MODEL`, `OPENAI_BASE_URL`, and `FOLDAGENT_API`. The model must support image input and strict JSON Schema. The model name in the template is only an example.

```powershell
node --env-file=foldagent/.env foldagent/run.mjs --task-file foldagent/examples/calculator.task.json --seed-file foldagent/examples/calculator.seed.json --max-steps 12 --headed
```

This task requires an actual calculation of `12 + 7 = 19` and also checks the calculation history. The agent does not take over your everyday browser tabs. Avoid manually interacting with its separate window during a run. The configured endpoint is called and screenshots are uploaded only when you explicitly run in model mode.

The runner supports Responses (the default) and Chat Completions (`--api chat-completions`). Set `--base-url` to the API root, for example a URL ending in `/v1`, without appending `/responses` or `/chat/completions`. The runner validates model output and completion status; malformed output is not executed directly as an action.

## Task Inputs

The three input modes are mutually exclusive:

| Input | Purpose |
| --- | --- |
| `--task-file PATH --seed-file PATH` | A custom v2 task with explicit initial data. The included examples use this mode. |
| `--episode-file PATH` | Rerun a frozen configuration from its initial state. The seed, instance, and run-seed cannot be overridden. |
| `--task ID` | An optional registered task. You must install converted tasks, instances, and seed data under `foldagent_runtime/tasks/` yourself; the old directories were not included in the migration. |

Copy the [calculator task](examples/calculator.task.json) and [seed](examples/calculator.seed.json) to create your own task. See [task.schema.json](../foldagent_runtime/schema/task.schema.json) and [controller_event.schema.json](../foldagent_runtime/schema/controller_event.schema.json) for the rules. Tasks must include executable initialization data and checks of the actual application state. A natural-language goal or a predefined action list cannot replace them.

`initial_state` is a logical path constrained by the schema. Custom mode reads the actual data from `--seed-file`; you do not need to create a duplicate file at the logical path. Task and seed hashes in frozen configurations are verified. Regenerate the configuration after making manual changes.

The directory and Python package have been renamed to `foldagent_runtime`. Tasks accept both the current `foldmobilegym.task.v2` and the compatible `foldagentgym.task.v2` identifier; frozen episodes retain `foldagentgym.episode.v1`. These strings do not indicate dependencies on the old Python package.

`template_docs_note*` contains templates for a document app. First check whether the target simulator enables `workspace_docs`, then adapt the application state and evaluation checks. The templates do not imply that the app is enabled in the current deployment. The [Calendar/WeChat split-screen example (Chinese)](examples/split_posture/README_ZH.md) includes its own task and seed.

## Folding and Split Screen

```powershell
# The task controller triggers folding after 12 + has been entered
node foldagent/run.mjs --task-file foldagent/examples/calculator_fold.task.json --seed-file foldagent/examples/calculator.seed.json --check

# Allow the model to fold/unfold when there are no predefined events;
# this command still runs only a preflight check without a model
node foldagent/run.mjs --task-file foldagent/examples/calculator.task.json --seed-file foldagent/examples/calculator.seed.json --run-seed 1 --allow-fold --check
```

To call a model, remove `--check` and add `--env-file=foldagent/.env` to the `node` invocation before `foldagent/run.mjs`. `--run-seed` selects the initial posture and event mapping: 0 means unfolded and 1 means folded. It is not a model sampling seed. Values 2/3 involve the legacy tabletop protocol; use 0/1 for the current simulator's two screen states. Legacy tabletop initialization does not apply to split screen.

By default, the task controller executes posture events. Model-initiated `fold/unfold` requires `--allow-fold` and is supported only with v4. It cannot be combined with tasks that require a fixed unfolded state, predefined events, or recovery.

Configure `initial_window` in a v2 task to start directly in side-by-side or stacked split screen:

```json
{
  "posture": "unfolded",
  "layout": "inner_wide",
  "focused_app": "calculator",
  "mode": "split",
  "split_apps": ["calculator", "notes"],
  "split_orientation": "side_by_side",
  "divider_ratio": 0.6
}
```

`split_apps` lists apps in left/right or top/bottom order and must correspond to the task's `apps`. `focused_app` must be one of those apps, and the seed must contain the data required by the apps. Use `stacked` for top/bottom split screen. The divider ratio ranges from 0.33 to 0.67. See the [task schema](../foldagent_runtime/schema/task.schema.json) for the complete task and event rules.

While unfolded, the specified orientation is preserved. Folding switches to stacked split screen. Unfolding again restores the previous inner-screen orientation, the same pair of tasks, and their primary/secondary order. Initial split screen does not require `--allow-split`. To let the model create, close, or adjust split screen, use that flag or the protocol for multiple windows in a fixed unfolded state.

The model operates visible window controls through screenshots: click the target pane before typing, and drag the divider to adjust the proportions. Swiping horizontally inward from the outer edge of a target pane closes that app and expands the remaining app to fill the screen. Dragging the divider to the screen boundary exits split screen; the apps may remain in recent tasks. Whether application state can be restored depends on each app's save mechanism.

The included [H50-002 example (Chinese)](examples/split_posture/README_ZH.md) demonstrates the initialization and task requirements for folding Calendar/WeChat from side-by-side into stacked split screen.

After starting the simulator, run the regression checks without a model:

```powershell
node foldagent/tests/split_windows.mjs http://127.0.0.1:3100/
```

Append `--initial-only` to check initialization only. The full regression covers window orientations, combinations of closing and focus, invalid/cancelled gestures, preservation of pages and input, continuing calculations, and more. Output is saved under `foldagent/runs/split_windows_*/` and does not represent success rates with real models.

The protocols `unfolded_static_v1` and `unfolded_static_multi_window_v1` remain supported and require `--run-seed 0` and v4. The former prohibits split screen; the latter automatically allows two-app window operations. Published tasks live in [`tasks/unfolded_static/`](../tasks/unfolded_static/), and the agent and regression tests share the same data. See the [task guide](../tasks/README.md) for manifest paths and commands. Pending validation markers do not establish completed end-to-end GUI evaluation.

## Prompts, Observations, and Results

The default v4 prompt includes task text, the names/IDs of actually installed apps, the current screenshot, recent actions, and allowlisted public feedback. By default, it retains 6 historical screenshots and action text from up to 12 steps. The model does not receive the DOM, seed data, answers, hidden event conditions, or per-step scores.

`--prompt-detail detailed` selects the default detailed version. `--prompt-detail tools-only` uses concise tool instructions and supports v4 only. `--prompt-version v1|v2|v3` retains access to older prompts for reproduction. Record different prompt, window, and model-initiated folding configurations separately.

The main files in a result directory are:

| File | Contents |
| --- | --- |
| `trajectory.html` | Step-by-step screenshots and actions that can be opened directly in a browser. |
| `result.json` | Final independent verdict, exit status, API call count, and usage. |
| `trajectory.json` | Actions, public feedback, and execution records for each step. |
| `episode.json` | Frozen task, seed, posture protocol, and hashes. |
| `config.json` | Model parameters, the complete system prompt, and source code hashes. |
| `screenshots/` | Initial and final screenshots, plus screenshots before and after each step. |
| `requests/`, `responses/` | Request audit copies and responses. Request images are replaced with summaries, and authorization headers are not saved. |

A model's self-reported `terminate success` does not mean the task passed. Check the top-level `passed` field in `result.json`: `true` means passed, `false` means failed, and `null` means not yet established or an infrastructure error. The corresponding exit codes are 0, 2, and 3; infrastructure errors use exit code 1. A successful preflight check exits with 0 and `passed:null`. `.env` and `foldagent/runs/` are ignored by Git.

## Validation and Troubleshooting

```powershell
node --test foldagent/tests/*.test.mjs
.\.venv\Scripts\python.exe -m unittest discover -s foldagent_runtime/tests -v
node foldagent/tests/browser_smoke.mjs --env-url http://127.0.0.1:3100/
node foldagent/tests/split_windows.mjs http://127.0.0.1:3100/
```

The first two commands verify request protocols, separation of prompts and feedback, task validation, frozen hashes, and migration paths. The last two require a running simulator, a local browser, and installed frontend dependencies. The browser smoke test uses a local mock API and does not call a paid model. Test scripts read visible button geometry to calibrate actions; this information is not passed to the model during actual runs.

If Puppeteer cannot be found, install the npm dependencies in `foldmobilegym`. If `jsonschema` is missing, install the requirements above into the Python interpreter actually being used. If the page is missing `__SIM__` or `__FOLDAGENT_BENCH__`, check the port and build. For API 400/404 errors, check the model, image/schema support, and API mode; for 401, check credentials; for 429, check quota. Run `node foldagent/run.mjs --help` for the complete list of options.
