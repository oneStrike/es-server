 # 用户成长体系排查与优化建议

 ## 范围

 - 成长事件总线、消费、审计、反作弊
 - 积分、经验、等级、徽章子域
 - 成长概览与管理端接口

 ## 现状概览

 - 事件入口由 UserGrowthEventService 发布到本地事件总线并触发消费
 - 消费端负责幂等、审计、反作弊、规则匹配与发放
 - 积分/经验/徽章记录与用户状态更新在同一事务内完成
 - 经验变化后触发等级重算
 - 管理端提供事件审计与概览接口

 ## 已识别优化点（来自增长事件消费者）

 - 异常日志与上下文缺失，排障成本较高
 - 规则计数与冷却校验存在多次逐条查询，规则多时为 N+1 查询
 - 冷却判断可复用批量查询结果，减少数据库往返
 - 等级规则查询可缓存或按区间优化
 - 事务内只读逻辑可前置以降低锁持有时间

 ## 全局排查补充优化点

 ### 反作弊

 - 同一事件会按 user/ip/device 维度分别执行冷却、日限、总限查询，查询次数较多
 - 可考虑将冷却判断与计数聚合为一次或少量查询，并按维度复用结果
 - 反作弊配置加载每次都查 systemConfig，可引入缓存或配置版本号以减少读取压力

 ### 幂等与审计

 - 幂等判定按窗口查重，建议检查索引覆盖 business/eventKey/userId/targetId/occurredAt
 - 审计归档任务按时间批量查询并删除，建议使用游标或主键范围避免全表扫描
 - 审计更新仅记录状态与结果，失败原因缺少结构化字段，排障依赖外部日志

 ### 规则与发放

 - 积分/经验/徽章规则匹配直接访问模型而未复用子域服务，规则变更逻辑存在重复维护风险
 - 规则命中后逐条写入记录与更新用户，且每条规则都独立查询次数限制，可用批量查询与内存过滤降低成本
 - 多事件并发处理同一用户可能出现并发写入争用，建议评估行级锁或乐观锁策略

 ### 等级计算

 - 等级规则每次通过 findFirst 计算最高可达等级，可考虑缓存等级阈值或改为区间查询优化
 - 经验服务与成长事件消费者均有等级重算逻辑，建议统一入口以避免规则漂移

 ### 概览与管理端

 - 概览接口聚合多子域数据，后续可引入缓存或分段查询以应对高并发
 - 事件审计分页查询对复杂条件组合依赖索引覆盖，建议复核排序与过滤字段的索引策略

 ## 涉及主要文件

 - libs/user/src/growth-event/growth-event.service.ts
 - libs/user/src/growth-event/growth-event.bus.ts
 - libs/user/src/growth-event/growth-event.consumer.ts
 - libs/user/src/growth-event/growth-event.audit.service.ts
 - libs/user/src/growth-event/growth-event.audit-cron.service.ts
 - libs/user/src/growth-event/growth-event.antifraud.service.ts
 - libs/user/src/point/point.service.ts
 - libs/user/src/experience/experience.service.ts
 - libs/user/src/level-rule/level-rule.service.ts
 - libs/user/src/badge/user-badge.service.ts
 - apps/admin-api/src/modules/user-growth/*
 - apps/app-api/src/modules/user/*
