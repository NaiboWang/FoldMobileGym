# Disclaimer / 免责声明

Updated for FoldMobileGym on 2026-11-16. / 2026-11-16 更新。

This document describes the FoldMobileGym distribution, which is based on
mobile-gym. It explains project intent and known rights boundaries; it does
not replace or modify the applicable code, data, or third-party licenses.
本文件适用于基于 mobile-gym 的 FoldMobileGym 分发版本，说明项目意图与已知
权利边界，不替代或修改适用的代码、数据或第三方许可。

---

## English

### Research environment and affiliation

mobile-gym is a research environment for training and evaluating agents that
operate mobile user interfaces. FoldMobileGym builds on this environment and
includes UI simulations of applications such as WeChat, Alipay, Bilibili,
RedBook (Xiaohongshu), X (Twitter), Reddit, Spotify, Tencent Meeting, eBay,
and 12306 Railway.

This project and its authors are not affiliated with, endorsed by, sponsored
by, or officially connected to the owners of the referenced products.
Product names, logos, and trademarks belong to their respective holders and
are referenced to identify the applications modeled by the environment.
Neither this document nor the code or data license grants trademark rights
or permission to imply endorsement.

### Simulation and network access

The simulated applications are intended as research and evaluation targets,
rather than replacements for the referenced applications or their services.
Visual, naming, and behavioral similarities serve the simulation. They do
not imply that the project represents the original service or authorizes
access to third-party accounts or real transactions.

Some modules load external resources or can call third-party services when
configured. For example, the Map module supports local snapshots and can
contact Google Maps when a real API key is configured. External media URLs
can also require network access. The project does not guarantee that every
deployment or page works entirely offline. Service use remains subject to
the applicable provider terms, credentials, and privacy requirements.

Third-party software and cached resources may be present alongside the
project's own code. Their separate terms still apply; inclusion here does
not convert them to Apache-2.0 or CC BY-NC 4.0.

### Data provenance and license boundaries

The distribution may contain synthetic or AI-generated content,
platform-origin content, separately licensed visual resources, and external
media references. It does not claim that every item is synthetic or that
every third-party item was obtained through an official developer API.
See [DATA-PROVENANCE.md](DATA-PROVENANCE.md) for source groups, available
evidence, and unresolved verification work.

CC BY-NC 4.0 applies to the maintainers' dataset compilation and other data
contributions only to the extent they hold the relevant rights, as explained
in [LICENSE-DATA](LICENSE-DATA). Project code is under Apache-2.0 where the
project has authority to grant it; see [LICENSE](LICENSE). Third-party
software, user content, fonts, images, icons, themes, and other materials
retain their own applicable rights and terms. For example, the Roboto font
files identified in `apps/Map/assets/offline-fonts/manifest.json` are under
SIL OFL 1.1, with the full notice in that directory's `OFL.txt`.

API access, public visibility, pseudonymization, or inclusion in a benchmark
does not by itself establish redistribution rights or remove underlying
copyright, privacy, personality, trademark, or database rights. The project
makes no ownership claim over third-party materials. Users must comply with
the licenses, platform terms where applicable, and law governing their use.
A source record or an inventory hash is evidence about origin or bytes,
not a substitute for permission.

### Intended use and agent training

The project is primarily intended for non-commercial academic research.
This is a statement of intended use, not an additional academic-only
restriction on material licensed under standard CC BY-NC 4.0. The license's
own definition of NonCommercial controls the rights granted under it.

Platform-origin content is provided as context in simulated interfaces,
rather than as a standalone corpus intended to reproduce the underlying
user-generated content. This purpose statement does not impose a new model
training prohibition on standard CC BY-NC 4.0 or grant permission over
third-party content.

Whether pre-training, fine-tuning, evaluation, or agent training using UI
observations or interaction trajectories is permitted depends on the actual
material, applicable rights, platform terms, and procedure. Calling data
"environment content" does not exempt a procedure from those requirements.
This document does not certify historical training activity; any claim
about a particular run requires supporting records.

### Third-party notices and rights-holder requests

See [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md) for software and font
notices and the limits of that inventory. Applicable attribution and license
notices must accompany redistribution. Attribution and a takedown process
do not by themselves establish permission to redistribute third-party work.

