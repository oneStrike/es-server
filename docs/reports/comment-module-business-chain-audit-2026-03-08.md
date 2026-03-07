# 评论模块业务链路审计报告（2026-03-08）

## 1. 审计范围

- API 入口
  - `apps/app-api/src/modules/comment/comment.module.ts`
  - `apps/app-api/src/modules/comment/comment.controller.ts`
- 评论核心
  - `libs/interaction/src/comment/comment.service.ts`
  - `libs/interaction/src/comment/comment-interaction.service.ts`
  - `libs/interaction/src/comment/comment-growth.service.ts`
  - `libs/interaction/src/comment/comment-permission.service.ts`
  - `libs/interaction/src/comment/dto/*.ts`
- 关联链路
  - 消息通知（发件箱模式）：`libs/message/src/outbox/*`、`libs/message/src/notification/*`、`libs/message/src/inbox/inbox.service.ts`
  - 成长账本：`libs/user/src/growth-ledger/growth-ledger.service.ts`
  - 数据模型与索引：`prisma/models/app/user-comment*.prisma`、`prisma/models/app/user-report.prisma`、`prisma/models/message/message-outbox.prisma`
  - 成长规则种子：`prisma/seed/modules/interaction/growth-rule.ts`

## 2. 总体结论

- 模块整体方向正确：评论权限、敏感词审核、成长激励、消息通知都已打通。
- 但存在多处高风险问题，会影响一致性、稳定性和用户体验：
  - 取消点赞逻辑错误，可触发误判和 500。
  - 隐藏/取消隐藏评论的计数逻辑错误，`commentCount` 会漂移。
  - 消息发件箱事件在进程崩溃后可能永久卡死在处理中状态。
  - 举报去重条件不完整，并发下可能出现误拦截或 500。
- 另外还有若干中低风险项：并发细节、输入约束不足、部分成长规则未落地、消息汇总查询偏重。

## 3. 业务链路现状

1. 发表评论/回复评论
- 控制器进入 `CommentService.createComment` / `CommentService.replyComment`。
- 先校验用户是否可评论、目标是否可评论。
- 执行敏感词检测，得到审核状态与隐藏状态。
- 事务内写入评论数据。
- 仅当评论“可见”时才：
  - 更新目标对象 `commentCount`。
  - 发放评论成长奖励（积分+经验）。
  - 回复场景写入通知发件箱事件。

2. 点赞/取消点赞/举报
- 点赞：事务内创建点赞记录、更新 `likeCount`、发成长、写通知事件。
- 取消点赞：事务内删除点赞记录并减少 `likeCount`。
- 举报：先检查评论存在和重复举报，再写入 `user_report`。

3. 消息通知链路
- 业务事务内写入 `message_outbox`（按 `bizKey` 幂等）。
- 定时任务消费待处理事件，创建用户通知，再实时推送并刷新收件箱摘要。

4. 成长链路
- 评论创建、评论被点赞都会调用统一成长账本 `GrowthLedgerService.applyByRule`。
- 账本具备幂等键、每日限额/总限额并发占位机制。

## 4. 关键问题清单（按严重度）

## 4.1 高危：取消点赞逻辑错误，可能误判并触发 500

- 证据
  - `libs/interaction/src/comment/comment-interaction.service.ts:112-117` 查询点赞时未按当前用户过滤。
  - `libs/interaction/src/comment/comment-interaction.service.ts:124-126` 用“是否存在任意点赞”判断“当前用户是否点赞”。
  - `libs/interaction/src/comment/comment-interaction.service.ts:127-134` 删除时按 `(commentId,userId)` 删除，若用户其实没点过会报错。
- 影响
  - 只要该评论被别人点过赞，当前用户点“取消点赞”就可能走错分支并报 500。
  - 查询会拉取更多无关点赞记录，存在浪费。
- 建议
  - 查询时仅检查当前用户点赞记录，或直接删除并捕获 `P2025` 转业务异常。

