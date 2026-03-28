# 事件注册表专项设计文档

## 1. 文档目的

本文专门回答一个问题：

当前项目是否需要“统一事件中心”？

结论是：

- 需要统一“事件定义层”
- 不需要强行统一“模块实现层”
- 最合适的形态不是“大总线”，而是“事件注册表 / 统一事件定义层”

这份文档的目标是把下面几件事讲清楚：

1. 事件注册表到底是什么，不是什么
2. 为什么它适合当前仓库
3. 它应该统一哪些内容，不应该统一哪些内容
4. 具体应该怎么落地
5. 当前 `GrowthRuleTypeEnum` 应该如何迁移到事件注册表体系

## 2. 先给结论

### 2.1 不要做成“统一执行中心”

当前仓的业务模块差异很大：

- `forum-topic` 有主题审核
- `comment` 有敏感词、回复目标、消息通知
- `follow` 有双边奖励
- `report` 有目标解析器和治理裁决
- `task` 有周期、领取、进度、完成

这些模块的执行流程、上下文、幂等策略、本来就不应该被强行拉平。

如果把“事件统一”理解成：

- 所有模块必须走同一个 service
- 所有模块必须产出完全同构 payload
- 所有通知文案必须由同一个模板服务生成
- 所有 bizKey 必须按同一个格式拼接

那后面维护一定会更困难。

### 2.2 应该做成“统一定义层”

更合适的方式是：

- 用一层共享定义统一“事件身份证”
- 各业务模块继续保留自己的 producer / resolver / service
- 任务、成长、通知、治理这些下游通过“统一定义层”对齐语义

一句话概括就是：

`统一事件身份证，不统一事件执行过程。`

## 3. 当前仓的真实现状

### 3.1 当前最接近事件字典的是 `GrowthRuleTypeEnum`

当前仓里最成型的事件定义在：

- `libs/growth/src/growth-rule.constant.ts`

它已经覆盖：

- 论坛事件
- 评论事件
- 漫画/小说作品事件
- 漫画/小说章节事件
- 成就与社交事件
- 举报处理结果事件

### 3.2 当前存在三类“同一语义多处表达”

#### 第一类：后端常量

- `GrowthRuleTypeEnum`
- `MessageNotificationTypeEnum`

这是当前最接近“定义层”的地方。

#### 第二类：DTO 注释

同一套成长事件说明被整段复制进多个 DTO 注释里：

- `libs/growth/src/point/dto/point-rule.dto.ts`
- `libs/growth/src/point/dto/point-record.dto.ts`
- `libs/growth/src/experience/dto/experience-rule.dto.ts`
- `libs/growth/src/experience/dto/experience-record.dto.ts`
- `apps/admin-api/src/modules/growth/experience/dto/experience.dto.ts`
- `apps/admin-api/src/modules/app-user/dto/app-user.dto.ts`

这会导致：

- 枚举值改了，注释可能忘记改
- 新增事件时要改很多处
- 注释变成事实源，常量反而不是唯一事实源

#### 第三类：模块本地文案

各模块为了落账、通知、展示，会写自己的本地文案：

- 成长 remark
- 通知 title/content
- 重复提示文案

例如：

- 发帖奖励 remark：`create forum topic #...`
- 举报奖励 remark：`创建举报 #...`
- 任务奖励 remark：`任务完成奖励（积分/经验）`
- 通知标题：`你的评论收到点赞`、`你有新的关注`

这些文案本身不是问题，但不应该承担“事件定义”的职责。

## 4. 为什么当前仓适合“事件注册表”

### 4.1 现在缺的不是枚举，而是元数据

当前问题不是“没有事件码”，而是缺这些稳定元数据：

- 事件中文名
- 所属业务域
- 作用对象
- 是否要经过治理后才算生效
- 理论上可以被哪些模块消费
- 当前只是声明了，还是已经有生产者接入

### 4.2 现在缺的不是统一 service，而是统一语义

以当前仓为例：

- `CREATE_TOPIC` 实际要受审核结果影响
- `TOPIC_REPORT` / `COMMENT_REPORT` 是历史上的“提交举报即奖励”语义
- `REPORT_VALID` / `REPORT_INVALID` 才更接近治理后的正式事件
- `CREATE_REPLY` 已声明，但当前回复奖励实际仍走 `CREATE_COMMENT`

