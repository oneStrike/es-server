# P0-02 管理端举报处理模块

## 目标

补齐管理端举报分页、详情、处理入口，让举报真正进入运营流程。

## 范围

- 新增管理端举报模块
- 提供分页、详情、处理接口
- 补处理 DTO 和状态流转约束

## 主要改动

- `apps/admin-api` 注册举报模块
- `libs/interaction` 增加管理端查询与处理能力
- 只允许 `PENDING / PROCESSING -> RESOLVED / REJECTED`

## 完成标准

- 运营能在后台处理举报
- `handlerId / handledAt / handlingNote / status` 能完整落库
- 已处理举报不能被错误回滚到待处理态

## 执行信息

- 优先级：`S0`
- 硬前置：无
- 软前置：`P0-01`
- 直接后置：`P0-03`
- 可并行：`P0-04`、`P0-05`
