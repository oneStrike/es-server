# 项目全量模块梳理与模块边界改造任务清单

生成时间：2026-04-06（Asia/Shanghai）

## 目标

- 先给出当前仓库的全量 Nest 模块盘点结果。
- 再给出后续“业务域不保留 barrel，`libs/platform` 允许目录级统一导出，其余统一改为文件直连”的改造任务清单。
- 该文档作为后续排期、拆分任务和实施改造的本地事实源。

## 盘点口径

- 扫描范围：`apps/*`、`libs/*`
- 扫描方法：
  - `rg --files apps libs | rg "module\\.ts$"` 用于识别模块相关文件
  - `rg -n "@Module\\(" apps libs -g "*.module.ts"` 用于识别真正声明了 Nest `@Module` 的模块
- 统计结果：
  - 模块相关文件总数：137
  - 真正声明了 `@Module` 的模块：127
  - 当前用于过渡的 runtime-only `module.ts` 入口文件：10
  - `apps/admin-api`：42
  - `apps/app-api`：20
  - `libs/*`：75

## 当前目标口径

- 除 `libs/platform` 目录级 public API 外，DTO、Module、Service、constant、type 全部直连 owner 文件
- 不再保留 `index.ts`、`dto/index.ts`、`core/index.ts`、`module/index.ts`、`module.ts` 这类转发文件；`libs/platform` 允许在各目录下保留 `index.ts` 作为统一导出，但不恢复 `src/modules/index.ts` 这类宽聚合入口
- `*.module.ts`、`*.service.ts`、`*.resolver.ts`、`*.controller.ts`、`*.dto.ts` 统一直连具体文件
- 真正的 Nest 聚合模块本体可以保留，例如：
  - `apps/admin-api/src/app.module.ts`
  - `apps/app-api/src/app.module.ts`
  - `libs/content/src/content.module.ts`
  - `libs/forum/src/forum.module.ts`
  - `libs/interaction/src/interaction.module.ts`
  - `libs/message/src/message.module.ts`
  - `libs/platform/src/platform.module.ts`
- 但这些聚合模块本体也不再通过额外 barrel 做二次转发

## 当前高风险入口

- 聚合模块 barrel：
  - `libs/interaction/src/module/index.ts`
  - `libs/forum/src/module/index.ts`
  - `libs/message/src/module/index.ts`
  - `libs/platform/src/module/index.ts`
- 当前仍需收敛口径的公共能力入口：
  - `libs/platform/src/config/index.ts`
  - `libs/platform/src/constant/index.ts`
  - `libs/platform/src/decorators/index.ts`
  - `libs/platform/src/dto/index.ts`
  - `libs/platform/src/filters/index.ts`
  - `libs/platform/src/interceptors/index.ts`
  - `libs/platform/src/types/index.ts`
  - `libs/platform/src/utils/index.ts`
  - `libs/platform/src/modules/**/index.ts`
  - `libs/user/src/index.ts`
  - `libs/user/src/dto/index.ts`
  - `libs/user/src/dto/base.ts`
  - `libs/identity/src/core/index.ts`
  - `libs/moderation/sensitive-word/src/index.ts`
- 过渡性 runtime-only module 入口：
  - `libs/interaction/src/browse-log/module.ts`
  - `libs/interaction/src/comment/module.ts`
  - `libs/interaction/src/download/module.ts`
  - `libs/interaction/src/emoji/module.ts`
  - `libs/interaction/src/favorite/module.ts`
  - `libs/interaction/src/follow/module.ts`
  - `libs/interaction/src/like/module.ts`
  - `libs/interaction/src/purchase/module.ts`
  - `libs/interaction/src/reading-state/module.ts`
  - `libs/interaction/src/report/module.ts`
- 当前最容易形成循环依赖或误导入的核心链路：
  - `content/work -> interaction.module -> comment.module -> like.module -> content/forum DTO`
  - `forum/topic.module -> comment|favorite|follow|like|report`
  - `interaction/comment|favorite|follow|like -> user.module`
  - `apps/* -> libs/*/module barrel -> 聚合模块 -> 子域 mixed barrel`
- `apps/*|libs/* -> @libs/platform/<folder> -> platform 目录级公共 API（允许存在，但要防止恢复根级 mega barrel 或 `@libs/platform/modules` 宽入口）`
  - `apps/*|libs/* -> @libs/user/index|dto -> user barrel -> dto/base`
  - `apps/*|libs/* -> @libs/identity/core|@libs/sensitive-word -> mixed barrel`

