 # DESIGN_user-growth-optimization

 ## 架构概览

 ```mermaid
 graph TD
   A[业务域事件] --> B[UserGrowthEventService]
   B --> C[事件总线]
   C --> D[GrowthEventConsumer]
   D --> E[AntiFraud]
   D --> F[EventAudit]
   D --> G[RuleMatch & Apply]
   G --> H[Point/Experience/Badge/Level]
   F --> I[Admin Event API]
   H --> J[Overview API]
 ```

 ## 分层与核心组件

 - 事件层：事件发布、消费、审计状态回写
 - 风控层：反作弊策略与配置解析
 - 规则层：规则读取、冷却/上限校验、发放
 - 账户层：用户积分/经验/等级更新
 - 展示层：成长概览与审计查询

 ## 模块依赖关系

 - GrowthEventConsumer 依赖 AntiFraud + Audit + 规则模型
 - AntiFraud 依赖 systemConfig 与 userGrowthEvent
 - Audit 依赖 userGrowthEvent 与归档表
 - Overview 依赖 LevelRule 与 Badge

 ## 接口契约与优化点

 - 反作弊：
   - 输入：event + 规则最大增量 + cooldown
   - 输出：allow + reason
   - 优化：统一计数查询、缓存配置
 - 审计：
   - 输入：event + status + 发放结果
   - 输出：事件记录
   - 优化：索引覆盖、归档游标、失败原因字段
 - 规则发放：
   - 输入：rules + event + eventId
   - 输出：apply result
   - 优化：批量查询与内存过滤，减少 N+1

 ## 数据流向

 1. 业务侧发布成长事件
 2. 消费端先做幂等与审计
 3. 反作弊判断
 4. 规则匹配与发放
 5. 回写审计结果

 ## 异常处理策略

 - 业务侧不感知消费失败
 - 审计记录失败状态与原因
 - 反作弊拒绝不触发发放
