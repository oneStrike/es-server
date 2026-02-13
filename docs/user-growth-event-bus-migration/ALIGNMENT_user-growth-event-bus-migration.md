# 用户成长事件总线迁移方案（NestJS 官方事件库）

## 1. 原始需求
- 将当前本地事件总线实现替换为 NestJS 官方事件库
- 生成迁移方案文档供评审，同事重点排查潜在不合理点
- 评审确认后再实施代码变更

## 2. 现状与上下文
- 当前事件总线实现：LocalUserGrowthEventBus 基于 node:events 的 EventEmitter
- 发布入口：UserGrowthEventService.handleEvent
- 消费入口：UserGrowthEventConsumer 在 onModuleInit 订阅事件
- 使用范围：用户成长事件业务，主要由 forum/content 等模块调用

## 3. 目标与非目标
### 目标
- 使用 NestJS 官方事件库完成同等能力替换
- 保持现有事件发布/消费的业务语义与调用方式一致或平滑迁移
- 保持模块边界清晰，可继续替换为分布式消息系统

### 非目标
- 本次不引入分布式消息队列或跨进程事件传递
- 不调整事件处理业务逻辑与审计规则

## 4. 当前实现的潜在不合理点（供排查）
- 可靠性不足：发布即触发，无持久化与重试机制，进程异常可能导致事件丢失
- 异常吞没：消费者中捕获异常后未记录，排障困难
- 监听泄漏风险：订阅未统一管理时存在监听叠加风险（目前在 onModuleDestroy 中退订，但需保持一致）
- 可观测性不足：缺少统一日志/指标/链路追踪支持

## 5. 方案选型
### 方案 A：NestJS 官方事件库（推荐）
- 使用 @nestjs/event-emitter（基于 eventemitter2）
- 模块级注册 EventEmitterModule
- 发布端使用 EventEmitter2.emit
- 消费端使用 @OnEvent 装饰器或显式监听

### 方案 B：保留现有实现
- 不满足“使用官方库”的目标，排除

## 6. 迁移方案（方案 A 详细）
### 6.1 依赖变更
- 新增依赖：@nestjs/event-emitter
- 需要确认版本与当前 @nestjs/* 主版本兼容（现为 11.x）

### 6.2 架构与代码变更
1. 在基础模块或 UserGrowthEventModule 中引入 EventEmitterModule
2. 增加官方事件发布实现：
   - 用 EventEmitter2 实现 UserGrowthEventBus（保持现有接口，避免业务侧改动）
3. 消费端改造：
   - 将 UserGrowthEventConsumer 订阅改为 @OnEvent('user-growth-event') 触发
   - 保持 onModuleInit/onModuleDestroy 行为可移除或保留用于其他清理逻辑
4. 删除 LocalUserGrowthEventBus 或标记为已弃用并移除注入映射

### 6.3 对外行为保持
- 事件名保持 user-growth-event
- 事件 payload 保持 UserGrowthEventDto
- 业务侧调用仍走 UserGrowthEventService.handleEvent

## 7. 风险与缓解
- 依赖新增导致包体变动：仅新增官方库，风险可控
- 事件监听执行顺序差异：EventEmitter2 默认按监听注册顺序执行，需在测试中验证
- 同步/异步处理差异：需要保证消费端的异步异常处理不被吞没（建议新增日志）

## 8. 验收标准
- 业务侧发布调用不变，事件可被正常消费
- 成长事件审计记录与规则处理结果与当前一致
- 事件消费异常可被明确观测（日志或监控）
- 无新增 TypeScript/编译错误

## 9. 影响范围清单（初步）
- libs/user/src/growth-event/growth-event.bus.ts
- libs/user/src/growth-event/growth-event.consumer.ts
- libs/user/src/growth-event/growth-event.module.ts
- libs/user/src/growth-event/growth-event.service.ts
- package.json（新增依赖）

## 10. 实施步骤（确认后执行）
1. 添加 @nestjs/event-emitter 依赖
2. 模块引入 EventEmitterModule
3. 实现基于 EventEmitter2 的事件总线适配
4. 消费端切换为 @OnEvent
5. 运行 lint / type-check / test