## 全量模块清单

### apps/admin-api（42）

- `apps/admin-api/src/app.module.ts`
- `apps/admin-api/src/modules/admin.module.ts`
- `apps/admin-api/src/modules/admin-user/admin-user.module.ts`
- `apps/admin-api/src/modules/app-content/agreement/agreement.module.ts`
- `apps/admin-api/src/modules/app-content/announcement/announcement.module.ts`
- `apps/admin-api/src/modules/app-content/config/config.module.ts`
- `apps/admin-api/src/modules/app-content/page/page.module.ts`
- `apps/admin-api/src/modules/app-user/app-user.module.ts`
- `apps/admin-api/src/modules/auth/auth.module.ts`
- `apps/admin-api/src/modules/check-in/check-in.module.ts`
- `apps/admin-api/src/modules/comment/comment.module.ts`
- `apps/admin-api/src/modules/content/author/author.module.ts`
- `apps/admin-api/src/modules/content/category/category.module.ts`
- `apps/admin-api/src/modules/content/comic/chapter-content/chapter-content.module.ts`
- `apps/admin-api/src/modules/content/comic/chapter/comic-chapter.module.ts`
- `apps/admin-api/src/modules/content/comic/core/comic.module.ts`
- `apps/admin-api/src/modules/content/comic/third-party/third-party.module.ts`
- `apps/admin-api/src/modules/content/content.module.ts`
- `apps/admin-api/src/modules/content/emoji/emoji.module.ts`
- `apps/admin-api/src/modules/content/novel/novel.module.ts`
- `apps/admin-api/src/modules/content/tag/tag.module.ts`
- `apps/admin-api/src/modules/forum/forum.module.ts`
- `apps/admin-api/src/modules/forum/moderator-application/moderator-application.module.ts`
- `apps/admin-api/src/modules/forum/moderator/moderator.module.ts`
- `apps/admin-api/src/modules/forum/search/search.module.ts`
- `apps/admin-api/src/modules/forum/section-group/forum-section-group.module.ts`
- `apps/admin-api/src/modules/forum/section/forum-section.module.ts`
- `apps/admin-api/src/modules/forum/sensitive-word/sensitive-word.module.ts`
- `apps/admin-api/src/modules/forum/tag/forum-tag.module.ts`
- `apps/admin-api/src/modules/forum/topic/topic.module.ts`
- `apps/admin-api/src/modules/growth/badge/badge.module.ts`
- `apps/admin-api/src/modules/growth/experience/experience.module.ts`
- `apps/admin-api/src/modules/growth/growth.module.ts`
- `apps/admin-api/src/modules/growth/level-rule/level-rule.module.ts`
- `apps/admin-api/src/modules/growth/point/point.module.ts`
- `apps/admin-api/src/modules/message/message.module.ts`
- `apps/admin-api/src/modules/report/report.module.ts`
- `apps/admin-api/src/modules/system/audit/audit.module.ts`
- `apps/admin-api/src/modules/system/config/system-config.module.ts`
- `apps/admin-api/src/modules/system/dictionary/dictionary.module.ts`
- `apps/admin-api/src/modules/system/upload/upload.module.ts`
- `apps/admin-api/src/modules/task/task.module.ts`

### apps/app-api（20）

- `apps/app-api/src/app.module.ts`
- `apps/app-api/src/modules/app.module.ts`
- `apps/app-api/src/modules/auth/auth.module.ts`
- `apps/app-api/src/modules/check-in/check-in.module.ts`
- `apps/app-api/src/modules/comment/comment.module.ts`
- `apps/app-api/src/modules/dictionary/dictionary.module.ts`
- `apps/app-api/src/modules/download/download.module.ts`
- `apps/app-api/src/modules/emoji/emoji.module.ts`
- `apps/app-api/src/modules/favorite/favorite.module.ts`
- `apps/app-api/src/modules/follow/follow.module.ts`
- `apps/app-api/src/modules/forum/forum.module.ts`
- `apps/app-api/src/modules/like/like.module.ts`
- `apps/app-api/src/modules/message/message.module.ts`
- `apps/app-api/src/modules/purchase/purchase.module.ts`
- `apps/app-api/src/modules/reading-history/reading-history.module.ts`
- `apps/app-api/src/modules/report/report.module.ts`
- `apps/app-api/src/modules/system/system.module.ts`
- `apps/app-api/src/modules/task/task.module.ts`
- `apps/app-api/src/modules/user/user.module.ts`
- `apps/app-api/src/modules/work/work.module.ts`

