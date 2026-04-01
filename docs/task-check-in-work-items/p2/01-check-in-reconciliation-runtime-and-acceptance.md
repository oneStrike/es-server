# P2-01 对账、补偿与上线验收

## 目标

为签到一期补齐运行治理能力，确保签到事实、奖励发放、补偿流程和上线验收具备可观察、可修复、可复核的闭环。

## 范围

1. 设计签到对账查询口径。
2. 设计奖励补偿与修复入口。
3. 定义运行期指标、日志和告警建议。
4. 定义最终上线验收需要沉淀的证据。

## 当前代码锚点

- `libs/growth/src/growth-ledger/growth-ledger.service.ts`
- `db/schema/app/growth-ledger-record.ts`
- `db/schema/app/growth-audit-log.ts`
- `db/schema/app/growth-rule-usage-slot.ts`

## 非目标

1. 不在本任务中增加新的签到业务能力。
2. 不在本任务中引入 task 对账或 task 联动验收。
3. 不在本任务中恢复现存 `DAILY_CHECK_IN` 规则配置。

## 主要改动

1. 定义对账查询主视图，至少覆盖：
   - `check_in_record`
   - `check_in_streak_reward_grant`
   - `growth_ledger_record`
   - `growth_audit_log`
2. 定义异常分类：
   - 有签到事实但无基础奖励账本；
   - 达到连续奖励阈值但无发放事实；
   - 有发放事实但账本落账失败；
   - 同一业务幂等键重复落账。
3. 定义补偿入口：
   - 只补奖励，不补签到事实；
   - 必须校验原业务幂等键；
   - 必须记录补偿操作人、时间和结果。
4. 定义运行指标：
   - 每日签到成功率；
   - 补签成功率；
   - 奖励补偿待处理数；
   - 连续奖励发放失败数；
   - 周期内补签额度耗尽分布。
5. 定义上线验收证据：
   - 并发幂等测试；
   - 补签边界测试；
   - 连续奖励触发测试；
   - 对账脚本结果；
   - 回归 task 与 growth 现有链路的结果。

## 完成标准

1. 已有明确的对账视图与异常分类，能定位签到奖励主链路问题。
2. 已有可执行的奖励补偿入口，且不会重复写入签到事实。
3. 已形成运行指标、日志与告警建议。
4. 最终验收清单可基于本任务定义的证据位完成签收。

## 完成后同步文档

1. [development-plan.md](/D:/code/es/es-server/docs/task-check-in-work-items/development-plan.md)
2. [final-acceptance-checklist.md](/D:/code/es/es-server/docs/task-check-in-work-items/checklists/final-acceptance-checklist.md)
3. [README.md](/D:/code/es/es-server/docs/task-check-in-work-items/README.md)

## 排期引用

- 优先级：`S2`
- 波次：`Wave 3`
- 状态：`pending`
- 硬前置：`P1-01`
- 直接后置：最终上线收口
- 以 [execution-plan.md](/D:/code/es/es-server/docs/task-check-in-work-items/execution-plan.md) 为唯一事实源