这些问题都不是“少一个公共 service”能解决的，而是“语义定义层没有统一”。

## 5. 设计目标

### 5.1 本设计要解决的事

1. 让事件定义有唯一事实源
2. 让各模块继续自治实现
3. 让 DTO、文档、任务配置、账本展示都能复用同一份定义
4. 让“已声明”和“已接入”明确区分
5. 让治理层对事件是否生效有标准表达

### 5.2 本设计明确不解决的事

1. 不把所有模块改成同一个事件总线
2. 不强制所有模块共享同一个 payload 结构
3. 不统一通知文案模板
4. 不统一各模块的 bizKey 生成细节
5. 不直接替代成长账本、任务引擎、通知模块

## 6. 统一什么，不统一什么

### 6.1 必须统一的内容

事件注册表应该统一：

- 事件编码
- 事件英文 key
- 事件标准中文名
- 所属业务域
- subject / target 类型
- 是否需要治理闸门
- 可被哪些下游消费
- 当前接入状态
- 是否允许用于规则配置

### 6.2 明确不统一的内容

各模块可以继续自己维护：

- service / resolver 的内部实现
- remark 文案
- 通知 title / content
- payload 内部细节
- bizKey 具体格式
- 模块内补偿策略和重试策略

### 6.3 统一与自治的边界

推荐边界如下：

| 层级 | 是否统一 | 说明 |
| --- | --- | --- |
| 事件码与标准语义 | 是 | 必须唯一事实源 |
| 事件治理要求 | 是 | 例如是否需要审核通过/举报裁决 |
| 事件消费者清单 | 是 | 用于任务、成长、通知复用 |
| 模块触发条件 | 否 | 由业务模块自行决定 |
| 模块查询与事务细节 | 否 | 由业务模块自行维护 |
| 通知文案与展示文案 | 否 | 允许业务自治 |
| bizKey 与 context 细节 | 否 | 允许按模块语义差异实现 |

## 7. 推荐模型

## 7.1 第一层：保留 `GrowthRuleTypeEnum` 作为稳定编码层

当前不建议直接废掉 `GrowthRuleTypeEnum`。

推荐做法：

- 保留数值编码不变
- 把它当作“稳定事件编码层”
- 通过注册表给它补元数据

原因：

- 规则表已经在用它
- DTO 已经在用它
- 账本里已经在用它
- 直接改编码层成本过高

### 7.2 第二层：新增代码级事件注册表

这是最推荐的第一阶段落地点。

建议新增目录：

- `libs/growth/src/event-definition/`

建议文件：

- `event-definition.constant.ts`
- `event-definition.type.ts`
- `event-definition.helper.ts`
- `index.ts`

推荐类型：

```ts
export type EventDomain =
  | 'forum'
  | 'comment'
  | 'content'
  | 'chapter'
  | 'social'
  | 'achievement'
  | 'governance'
  | 'task'
  | 'admin'

export type EventGovernanceGate =
  | 'none'
  | 'audit_approval'
  | 'report_judgement'
  | 'manual_review'

export type EventImplStatus =
  | 'implemented'
  | 'manual_selectable'
  | 'declared_only'
  | 'legacy_to_migrate'
  | 'deprecated'

export interface EventDefinition {
  code: GrowthRuleTypeEnum
  key: string
  label: string
  domain: EventDomain
  subjectType: string
  targetType: string
  governanceGate: EventGovernanceGate
  consumers: {
    growth: boolean
    task: boolean
    notification: boolean
  }
  implStatus: EventImplStatus
  isRuleConfigurable: boolean
  note?: string
}
```

### 7.3 第三层：统一事件实例类型 `EventEnvelope`

注册表只定义“事件是什么”，还需要一个轻量类型定义“这次发生了什么”。

推荐先只做 Type，不急着先落库。

```ts
export interface EventEnvelope {
  eventCode: GrowthRuleTypeEnum
  actorId?: number
  subjectType?: string
  subjectId?: number
  targetType?: string | number
  targetId?: number
  sceneType?: number
  sceneId?: number
  payload?: Record<string, unknown>
  occurredAt: Date
  validState: 'pending_review' | 'approved' | 'rejected' | 'hidden'
}
```