### libs/app-content（3）

- `libs/app-content/src/agreement/agreement.module.ts`
- `libs/app-content/src/announcement/announcement.module.ts`
- `libs/app-content/src/page/page.module.ts`

### libs/config（3）

- `libs/config/src/app-config/config.module.ts`
- `libs/config/src/dictionary/dictionary.module.ts`
- `libs/config/src/system-config/system-config.module.ts`

### libs/content（7）

- `libs/content/src/author/author.module.ts`
- `libs/content/src/category/category.module.ts`
- `libs/content/src/content.module.ts`
- `libs/content/src/permission/content-permission.module.ts`
- `libs/content/src/tag/tag.module.ts`
- `libs/content/src/work/work.module.ts`
- `libs/content/src/work-counter/work-counter.module.ts`

### libs/forum（12）

- `libs/forum/src/action-log/action-log.module.ts`
- `libs/forum/src/counter/forum-counter.module.ts`
- `libs/forum/src/forum.module.ts`
- `libs/forum/src/moderator/moderator.module.ts`
- `libs/forum/src/moderator-application/moderator-application.module.ts`
- `libs/forum/src/permission/forum-permission.module.ts`
- `libs/forum/src/profile/profile.module.ts`
- `libs/forum/src/search/search.module.ts`
- `libs/forum/src/section/forum-section.module.ts`
- `libs/forum/src/section-group/forum-section-group.module.ts`
- `libs/forum/src/tag/forum-tag.module.ts`
- `libs/forum/src/topic/forum-topic.module.ts`

### libs/growth（11）

- `libs/growth/src/badge/user-badge.module.ts`
- `libs/growth/src/check-in/check-in.module.ts`
- `libs/growth/src/event-definition/event-definition.module.ts`
- `libs/growth/src/experience/experience.module.ts`
- `libs/growth/src/growth-ledger/growth-ledger.module.ts`
- `libs/growth/src/growth-reward/growth-event-bridge.module.ts`
- `libs/growth/src/growth-reward/growth-reward.module.ts`
- `libs/growth/src/level-rule/level-rule.module.ts`
- `libs/growth/src/permission/permission.module.ts`
- `libs/growth/src/point/point.module.ts`
- `libs/growth/src/task/task.module.ts`

### libs/identity（1）

- `libs/identity/src/identity.module.ts`

### libs/interaction（12 个实际模块 + 10 个过渡入口）

实际模块：

- `libs/interaction/src/browse-log/browse-log.module.ts`
- `libs/interaction/src/comment/comment.module.ts`
- `libs/interaction/src/download/download.module.ts`
- `libs/interaction/src/emoji/emoji.module.ts`
- `libs/interaction/src/favorite/favorite.module.ts`
- `libs/interaction/src/follow/follow.module.ts`
- `libs/interaction/src/interaction.module.ts`
- `libs/interaction/src/like/like.module.ts`
- `libs/interaction/src/purchase/purchase.module.ts`
- `libs/interaction/src/reading-state/reading-state.module.ts`
- `libs/interaction/src/report/report.module.ts`
- `libs/interaction/src/user-assets/user-assets.module.ts`

过渡入口：

- `libs/interaction/src/browse-log/module.ts`
- `libs/interaction/src/comment/module.ts`
- `libs/interaction/src/download/module.ts`
- `libs/interaction/src/emoji/module.ts`
- `libs/interaction/src/favorite/module.ts`
- `libs/interaction/src/follow/module.ts`
- `libs/interaction/src/like/module.ts`
- `libs/interaction/src/purchase/module.ts`
- `libs/interaction/src/reading-state/module.ts`
- `libs/interaction/src/report/module.ts`

### libs/message（6）

- `libs/message/src/chat/chat.module.ts`
- `libs/message/src/inbox/inbox.module.ts`
- `libs/message/src/message.module.ts`
- `libs/message/src/monitor/monitor.module.ts`
- `libs/message/src/notification/notification.module.ts`
- `libs/message/src/outbox/outbox.module.ts`

### libs/moderation（1）

- `libs/moderation/sensitive-word/src/sensitive-word.module.ts`

### libs/platform（8）

