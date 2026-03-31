# P2-02 任务模板 / 发布 / campaign 拆分

## 1. 目标

在前几波已经验证“任务目标模型、事件驱动推进、读模型口径”稳定之后，评估并落地 `task` 单表的结构性拆分，解决同一任务模板复用发布、活动归属、多次上线等中长期扩展问题。

## 2. 范围

本任务覆盖以下结构与模块：

- 现有任务单表：
  - `db/schema/app/task.ts`
- 任务 assignment 与快照：
  - `db/schema/app/task-assignment.ts`
- 任务服务与 Admin 管理接口：
  - `libs/growth/src/task/task.service.ts`
  - `apps/admin-api/src/modules/task/task.controller.ts`
- 若落地 campaign 模型，需覆盖对应 schema、service、DTO、文档。

## 3. 当前代码锚点

- 当前 `task` 单表同时承载：
  - 模板展示信息
  - 发布状态与时间窗
  - 目标模型
  - 奖励配置
  - 运营来源语义
- 这在快速开发阶段成本低，但一旦出现“同模板多次发布”“同活动下多任务编组”“活动复盘需要保留发布实例”时会迅速变重；
- assignment 当前通过快照规避了一部分 live config 风险，但无法替代结构分层。

## 4. 非目标

- 本任务不是 P0/P1 的前置条件；
- 不在任务目标模型未稳定前抢先拆表；
- 不做复杂 campaign 权益结算；
- 不引入多租户/多品牌发布中心；
- 不在本任务中重做消息系统。

## 5. 主要改动

### 5.1 拆分三层结构

建议的目标模型：

- `task_template`
  - 稳定展示字段
  - 场景类型
  - 目标模型
  - 默认奖励策略
- `task_publish`
  - 实际发布窗口
  - enable/status
  - 领取方式/完成方式
  - 人群范围
  - 是否自动提醒
- `campaign`
  - 运营活动归属
  - 活动时间范围
  - 活动级说明与展示资源

### 5.2 明确 assignment 绑定对象

assignment 应明确绑定 `publishId`，并快照模板 + 发布关键字段，避免：

- 模板修改影响历史发布；
- 发布修改影响存量 assignment；
- 同模板多次发布时 assignment 无法区分来源。

### 5.3 调整后台配置流程

后台配置流程建议调整为：

1. 维护任务模板
2. 选择模板创建发布实例
3. 选择是否归属某个 campaign
4. 查看发布实例的 assignment、奖励、通知运行情况

### 5.4 设计迁移与兼容策略

迁移建议分两步：

1. 从现有 `task` 单表回填一份 `template + publish` 数据；
2. 兼容期保留单表读取 facade，对外接口先不大改；
3. 待 App/Admin 稳定后再切掉旧字段直读。

### 5.5 约束开工条件

本任务只能在以下条件满足后开工：

- `P1-02` 已证明事件驱动任务推进有效；
- `P1-03` 已证明当前读模型语义稳定；
- 团队确认单表已经成为真实瓶颈，而不是“为了架构整洁提前透支复杂度”。

## 6. 完成标准

- 已形成明确的模板/发布/campaign 三层数据模型；
- assignment 对发布实例的绑定关系清晰；
- 有可执行的数据迁移与兼容策略；
- Admin 配置流程与读模型说明已更新；
- 至少具备：
  - schema 迁移方案；
  - 旧数据回填脚本方案；
  - 双读/单读切换方案；
  - 核心回归测试列表。

## 7. 完成后同步文档

- `docs/task-growth-notification-rearchitecture-work-items/README.md`
- `docs/task-growth-notification-rearchitecture-work-items/development-plan.md`
- Admin 任务配置流程文档
- 数据迁移执行说明

## 8. 排期引用

- 优先级与依赖以 `docs/task-growth-notification-rearchitecture-work-items/execution-plan.md` 为准；
- 本任务对应排期项：`P2-02`；
- 直接前置：`P1-02`、`P1-03`；
- 是否开工以排期文档中的后置原则为准。
