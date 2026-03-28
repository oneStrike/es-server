# 任务、奖励、成长、通知与事件系统梳理

## 1. 文档目的

本文只针对当前后端仓库 `apps`、`libs`、`db` 下已经存在的源码进行梳理。

本文的目标不是罗列理想化的大一统模型，而是回答 4 个更实际的问题：

1. 当前仓里哪些能力已经真实落地
2. 当前有哪些确认存在的口径错误、模型缺口和可维护性风险
3. 后续的目标模型应该如何收敛，哪些只是长期方向，哪些适合近期落地
4. P0 / P1 / P2 应该如何拆分，避免过度设计

## 2. 审查基线

本次梳理以后端代码为唯一事实源，基于以下目录：

- `apps/admin-api`
- `apps/app-api`
- `libs/*`
- `db/*`

本次核对时已确认：

- 仓库是后端 monorepo，`apps` 下只有 `admin-api` 与 `app-api`
- 设计判断不再引用本仓库不存在的前端页面或路由
- “已存在能力”和“目标模型”在文档中显式分开表达

## 3. 当前确认已落地的能力

### 3.1 任务域

- 任务定义、任务分配、任务进度日志已经存在
- 管理端已提供任务创建、更新、上下线、领取记录分页
- App 端已提供任务领取、进度上报、手动完成
- `task_assignment` 已具备 `cycleKey`、`taskSnapshot`、`progress`、`status`、`version`

### 3.2 成长与奖励

- 积分规则、经验规则、等级规则、徽章定义、用户徽章已存在
- 统一成长流水、成长审计日志、规则限额槽位已存在
- App 端已提供积分/经验统计与记录查询、徽章查询
- 管理端已提供人工加积分、扣积分、加经验、发徽章
- 管理端人工补发已接入稳定 `operationKey`，同一操作重试会复用同一条 `bizKey`

### 3.3 通知与消息

- `user_notification`、`message_outbox`、`message_ws_metric` 已存在
- App 端已提供通知分页、未读数、单条已读、全部已读、inbox 摘要、timeline、会话与消息查询
- 管理端已提供 outbox / WS 监控摘要接口

### 3.4 公告与治理

- 公告与公告已读表已存在
- App 端已提供公告分页接口
- 主题审核、版主申请审核、敏感词管理与统计已存在
- 举报模型与 App 端创建、我的举报、详情接口已存在
- 管理端已提供举报分页、详情、处理接口
- 主题首次 `PENDING -> APPROVED` 会补发 `CREATE_TOPIC`
- 举报奖励已切到裁决后按 `REPORT_VALID / REPORT_INVALID` 结算

## 4. 当前设计中合理的部分

- 任务模板与任务实例分离，这个方向正确
- 成长变更统一落到账本服务，这个方向正确
- `bizKey` 幂等、额度控制、成长审计日志已经具备基础设施雏形
- 消息中心已不是简单占位接口，至少已有 outbox、通知、WS 指标与 inbox 聚合

## 5. 当前确认存在的问题

### 5.1 事件定义已有代码级事实源，但引用层还没完全收口

当前已经在 `libs/growth/src/event-definition/` 落地代码级 `EventDefinitionMap`，并保留 `GrowthRuleTypeEnum` 作为稳定编码层。

当前这一层已经补齐：

- 统一维护 `label / domain / subjectType / targetType / governanceGate`
- 统一维护 `consumers / implStatus / isRuleConfigurable`
- 已提供 `getEventDefinition / listEventDefinitions / listImplementedEventDefinitions / listRuleConfigurableEventDefinitions`
- 已提供轻量 `EventEnvelope`，并接到 topic / comment / like / report / task complete 高频链路
- point / experience / growth ledger / admin growth DTO 已统一引用 `event-definition` 模块里的共享说明常量

当前保留的边界是：

- 通知域与后续治理后台文档还没有完全复用同一套定义引用
- 事件定义虽然已经成为当前主事实源，但下游对 `implStatus / governanceGate` 的自动化消费仍在后续阶段

### 5.2 任务奖励契约已收紧，但能力仍只覆盖 points / experience

当前 `rewardConfig` 已经是 `jsonb`，并不是自由文本字段。

当前这一层已经完成：

- DTO、schema 注释与服务端校验都已统一到 `points / experience`
- 非法字段、负数、浮点数、0 值配置都会被明确拒绝

当前保留的边界是：

- 任务奖励能力仍只覆盖 `points / experience`
- 若未来要支持徽章等复合奖励，仍需要单独扩展正式能力而不是继续复用当前 schema

### 5.3 任务完成后已具备任务侧结算可见性

