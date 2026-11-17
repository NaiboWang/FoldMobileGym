# 开发与维护工具

以下路径和命令均从仓库根目录执行。前端依赖安装在 `foldmobilegym/` 子目录。

| 目录 | 用途 |
| --- | --- |
| `browser-automation/` | 定位 Chromium 浏览器、打开模拟应用并等待路由和界面就绪；供检查和媒体脚本导入。 |
| `browser-extension/` | 折叠与分屏控制扩展，安装方法见该目录的 README。 |
| `data/` | `prepare_data.py` 恢复并验证固定版本的数据包；`compare_release.py` 比较数据差异；`snapshot_data.mjs` 导出数据清单。 |
| `media/` | 媒体包构建、安装、验证与演示素材采集。 |
| `release/` | 源码与文档路径检查、源码快照导出、发布环境依赖清单，以及 Git 历史和图片元数据审计。 |
| `reviews/` | `review_*.mjs` 功能回归检查，以及图像健康检查、运行断言和网络证据采集辅助函数。 |

源码与文档路径检查：

```powershell
node tools/release/check_source.mjs
```

数据工具和发布审计的本地测试：

```powershell
python -m unittest discover -s tools/data -p 'test_*.py' -v
python -m unittest discover -s tools/release -p 'test_*.py' -v
```

图片元数据测试需要 Pillow；审计依赖的安装环境清单保存在 `release/requirements-*.txt`。

Node 工具测试（PowerShell）：

```powershell
$toolTests = @(Get-ChildItem tools/release, tools/reviews -Filter 'test_*.mjs' -File | ForEach-Object { $_.FullName })
node --test @toolTests
```

浏览器回归脚本需要先启动本地模拟器，并安装前端依赖和 Edge、Chrome 或 Chromium。各脚本默认端口可能不同，建议显式设置本地地址：

```powershell
$env:FOLDAGENT_REVIEW_URL = 'http://127.0.0.1:3100/'
node tools/reviews/review_contacts_chinese_sections.mjs
```

必要时通过 `FOLDAGENT_BROWSER_PATH` 指定浏览器可执行文件路径。回归脚本的输出位于各脚本指定的 `artifacts/` 子目录。

维护者使用的快照和数据差异脚本会生成文件；执行前应检查脚本要求的源目录与目标目录。
