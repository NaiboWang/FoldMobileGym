# 数据与媒体来源记录 / Data and media provenance

本记录更新于 2026-11-16，适用于当前 FoldMobileGym 工作目录。下表区分本地
能够核对的证据与尚未核实的权利事项。“已核对”仅指所列证据，不表示所有
材料均已获得再分发、商业使用或模型训练授权。具体资源的许可声明优先于
目录概述；未知来源不能仅凭文件夹名称判断。

This record separates locally checked evidence from unresolved rights
questions. Verification of a manifest, hash, or source statement is not
verification of redistribution or training permission.

## 现有资源分组

以下路径以本文件所在目录为基准，`../` 表示外层仓库目录。

| 资源组与位置           | 来源及本地证据                                                                                                                                                              | 权利与许可状态                                                                            | 处理与待核实事项                                                                                      |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| 上游代码与项目改动     | MobileGym: https://github.com/Purewhiter/mobilegym；`SOURCE_SNAPSHOT.json` 记录派生来源 `flyx-flyx/foldagent-gui` 及提交 `4d7d4637fe7fcdf73e8e421d4f5bbc5d35285f20`   | `LICENSE` 中的 Apache-2.0 适用于有权按该许可发布的代码；第三方代码保留原条款            | 来源元数据已核对；提交标识与哈希不证明素材授权，也不证明工作目录没有后续改动                          |
| 上游数据发布包         | `DATA_SNAPSHOT.json` 与 `../media_sources/manifest.json` 标识 MobileGym `data-v0.1.0`；原包地址见下方记录                                                             | 上游声明对其有权许可的数据贡献采用 CC BY-NC 4.0；用户内容与其他第三方材料不被统一重新授权 | 本次仅核对本地元数据，未重新下载或逐项核查原包；平台、接口、采集日期、条款版本和再分发依据待逐批核实  |
| 应用数据与评测内容     | `apps/*/data/`、`public/*_action_tasks*.json` 等；可能混合数据、加载代码和来源引用                                                                                      | 代码与数据分别按适用许可处理，不能按目录名统一认定为合成或 API 数据                       | 逐组记录作者、生成或采集方式、脱敏处理及许可；本表不认证其中每条内容的来源                            |
| Roboto 字体            | `apps/Map/assets/offline-fonts/README.md`、`manifest.json`、`OFL.txt`；声明于 2026-10-25 从 Google Fonts 获取两个 WOFF2 文件                                          | Copyright 2011 The Roboto Project Authors；SIL OFL 1.1，非 CC BY-NC 4.0                   | 已核对本地来源声明、完整许可及文件大小和 SHA-256；日期和原始 URL 来自该清单，本次未在线重验           |
| 地图缓存与外部服务资源 | `apps/Map/sw/manifest.json`、`apps/Map/sw/vector/`、`apps/Map/sw/files/`，以及相关地图脚本                                                                            | 可能包含服务商的脚本、样式、瓦片和字体；不能套用上述两个 Roboto 文件的许可                | 服务访问、缓存和再分发权限分别待核实；Roboto 的 OFL 声明不覆盖 Google Sans 或其他字体和地图资源       |
| 媒体补丁、图片与主题   | `media_patch/`、`MEDIA_PATCH_MANIFEST.json`、`apps/*/assets/`、`apps/Weather/wmr/`、`system/`、`assets/`、`public/sdcard/` 及 `../media_sources/overrides/` | 存在第三方或来源待核实材料；文件名含 `unsplash`、主题名或作者名不能独立证明许可         | 清单通常证明文件与哈希；逐项补充原始页面、权利人、许可版本、处理方式和再分发依据                      |
| 外部媒体引用           | 例如 `apps/X/data/defaults.json` 中的外部头像和图片 URL                                                                                                                   | 外部引用不授予下载、缓存、再分发或训练权限                                                | 区分远程引用与已打包字节；实际打包时应核实来源，必要时替换为有权使用的素材                            |
| 第三方软件             | `package-lock.json`、安装的包及 `bench_env/requirements.txt`                                                                                                            | 各自许可，见 [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md)                              | JavaScript 非 dev 依赖的现有许可文本已汇总；开发依赖、Python 环境和最终产物的完整覆盖仍需按分发物核实 |

上游原始数据包记录：

- 来源地址：[https://github.com/Purewhiter/mobilegym/releases/download/data-v0.1.0/mobilegym-data-v0.1.0.tar.gz](https://github.com/Purewhiter/mobilegym/releases/download/data-v0.1.0/mobilegym-data-v0.1.0.tar.gz)
- 原包 SHA-256：`933a8499c71450f135eda70f9107af72b56b42181fc62de76ed1aa4c513a603c`。
- 本地来源：`DATA_SNAPSHOT.json`、`../media_sources/manifest.json`。
- 上游“通过官方 API 获取”的说法属于继承的来源声明，本次未取得逐平台
  采集记录或再分发授权证明，不能据此把所有平台内容标为已获授权。

`../media_sources/manifest.json` 是已有媒体清单，部分条目仍使用历史目录
名称。它和快照文件可用于追溯已有记录，不应被解读为当前所有文件、页面
或授权状态的完整证明。

## 单组资源的核实记录

新增或进一步核实资源时，应补充以下字段；缺失项写“待核实”，不推断填充：

| 字段               | 当前要求                                                     |
| ------------------ | ------------------------------------------------------------ |
| 本地路径及文件范围 | 精确文件、模式或可追溯清单                                   |
| 原始来源与取得方式 | 平台、接口、素材页面、上游仓库或人工制作记录                 |
| 采集或生成日期     | 日期及其证据；未知则写待核实                                 |
| 权利人与许可       | 权利人、许可名称、版本和可追溯的条款文本或链接               |
| 再分发依据         | 明确支持所分发材料和用途的授权、许可或其他法律依据           |
| 处理情况           | 脱敏、假名化、裁剪、格式转换、合成等及其记录                 |
| AI / ML 条件       | 实际适用的训练、评测或数据使用条件，不以“环境内容”替代核实 |
| 核实状态           | 已核对的证据、未解决事项、核实人或记录来源及日期             |

“公开可见”“通过 API 获取”“已脱敏”“注明作者”“非商业”或“可申请删除”
均不能单独替代再分发授权。AI 生成内容也仅在相关权利实际存在并可由项目
授予的范围内适用项目许可。

## 更正与权利人请求

如需更正来源信息或提出权利请求，请通过项目 issue 页面提供资源路径与来源依据，不要在公开 Issue 中披露私人个人信息。
处理方式见 [DISCLAIMER.md](DISCLAIMER.md)。
