## 用户成长体系重构（User Growth Refactor） - ALIGNMENT

### 1. 背景与问题

- 当前成长相关能力分散在多个“论坛命名”的模块中：
  - 积分：`ForumPointService` + `AppPointRule/AppPointRecord`
  - 经验：`ForumExperienceService` + `AppExperienceRule/AppExperienceRecord`
  - 等级：`ForumLevelRuleService` + `AppLevelRule`
  - 徽章：`ForumBadge/ForumProfileBadge`，模型挂在 forum schema 下
- 数据层面，这些能力已经直接关联 `AppUser`，但在语义和架构上仍强绑定“论坛”：
  - 枚举、注释、种子数据以论坛行为为中心
  - 管理端接口挂在 `/admin/forum/*`
  - 徽章模型命名为 `ForumBadge`，限制了跨业务复用空间
- 希望将“成长体系”从论坛子能力升级为“用户成长中心”，支持论坛、漫画等多业务共享一套统一的用户成长模型。

### 2. 目标与非目标

**目标**

- 建立独立的“用户成长域（User Growth Domain）”，统一承载：
  - 积分（Points）
  - 经验（Experience）
  - 等级及其权益（Level + Permissions）
  - 通用用户徽章（Badges）
  - 成长事件与规则（按子域配置）
- 论坛、漫画等业务作为“事件源”接入成长域，而不是成长能力的宿主。
- 明确引入**消息队列/事件总线**，采用“事件驱动 + 异步消费”的成长架构：
  - 业务域只负责发布领域事件到事件总线；
  - 成长域作为事件消费者，订阅并处理用户成长相关事件。
- 为漫画系统提供与论坛同等优先级的一等接入能力，而不是后置补充。

**非目标（本阶段不做）**

- 不在本轮实现复杂的 AB 实验与动态策略引擎，先聚焦规则配置 + 防刷。
- 不在本轮拆分为独立微服务进程，仍在现有 monorepo 内按 NestJS 库模式组织代码。

### 3. 范围与边界

**本轮改造范围**

- 后端：
  - 对现有 **`libs/user` 库进行完全重构**，将其升级为“用户成长域”库，而不是在其旁边新增新的用户成长库。
  - 在该库内部统一封装积分、经验、等级、徽章等成长能力，对外只以“用户成长”语义暴露接口。
  - 引入“成长事件（GrowthEvent）”层，将论坛、漫画等业务行为抽象为标准事件。
  - 基于 NestJS 库模式（`libs/*`）对 `libs/user` 的内部结构进行分层重构（如 `growth/events`、`growth/points`、`growth/experience`、`growth/level`、`growth/badge` 等），通过公共接口供各业务库调用。
  - 引入消息队列或事件总线抽象（如 `UserGrowthEventBus`），业务库通过事件总线发布用户成长事件，成长库订阅并处理。
  - 将论坛模块从直接调用积分/经验服务，改为发布事件；成长域异步消费事件并发放成长值。
  - 将论坛徽章模型迁移/升级为通用用户徽章模型，并与 `AppUser` 绑定，forum 侧不再持有自己的徽章表。
- 管理端：
  - 新增“用户成长管理”接口分组（例如 `/admin/user-growth/*`）。
  - forum 模块下原有成长相关接口**不再保留向后兼容实现**，而是迁移到 user-growth 管理模块。

**暂不纳入范围**

- 前端 UI 的深度重构，仅做路由与分组的必要调整（菜单/路径分组到“用户成长”）。
- 事件存储 Event Store 的重放能力在后续设计（本轮只要求具备将事件写入 MQ / EventBus 的能力，是否额外落库单独评估）。

### 4. 当前实现摘要（现状快照）

- 积分：
  - 表：`AppPointRule`、`AppPointRecord`（app 域），通过 `userId` 关联 `AppUser`。
  - 服务：`ForumPointService`，命名上带 Forum，逻辑上已是通用积分服务。
  - 调用：论坛发帖成功后直接调用 `ForumPointService.addPoints`。
- 经验与等级：
  - 表：`AppExperienceRule`、`AppExperienceRecord`、`AppLevelRule`（app 域）。
  - 服务：`ForumExperienceService`、`ForumLevelRuleService`。
  - 调用：经验主要通过后台管理接口发放；等级通过经验更新自动计算并更新 `AppUser.levelId`。
- 徽章：
  - 表：`ForumBadge`、`ForumProfileBadge`（forum schema），但 `ForumProfileBadge.userId` 直接关联 `AppUser`。
  - 服务：`ForumBadgeService`，负责创建/更新徽章、为用户分配/撤销徽章。
  - 调用：前后台只通过论坛徽章服务操作，逻辑上是“论坛徽章”，数据上是“用户徽章”。