它的作用不是替代各模块 payload，而是给跨域消费一个最小公共外壳。

### 7.4 第四层：可选的数据库表 `event_type`

只有在下面这些需求出现时，再建议上表：

- 管理端只读查看事件字典
- 事件定义需要运营可见
- 需要标记事件启停
- 需要标记“已接入/未接入/废弃”

推荐字段：

- `id`
- `code`
- `key`
- `label`
- `domain`
- `subjectType`
- `targetType`
- `governanceGate`
- `consumerMask`
- `implStatus`
- `isRuleConfigurable`
- `isEnabled`
- `remark`

当前阶段不建议一开始就先做 `event_type` 表。

## 8. 推荐字段解释

### 8.1 `governanceGate`

这个字段非常关键，用来表达“一个动作发生了，不等于一个事件已经成立”。

建议值：

- `none`
  - 直接成立，不需要治理层裁决
  - 例如关注用户、作品点赞
- `audit_approval`
  - 需要审核通过后才算正式成立
  - 例如主题发表
- `report_judgement`
  - 需要举报处理结果定性后才成立
  - 例如举报有效、举报无效
- `manual_review`
  - 预留给后续复杂治理场景

### 8.2 `implStatus`

建议值及含义：

- `implemented`
  - 仓内已经存在真实生产者
- `manual_selectable`
  - 没有固定生产者，但管理端或运营输入可以选择
- `declared_only`
  - 枚举里存在，但当前没有真实生产者
- `legacy_to_migrate`
  - 当前还在使用，但语义上准备迁移
- `deprecated`
  - 明确不再建议使用

### 8.3 `consumers`

用来表达这个事件理论上能被谁消费：

- `growth`
- `task`
- `notification`

注意：

- 这是“理论消费能力”，不是“当前已全部接入”
- 实际是否接入还要看 `implStatus` 和模块具体实现

## 9. 当前事件清单推荐分档

## 9.1 已接入事件

这些事件在当前仓里已经有真实生产者：

| 事件 | 当前状态 | 说明 |
| --- | --- | --- |
| `CREATE_TOPIC` | `implemented` | 主题创建奖励已接入，但需要审核通过补发闭环 |
| `TOPIC_LIKED` | `implemented` | 主题点赞奖励已接入 |
| `TOPIC_FAVORITED` | `implemented` | 主题收藏奖励已接入 |
| `TOPIC_VIEW` | `implemented` | 主题浏览奖励已接入 |
| `CREATE_COMMENT` | `implemented` | 评论创建奖励已接入，当前也承载了回复创建 |
| `COMMENT_LIKED` | `implemented` | 评论被点赞奖励已接入 |
| `COMIC_WORK_VIEW` | `implemented` | 漫画作品浏览奖励已接入 |
| `NOVEL_WORK_VIEW` | `implemented` | 小说作品浏览奖励已接入 |
| `COMIC_WORK_LIKE` | `implemented` | 漫画作品点赞奖励已接入 |
| `NOVEL_WORK_LIKE` | `implemented` | 小说作品点赞奖励已接入 |
| `COMIC_WORK_FAVORITE` | `implemented` | 漫画作品收藏奖励已接入 |
| `NOVEL_WORK_FAVORITE` | `implemented` | 小说作品收藏奖励已接入 |
| `COMIC_CHAPTER_LIKE` | `implemented` | 漫画章节点赞奖励已接入 |
| `NOVEL_CHAPTER_LIKE` | `implemented` | 小说章节点赞奖励已接入 |
| `FOLLOW_USER` | `implemented` | 关注者奖励已接入 |
| `BE_FOLLOWED` | `implemented` | 被关注者奖励已接入 |

## 9.2 已声明但语义存在历史包袱的事件

这些事件当前有实现，但建议后续迁移口径：

