# 统一成长账本方案（废弃 growth-event 主链路）

## 1. 文档定位

本文档是针对当前 `es-server` 项目的一份落地方案，目标是在废弃 `growth-event` 主链路的前提下，建设一个可扩展到积分、经验、徽章等能力的统一成长结算内核。

当前项目处于开发阶段，历史数据可删除，因此本文默认采用“开发阶段简化迁移策略”：

1. 允许直接清理旧数据与旧表
2. 允许一次性切换，不强制长期双轨兼容
3. 以交付速度优先，在测试环境完成回归后直接收敛

本版为一期决策稿，关键决策已固定：

1. 一期即落地统一流水表，不做双表兼容
2. 限流采用“规则使用槽位表 + 唯一约束”方案
3. `bizKey` 唯一维度采用 `(user_id, biz_key)`
4. 徽章纳入同一业务事务（与积分/经验原子一致）

文档侧重：

1. 强一致（业务成功即账本成功）
2. 并发安全（不丢账、不超扣、不重复发放）
3. 可扩展（不仅积分，后续经验/徽章/活动奖励可复用）
4. 可审计（可追溯每次变更来源与规则）

---

## 2. 背景与问题

### 2.1 当前现状

当前项目已同时存在以下能力：

1. 积分能力：`libs/user/src/point/*`
2. 经验能力：`libs/user/src/experience/*`
3. 成长事件链路：`libs/user/src/growth-event/*`
4. 多业务域触发成长：`forum/content/interaction/task`

### 2.2 已识别问题

1. 结算入口分散：有的直接写积分记录，有的走 `growth-event`
2. 幂等策略不统一：不同业务自己做“防重”，可维护性差
3. 并发策略不统一：部分场景为“先查再写”，存在竞态风险
4. 审计分散：事件审计与账本记录分离，排障链路长
5. 扩展成本高：新增“资产类型”容易重复造轮子

---

## 3. 目标与非目标

### 3.1 目标

1. 废弃 `growth-event` 作为主结算链路
2. 提供统一的同步结算内核 `GrowthLedgerService`
3. 支持至少两类资产：`POINTS`、`EXPERIENCE`
4. 规则判定与账本记账解耦，支持后续策略扩展
5. 提供强幂等、并发安全、审计可追踪能力

### 3.2 非目标

1. 不在一期内改造全部历史业务
2. 不要求一期就合并所有旧表
3. 不强制一期上线复杂活动编排系统

---

## 4. 核心设计原则

1. 单一写入口：所有成长资产变更只能走 Ledger
2. 事务内结算：核心业务与成长记账同事务
3. 幂等优先：通过 `bizKey` 保证“最多一次生效”
4. 原子更新：余额相关变更必须使用数据库原子表达式
5. 审计先行：每次判定与写入均有审计信息

---

## 5. 总体架构

## 5.1 组件划分

1. `GrowthLedgerService`（核心）
   1. 统一处理 `grant/consume/apply`
   2. 强制要求传入事务 `tx`
   3. 负责幂等、原子更新、流水写入

2. `GrowthRuleEngine`（规则判定）
   1. 输入：用户、资产类型、规则类型、业务上下文
   2. 输出：`allow | deny`、`delta`、`reason`
   3. 不直接写库

3. `GrowthAuditService`（审计）
   1. 记录请求上下文、判定结果、落账结果
   2. 提供排障与运营追溯

4. `GrowthPolicy`（可扩展策略层）
   1. `PointPolicy`
   2. `ExperiencePolicy`
   3. 后续可接 `BadgePolicy`（发放型）

### 5.2 建议目录

```text
libs/user/src/growth-ledger/
  dto/
    growth-apply.dto.ts
  growth-ledger.constant.ts
  growth-ledger.types.ts
  growth-ledger.service.ts
  growth-rule-engine.service.ts
  growth-audit.service.ts
  policies/
    point.policy.ts
    experience.policy.ts
  index.ts
```