## 4.2 高危：隐藏状态更新时计数回算错误，`commentCount` 会累计漂移

- 证据
  - `libs/interaction/src/comment/comment.service.ts:480-484` 通过 `!dto.isHidden` 反推“旧状态”。
  - 该逻辑没有读取真实旧值，属于不成立假设。
- 影响
  - 重复提交同状态（例如已经显示再执行显示）会被误判为状态变化。
  - `commentCount` 会被重复增减，长期失真。
- 建议
  - 在同一事务中先读取旧状态，再更新，再依据真实前后可见性差异改计数。

## 4.3 高危：发件箱缺少“处理中超时回收”，进程崩溃可能导致通知永久丢失

- 证据
  - `libs/message/src/outbox/outbox.worker.ts:33-43` 仅拉取 `PENDING`。
  - `libs/message/src/outbox/outbox.worker.ts:49-56` 抢占后改为 `PROCESSING`。
  - 没有将超时 `PROCESSING` 回收为 `PENDING` 的逻辑。
- 影响
  - 任务抢占后进程异常退出，会导致该事件长期无人再处理。
- 建议
  - 增加处理锁时间字段并做超时回收；或采用可恢复锁模型（如跳过锁定行 + 超时机制）。

## 4.4 高危：举报去重条件不完整，并发冲突未兜底

- 证据
  - `libs/interaction/src/comment/comment-interaction.service.ts:155-158` 去重查询缺少 `targetType`。
  - 唯一约束实际是 `(reporterId,targetType,targetId)`：`prisma/models/app/user-report.prisma:44`。
  - 创建举报未捕获唯一冲突 `P2002`：`libs/interaction/src/comment/comment-interaction.service.ts:171-181`。
- 影响
  - 可能误判“已举报”；并发重复提交时可能直接报 500。
- 建议
  - 去重查询补齐 `targetType`。
  - 对 `create` 捕获 `P2002` 并转换成明确业务错误。

## 4.5 中危：点赞并发冲突未转业务错误

- 证据
  - `libs/interaction/src/comment/comment-interaction.service.ts:41-66` 先查后写。
  - 唯一约束：`prisma/models/app/user-comment-like.prisma:20`。
  - 没有对点赞 `create` 的 `P2002` 做捕获。
- 影响
  - 双击点赞/并发点赞时，第二次请求可能返回 500。
- 建议
  - 捕获 `P2002`，统一返回“已点赞”。

## 4.6 中危：楼层号分配存在并发竞态

- 证据
  - `libs/interaction/src/comment/comment.service.ts:157-165` 在事务外先查最大楼层。
  - `libs/interaction/src/comment/comment.service.ts:167-175` 事务内再写入楼层。
- 影响
  - 并发根评论可能产生相同楼层。
- 建议
  - 将计算移入事务并加锁，或使用可重试策略与唯一约束兜底。

## 4.7 中危：敏感词命中信息落库格式不合理，且配置项未生效

- 证据
  - `libs/interaction/src/comment/comment.service.ts:136-138` 对命中数据做 `JSON.stringify` 后再存储。
  - `user_comment.sensitive_word_hits` 是 JSON 类型，应直接存 JSON。
  - 配置 `recordHits` 未被使用（检测后不区分是否应记录）。
- 影响
  - 后续按 JSON 查询分析能力下降；配置与实际行为不一致。
- 建议
  - 直接存对象数组，且按配置控制是否落库命中详情。

## 4.8 中危：输入长度约束不足，容易在数据库层报错

- 证据
  - 评论内容只有最小长度，没有最大长度：`libs/interaction/src/comment/dto/comment.dto.ts:82-88`。
  - 举报 `reason/description/evidenceUrl` 缺少上限限制：`libs/interaction/src/comment/dto/comment-interaction.dto.ts:19-40`。
  - 数据库字段有长度上限（如 `reason(50)`、`description/evidenceUrl(500)`）。
- 影响
  - 超长输入会在持久化阶段失败，形成不友好错误甚至 500。