| 事件 | 当前状态 | 说明 |
| --- | --- | --- |
| `TOPIC_REPORT` | `legacy_to_migrate` | 当前表示“提交主题举报即奖励”，建议迁到 `REPORT_VALID/INVALID` |
| `COMMENT_REPORT` | `legacy_to_migrate` | 当前表示“提交评论举报即奖励”，建议迁到 `REPORT_VALID/INVALID` |
| `COMIC_WORK_REPORT` | `legacy_to_migrate` | 当前语义偏“提交举报”，不是“举报裁决” |
| `NOVEL_WORK_REPORT` | `legacy_to_migrate` | 同上 |
| `COMIC_CHAPTER_REPORT` | `legacy_to_migrate` | 同上 |
| `NOVEL_CHAPTER_REPORT` | `legacy_to_migrate` | 同上 |

## 9.3 已声明但尚未接入的事件

这些事件枚举存在，但当前仓内没看到真实生产者：

| 事件 | 当前状态 | 说明 |
| --- | --- | --- |
| `CREATE_REPLY` | `declared_only` | 当前回复奖励仍由 `CREATE_COMMENT` 兼容承载 |
| `REPLY_LIKED` | `declared_only` | 当前没有单独回复被点赞事件，评论点赞统一走 `COMMENT_LIKED` |
| `TOPIC_COMMENT` | `declared_only` | 当前未形成“帖子被评论”奖励生产者 |
| `COMIC_WORK_COMMENT` | `declared_only` | 当前未接入 |
| `NOVEL_WORK_COMMENT` | `declared_only` | 当前未接入 |
| `COMIC_CHAPTER_READ` | `declared_only` | 当前未接入 |
| `NOVEL_CHAPTER_READ` | `declared_only` | 当前未接入 |
| `COMIC_CHAPTER_PURCHASE` | `declared_only` | 当前未接入 |
| `NOVEL_CHAPTER_PURCHASE` | `declared_only` | 当前未接入 |
| `COMIC_CHAPTER_DOWNLOAD` | `declared_only` | 当前未接入 |
| `NOVEL_CHAPTER_DOWNLOAD` | `declared_only` | 当前未接入 |
| `COMIC_CHAPTER_EXCHANGE` | `declared_only` | 当前未接入 |
| `NOVEL_CHAPTER_EXCHANGE` | `declared_only` | 当前未接入 |
| `COMIC_CHAPTER_COMMENT` | `declared_only` | 当前未接入 |
| `NOVEL_CHAPTER_COMMENT` | `declared_only` | 当前未接入 |
| `BADGE_EARNED` | `declared_only` | 当前没有标准化自动生产者 |
| `PROFILE_COMPLETE` | `declared_only` | 当前未接入 |
| `AVATAR_UPLOAD` | `declared_only` | 当前未接入 |
| `SHARE_CONTENT` | `declared_only` | 当前未接入 |
| `INVITE_USER` | `declared_only` | 当前未接入 |
| `DAILY_CHECK_IN` | `declared_only` | 当前未接入 |

## 9.4 建议视为人工可选事件的事件

| 事件 | 当前状态 | 说明 |
| --- | --- | --- |
| `ADMIN` | `manual_selectable` | 更适合作为人工运营或系统补发来源，不适合要求固定生产者 |

## 9.5 建议作为治理结果正式事件的事件

| 事件 | 当前状态 | 说明 |
| --- | --- | --- |
| `REPORT_VALID` | `declared_only` | 应成为举报治理通过后的正式事件 |
| `REPORT_INVALID` | `declared_only` | 应成为举报治理驳回后的正式事件 |

## 10. 各模块如何接入

## 10.1 成长模块

成长模块应该从注册表获得：

- 事件标准名
- 是否允许配置为规则
- 当前是否已废弃 / 待迁移

成长模块不应该负责：

- 决定事件怎么产生
- 决定审核是否通过
- 决定通知怎么写文案

推荐改造点：

- 规则配置 DTO 说明从注册表生成
- 账本展示的 `sourceLabel` 从注册表派生
- 对 `legacy_to_migrate` 事件增加标记

## 10.2 任务模块

任务模块应该从注册表获得：

- 哪些事件可作为任务进度来源
- 哪些事件需要治理通过后才算有效
- 哪些事件只是声明了但还没接入

任务模块不应该负责：

- 发明自己的事件字典
- 维护另一套事件候选项语义

## 10.3 通知模块

通知模块应该从注册表获得：

- 事件码与标准语义
- 是否理论上可被通知消费

通知模块继续自己维护：

- title
- content
- aggregateKey
- bizKey
- payload