---

## 6. 数据模型设计

## 6.1 统一流水表（新增）

建议新增 `growth_ledger_record`，统一记录积分/经验等资产流水。

关键字段：

1. `userId`
2. `assetType`：`POINTS | EXPERIENCE`
3. `delta`：正数发放，负数扣减
4. `beforeValue` / `afterValue`
5. `ruleType` / `ruleId`（可空）
6. `bizKey`（幂等键，核心）
7. `source`（业务来源：comment/purchase/task/...）
8. `targetType` / `targetId`（业务关联）
9. `remark`
10. `createdAt`

关键索引：

1. `UNIQUE(user_id, biz_key)`：幂等保障（跨资产统一幂等）
2. `INDEX(user_id, asset_type, created_at)`：账单查询
3. `INDEX(source, created_at)`：审计追踪

## 6.2 审计表（新增）

建议新增 `growth_audit_log`，用于替代 `growth-event` 的链路审计价值。

关键字段：

1. `requestId`（链路追踪）
2. `userId`
3. `bizKey`
4. `assetType`
5. `action`（grant/consume/apply_rule）
6. `ruleType`
7. `decision`（allow/deny）
8. `reason`
9. `deltaRequested` / `deltaApplied`
10. `context`（json）
11. `createdAt`

## 6.3 用户资产字段

短期继续复用 `app_user.points`、`app_user.experience`；
后续若资产增多再评估是否引入 `user_asset_balance` 表。

## 6.4 用户资产余额表（可选规划）

为支持后续多资产扩展，建议在方案中预留 `user_asset_balance`（是否启用由你决定）。

建议字段：

1. `id`
2. `userId`
3. `assetType`：`POINTS | EXPERIENCE | ...`
4. `balance`
5. `version`（可选，乐观锁）
6. `createdAt` / `updatedAt`

建议索引：

1. `UNIQUE(user_id, asset_type)`
2. `INDEX(asset_type, updated_at)`

两种落地模式：

1. 模式 A（先不启用，当前推荐）
   1. 继续使用 `app_user.points/experience`
   2. 后续资产类型增加时再迁移到余额表

2. 模式 B（直接启用）
   1. 所有资产余额统一写 `user_asset_balance`
   2. `app_user.points/experience` 可保留为冗余列或逐步下线

取舍：

1. 模式 A：改造成本低，适合快速替换 `growth-event`
2. 模式 B：长期扩展性更强，但一期改造与迁移成本更高

---

## 7. 幂等与并发安全设计

## 7.1 幂等键规范（必选）

`bizKey` 生成建议：

1. 评论创建奖励：`comment:create:{commentId}`
2. 评论被点赞奖励：`comment:liked:{commentId}:{likeUserId}`
3. 章节购买扣积分：`purchase:chapter:{purchaseId}`
4. 任务奖励：`task:complete:{taskAssignmentId}`

约束：

1. 同一业务语义必须稳定生成同一 `bizKey`
2. 不允许时间戳随机后缀
3. 由业务调用层生成，Ledger 只校验不生成

## 7.2 原子扣减（必选）

扣减流程必须如下：

1. `updateMany where id = userId and points >= need`
2. `data: { points: { decrement: need } }`
3. `count = 0` 时返回余额不足
4. 成功后查询新值并写流水（同事务）

经验扣减同理。

## 7.3 原子发放（建议）

发放使用 `increment`，避免“外部 current 值覆盖写回”导致丢更新。

## 7.4 限流规则并发保护

对于 `dailyLimit/totalLimit/cooldown`，禁止仅靠“先 count 后 create”。

本方案固定采用：`growth_rule_usage_slot` 槽位表 + 唯一键（社区常见的高并发可控方案）。

建议表结构：

1. `id`
2. `userId`
3. `assetType`
4. `ruleKey`（规则唯一标识）
5. `slotType`：`DAILY | TOTAL | COOLDOWN`
6. `slotValue`：如 `2026-03-07`、`all`、`2026-03-07T10:15`
7. `createdAt`

