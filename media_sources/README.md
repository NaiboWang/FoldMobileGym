# FoldMobileGym 媒体资源

媒体包提供模拟应用使用的本地图片等素材。完整安装与启动步骤见[项目使用说明](../README.md)。

## 下载与安装

请先安装 Python 3.11 或更高版本，并预留至少 15 GB 可用空间。

从[媒体包下载页](https://github.com/NaiboWang/foldmobilegym/releases/tag/media-v0.3.0)下载 [`foldagent-gui-media-full-v0.3.0.tar.gz`](https://github.com/yannnf/foldmobilegym/releases/download/media-v0.3.0/foldagent-gui-media-full-v0.3.0.tar.gz)。如果下载页需要登录，请使用具有访问权限的账号。

在仓库根目录执行以下命令，将示例路径替换为实际下载位置。请等待安装完成，不要手动解压覆盖项目文件。

```powershell
python tools/media/install_media_package.py --archive "C:\Downloads\foldagent-gui-media-full-v0.3.0.tar.gz"
```

Linux / macOS 使用 `python3`，并替换为对应的文件路径。

媒体包下载大小为 2,073,275,786 字节，SHA-256 为：

```text
6c308ab775a0af904776a7e9439dd37c97608b436b16ca89da18b5649737e12b
```

安装程序会校验文件；如果已有文件的内容与媒体包不一致，安装会停止并保留原文件。

源码中的本说明、`foldmobilegym/NOTICE`、`foldmobilegym/LICENSE-DATA` 和 `foldmobilegym/DISCLAIMER.md` 可以独立于媒体包更新；安装时保留源码版本，且这些文档必须已存在。压缩包及其中全部素材和文档的哈希仍会校验，运行素材、媒体清单、数据快照和代码 LICENSE 仍须匹配固定版本。

## 检查安装

在仓库根目录执行：

```powershell
python tools/media/install_media_package.py --archive "C:\Downloads\foldagent-gui-media-full-v0.3.0.tar.gz" --check-only
```

如果安装失败，请确认下载完整、路径正确、磁盘空间充足，并参考[项目使用说明中的常见问题](../README.md#常见问题)。

## 使用范围与许可

部分外部图片仍需要网络，不能保证所有页面完全离线可用。

源代码许可不代表所有媒体素材均可用于商业用途。项目包含按 CC BY-NC 4.0 发布的数据，第三方图片、内容和品牌的相关权利属于各自权利人。使用或转载前请核实[数据许可](../foldmobilegym/LICENSE-DATA)、[第三方声明](../foldmobilegym/NOTICE)和[免责声明](../foldmobilegym/DISCLAIMER.md)。