- `libs/platform/src/modules/auth/auth.module.ts`
- `libs/platform/src/modules/cache/cache.module.ts`
- `libs/platform/src/modules/crypto/crypto.module.ts`
- `libs/platform/src/modules/health/health.module.ts`
- `libs/platform/src/modules/logger/logger.module.ts`
- `libs/platform/src/modules/sms/sms.module.ts`
- `libs/platform/src/modules/upload/upload.module.ts`
- `libs/platform/src/platform.module.ts`

### libs/user（1）

- `libs/user/src/user.module.ts`

## 改造任务清单

### P0-01 统一文件直连目标口径

目标

- 把“全仓不保留任何 barrel，统一文件直连”写成明确改造口径。

范围

- `.trae/rules/PROJECT_RULES.md`
- `.trae/rules/PROJECT_RULES.md`
- 本文档

当前代码锚点

- `libs/interaction/src/module/index.ts`
- `libs/forum/src/module/index.ts`
- `libs/message/src/module/index.ts`
- `libs/platform/src/module/index.ts`

非目标

- 不在本任务里批量改代码。

主要改动

- 把允许入口明确收敛成：
  - DTO：直接导具体 `*.dto.ts` 文件
  - 运行时：直接导具体 `*.service.ts`、`*.module.ts`、`*.constant.ts`、`*.type.ts`
  - 禁止任何额外转发文件

完成标准

- 规范文件与本文档口径一致。
- 不再保留“DTO barrel 可以保留”或“聚合入口可以长期存在”的模糊表述。

完成后同步文档

- 本文档

排期引用

- Wave 1 前置

### P0-02 清理 Interaction 运行时过渡入口

目标

- 把 `libs/interaction/src/*/module.ts` 这 10 个过渡入口全部回收掉，模块文件改为直连真实 `*.module.ts`。

范围

- `libs/interaction/src/*/module.ts`
- 所有引用 `@libs/interaction/*/module` 的运行时文件（至少包括 `*.module.ts`）

当前代码锚点

- `libs/interaction/src/comment/comment.module.ts`
- `libs/forum/src/topic/forum-topic.module.ts`
- `apps/app-api/src/modules/comment/comment.module.ts`
- `apps/app-api/src/modules/download/download.module.ts`
- `apps/app-api/src/modules/favorite/favorite.module.ts`
- `apps/app-api/src/modules/follow/follow.module.ts`
- `apps/app-api/src/modules/like/like.module.ts`
- `apps/app-api/src/modules/purchase/purchase.module.ts`
- `apps/app-api/src/modules/reading-history/reading-history.module.ts`
- `apps/admin-api/src/modules/comment/comment.module.ts`
- `apps/admin-api/src/modules/report/report.module.ts`

非目标

- 不在本任务里处理 DTO 文件归并。

主要改动

- 把 `@libs/interaction/*/module` 改成具体文件路径。
- 删除 10 个过渡 `module.ts` 文件。

完成标准

- 全仓不再出现 `from '@libs/interaction/*/module'`。
- `libs/interaction/src/*/module.ts` 文件全部删除。
- `pnpm type-check` 通过。
- 至少完成 1 项运行时装配验证：
  - `admin-api` / `app-api` 的启动验证，或
  - 受影响 Nest 模块的 targeted bootstrap / module compile 验证
- 不再出现 `imports[x] is undefined`、模块扫描失败或同类运行时装配错误。

完成后同步文档

- 本文档

排期引用

- Wave 1

### P0-03 清理高风险循环链上的所有转发入口

目标

- 优先拆掉最容易在 Nest 模块扫描阶段引发循环依赖的运行时导入链。

范围

- `libs/content/src/work`
- `libs/forum/src/topic`
- `libs/interaction/src/comment`
- `libs/interaction/src/favorite`
- `libs/interaction/src/follow`
- `libs/interaction/src/like`
- `libs/user/src`

当前代码锚点

- `libs/content/src/work/work.module.ts`
- `libs/forum/src/topic/forum-topic.module.ts`
- `libs/interaction/src/comment/comment.module.ts`
- `libs/interaction/src/favorite/favorite.module.ts`
- `libs/interaction/src/follow/follow.module.ts`
- `libs/interaction/src/like/like.module.ts`
- `libs/user/src/index.ts`

非目标

- 不在本任务里做全仓统一收尾。

主要改动

- 先把模块层、服务层对 `@libs/user/index`、`@libs/interaction/module`、`@libs/message/module`、`@libs/forum/module`、`@libs/platform/module` 的依赖逐步改成具体文件。
- 把本轮已知高风险链路压平，先保证应用可以稳定启动。