关键约束：

1. `UNIQUE(user_id, asset_type, rule_key, slot_type, slot_value)`

判定方式：

1. `dailyLimit`：按天槽位写入，达到上限后插入失败即拒绝
2. `totalLimit`：使用累计槽位 `slotValue=all` 配合计数控制
3. `cooldown`：按时间窗口槽位（向下取整）防重复命中

> 说明：当前库结构里积分/经验规则表的 `cooldown/business/event_key` 字段已删除，限流与路由需在规则引擎层或独立 usage 表实现，不再依赖旧字段。

---

## 8. 统一接口设计

## 8.1 入参结构

```ts
export type GrowthAssetType = 'POINTS' | 'EXPERIENCE'

export interface ApplyGrowthParams {
  userId: number
  assetType: GrowthAssetType
  action: 'GRANT' | 'CONSUME'
  delta: number
  bizKey: string
  source: string
  ruleType?: number
  ruleId?: number
  targetType?: number
  targetId?: number
  remark?: string
  context?: Record<string, unknown>
}
```

## 8.2 返回结构

```ts
export interface ApplyGrowthResult {
  success: boolean
  duplicated?: boolean
  reason?:
    | 'insufficient_balance'
    | 'rule_not_found'
    | 'rule_disabled'
    | 'daily_limit'
    | 'total_limit'
    | 'cooldown'
    | 'rule_zero'
  beforeValue?: number
  afterValue?: number
  deltaApplied?: number
  ledgerRecordId?: number
}
```

## 8.3 批量资产结算接口（签到等场景）

为支持“一个业务同时发积分+经验”，建议提供 `applyBatch`：

```ts
export interface ApplyGrowthBatchParams {
  userId: number
  bizKey: string
  source: string
  items: Array<{
    assetType: 'POINTS' | 'EXPERIENCE'
    action: 'GRANT' | 'CONSUME'
    delta: number
    ruleType?: number
    ruleId?: number
  }>
  targetType?: number
  targetId?: number
  remark?: string
  context?: Record<string, unknown>
}
```

`applyBatch` 规则：

1. 单事务执行
2. 单 `bizKey` 幂等（整批只生效一次）
3. 同时失败同时回滚
4. 返回每个资产项的 before/after/deltaApplied

---

## 9. 代码骨架（示例）

```ts
@Injectable()
export class GrowthLedgerService extends BaseService {
  async apply(tx: Prisma.TransactionClient, params: ApplyGrowthParams): Promise<ApplyGrowthResult> {
    // 1) 幂等检查：存在则直接返回 duplicated
    const duplicated = await tx.growthLedgerRecord.findFirst({
      where: {
        userId: params.userId,
        assetType: params.assetType,
        bizKey: params.bizKey,
      },
      select: { id: true, beforeValue: true, afterValue: true, delta: true },
    })
    if (duplicated) {
      return {
        success: true,
        duplicated: true,
        beforeValue: duplicated.beforeValue,
        afterValue: duplicated.afterValue,
        deltaApplied: duplicated.delta,
        ledgerRecordId: duplicated.id,
      }
    }

    // 2) 资产字段映射
    const field = params.assetType === 'POINTS' ? 'points' : 'experience'
    const amount = Math.abs(params.delta)

    // 3) 扣减
    if (params.action === 'CONSUME') {
      const updated = await tx.appUser.updateMany({
        where: { id: params.userId, [field]: { gte: amount } },
        data: { [field]: { decrement: amount } },
      })
      if (updated.count === 0) {
        return { success: false, reason: 'insufficient_balance' }
      }
    } else {
      // 4) 发放
      await tx.appUser.update({
        where: { id: params.userId },
        data: { [field]: { increment: amount } },
      })
    }

    // 5) 查询变更后值并计算前值
    const user = await tx.appUser.findUniqueOrThrow({
      where: { id: params.userId },
      select: { points: true, experience: true },
    })

    const afterValue = params.assetType === 'POINTS' ? user.points : user.experience
    const signedDelta = params.action === 'CONSUME' ? -amount : amount
    const beforeValue = afterValue - signedDelta

    // 6) 写统一流水
    const record = await tx.growthLedgerRecord.create({
      data: {
        userId: params.userId,
        assetType: params.assetType,
        delta: signedDelta,
        beforeValue,
        afterValue,
        bizKey: params.bizKey,
        source: params.source,
        ruleType: params.ruleType,
        ruleId: params.ruleId,
        targetType: params.targetType,
        targetId: params.targetId,
        remark: params.remark,
        context: params.context as any,
      },
    })

    return {
      success: true,
      beforeValue,
      afterValue,
      deltaApplied: signedDelta,
      ledgerRecordId: record.id,
    }
  }
}
```

