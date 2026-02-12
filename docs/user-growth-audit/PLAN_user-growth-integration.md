# 漫画与论坛成长系统接入改造方案（待确认）

## 1. 目标与验收标准

### 1.1 目标
- 漫画与论坛所有成长相关行为统一通过成长事件链路上报并被正确消费
- 成长规则（积分/经验/等级/徽章/奖励）在各业务场景一致生效
- 成长奖励在前端可实时展示、刷新、领取，且不丢失
- 等级/徽章/特权等关键事件触达站内信、Push、弹窗、红点并可正确跳转
- 异常场景具备幂等、重试与补偿，确保数据一致
- 运营配置变更 5 分钟内在漫画与论坛生效

### 1.2 验收标准
- 业务域无直接调用积分/经验/徽章服务的遗留逻辑
- 所有成长事件有审计记录，可追踪状态与规则命中
- 规则计算结果可通过审计记录与业务数据对账一致
- 事件消费失败具备重试与补偿路径
- 前端奖励与通知完整覆盖并可验证链路

## 2. 当前缺口摘要
- 论坛域发帖仍直接加积分，其他行为未通过成长事件上报
- 成长事件仅发布，无订阅、无审计、无规则分发
- app-api 缺少成长奖励展示/领取与成长通知入口
- 事件补偿、幂等、防刷、热更新未落地

## 3. 总体技术方案

### 3.1 统一事件入口
- 业务域调用 UserGrowthEventService.handleEvent
- 事件结构统一为 UserGrowthEventDto（business/eventKey/userId/targetId/ip/deviceId/occurredAt/context）
- 事件键采用 domain.resource.action 风格

### 3.2 成长事件消费链路
- 建立 GrowthEventConsumer 订阅 LocalUserGrowthEventBus
- 事件处理流程：
  1. 防刷校验
  2. 幂等检查与审计写入
  3. 规则匹配（business + eventKey）
  4. 积分/经验/徽章/等级处理
  5. 结果回写审计与事件摘要
  6. 通知与奖励投递

### 3.3 审计与幂等
- 使用 user_growth_event 审计表
- 基于 business + eventKey + userId + targetId + occurredAt 窗口做幂等判定
- 审计状态：PROCESSED / REJECTED_ANTIFRAUD / IGNORED_RULE_NOT_FOUND / FAILED

### 3.4 防刷策略
- 用户/设备/IP 维度冷却与上限
- 规则配置由运营管理端维护
- 命中防刷时记录审计，不阻断业务流程

### 3.5 奖励与通知
- 奖励包括经验、积分、徽章、特权
- 新增成长奖励领取与展示 API
- 事件触发站内信、Push、弹窗、红点

### 3.6 热更新
- 规则缓存按业务域维度缓存
- 运营端配置变更触发缓存失效或主动刷新
- 5 分钟内生效以缓存 TTL 与强制刷新保证

## 4. 事件清单与规则映射

### 4.1 漫画事件
- comic.work.view
- comic.work.like
- comic.work.favorite
- comic.chapter.read
- comic.chapter.like
- comic.chapter.purchase
- comic.chapter.download

### 4.2 论坛事件
- forum.topic.create
- forum.reply.create
- forum.topic.like
- forum.reply.like
- forum.topic.favorite
- forum.topic.view
- forum.report.create
- forum.share
- forum.checkin
- forum.task.complete

### 4.3 规则匹配原则
- 规则表保留既有结构，补齐 business 与 eventKey
- 规则优先级按业务域 + eventKey 精确匹配

## 5. 代码改造范围

### 5.1 论坛域改造
- forum-topic.service：发帖成功后改为发布成长事件
- forum-reply.service：回帖成功后发布成长事件
- forum-topic-like.service：点赞发布成长事件
- forum-reply-like.service：回复点赞发布成长事件
- forum-topic-favorite.service：收藏发布成长事件
- forum-view.service：浏览发布成长事件
- forum-report.service：举报发布成长事件
- 新增分享/签到/任务模块，以及相对应的事件

### 5.2 漫画域改造
- 事件已发布，补充 context、审计字段与统一 key 校验
- 确认漫画阅读/收藏/点赞/购买/下载均触发成长事件

### 5.3 成长域改造
- 新增 GrowthEventConsumer 订阅事件总线
- 新增审计服务与 antifraud 服务
- 更新积分/经验/徽章/等级子域支持 business + eventKey 规则匹配
- 增加规则命中、冷却、上限、总上限支持

### 5.4 app-api 接口
- 新增成长信息聚合接口（积分/经验/等级/徽章）
- 新增奖励领取与徽章列表接口
- 新增成长事件通知与红点状态接口

### 5.5 admin-api 接口
- user-growth/events：审计查询
- user-growth/overview：用户成长概览
- 规则变更触发缓存失效

## 6. 数据与一致性策略

### 6.1 幂等策略
- 事件唯一键：business + eventKey + userId + targetId + occurredAt(分钟级)
- 重复事件直接返回已处理状态

### 6.2 补偿策略
- 失败事件进入待补偿队列
- 定时任务重试失败事件，按次数熔断

### 6.3 并发策略
- 事件写入与规则执行在单事务或可控事务中完成
- 对用户级别的积分/经验更新加行级锁或序列化更新

## 7. 通知与前端展示

### 7.1 触发场景
- 等级提升
- 徽章获得/撤销
- 特权解锁
- 重要成长奖励发放

### 7.2 通知通道
- 站内信
- Push
- 弹窗
- 红点

### 7.3 展示刷新
- 领奖后刷新用户成长聚合接口
- 关键变更支持前端轮询或订阅刷新