完成标准

- `InteractionModule`、`WorkModule`、`ForumTopicModule` 的 imports 不再通过运行时 barrel 间接拉起 DTO。
- admin-api / app-api 启动时不再出现 “imports[x] is undefined” 这类模块扫描错误。

完成后同步文档

- 本文档

排期引用

- Wave 1

### P1-01 清理 Content 与 Forum 域的全部 barrel

目标

- 把 `content/*`、`forum/*` 中包括 DTO 在内的公共入口全部改成直连具体文件。

范围

- `libs/content/src/**/index.ts`
- `libs/forum/src/**/index.ts`
- 相关 controller / service / resolver / module 调用点

当前代码锚点

- `libs/content/src/author/index.ts`
- `libs/content/src/category/index.ts`
- `libs/content/src/tag/index.ts`
- `libs/content/src/work/index.ts`
- `libs/forum/src/section/index.ts`
- `libs/forum/src/section-group/index.ts`
- `libs/forum/src/tag/index.ts`
- `libs/forum/src/topic/index.ts`
- `libs/forum/src/profile/index.ts`

非目标

- 不主动重命名业务类。

主要改动

- DTO、service、module、constant、type 的引用全部改为直连文件
- 删除 root `index.ts`、`dto/index.ts` 以及其他转发文件

完成标准

- `content/*`、`forum/*` 不再保留任何 barrel。
- 与这两个域相关的 DTO 全部从具体 DTO 文件直连获取。

完成后同步文档

- 本文档

排期引用

- Wave 2

### P1-02 清理 Growth、Message、App-Content、Config 域的全部 barrel

目标

- 把剩余共享库的所有 barrel 全部回收，统一到“全量文件直连”。

范围

- `libs/growth/src/**`
- `libs/message/src/**`
- `libs/app-content/src/**`
- `libs/config/src/**`

当前代码锚点

- `libs/growth/src/badge/index.ts`
- `libs/growth/src/experience/index.ts`
- `libs/growth/src/point/index.ts`
- `libs/growth/src/level-rule/index.ts`
- `libs/growth/src/growth-ledger/index.ts`
- `libs/message/src/module/index.ts`
- `libs/config/src/core/index.ts`
- `libs/app-content/src/agreement/index.ts`

非目标

- 不在本任务里处理 apps 入口层的最终收尾。

主要改动

- 继续按域分批把 DTO 与 runtime 的 barrel 都切成直连文件
- 删除剩余历史 `index.ts`、`module/index.ts`、`module.ts`、`base.ts` 等转发文件

完成标准

- 共享层不再保留任何 barrel。
- 这些域内所有会解析到转发文件的目录级入口全部回收，不仅限于 `@libs/**/module`、`@libs/**/dto`。

完成后同步文档

- 本文档

排期引用

- Wave 3

### P1-03 清理 Platform、User、Identity、Moderation 域的公共 barrel

目标

- 清理公共能力层仍在活跃使用的 barrel，并把 `platform` 历史公共入口收敛为“目录级 public API”，避免 Wave 结束后仍残留失控入口。

范围

- `libs/platform/src/**`
- `libs/user/src/**`
- `libs/identity/src/**`
- `libs/moderation/sensitive-word/src/**`
- 直接依赖上述 barrel 的 libs 调用点

当前代码锚点

- `libs/platform/src/config/index.ts`
- `libs/platform/src/filters/index.ts`
- `libs/platform/src/module/index.ts`
- `libs/user/src/index.ts`
- `libs/user/src/dto/index.ts`
- `libs/user/src/dto/base.ts`
- `libs/identity/src/core/index.ts`
- `libs/moderation/sensitive-word/src/index.ts`

非目标

- 不在本任务里统一收尾 apps 入口层的全部导入。

主要改动

- 把 `platform` 的公共导入口统一收敛到目录级 `index.ts`，例如 `@libs/platform/config`、`@libs/platform/dto`、`@libs/platform/utils`、`@libs/platform/modules/auth`，但不再保留 `@libs/platform/modules`
- 回收 `@libs/user/index`、`@libs/user/dto`、`@libs/identity/core`、`@libs/sensitive-word` 等非平台公共入口
- 把 DTO、module、service、constant、type、decorator、filter、utility 等调用统一改成直连 owner 文件
- 删除对应 `index.ts`、`dto/index.ts`、`base.ts`、`module/index.ts` 等转发文件；`platform` 仅保留目录级 `index.ts` public API