---

## 10. 规则引擎设计

## 10.1 引擎职责

`GrowthRuleEngine` 仅负责判定，不写用户资产，不写最终流水。

判定内容：

1. 规则是否存在/启用
2. 规则值是否有效
3. `dailyLimit/totalLimit/cooldown` 是否命中
4. 返回 `allow/deny/reason/delta`

## 10.2 与 Ledger 协作

调用顺序：

1. 业务层生成 `bizKey`
2. `ruleEngine.evaluate(...)`
3. 允许后 `ledger.apply(...)`
4. 审计结果写入 `growth_audit_log`

---

## 11. 业务接入规范

## 11.1 评论创建奖励（同步）

在 `CommentService.createComment` 事务内：

1. 先写评论
2. 规则判定（评论奖励）
3. 通过后调用 Ledger 发积分/经验
4. 使用固定 `bizKey = comment:create:{commentId}`

## 11.2 评论被点赞奖励（同步）

在 `CommentInteractionService.likeComment` 事务内：

1. 先写点赞关系
2. 对评论作者触发奖励
3. `bizKey = comment:liked:{commentId}:{likerUserId}`

## 11.3 章节购买扣减（同步）

在 `PurchaseService.purchaseTarget` 事务内：

1. 先创建购买记录
2. 调用 Ledger 扣积分（原子扣减）
3. `bizKey = purchase:chapter:{purchaseId}`

## 11.4 任务奖励（同步或准同步）

建议优先同步（任务完成即到账），若任务量极大可拆批处理，但幂等键规则保持一致。

## 11.5 签到同时发积分和经验（明确支持）

签到服务直接调用 `applyBatch`：

1. `bizKey = sign:daily:{userId}:{yyyyMMdd}`
2. `items = [{assetType:'POINTS', action:'GRANT', delta:5}, {assetType:'EXPERIENCE', action:'GRANT', delta:10}]`
3. 若重复签到，幂等命中返回 `duplicated=true`
4. 全流程一次事务，不会出现“积分成功但经验失败”

---

## 12. 与现有模块职责关系

1. `UserPointService`
   1. 保留查询能力
   2. 发放/扣减接口逐步下线或改为代理到 Ledger

2. `UserExperienceService`
   1. 同上

3. `growth-event`
   1. 迁移期保留只读/兼容
   2. 新写入停止
   3. 验证完成后移除模块依赖与消费器

4. `growth-overview`
   1. 该模块当前主要是 DTO 导出，可不立即删除
   2. 若后续无对外接口依赖，可在收敛阶段移除
   3. 若仍有展示需求，可改为读取 `growth_ledger_record` 聚合数据

5. 徽章发放
   1. 纳入同一业务事务
   2. 与积分/经验共用同一 `bizKey`
   3. 通过 `user_badge_assignment` 唯一约束保证幂等

---

## 13. 分阶段迁移计划（推荐）

## 阶段 0：准备

