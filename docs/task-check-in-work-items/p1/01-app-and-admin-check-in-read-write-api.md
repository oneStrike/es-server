# P1-01 App/Admin 签到接口与读模型

## 目标

在签到计划、周期与奖励契约冻结后，补齐 App 与 Admin 的签到读写接口，让用户侧可完成签到、补签、查看记录与日历，让运营侧可配置计划、查看奖励规则、追踪执行结果。

## 范围

1. 设计 App 端签到、补签、摘要、日历、记录接口。
2. 设计 Admin 端签到计划管理、计划详情、对账入口与执行观察面。
3. 定义接口返回结构与错误语义。
4. 定义读模型字段，覆盖当前周期、剩余补签次数、连续天数和奖励信息。

## 当前代码锚点

- `apps/app-api/src/modules/task/task.controller.ts`
- `apps/admin-api/src/modules/task/task.controller.ts`
- `libs/growth/src/task/task-runtime.service.ts`
- `libs/growth/src/task/dto/task.dto.ts`
- `libs/growth/src/growth-ledger/growth-ledger.service.ts`

## 非目标

1. 不在本任务中重新设计成长账本服务。
2. 不在本任务中引入 task 联动或签到任务视图。
3. 不在本任务中恢复 `DAILY_CHECK_IN` 为可配置事件。

## 主要改动

1. 定义 App 端接口：
   - `GET /check-in/summary`
   - `GET /check-in/calendar`
   - `GET /check-in/records`
   - `POST /check-in/sign`
   - `POST /check-in/makeup`
2. 定义 App 端返回字段：
   - 当前有效计划；
   - 当前周期日期范围；
   - 已签天数；
   - 剩余补签次数；
   - 当前连续天数；
   - 下一档连续奖励；
   - 最近签到记录与奖励状态。
3. 定义 Admin 端接口：
   - 计划列表、计划详情、创建、更新、发布、停用；
   - 连续奖励规则查看；
   - 对账查询与补偿入口。
4. 定义 Admin 端计划详情字段：
   - `baseRewardConfig`；
   - 周期规则；
   - 每周期补签次数；
   - 连续奖励规则；
   - 计划启停与发布时间窗；
   - 最近账本与补偿结果摘要。
5. 明确错误语义：
   - 今天已签到；
   - 补签日期非法；
   - 已超过补签上限；
   - 当前无有效签到计划；
   - 奖励待补偿但签到已成功。

## 完成标准

1. App 端可稳定完成签到、补签、日历查询和签到记录查询。
2. Admin 端可管理签到计划并查看基础奖励、连续奖励与周期配置。
3. 接口返回结构不依赖 task，也不依赖现存 `DAILY_CHECK_IN` 规则配置。
4. 错误语义与读模型字段可支持前端页面直接渲染，无需自行猜测业务状态。

## 完成后同步文档

1. [README.md](/D:/code/es/es-server/docs/task-check-in-work-items/README.md)
2. [development-plan.md](/D:/code/es/es-server/docs/task-check-in-work-items/development-plan.md)
3. [p2/01-check-in-reconciliation-runtime-and-acceptance.md](/D:/code/es/es-server/docs/task-check-in-work-items/p2/01-check-in-reconciliation-runtime-and-acceptance.md)
4. [final-acceptance-checklist.md](/D:/code/es/es-server/docs/task-check-in-work-items/checklists/final-acceptance-checklist.md)

## 排期引用

- 优先级：`S1`
- 波次：`Wave 2`
- 状态：`pending`
- 硬前置：`P0-02`、`P0-03`
- 直接后置：`P2-01`
- 以 [execution-plan.md](/D:/code/es/es-server/docs/task-check-in-work-items/execution-plan.md) 为唯一事实源
