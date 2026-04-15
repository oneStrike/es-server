# 奖励发放 / 消息通知域审查规格

## Metadata

- Slug：`reward-notification-domain-audit`
- Profile：`standard`
- Context Type：`brownfield`
- Final Ambiguity：`6.1%`
- Threshold：`20%`
- Rounds：`4`
- Context Snapshot：`.omx/context/reward-notification-domain-audit-20260415T154606Z.md`
- Interview Transcript：`.omx/interviews/reward-notification-domain-audit-20260415T155146Z.md`

## Clarity Breakdown

| Dimension   | Score |
| ----------- | ----- |
| Intent      | 0.95  |
| Outcome     | 0.93  |
| Scope       | 1.00  |
| Constraints | 0.90  |
| Success     | 0.86  |
| Context     | 0.97  |

## Intent

用户需要一份按项目规范组织、面向真实业务链路而非单一目录边界的完整审查结果，用来发现“奖励发放”和“消息通知”相关实现中的正确性、契约、测试、基础设施与跨域耦合风险，避免只审查主模块而漏掉关键关联模块。

## Desired Outcome

产出统一审查报告，整合现有通知专项审查结论，并补齐奖励发放主链路、只读消费链路、共享基础设施相关风险，最终给出：

- 必须修复项 / 建议修改项 / 仅供参考项
- 覆盖到的业务模块与基础设施清单
- 项目规范符合性结论
- 已有测试覆盖与关键缺失
- 剩余风险与审查边界说明

## In Scope

### 业务主域

- `libs/message/src/notification/*`
- `libs/message/src/eventing/*`
- `libs/growth/src/point/*`
- `libs/growth/src/experience/*`
- `libs/growth/src/growth-reward/*`
- `libs/growth/src/check-in/*`
- `libs/growth/src/task/*`
- `libs/app-content/src/announcement/*`

### 入口与消费方

- `apps/app-api/src/modules/message/*`
- `apps/admin-api/src/modules/message/*`
- `apps/admin-api/src/modules/growth/experience/*`
- `apps/admin-api/src/modules/growth/point/*`
- `apps/app-api/src/modules/user/user.service.ts`
- `apps/admin-api/src/modules/app-user/app-user-growth.service.ts`
- `libs/forum/src/profile/profile.service.ts`

### 数据契约与存储

- `db/schema/message/*`
- `db/schema/app/user-point-rule.ts`
- `db/schema/app/user-experience-rule.ts`
- `db/schema/app/check-in-streak-reward-grant.ts`
- 与主题链路直接关联的 relation / migration / comments 事实源

### 共享基础设施

- `db/extensions/findPagination.ts`
- `db/core/drizzle.service.ts`
- `db/core/error/error-handler.ts`
- `libs/platform/src/decorators/validate/contract.ts`
- `libs/platform/modules/eventing/*`
- `libs/platform/modules/auth/*`
- `libs/platform/utils/time*`
- `libs/message/src/notification/notification-websocket.service.ts`
- `libs/message/src/notification/notification-native-websocket.server.ts`

说明：共享基础设施纳入审查，但仅限它们在“奖励发放 / 消息通知 / 其读接口”主题链路上的设计、实现、风险与契约影响。

## Out of Scope / Non-goals

- 不做整仓普查式基础设施审查
- 不因为共享基础设施被复用，就自动外扩到 chat、comment 等无关业务域
- 不把与主题无关、仅共用同一 JWT / 事件 / 分页 / 错误处理能力的其他业务模块并入本次审查
- 不把审查目标缩窄为单个 PR、分支或近期改动集

## Decision Boundaries

- 默认按“当前工作区现状”做全链路审查
- 默认整合已有通知专项审查结论到新的统一报告
- 默认将“只消费奖励结果 / 通知结果”的读接口也纳入
- 默认将共享基础设施本身纳入，但只审查其在主题链路中的相关实现与影响

## Constraints

- 必须遵循 `AGENTS.md` 与 `.trae/rules/PROJECT_RULES.md`
- 审查应覆盖 controller / service / dto / module / schema / eventing / test 等分层，而非只看单个 service
- 结论表达应优先面向正确性、契约一致性、幂等、事务语义、分页语义、鉴权安全、通知投递可靠性和测试覆盖
- 若发现共享基础设施问题，报告中需明确“它对主题链路造成的影响”，避免空泛平台层吐槽

## Testable Acceptance Criteria

- 报告能列清实际覆盖的业务模块、消费模块、共享基础设施
- 报告整合已有通知专项结论，并补齐奖励发放链路
- 每个高优先级问题都能落到具体文件 / 行号 / 风险 / 建议
- 报告能明确哪些风险来自业务实现，哪些来自共享基础设施
- 报告能明确哪些内容被有意排除在本次范围之外
- 报告符合项目审查风格，优先输出 findings，再给概要

## Assumptions Exposed + Resolutions

1. 假设：审查目标是当前仓库现状，而不是某个变更集
   - 结论：确认按当前工作区现状审查

2. 假设：只读消费方是否属于“关联模块”
   - 结论：属于，必须纳入

3. 假设：共享基础设施要不要单独完整审查
   - 结论：要，但仅限主题相关链路

4. 假设：共享基础设施纳入后是否要继续外扩到其他复用域
   - 结论：不要，chat / comment 等无关业务域属于非目标

## Pressure-pass Findings

- Revisitation target：共享基础设施边界
- Before：用户要求“共享基础设施本身也扩成独立完整审查范围”
- After challenge：明确限制为“仅围绕奖励发放 / 消息通知 / 其读接口的相关链路”，防止范围膨胀成整仓审查

## Brownfield Evidence vs Inference

### 直接证据

- 奖励发放聚合入口存在：`libs/growth/src/growth-reward/growth-reward.service.ts`
- 任务奖励触发调用存在：`libs/growth/src/task/task.service.support.ts`
- 签到奖励发放事实存在：`db/schema/app/check-in-streak-reward-grant.ts`
- 通知投影与分发链路存在：`libs/message/src/eventing/notification-projection.service.ts`、`libs/message/src/eventing/message-domain-event-dispatch.worker.ts`
- App / Admin / 用户资料页读接口消费者存在：
  - `apps/app-api/src/modules/user/user.service.ts`
  - `apps/admin-api/src/modules/app-user/app-user-growth.service.ts`
  - `libs/forum/src/profile/profile.service.ts`
- 共享基础设施已实际被主题链路调用：
  - `db/extensions/findPagination.ts`
  - `db/core/drizzle.service.ts`
  - `libs/platform/src/decorators/validate/contract.ts`
  - `libs/platform/modules/eventing/*`
  - `libs/platform/modules/auth/*`

### 推断

- 后续正式审查中，分页稳定性、DTO 契约一致性、幂等写入、鉴权入口与 worker 重试语义会是高风险检查点
- 通知专项审查中的现有结论很可能会与共享基础设施问题形成交叉复现，需要统一归因

## Technical Context Findings

- 通知域已有专项审查文档，可作为已有结论输入，但不能替代奖励链路审查
- 奖励链路至少横跨 point / experience / growth-reward / task / check-in / app-content announcement
- 主题相关共享基础设施横跨分页、错误处理、事件、认证、时间和 WebSocket 握手
- 只读消费方同样可能暴露 DTO、分页、聚合统计或权限语义问题，不能简单排除

## Recommended Execution Handoff

本任务不是实现需求，而是执行一轮主题化代码审查。下一阶段应直接进入审查执行，输出统一报告，并沿用本规格作为范围和非目标约束。