1. 新增 `growth-ledger` 模块
2. 新增 `growth_ledger_record`、`growth_audit_log`
3. 新增 `growth_rule_usage_slot`
4. 新增/调整唯一索引：`UNIQUE(user_id, biz_key)`

## 阶段 1：接入强一致核心场景

1. 购买扣积分接入 Ledger
2. 评论创建奖励接入 Ledger
3. 评论点赞奖励接入 Ledger
4. 签到场景接入 `applyBatch`（积分+经验同事务）
5. 徽章发放与积分/经验同事务落地

## 阶段 2：接入任务与活动场景

1. 任务奖励迁移
2. 运营奖励迁移
3. 举报奖励/审核奖励迁移

## 阶段 3：下线 growth-event 主链路

1. 禁止 `UserGrowthEventService.handleEvent` 新调用
2. 清理业务模块对 `growth-event` 的注入
3. 移除消费者与定时审计依赖
4. 开发阶段可直接清空并删除历史事件数据与相关表（无需归档）

## 阶段 4：收敛旧接口

1. `UserPointService.addPoints/consumePoints` 标记废弃
2. 对外统一只暴露 Ledger 能力
3. 更新开发规范与代码扫描规则
4. 评估是否删除 `growth-event` 相关数据表与代码

---

## 14. 数据迁移与兼容策略

1. 一期直接写 `growth_ledger_record`（单轨）
2. 不做双表兼容，不做历史回灌
3. 查询口径直接切到新表
4. `user_growth_event` / `user_growth_event_archive` 直接删除
5. `user_point_record` / `user_experience_record` 迁移完成后可直接删除

## 14.1 可能删除的对象（最终阶段）

开发阶段在“已完成全量迁移 + 回归通过”后即可删除：

1. 代码模块：
   1. `libs/user/src/growth-event/*`
   2. 所有业务域对 `UserGrowthEventService` 的注入和调用

2. 数据表（可选）：
   1. `user_growth_event`
   2. `user_growth_event_archive`

开发阶段可选直接删除：

1. `user_point_record`
2. `user_experience_record`

前提：对应查询接口已改读 `growth_ledger_record`，并通过联调测试。

## 14.2 开发阶段推荐收敛动作（一次性）

1. 停止所有 `UserGrowthEventService` 调用
2. 删除 `libs/user/src/growth-event/*`
3. 删除 `user_growth_event`、`user_growth_event_archive` 表
4. 视查询改造情况删除 `user_point_record`、`user_experience_record`
5. 全量运行回归测试后再开放联调环境

---

## 15. 功能可用优先（最小联调清单）

当前阶段不要求完整测试体系，先保证核心功能可用。上线前至少完成以下联调：

1. 评论创建可正常发放积分/经验（单次到账，重复请求不重复到账）
2. 评论点赞可给作者发奖励（点赞人不获奖，重复点赞不重复发放）
3. 章节购买可正常扣积分（余额不足时明确失败）
4. 签到可一次性发放积分+经验（同事务，要么都成功要么都失败）
5. 账本查询可看到 `before/after/delta/bizKey/source`

---

## 16. 监控与告警

核心指标：

1. `growth_ledger_apply_total{assetType,action,success}`
2. `growth_ledger_apply_duration_ms`
3. `growth_ledger_idempotent_hit_total`
4. `growth_ledger_insufficient_balance_total`
5. `growth_ledger_rule_reject_total{reason}`

告警建议：

1. 5 分钟失败率 > 2%
2. 幂等命中率突增（可能重试风暴）
3. 审计日志写入失败

---

## 17. 风险与应对

1. 风险：迁移期双写不一致
   1. 应对：迁移期坚持“单写”，避免双写分叉

2. 风险：幂等键设计不规范
   1. 应对：统一生成规范与代码审查检查项

3. 风险：规则限流并发超发
   1. 应对：引入槽位表/锁机制，不走裸 `count->create`