当前任务完成后已经会发奖，账本层也有幂等保护。

当前这一层已经补齐：

- `task_assignment` 已回写 `rewardStatus / rewardResultType`
- 已记录 `rewardSettledAt / rewardLedgerIds / lastRewardError`
- 任务奖励服务已返回结构化结果，不再只能靠日志判断是否命中幂等或真实失败

当前保留的边界是：

- 任务奖励失败后仍缺少独立的后台重试入口
- 混合成长时间线接口还没补，跨积分/经验统一查看仍要走后续 P1 子项

### 5.4 治理结果还没有统一前置到全部奖励与通知链路

P0 已先收住两个最明显的断点：

- 主题创建时若进入待审核，首次 `PENDING -> APPROVED` 已会补发 `CREATE_TOPIC`
- 举报已不再“创建即发奖”，而是在 `RESOLVED / REJECTED` 后按治理结果结算

但治理层仍未成为跨主题、评论、通知、任务推进的统一正式闸门。

### 5.5 管理端人工补发已恢复稳定幂等，但回滚体系仍未建设

当前人工加积分、扣积分、加经验都已经要求调用方提交稳定 `operationKey`，并会映射成稳定 `bizKey`。

当前保留的边界仍然是：

- 暂未引入通用人工回滚框架
- `operationKey` 已能串起请求、审计与账本，但后续运营工具仍可以围绕它继续增强追踪能力

### 5.6 通知域底座已存在，但领域闭环还不完整

当前确认缺失的能力包括：

- 暂无本轮新增缺口

当前已经补上的能力包括：

- `notification_template`
- `notification_preference`
- `notification_delivery`
- `CHAT` 域消息创建 outbox 消费闭环
- 任务提醒第一批链路：新任务可领、任务即将过期、奖励到账
- 重要公告经消息域物化后进入 `user_notification(type=SYSTEM_ANNOUNCEMENT)`
- 管理端通知模板 CRUD 与通知投递结果分页排障入口

当前更准确的判断是：消息域的通知链路和 chat message-created outbox 链路都已形成最小闭环，但 chat 仍继续保留自己的 ack / 未读 / 会话聚合事实源。

### 5.7 规则编码主漂移已止住，但注释复制问题仍待定义层收口

当前已经完成：

- seed 与 schema 注释里的旧章节编码 `111/113/...` 已收口到 `300/302/...`
- 举报奖励当前主链路已明确为 `REPORT_VALID / REPORT_INVALID`
- `*_REPORT` 已只保留为历史兼容语义

当前仍然保留的问题是：

- 多处 DTO 仍在手工抄写长枚举说明
- 事件定义尚未形成唯一元数据事实源，后续仍需要用定义层进一步收口

## 6. 推荐目标原则

推荐按下面几个原则收敛：

1. 任务负责“是否完成”，成长负责“如何记账”
2. 奖励结算必须可审计、可解释、可幂等
3. 治理层先判定事件是否成立，再决定是否进入奖励和通知主链路
4. 通知域与成长域共享事件语义，但不强制共享实现流程
5. 当前仓优先统一“定义层”和“契约层”，不要一开始就追求“大总线”或“大闭环”

## 7. 推荐目标模型

### 7.1 Event Definition

目标不是立刻上数据库事件中心，而是先形成代码级统一定义层。

推荐最小模型：

- 保留 `GrowthRuleTypeEnum` 作为稳定编码层
- 新增 `EventDefinitionMap`
- 用统一元数据补充：
  - 标准中文名
  - 所属业务域
  - target / subject 类型
  - 是否经过治理闸门
  - 哪些下游理论上可以消费
  - 当前实现状态

### 7.2 Task + Reward

近期目标不是直接引入复杂奖励引擎，而是先把任务奖励做成“可解释”。

推荐近期模型：

- `task` 继续保留 `rewardConfig`
- `task_assignment` 优先补奖励状态字段
- `rewardConfig` 收紧为稳定 JSON schema
- `GrowthRewardService` 返回结构化结果，不再只写 warning log

长期再评估是否需要：

- `reward_bundle`
- `reward_item`
- 独立 `task_reward_settlement`

### 7.3 Growth

成长域继续以统一账本为核心：

- 所有积分、经验变化落统一流水
- 用户积分、经验、等级仍可保留快照字段用于高频读
- 规则合表属于后续重构，不作为近期前置条件

### 7.4 Notification

通知域建议分层理解：

- `user_notification`：站内通知读模型
- `message_outbox`：可靠异步投递底座
- inbox / chat / WS：用户侧读取与实时同步

近期应补的是最小闭环，而不是一次性做多渠道通知平台：

