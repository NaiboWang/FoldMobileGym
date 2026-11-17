# 公开任务数据

`unfolded_static/` 保存当前公开的展开态任务集。Agent 和回归测试直接读取同一份数据；`foldagent/examples/` 单独保留计算器等少量入门验证示例。

| 任务目录                                  | 类型                       | 任务实例数 |
| ----------------------------------------- | -------------------------- | ---------: |
| `unfolded_static/single_app/`           | 单应用                     |         56 |
| `unfolded_static/cross_app_sequential/` | 跨应用顺序操作             |         24 |
| `unfolded_static/multi_window/`         | 多窗口操作                 |         40 |
| 合计                                      | 包含不同内容实例和窗口方向 |        120 |

任务的 `gui_validation_required` 等状态保持原样；文件可以通过初始化校验，并不代表任务已经完成 GUI 端到端验证，也不代表真实模型成功率。

## 目录和路径

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

总清单为 [`unfolded_static/manifest.json`](unfolded_static/manifest.json)。清单中的 `task`、`seed`，以及任务的 `initial_state`，均为相对于**仓库根目录**的路径，例如 `tasks/unfolded_static/single_app/SA01/instances/base/seed.json`。单应用子清单也遵循这一规则。

- `static.task.json`：任务指令、初始窗口、事件配置和判定条件。
- `seed.json`：应用、系统和文件等初始模拟数据。
- `gold.private.json`：用于判定或回归测试的合成参考答案。`private` 是历史命名；这些文件属于当前公开数据，应仅供判定端或测试使用，不应作为 Agent 的模型输入。

任务集使用 `foldmobilegym.task.v2`，运行时同时兼容 `foldagentgym.task.v2`。

## 运行任务

按[项目安装说明](../README.md)安装模拟器和媒体，并按 [Agent 使用说明](../foldagent/README_ZH.md)安装 Python 依赖。以下命令均从仓库根目录执行。

仅检查任务格式与初始化配置，不启动浏览器、不调用模型：

```powershell
python foldagent/prepare_episode.py --task-file tasks/unfolded_static/single_app/SA01/instances/base/static.task.json --seed-file tasks/unfolded_static/single_app/SA01/instances/base/seed.json --run-seed 0
```

如果依赖安装在项目的 `.venv`，Windows 使用 `.\.venv\Scripts\python.exe`，Linux/macOS 使用 `.venv/bin/python` 替代上述 `python`。

启动模拟器后，执行免模型浏览器预检查：

```powershell
node foldagent/run.mjs --task-file tasks/unfolded_static/single_app/SA01/instances/base/static.task.json --seed-file tasks/unfolded_static/single_app/SA01/instances/base/seed.json --run-seed 0 --prompt-version v4 --check
```

其他任务使用总清单对应的 `task`、`seed` 路径。固定展开态任务要求 `--run-seed 0` 和 v4；多窗口任务会按其协议允许分屏操作。调用模型时，按 Agent 文档配置模型服务和凭据，移除 `--check` 并加载配置文件。

## 回归测试

前端任务判定、Agent 配置和 Python 任务校验测试直接读取此目录，无需另存一份测试夹具。`foldagent_runtime/tests/test_migration.py` 检查任务与配套文件、清单路径，以及所有公开任务的初始化校验。