也就是说，通知模块统一“事件来源”，不统一“通知文案”。

## 10.4 治理模块

治理模块应该使用注册表的 `governanceGate`：

- `audit_approval`
- `report_judgement`

这样可以标准化回答：

- 这个动作是不是已经是正式事件
- 这个事件现在能不能进入奖励链路
- 这个事件现在能不能进入任务链路

## 11. 第一阶段最推荐的落地方案

### 11.1 Phase 1：只上代码级注册表

第一阶段建议只做这些事：

- 新增 `EventDefinition` 类型
- 新增 `EventDefinitionMap`
- 新增 helper：
  - `getEventDefinition(code)`
  - `listEventDefinitions()`
  - `listImplementedEventDefinitions()`
  - `listRuleConfigurableEventDefinitions()`

不做这些事：

- 不新增数据库表
- 不新增事件实例表
- 不重构业务模块
- 不统一通知文案

### 11.2 Phase 2：让展示层和文档层改读注册表

优先替换：

- 积分/经验规则 DTO 里的长注释
- 积分/经验账本 DTO 里的长注释
- 管理端 app-user 相关 DTO 的长注释
- 根目录设计文档里的事件表述

收益：

- 先止住漂移
- 先让“定义层”真正成为唯一事实源

### 11.3 Phase 3：让任务/奖励/通知开始消费注册表元数据

这一阶段开始把定义层真正接到业务判断里：

- 任务根据 `governanceGate` 判断事件是否可计进度
- 成长根据 `implStatus` / `legacy_to_migrate` 做规则治理
- 通知根据 `consumers.notification` 决定是否纳入标准通知事件

### 11.4 Phase 4：确认有必要后再做 `event_type`

只有在管理端需要可视化事件字典，或者后续确实需要配置化事件状态时，再上表。

## 12. 推荐文件布局

建议新增：

- `libs/growth/src/event-definition/event-definition.type.ts`
- `libs/growth/src/event-definition/event-definition.constant.ts`
- `libs/growth/src/event-definition/event-definition.helper.ts`
- `libs/growth/src/event-definition/index.ts`

后续如果事件定义层逐步跨出 growth 域，再考虑独立库，例如：

- `libs/domain-event/*`

当前阶段不建议一开始就拆独立库。

## 13. 验收标准

### 13.1 定义层验收

- 全仓事件定义只有一个正式事实源
- 新增事件时不再需要手改多份长注释
- 已声明 / 已接入 / 待迁移事件能被明确区分

### 13.2 模块边界验收

- 各模块仍保留自己的业务实现
- 没有因为上注册表而把模块逻辑硬抽平
- 通知文案仍可按模块自治

### 13.3 业务验收

- 团队能明确说明 `CREATE_TOPIC`、`REPORT_VALID`、`COMMENT_LIKED` 这些事件的标准语义
- 任务、奖励、通知三条链路在语义上对得齐

## 14. 风险与注意事项

### 14.1 最大风险：把注册表做成总线

如果把注册表继续扩成：

- 统一 producer
- 统一 payload
- 统一通知渲染
- 统一事务编排

那它很快就会失控。

### 14.2 第二个风险：只建表不改消费

如果只是新增 `event_type` 表，但：

- DTO 还在手抄注释
- 模块还在自己解释事件语义
- 治理层还没接 `governanceGate`

那只是多了一张“更正式但没人用”的表。

### 14.3 第三个风险：过早追求事件实例表

当前阶段最急的是统一定义，不是统一存储所有业务事件实例。

`EventEnvelope` 先做 Type 即可，不建议现在先做 `event_record`。

## 15. 推荐下一步

如果按当前仓的节奏推进，建议顺序如下：

1. 先在 P0/P1 里冻结事件语义
2. 再新增代码级 `EventDefinitionMap`
3. 先替换 DTO 长注释和文档
4. 再让任务/奖励/通知按注册表元数据消费
5. 最后才考虑 `event_type` 表和更重的治理接入

当前最推荐的第一步实现，不是建表，而是：

- 保留 `GrowthRuleTypeEnum`
- 新增 `EventDefinitionMap`
- 给每个事件补 `domain/governanceGate/consumers/implStatus`
- 明确 `TOPIC_REPORT` 等历史事件的迁移状态