### 5. 目标架构概览

- 在用户域下抽象“用户成长域”（按照 NestJS 库模式实现独立模块）：
  - Points 子域：封装积分规则与积分记录逻辑。
  - Experience 子域：封装经验规则与经验记录逻辑。
  - Level 子域：封装等级规则、升级计算与等级权益（发帖数、回复数、点赞/收藏上限、黑名单/收藏上限、折扣等）。
  - Badge 子域：封装通用用户徽章及用户-徽章关联。
  - GrowthEvent 中心：统一接收各业务上报的用户行为事件（如 `forum.topic.create`、`comic.chapter.read`），并根据各子域规则表分发到 Points/Experience/Badge 等子域执行成长逻辑。
  - UserGrowthEventBus 抽象：采用消息队列或事件总线作为实现（具体中间件可为 Kafka/RabbitMQ/NATS 或 NestJS 微服务传输层），支持解耦业务与成长域。
- 论坛域和漫画域等业务库：
  - 只负责在领域行为成功后发布成长事件到 UserGrowthEventBus（遵循统一事件模型）。
  - 不再直接依赖具体积分/经验/徽章服务。
  - forum 不再拥有独立的徽章表，所有徽章数据统一由成长域管理。

### 6. 里程碑与任务拆分（高层）

- M1：重构现有 `libs/user` 为用户成长域库并抽象事件模型
  - 以现有 `libs/user` 为基础，重构其内部结构：
    - 从当前的 `experience`、`level-rule`、`point` 三个模块，收敛为以“用户成长”为核心的分层结构（如 `growth/points`、`growth/experience`、`growth/level`、`growth/badge`、`growth/events` 等）。
    - 将现有 Forum* 命名的服务迁移/重命名到用户成长语义下（例如 `UserPointService`、`UserExperienceService` 等），并通过统一的 Growth API 暴露。
  - 在该库中定义统一成长事件 DTO（包含 business、eventKey、userId、targetId、context 等字段）。
- M2：引入 UserGrowthEventBus 抽象与 MQ/事件总线集成
  - 定义 `UserGrowthEventBus` 接口，封装发布/订阅能力。
  - 基于选定的消息队列或事件总线中间件实现默认实现（如 Kafka/RabbitMQ/NATS 或 NestJS 内置微服务传输层）。
  - 论坛与漫画库在关键行为成功后，通过 UserGrowthEventBus 发布成长事件。
  - UserGrowthModule 作为事件消费者，订阅并处理成长事件。
- M3：通用徽章模型与 forum 徽章表退场
  - 在 Prisma 中新增通用徽章与用户徽章关联模型（例如 `UserBadge` / `UserBadgeAssignment`，命名待最终确认）。
  - 将 `ForumBadge`/`ForumProfileBadge` 数据迁移到新模型，并在迁移后移除 forum 侧对应表与模型定义。
  - 新建 UserBadgeService，基于新表实现徽章 CRUD 与用户徽章能力，仅由 UserGrowthModule 暴露。
  - forum 侧的徽章接口调整为调用 UserGrowthModule 提供的徽章能力。
- M4：积分/经验规则事件化与命名统一
  - 保持 `AppPointRule` 与 `AppExperienceRule` 两张规则表，但在字段层增加事件维度（如 eventKey/business）。
  - Re-map 现有规则 type 为标准事件键（如 `forum.topic.create`、`forum.reply.create`、`forum.topic.liked` 等）。
  - Growth 事件消费端根据 eventKey/business 匹配对应规则并执行积分/经验/徽章处理。
  - 服务命名逐步统一到以 UserGrowth 为前缀或命名空间，替换掉 Forum* 命名。
- M5：管理端接口迁移与合并
  - 新增 `/admin/user-growth/*` 路由，包含积分、经验、等级、徽章和成长事件监控等能力。
  - forum 管理模块下原有成长相关接口迁移到 user-growth 管理模块，不保留向后兼容实现。
  - 前端调整菜单，将成长相关管理功能统一归到“用户成长”或“运营成长体系”下。
- M6：漫画系统接入与防刷策略完善
  - 为漫画域定义关键成长事件（如章节阅读、章节购买、作品收藏等）并通过 UserGrowthEventBus 上报。
  - 根据社区最佳实践补齐防刷策略（详见下文防刷策略章节），对两大业务域（论坛/漫画）统一执行。

### 7. 已确认的关键决策与约束

根据最新要求，以下歧义点已经收敛为明确约束，将作为后续设计与实现的前提：

1. **必须引入消息队列或事件总线，但本轮不拆微服务**
   - 成长架构采用“事件驱动 + 异步消费”模式。
   - 业务域通过事件总线发布事件，成长域订阅并处理，不再直接调用成长服务。
   - 本轮改造以单体 NestJS 应用 + libs 模块化为前提，通过 `UserGrowthEventBus` 抽象对接 MQ/事件总线，未来如需拆分为独立成长服务，只需替换 EventBus 的具体实现。