完成标准

- `user / identity / moderation` 域不再保留仍被代码消费的 barrel。
- `platform` 域允许 `@libs/platform/<folder>`、`@libs/platform/<folder>/<subfolder>` 这类目录级 public API，但不恢复 `@libs/platform` 根级入口、`@libs/platform/module` 历史入口与 `@libs/platform/modules` 宽入口。
- 不再存在任何解析到非平台转发文件的目录级 alias 导入；`platform` 仅允许命中 `libs/platform/src/**/index.ts`，且排除 `libs/platform/src/modules/index.ts`。
- 类型检查、目标测试、目标启动验证通过。

完成后同步文档

- 本文档

排期引用

- Wave 4

### P1-04 清理 apps 入口层导入

目标

- 让 `apps/admin-api`、`apps/app-api` 不再依赖共享库的运行时 barrel；`platform` 允许目录级 public API。

范围

- `apps/admin-api/src/**`
- `apps/app-api/src/**`

当前代码锚点

- `apps/admin-api/src/app.module.ts`
- `apps/admin-api/src/modules/admin.module.ts`
- `apps/app-api/src/app.module.ts`
- `apps/app-api/src/modules/app.module.ts`
- `apps/app-api/src/modules/auth/auth.module.ts`
- `apps/app-api/src/modules/user/user.module.ts`
- `apps/app-api/src/modules/work/work.module.ts`

非目标

- 不改变 controller/service 的业务行为。

主要改动

- DTO、module、service、constant、type 导入全部改为直连具体文件；`platform` 目录级 public API 可保留聚合导入

完成标准

- `apps/*` 不再通过非平台 barrel 获取 DTO 或运行时符号。
- `apps/*` 中不再保留任何会解析到转发文件的目录级 alias 导入；唯一允许的例外是 `platform` 的目录级 public API。
- 类型检查、目标测试、应用启动验证通过。

完成后同步文档

- 本文档

排期引用

- Wave 5

### P2-01 补齐自动校验与验收清单

目标

- 防止后续再次引入业务域 barrel、未经批准的转发文件，或把 `platform` 目录级 public API 演变回根级 mega barrel。

范围

- `eslint.config.mjs`
- 自定义 boundary 检查脚本
- 本文档或后续验收清单

当前代码锚点

- `.trae/rules/PROJECT_RULES.md`
- `.trae/rules/PROJECT_RULES.md`
- `docs/audits/2026-04-06-module-inventory-refactor-task-list.md`

非目标

- 不在本任务里继续做大范围代码迁移。

主要改动

- 新增校验：
  - DTO 文件必须直连具体 DTO 文件
  - 运行时文件必须直连 owner 文件
  - 禁止新增未获批准的 `index.ts`、`dto/index.ts`、`module/index.ts`、`module.ts`、`base.ts` 等转发文件
  - 禁止任何会解析到转发文件的目录级 alias 导入，而不只是 `@libs/**/module`、`@libs/**/dto`
  - `platform` 仅允许 `libs/platform/src/**/index.ts` 形式的目录级 public API，但排除 `libs/platform/src/modules/index.ts`

完成标准

- 有稳定的 lint 或脚本校验可以阻止回归。
- 校验范围覆盖 DTO、runtime、user/identity/moderation 公共入口等所有 barrel 形态，并对 `platform` 目录级 public API 做精确例外控制。
- 最终验收清单可以对照本文档逐项勾选。

完成后同步文档

- 本文档
- 后续验收清单

排期引用

- Wave 6

## 建议执行顺序

1. `P0-01` 先冻结目标口径，避免后面边改边变。
2. `P0-02` 先回收 Interaction 的 10 个过渡入口。
3. `P0-03` 先压平 `work / topic / comment / like / user` 这条高风险链。
4. `P1-01` 和 `P1-02` 先按业务域清理 content / forum / growth / message / app-content / config 的剩余 barrel。
5. `P1-03` 再集中回收 `platform / user / identity / moderation` 这些公共入口。
6. `P1-04` 最后统一 apps 入口层导入。
7. `P2-01` 收尾加防线。

## 备注

- 本文档只负责“模块盘点 + 改造任务拆分”。
- 实施时建议按任务再拆更细的子任务文档，而不是一次性全仓改完。
- `UploadModule.register(...)` 这类动态模块返回值不属于 barrel 问题，本轮排查时不要和“imports[x] is undefined”简单混为一谈。