- 建议
  - 在 DTO 层补齐 `maxLength` 与 URL 合法性校验。

## 4.9 中危：成长规则未完全落地（每日首评）

- 证据
  - 已有规则定义和种子：`FIRST_COMMENT_OF_DAY`（类型 12）。
  - 评论链路未看到对应奖励触发逻辑。
- 影响
  - “每日首评奖励”策略无法生效。
- 建议
  - 增加每日首评判定与幂等奖励发放。

## 4.10 中危：审核后转可见未补发奖励/通知（需产品确认）

- 证据
  - 创建时仅“可见评论”才发奖励/通知。
  - 审核状态更新仅调整 `commentCount`，未补偿成长和通知。
- 影响
  - 先待审后通过的评论，可能没有获得应有激励/提醒。
- 建议
  - 若产品希望“最终通过即享权益”，需在审核通过路径补偿（幂等实现）。

## 4.11 中危：等级风控能力存在但评论链路未接入

- 证据
  - 等级规则中有 `dailyReplyCommentLimit` 和 `postInterval`。
  - `UserLevelRuleService.checkLevelPermission` 已实现校验。
  - 评论服务未接入该校验。
- 影响
  - 无法按用户等级实施细粒度反刷策略。
- 建议
  - 评论发表前接入等级风控检查。

## 4.12 低危：通知后立即刷新收件箱摘要，查询成本偏高

- 证据
  - 每次通知创建后都会刷新摘要。
  - 摘要查询组合较重（多次并发查询 + 额外查询）。
- 影响
  - 高互动场景下数据库压力增大。
- 建议
  - 采用增量缓存、批量合并推送或节流刷新。

## 5. 性能与查询评估

## 5.1 明确存在的查询浪费

1. 取消点赞时读取“整条评论的全部点赞列表”，仅用于判断当前用户是否点赞。  
2. 举报流程“先查再写”，并发下仍会撞唯一约束，额外查询收益有限。

## 5.2 索引情况

- `user_comment` 在目标维度、可见性筛选、回复分页方面索引较完整。
- `user_comment_like`、`user_report`、`message_outbox` 的关键唯一约束存在，幂等基础较好。

## 6. 安全与鲁棒性评估

## 6.1 已具备能力

- 全局 JWT 鉴权、参数校验、字段白名单。
- 评论权限校验覆盖用户状态与目标状态。
- 成长与通知事件写入基本与主业务同事务，保证了大部分一致性。

## 6.2 主要缺口

- 并发冲突未统一转换为业务错误（点赞/举报）。
- 发件箱缺少处理中超时恢复策略。
- 输入长度与格式约束仍不完整。

## 7. 修复优先级建议

1. 修复 `updateCommentHidden` 计数漂移问题。  
2. 修复 `unlikeComment` 判断逻辑和异常处理。  
3. 为点赞/举报补齐 `P2002/P2025` 异常兜底。  
4. 增加发件箱 `PROCESSING` 超时回收机制。  
5. 修正举报去重条件（补 `targetType`）。  
6. 补充 DTO 长度与格式校验。  
7. 处理楼层并发和敏感词命中落库格式。  
8. 按产品策略决定是否补齐“审核后补偿奖励/通知”“每日首评奖励”。

## 8. 建议回归测试（最小集）

1. 点赞并发双击：第二次返回“已点赞”，不返回 500。  
2. 他人点赞后本人取消点赞：返回“未点赞”，不返回 500。  
3. 重复设置相同隐藏状态：`commentCount` 不变化。  
4. 举报并发重复提交：返回“已举报”，不返回 500。  
5. 消费发件箱期间中断进程：事件可恢复并最终投递。  
6. 评论先待审后通过：按产品规则验证是否补发成长与通知。

## 9. 结论

- 当前评论模块骨架完整，已具备上线所需的核心业务链路。
- 但在并发正确性、计数一致性、异步可靠性上仍有结构性风险。
- 建议先完成高优问题修复，再扩大评论场景流量。

