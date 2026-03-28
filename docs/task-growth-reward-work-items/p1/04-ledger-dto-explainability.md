# P1-04 账本 DTO 解释力增强

## 目标

让 App 和管理端都能直接看到账本来源，而不是只剩 `remark`。

## 范围

- App 端 point / experience DTO 增补来源字段
- 管理端 point / experience DTO 增补来源字段
- `context` 做白名单裁剪

## 主要改动

- 增加 `ruleType`
- 增加 `bizKey`
- 增加必要的 `targetType / targetId / context`
- 可选增加 `sourceLabel`

## 完成标准

- 用户和运营都能直接判断一条账本来源
- 前端不必只靠 remark 猜测业务来源

## 执行信息

- 优先级：`S1`
- 硬前置：无
- 软前置：`P0-01`、`P1-01`
- 直接后置：`P1-05`、`P2-A-03`
- 可并行：`P1-01`、`P1-03`