2. **不需要向后兼容 forum 下的成长接口**
   - forum 模块下原有的积分/经验/徽章接口不再保留长期兼容层。
   - 管理面能力统一迁移到“用户成长管理”模块（如 `/admin/user-growth/*`），由重构后的 `libs/user` 提供能力。

3. **forum 不再保留成长相关表**
   - `ForumBadge`、`ForumProfileBadge` 等 forum 下的成长表在数据迁移完成后将被移除。
   - 成长相关数据全部集中在 app/user 侧的通用模型中管理。

4. **漫画系统作为明确需要接入的第二业务域**
   - 漫画业务与论坛业务在成长体系中的接入优先级视为同级。
   - 在设计事件模型与规则映射时，需要同时考虑漫画事件（如章节阅读/购买）。

5. **防刷与上限策略需要参考社区最佳实践**
   - 除现有 `dailyLimit` 外，将按社区实践补充 IP/设备/时间窗口等多维度频控策略。
   - 防刷策略在成长事件层统一实现，并可按业务/事件进行细粒度配置。

6. **遵循 NestJS 库模式组织成长域并重构现有 `libs/user`**
   - 不新增新的用户成长库，而是在现有 `libs/user` 基础上重构其内部结构，使其成为“用户成长域库”。
   - 业务模块通过依赖注入方式使用成长域提供的接口/客户端，不直接耦合内部实现。

7. **命名需要参考社区最佳实践**
   - 域名/模块名/事件键/表名等命名遵循：
     - 领域驱动命名（例如 `user_growth`, `user_badge`, `user_growth_event` 等）。
     - 事件键采用 `domain.resource.action` 风格（如 `forum.topic.create`、`comic.chapter.read`）。
   - 具体命名将在下一阶段 CONSENSUS 文档中给出候选方案，由你最终拍板。
8. **成长规则不统一为规则中心**
  - 各子域保留自身规则表与配置逻辑；
  - 事件按 `business + eventKey` 路由到对应子域执行。

### 8. 仍需你确认的歧义点

在以上前提已经确认的基础上，目前仍存在以下需要你拍板的方案细节：

1. **成长模块在 `libs/user` 内部的命名细节**
   - 推荐方向：
     - 目录：`libs/user/src/growth` 作为用户成长域主目录。
     - Module 名称：`UserGrowthModule` 作为对外暴露的聚合模块。
   - 问题：是否接受上述命名？如果项目已有统一规范，请告知需要对齐的规则。

2. **通用徽章模型的具体命名**
   - 当前倾向使用更通行的命名：
     - 表/模型：`UserBadge`（徽章定义）、`UserBadgeAssignment`（用户徽章关联）或类似风格。
   - 问题：是否接受该命名风格？如果有产品层面的既定术语（如“成就/勋章”等），是否需要体现在模型名中？

3. **消息队列/事件总线的具体技术选型与集成方式**
   - 备选：
     - 基于 NestJS Microservices 抽象，使用 Kafka/RabbitMQ/NATS 等作为传输层。
     - 或现有项目中已经存在的 MQ/事件基础设施（如果有）。
   - 问题：
     - 是否已有既定 MQ 中间件（如 Kafka/RabbitMQ）必须对齐？还是由我在 DESIGN 阶段给出推荐默认方案？

4. **事件存储与审计的深度**
   - 选项 A：仅依赖 MQ + 成长记录表（PointRecord/ExperienceRecord/BadgeAssignment），不额外建 Event Store。
   - 选项 B：同时引入 `user_growth_event` 表，记录关键事件，用于后续重放/审计。
   - 问题：
     - 在你的期望里，是否需要在本轮就落地 Event Store？如果是，更偏向轻量审计用途，还是明确要支持重放？

5. **防刷策略的粒度与默认策略**
   - 社区常见防刷维度包括：
     - 同一用户在短时间内的事件频次限制（例如 N 秒内最多一次同类事件生效）。
     - 同一 IP/设备在短时间内的事件频次限制。
     - 针对高价值事件（例如大额经验/积分或稀有徽章）的人工审核/白名单机制。
   - 问题：
     - 是否有具体的业务规则（例如“1 分钟内最多计 1 次发帖经验”“每日最多获得 X 枚徽章”）需要在方案中固化？

请基于以上“仍需确认的歧义点”给出你的偏好，我会在此基础上更新 ALIGNMENT 文档为最终版，并输出对应的 CONSENSUS 与 DESIGN 文档大纲和内容草案，确保后续实现阶段可以直接按文档拆解任务。 