- 模板
- 偏好
- delivery
- 任务提醒
- 公告与通知域边界

## 8. 分阶段建议

### 8.1 P0：已完成口径纠偏与幂等止血

当前这一阶段已完成：

- 主题审核通过补发 `CREATE_TOPIC`
- 举报改为裁决后发奖
- 管理端人工补发改为稳定 `operationKey`
- 对齐 `GrowthRuleTypeEnum`、seed、schema 注释与运营说明

### 8.2 P1：已完成任务奖励与账本可解释性

当前这一阶段已完成：

- `rewardConfig` schema 与示例收敛
- `task_assignment` 增补奖励状态字段
- 任务奖励返回结构化结果
- App / 管理端账本 DTO 增补 `ruleType / bizKey / context`
- 提供混合成长账本接口

### 8.3 P2：已进入定义层收口与通知最小闭环阶段

前提是 P0 / P1 已经完成。

当前已经完成：

- 代码级 `EventDefinitionMap`
- “已声明 / 已接入 / 可配置”三种状态表达
- 事件定义查询 service 与模块导出
- 轻量 `EventEnvelope` type 与高频 producer 接线
- DTO 与成长相关文档说明统一引用事件定义层，不再继续复制长枚举注释
- `notification_template`、管理端模板 CRUD 与通知渲染 fallback 已接入消息域
- 核心站内通知类型已有稳定 `notificationType -> templateKey` 定义与默认 seed 模板
- `notification_preference`、App 端偏好 `list/update` 接口与“显式覆盖默认值”策略已接入通知主链路
- 通知创建阶段已能区分 `DELIVERED / SKIPPED_SELF / SKIPPED_DUPLICATE / SKIPPED_PREFERENCE`
- `notification_delivery` 已接到 outbox worker，管理端可分页查看 `DELIVERED / FAILED / RETRYING / SKIPPED_*` 业务结果、失败原因与重试次数
- `TASK_REMINDER` 已接入通知模板/偏好/投递主链路，当前覆盖新任务可领、即将过期、奖励到账三类提醒
- 重要公告已按“高优先级 / 置顶 / 弹窗”规则物化进通知域，`inbox` 继续只读取 `user_notification + chat`
- `CREATE_TOPIC / CREATE_COMMENT / REPORT_VALID / REPORT_INVALID` 已按 consumer-aware governance gate 收口，待审核内容不再进入用户侧奖励 / 通知主链路，举报终态事件则允许进入正式结算链路
- 管理端评论审核后台已补齐 `page/detail/update-audit-status/update-hidden`，并在评论首次变为可见时补发奖励与回复通知；从可见变为隐藏/拒绝时会同步回退目标评论可见计数
- `chat.send` 已改为同事务写入 `CHAT` outbox，并在提交后做一次即时 fanout；若即时分发失败，worker 会继续基于 outbox 重试，且不写 `notification_delivery`

后续继续拆开推进：

- 暂无新的 P2-C 遗留前置

### 8.4 P3：可选的重型模型优化

这些都不该成为近期前置条件：

- `event_type` / `event_record`
- `reward_bundle` / `reward_item`
- 积分规则与经验规则彻底合表
- 多渠道通知（短信 / 邮件 / Push）

## 9. 当前更推荐的实施顺序

1. 先修正现状描述与规则编码漂移，避免团队继续基于错误认知推进
2. 再完成 P0，先收住奖励时机和人工幂等
3. 再完成 P1，把任务奖励与账本来源做成“可解释”
4. 最后才进入事件定义层与通知域收敛

## 10. 明确不建议的做法

- 不再把本仓不存在的前端页面当作“当前现状”的证据
- 不在 P0/P1 之前直接建设 `event_type` / `event_record`
- 不在当前只支持 `points/experience` 的前提下默认引入复杂 settlement 表
- 不把事件注册表做成统一执行中心
- 不把通知模板、偏好、delivery、chat 闭环、公告接入、治理收口塞进同一迭代

## 11. 结论

当前项目不是“完全没有设计”，而是已经长出了几条明确主线：

- 任务
- 成长账本
- 治理
- 消息底座

当前最大的风险不是功能少，而是：

- 现状描述不够统一
- 事件语义不是事实源
- 奖励结果在任务侧不可见
- 通知域还缺一层最小闭环
- 规则编码、seed 与注释已经开始漂移

因此当前最合理的收敛方式不是继续堆更多并列模型，而是按下面的顺序推进：

`口径修正 -> 可解释性补齐 -> 定义层统一 -> 领域闭环扩展`

---

文档落地点：

- `docs/task-growth-reward-domain-design.md`
