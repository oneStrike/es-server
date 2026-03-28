# P1-04 账本 DTO 解释力增强

## 目标

让 App 和管理端都能直接看到账本来源，而不是只剩 `remark`。

## 范围

- App 端 point / experience DTO 增补来源字段
- 管理端 point / experience DTO 增补来源字段
- `context` 做白名单裁剪

## 当前代码锚点

- `libs/growth/src/point/dto/point-record.dto.ts`
- `libs/growth/src/experience/dto/experience-record.dto.ts`
- `apps/app-api/src/modules/user/dto/user-point.dto.ts`
- `apps/app-api/src/modules/user/dto/user.dto.ts`
- `apps/admin-api/src/modules/app-user/dto/app-user.dto.ts`

## 非目标

- 不暴露未经筛选的内部 `context`
- 不改账本表结构，也不重写账本查询模型
- 不要求前端自己解析任意业务 payload 来还原来源

## 主要改动

- 不只改基础 DTO，App / 管理端实际对外响应 DTO 也要同步补字段
- 增加 `ruleType`
- 增加 `bizKey`
- 增加必要的 `targetType / targetId / context`
- 可选增加 `sourceLabel`
- `context` 仅按白名单暴露必要解释字段，避免把内部调试信息直接透出

## 完成标准

- 用户和运营都能直接判断一条账本来源
- 前端不必只靠 remark 猜测业务来源
- App 与管理端返回字段口径一致
- 不会因为增强解释力把敏感或无意义的内部上下文直接暴露出去

## 完成后同步文档

- [领域设计总览](../../task-growth-reward-domain-design.md)
- [开发排期版](../development-plan.md)
- [P1-05 混合成长账本分页接口](./05-mixed-growth-ledger-page.md)

## 排期引用

- 本任务的优先级、依赖关系、并行策略统一以 [执行计划](../execution-plan.md) 为准
- 若本页与其他文档出现排期描述不一致，以 `execution-plan.md` 为准