## 8. 热更新方案
- 规则缓存 TTL 设为 300 秒
- 管理端更新后写入版本号，业务端读取时比对版本并刷新

## 9. 验证与对账方案

### 9.1 功能验证
- 触发每类事件后检查 user_growth_event 状态与积分/经验变更
- 验证防刷命中时不产生积分/经验变更

### 9.2 数据对账
- 按 eventKey 维度抽样对比规则输出与用户积分/经验变动
- 对比成长审计表与积分/经验记录一致性

## 10. 交付清单
- 事件消费与审计链路
- 论坛与漫画事件全覆盖
- 成长奖励展示/领取 API
- 通知与红点触发
- 防刷与补偿机制
- 热更新缓存策略

## 11. 风险与缓解
- 规则配置不全导致事件被忽略：提供审计告警
- 并发更新导致积分/经验错乱：采用事务与行级锁
- 事件积压导致通知延迟：提供队列与重试监控

## 12. 详细改动文件清单

### 12.1 论坛域（事件上报与依赖注入）
- libs/forum/src/topic/forum-topic.service.ts：替换直接积分调用为成长事件发布
- libs/forum/src/reply/forum-reply.service.ts：回帖完成后发布成长事件
- libs/forum/src/topic-like/forum-topic-like.service.ts：点赞后发布成长事件
- libs/forum/src/reply-like/forum-reply-like.service.ts：回复点赞后发布成长事件
- libs/forum/src/topic-favorite/forum-topic-favorite.service.ts：收藏后发布成长事件
- libs/forum/src/view/forum-view.service.ts：浏览记录后发布成长事件
- libs/forum/src/report/forum-report.service.ts：举报创建后发布成长事件
- libs/forum/src/forum.module.ts：引入成长事件模块与相关依赖

### 12.2 漫画域（事件完善与对齐）
- libs/content/src/comic/core/comic.service.ts：补充 context 与统一事件键校验
- libs/content/src/comic/chapter/comic-chapter.service.ts：补充 context 与统一事件键校验
- libs/content/src/comic/core/comic.constant.ts：必要时补齐事件键常量
- libs/content/src/comic/chapter/comic-chapter.constant.ts：必要时补齐事件键常量

### 12.3 成长事件域（消费、审计、防刷、补偿）
- libs/user/src/growth-event/growth-event.module.ts：注册消费者与新服务
- libs/user/src/growth-event/growth-event.bus.ts：保持接口不变，扩展订阅链路
- libs/user/src/growth-event/growth-event.service.ts：保持事件入口一致
- libs/user/src/growth-event/growth-event.constant.ts：新增事件状态与通用常量
- libs/user/src/growth-event/dto/growth-event.dto.ts：扩展上下文字段与复用 DTO
- libs/user/src/growth-event/growth-event.consumer.ts：新增事件消费逻辑
- libs/user/src/growth-event/growth-event-audit.service.ts：新增审计与幂等服务
- libs/user/src/growth-event/growth-event-antifraud.service.ts：新增防刷策略服务
- libs/user/src/growth-event/growth-event.types.ts：新增统一的内部类型定义

### 12.4 成长规则与奖励
- libs/user/src/point/point.service.ts：支持 business + eventKey 规则匹配
- libs/user/src/experience/experience.service.ts：支持 business + eventKey 规则匹配
- libs/user/src/level-rule/level-rule.service.ts：对等级规则命中提供统一入口
- libs/user/src/badge/user-badge.service.ts：支持成长事件驱动的徽章授予
- libs/user/src/point/point.constant.ts：扩展规则常量，复用枚举与键名
- libs/user/src/experience/experience.constant.ts：扩展规则常量，复用枚举与键名
- libs/user/src/level-rule/level-rule.constant.ts：复用权限常量与名称

### 12.5 app-api（成长展示、奖励领取、通知）
- apps/app-api/src/modules/user/user.controller.ts：补充成长聚合信息展示
- apps/app-api/src/modules/user/user.service.ts：聚合成长信息（积分/经验/等级/徽章）
- apps/app-api/src/modules/app.module.ts：引入成长相关模块
- apps/app-api/src/modules/user-growth/user-growth.controller.ts：新增成长信息/奖励/通知接口
- apps/app-api/src/modules/user-growth/user-growth.module.ts：新增模块聚合
- apps/app-api/src/modules/user-growth/dto/user-growth.dto.ts：新增 DTO（可复用）

### 12.6 admin-api（审计与配置热更新）
- apps/admin-api/src/modules/user-growth/user-growth.module.ts：引入事件审计模块
- apps/admin-api/src/modules/user-growth/event/event.controller.ts：新增审计查询与重放接口
- apps/admin-api/src/modules/user-growth/event/event.module.ts：新增模块
- apps/admin-api/src/modules/user-growth/dto/event.dto.ts：新增 DTO（可复用）

### 12.7 数据模型与迁移
- prisma/schema.prisma：新增 user_growth_event 审计表与索引
- prisma/migrations/*：新增数据库迁移

## 13. 任务清单（含规范要求）

### 13.1 规则与规范约束（必须满足）
- 改动代码必须符合项目现有结构、依赖注入与模块组织规范
- 注释必须明确、语义一致，避免歧义与冗余
- DTO 与 constant 必须高复用，避免重复定义与命名冲突
- 复用已有工具类与公共类型，避免引入未使用依赖

### 13.2 任务拆解
- 论坛域行为事件化改造并清理直接积分调用
- 成长事件消费链路（审计、幂等、防刷、补偿）实现
- 成长规则匹配与发放（积分/经验/徽章/等级）改造
- app-api 成长展示/奖励领取/通知接口补齐
- admin-api 成长事件审计与热更新入口补齐
- 数据模型与迁移落地并完成对账验证