Rights holders may request review through the
[FoldMobileGym issue tracker](https://github.com/flyx-flyx/foldmobilegym/issues).
Please identify the file or URL, the material at issue, and the relevant
rights information. Do not include private personal information in a public
issue. The maintainers will review requests and remove, replace, or disable
material as appropriate.

---

## 中文

### 研究环境与无关联声明

mobile-gym 是用于训练和评测手机界面操作 Agent 的研究环境。FoldMobileGym
基于该环境构建，包含微信、支付宝、哔哩哔哩、小红书、X（推特）、Reddit、
Spotify、腾讯会议、eBay、铁路 12306 等应用的 UI 模拟。

本项目及其作者与上述产品的权利人不存在附属、代言、赞助或官方合作关系。
产品名称、标识和商标归各自权利人所有，提及这些名称是为了标识模拟对象。
本文件以及代码或数据许可均不授予商标权，也不允许暗示获得官方认可。

### 模拟范围与网络访问

模拟应用旨在作为研究和评测对象，不旨在替代原应用或其服务。界面、命名
及行为上的相似服务于模拟目的，不代表本项目代表原服务，也不构成访问
第三方账户或开展真实交易的授权。

部分模块会加载外部资源，或在配置后调用第三方服务。例如，Map 模块支持
本地快照，配置真实 API 密钥后也可以连接 Google Maps。外部媒体链接同样
可能需要网络访问。本项目不保证每个部署或页面均能完全离线运行。服务
使用仍受相应提供商的适用条款、凭据要求和隐私要求约束。

第三方软件及缓存资源可能与项目自有代码一同存在，其单独条款继续适用，
不会因被收录而自动改用 Apache-2.0 或 CC BY-NC 4.0。

### 数据来源与许可边界

分发内容可能包括合成或 AI 生成内容、平台来源内容、单独许可的视觉资源
及外部媒体引用。本项目不声称所有内容均为合成，也不声称所有第三方内容
均通过官方开发者接口取得。来源分组、现有证据及待核实事项见
[DATA-PROVENANCE.md](DATA-PROVENANCE.md)。

CC BY-NC 4.0 仅在维护者拥有相应权利的范围内，适用于其数据集编排及其他
数据贡献，具体见 [LICENSE-DATA](LICENSE-DATA)。项目代码在项目有权授权
的范围内采用 Apache-2.0，见 [LICENSE](LICENSE)。第三方软件、用户内容、
字体、图片、图标、主题及其他材料保留各自适用的权利和条款。例如，
`apps/Map/assets/offline-fonts/manifest.json` 标识的 Roboto 字体采用 SIL
OFL 1.1，完整声明见该目录的 `OFL.txt`。

能够通过 API 获取、公开可见、经过假名化处理或被纳入评测数据，并不自动
证明内容可以再分发，也不会消除其版权、隐私、人格、商标或数据库权利。
本项目不主张第三方材料的所有权。使用者应遵守相关许可、在适用时遵守
平台条款，并遵守其使用行为适用的法律。来源记录和文件哈希分别提供来源
或字节方面的证据，不能替代授权。

### 预期用途与 Agent 训练

本项目主要面向非商业学术研究。这是预期用途说明，不对标准 CC BY-NC 4.0
授权的材料额外施加“仅限学术研究”的限制。该许可授予的权利以协议自身对
“非商业性使用”的定义为准。

平台来源内容作为模拟界面中的上下文提供，不作为旨在再现原始用户内容的
独立语料库发布。这一用途说明不对标准 CC BY-NC 4.0 增加新的模型训练
禁令，也不授予对第三方内容的额外使用权。

预训练、微调、评测，或使用 UI 观察与交互轨迹开展 Agent 训练是否被允许，
取决于实际材料、适用权利、平台条款和具体流程。将数据称为“环境内容”
不使训练流程豁免于这些要求。本文件不对历史训练活动作事实认证；关于
某次训练的声明需要相应记录支持。

### 第三方声明与权利人请求

软件、字体声明及清单覆盖范围见
[THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md)。再分发时应附带适用的
署名和许可声明。署名及删除处理机制本身不构成第三方作品的再分发授权。

权利人可通过
[FoldMobileGym Issue 页面](https://github.com/flyx-flyx/foldmobilegym/issues)
请求审阅。请说明文件路径或链接、涉及的材料及相应权利信息，不要在公开
Issue 中披露私人个人信息。维护者将审阅请求，并视情况删除、替换或禁用
相关材料。
