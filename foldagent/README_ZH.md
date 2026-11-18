# FoldMobileGym 截图 Agent

**简体中文** | [English](README_EN.md)

从截图读取界面，调用视觉模型选择一个动作，通过浏览器执行，再由模拟器独立判定结果。入口为 `foldagent/run.mjs`，共用代码位于 [`foldagent_runtime/`](../foldagent_runtime/README.md)。

本次迁入模型客户端、提示词、截图与动作循环、任务校验、折叠/分屏控制和运行记录。未迁入旧项目的任务全集、批处理平台、私有配置或历史运行。示例用于开发验证，不代表正式基准成绩。

## 准备环境

所有命令均从 **FoldMobileGym 仓库根目录**执行。建议使用项目参考版本 Node.js 24、Python 3.11，以及本机 Chrome 或 Edge。

按根目录 [README](../README.md) 安装模拟器依赖和媒体。Agent 复用 `foldmobilegym/node_modules` 中的 Puppeteer，不需要 OpenAI SDK 或单独编译。

创建独立 Python 环境并安装任务校验依赖（Windows PowerShell）：

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r foldagent_runtime/requirements.txt
```

Linux/macOS 使用 `.venv/bin/python`。运行器依次使用 `FOLDAGENT_PYTHON_PATH`、仓库 `.venv`、系统 Python；可在环境变量中显式指定解释器和浏览器路径，见 [配置模板](.env.example)。

在另一个终端启动目标模拟器并保持运行：

```powershell
npm --prefix foldmobilegym run dev -- --host 127.0.0.1 --port 3100 --strictPort
```

## 先做免模型预检查

```powershell
node foldagent/run.mjs --task-file foldagent/examples/calculator.task.json --seed-file foldagent/examples/calculator.seed.json --check
```

`--check` 打开独立浏览器，初始化任务并保存初始截图，不需要密钥，也不会请求模型。成功时 `run_status` 为 `preflight_passed`、`passed` 为 `null`。它只证明初始化与接口可用，不证明任务可完成。

默认结果保存在 `foldagent/runs/<时间>_<任务ID>_<进程号>/`。`--headed` 可显示独立浏览器窗口，`--env-url` 可指定不同模拟器端口。

## 配置模型并执行

首次配置时复制模板；已有 `foldagent/.env` 时直接编辑：

```powershell
Copy-Item foldagent/.env.example foldagent/.env
```

填写自己的 `OPENAI_API_KEY`、`OPENAI_MODEL`、`OPENAI_BASE_URL` 和 `FOLDAGENT_API`。模型需支持图片输入和严格 JSON Schema；模板中的模型名仅为示例。

```powershell
node --env-file=foldagent/.env foldagent/run.mjs --task-file foldagent/examples/calculator.task.json --seed-file foldagent/examples/calculator.seed.json --max-steps 12 --headed
```

该任务要求通过实际计算得到 `12 + 7 = 19`，同时检查运算记录。Agent 不接管日常浏览器标签页；运行期间避免手动干预它的独立窗口。只有显式执行模型模式才会调用所配端点并上传截图。

支持 Responses（默认）和 Chat Completions（`--api chat-completions`）。`--base-url` 指向 API 根路径，例如以 `/v1` 结尾，不追加 `/responses` 或 `/chat/completions`。运行器检查模型输出和完成状态，格式错误不会直接作为动作执行。

## 任务输入

三种输入互斥：

| 输入                                  | 用途                                                                                                        |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `--task-file PATH --seed-file PATH` | 自定义 v2 任务及显式初始数据；本次提供的示例使用此方式                                                      |
| `--episode-file PATH`               | 从初始状态重跑冻结配置；不能再覆盖 seed、instance 或 run-seed                                               |
| `--task ID`                         | 可选注册任务；需要自行在 `foldagent_runtime/tasks/` 安装 converted、instances 和 seed，旧目录未随迁移提供 |

可复制 [计算器任务](examples/calculator.task.json) 和 [seed](examples/calculator.seed.json) 编写自己的任务。规则见 [task.schema.json](../foldagent_runtime/schema/task.schema.json) 和 [controller_event.schema.json](../foldagent_runtime/schema/controller_event.schema.json)。任务必须包含可执行的初始化数据和真实业务判定，自然语言目标或预设动作列表不能替代它们。

`initial_state` 是受 schema 约束的逻辑路径；自定义模式实际读取 `--seed-file`，不要求在逻辑路径创建同一份文件。冻结配置中的 task/seed 哈希会被校验，手工修改后应重新生成。

目录和 Python 包已更名为 `foldagent_runtime`；任务同时支持当前的 `foldmobilegym.task.v2` 和兼容标识 `foldagentgym.task.v2`，冻结配置继续使用 `foldagentgym.episode.v1`。这些字符串不是旧 Python 包依赖。

`template_docs_note*` 为文档应用模板，需要先核对目标模拟器是否启用 `workspace_docs`，并适配业务状态和判定；不能据此认为该应用已在当前部署中启用。[日历/微信分屏示例](examples/split_posture/README_ZH.md) 自带 task/seed。

## 折叠与分屏

```powershell
# 输入 12 + 后由任务控制器触发折叠
node foldagent/run.mjs --task-file foldagent/examples/calculator_fold.task.json --seed-file foldagent/examples/calculator.seed.json --check