4. 风险：业务改造面大
   1. 应对：分阶段、按域灰度、先改强一致场景

---

## 18. 开发规范（落地约束）

1. 禁止直接 `update app_user.points/experience`（除 Ledger）
2. 禁止无 `bizKey` 的成长变更
3. 禁止在业务层自行写成长流水
4. 规则判定必须通过 RuleEngine
5. 所有新业务奖励必须补充并发与幂等测试
6. 业务层避免重复查用户：在事务入口读取一次用户快照并在 Ledger 内复用

## 18.1 查询次数控制（避免“过多查询”）

原则：一次业务事务内，用户存在性与余额信息最多读取一次。

建议实现：

1. `applyBatch` 内一次性更新并返回用户最新余额（或一次更新 + 一次读取）
2. 规则引擎接收调用方已查到的用户快照，避免重复 `findUnique`
3. 对“扣减+写流水”使用原子更新，避免额外重试查询风暴

---

## 19. 与“积分工具类方案”的关系

1. 可继承其“事务内调用”思想
2. 不采用“纯静态 helper + 外部 currentPoints 覆盖写回”模式
3. 升级为统一 Ledger 架构，覆盖积分+经验+后续资产

---

## 20. 验收标准

1. 强一致场景（评论、购买、点赞）全部接入 Ledger
2. `growth-event` 主链路无新增调用
3. 并发压测下无负余额、无重复发放
4. 审计链路可追踪任意一笔账变来源
5. 新增经验奖励接入无需复制积分逻辑

---

## 21. 待确认项

本版已完成决策，无待确认项。

---

## 22. 实施进展（2026-03-07）

### 22.1 已完成

1. 数据库改造完成
2. 已新增 `growth_ledger_record`、`growth_audit_log`、`growth_rule_usage_slot`
3. 已删除 `user_growth_event`、`user_growth_event_archive`
4. 已按 `UNIQUE(user_id, biz_key)` 落地幂等唯一约束
5. 已完成 `pnpm prisma:update` 迁移

6. 统一结算内核已落地
7. 已新增 `GrowthLedgerService` 作为积分/经验统一结算入口
8. 已支持 `applyByRule` 与 `applyDelta` 两类结算模式
9. 已落地 `daily/total` 槽位限流

10. 并发事务稳定性修复完成
11. 已将“唯一冲突后 catch”改为 `createMany + skipDuplicates`
12. 已避免 PostgreSQL 事务因唯一冲突进入 aborted 状态
13. 已修复报错：`当前事务被终止, 事务块结束之前的查询被忽略`

14. 业务模块对接进展
15. 积分服务已切到统一账本写入
16. 经验服务已切到统一账本写入
17. 评论模块已完成对接：
18. 评论发布奖励（积分+经验）已接入
19. 评论点赞奖励（发给评论作者）已接入
20. 评论奖励与评论业务处于同一事务

21. 兼容与配套调整
22. `growth-event` 旧 consumer/audit/cron 已移除
23. `UserGrowthEventService` 现为兼容桥接层（同步写账本）
24. 种子已补充评论成长规则（`CREATE_COMMENT`/`COMMENT_LIKED`/`FIRST_COMMENT_OF_DAY`）
25. 种子已移除已废弃字段 `business/eventKey` 的写入
26. `pnpm type-check` 已通过

### 22.2 未完成（下一阶段）

1. 购买链路仍有旧表写入，尚未完全单轨
2. `libs/interaction/src/purchase/purchase.service.ts` 仍直接写 `user_point_record`
3. `growth-event` 仍有业务侧引用，尚未彻底删除模块
4. `growth-overview` DTO 仍在 admin 概览接口中被引用
5. `cooldown` 槽位限流尚未完成最终实现

### 22.3 当前结论

1. 评论场景已可用并已对接统一账本
2. 方案已从“仅设计”进入“可运行改造阶段”
3. 完全收敛到无 `growth-event` 仍需继续推进
