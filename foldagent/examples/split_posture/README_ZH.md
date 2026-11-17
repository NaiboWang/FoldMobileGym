# H50-002：分屏姿态切换示例

任务从展开态左右分屏开始，左侧日历、右侧微信。读取来源信息后，由控制器触发折叠，窗口转为上下分屏。目标是在微信空白输入框填写指定草稿，不发送、不修改日历，并保持要求的最终窗口。

本目录自带 task 与 seed，不需要旧研究任务目录。task 的 `initial_state` 保留兼容 schema 的逻辑路径，实际初始化数据由 `--seed-file` 提供。业务判分包含读取、编辑、窗口与姿态事件证据，单纯改变方向不足以通过。

按照根目录 [README](../../../README.user.md) 启动模拟器，再从仓库根目录预检查：

```powershell
node foldagent/run.mjs --task-file foldagent/examples/split_posture/H50-002.task.json --seed-file foldagent/examples/split_posture/H50-002.seed.json --instance test03 --run-seed 0 --env-url http://127.0.0.1:3100/ --allow-split --check
```

要调用模型，在配置 `foldagent/.env` 后使用 `node --env-file=foldagent/.env foldagent/run.mjs` 和相同任务参数，去掉 `--check`，按需要设置 `--max-steps`。本任务有控制器事件，不能加 `--allow-fold`。

运行结果保存在 `foldagent/runs/`，查看 `trajectory.html` 与 `result.json`。此示例和免模型预检查不证明真实模型能成功完成任务。完整使用与参数见 [Agent 说明](../../README_ZH.md)。