# 无预设事件时允许模型主动折叠/展开；此命令仍为免模型预检
node foldagent/run.mjs --task-file foldagent/examples/calculator.task.json --seed-file foldagent/examples/calculator.seed.json --run-seed 1 --allow-fold --check
```

去掉 `--check`、加上 `--env-file=foldagent/.env` 即可调用模型。`--run-seed` 选择初始姿态及事件映射，0 为展开、1 为折叠；它不是模型采样种子。2/3 涉及历史 tabletop 协议，当前双形态模拟器建议使用 0/1；历史 tabletop 初始化不适用于分屏。

默认由任务控制器执行姿态事件。主动 `fold/unfold` 需要 `--allow-fold`，仅支持 v4，不与固定展开态任务、预设事件或 recovery 混用。

在 v2 任务中配置 `initial_window`，可以直接从左右或上下分屏开始：

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

`split_apps` 按左/右或上/下排序，必须与任务的 `apps` 对应。`focused_app` 必须是其中一个应用；seed 需包含所需应用的数据。上下分屏使用 `stacked`，比例范围为 0.33～0.67。任务与事件的完整规则见 [task schema](../foldagent_runtime/schema/task.schema.json)。

展开时保留指定方向；折叠后转为上下分屏；再次展开恢复此前内屏方向、同一对任务及其主次顺序。初始分屏不依赖 `--allow-split`，但希望模型主动创建、关闭或调整分屏时，应使用该开关或固定展开态多窗口协议。

模型通过截图操作可见窗口控件：先点击目标窗格再输入；通过分隔条调整比例；从目标窗格的外侧边缘水平向内滑动关闭该应用，剩余应用铺满屏幕。拖动分隔条到边界为退出分屏，应用仍可保留在最近任务中。业务状态是否可恢复取决于各应用的保存机制。

自带的 [H50-002 示例](examples/split_posture/README_ZH.md) 展示日历/微信从左右分屏折叠为上下分屏的初始化与任务要求。

启动模拟器后，可运行免模型回归：

```powershell
node foldagent/tests/split_windows.mjs http://127.0.0.1:3100/
```

仅检查初始化时在最后加 `--initial-only`。完整回归覆盖窗口方向、关闭与焦点组合、无效/取消手势、页面和输入保留、计算继续完成等。输出位于 `foldagent/runs/split_windows_*/`，不代表真实模型成功率。

固定展开态协议 `unfolded_static_v1` 和 `unfolded_static_multi_window_v1` 继续支持，要求 `--run-seed 0` 和 v4。前者禁止分屏，后者自动允许双应用窗口操作。公开任务集位于 [`tasks/unfolded_static/`](../tasks/unfolded_static/)，由 Agent 和回归测试共用同一份数据；清单路径和运行方法见 [任务数据说明](../tasks/README.md)。任务文件中的待验证标记不代表已完成 GUI 端到端评测。

## 提示词、观察与结果

默认 v4 提示包含任务文本、实际安装应用名称/ID、当前截图、最近动作和白名单公开反馈。默认保留 6 张历史截图、最多 12 步动作文字。模型不会获得 DOM、seed、答案、隐藏事件条件或每步判分。

`--prompt-detail detailed` 为默认详细版；`--prompt-detail tools-only` 使用精简工具说明，仅支持 v4。`--prompt-version v1|v2|v3` 保留旧提示复现入口。不同提示、窗口和主动折叠配置应分别记录。

结果目录的主要文件：

| 文件                          | 内容                                                 |
| ----------------------------- | ---------------------------------------------------- |
| `trajectory.html`           | 可直接打开的逐步截图与动作                           |
| `result.json`               | 最终独立判定、退出状态、API 次数和 usage             |
| `trajectory.json`           | 每步动作、公开反馈与执行记录                         |
| `episode.json`              | 冻结任务、seed、姿态协议及哈希                       |
| `config.json`               | 模型参数、完整系统提示及源码哈希                     |
| `screenshots/`              | 初始、每步前后和结束截图                             |
| `requests/`、`responses/` | 请求审计副本和响应；请求图片用摘要代替，不保存鉴权头 |

模型自报 `terminate success` 不等于通过。应查看 `result.json` 的顶层 `passed`：`true` 为通过，`false` 为失败，`null` 为尚未证明或基础设施错误；对应退出码分别为 0、2、3，基础设施错误为 1。预检查退出 0 且 `passed:null`。`.env` 和 `foldagent/runs/` 已忽略，不随 Git 提交。

## 验证与排错

```powershell
node --test foldagent/tests/*.test.mjs
.\.venv\Scripts\python.exe -m unittest discover -s foldagent_runtime/tests -v
node foldagent/tests/browser_smoke.mjs --env-url http://127.0.0.1:3100/
node foldagent/tests/split_windows.mjs http://127.0.0.1:3100/
```

前两项验证请求协议、提示与反馈隔离、任务校验、冻结哈希及迁移路径。后两项需要运行中的模拟器、本机浏览器和已安装的前端依赖；浏览器 smoke 使用本地模拟 API，不调用付费模型。测试脚本读取可见按钮几何来校准动作，这些信息不传给正式模型。

找不到 Puppeteer 时安装 `foldmobilegym` 的 npm 依赖；缺 `jsonschema` 时给实际使用的 Python 安装上述 requirements。页面缺少 `__SIM__` 或 `__FOLDAGENT_BENCH__` 时核对端口与构建。API 400/404 核对模型、图片/schema 支持和 API 模式，401 核对凭据，429 核对额度。完整参数见 `node foldagent/run.mjs --help`。
