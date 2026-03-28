# P0 本地改进方案任务清单

## 1. 文档目标

P0 只解决“现有业务口径错误”和“已经影响正确性/审计性”的问题，不做大规模抽象重构。

本阶段目标是把下面三条主链路先拉齐：

1. 审核通过后的发帖奖励闭环
2. 举报处理后的奖励闭环
3. 管理端人工补发的幂等闭环

P0 完成后，系统至少要满足两个基本要求：

- 同一个真实业务动作不会因为重试、审核流转、重复点击而重复发奖
- 奖励发放时机和治理结果一致，不再出现“治理还没定性，奖励已经发了”的错误口径

## 2. 范围边界

### 2.1 本阶段纳入范围

- 主题审核通过后的 `CREATE_TOPIC` 奖励补发
- 举报管理端处理闭环
- 举报奖励从“提交即发”切到“裁决后发”
  - 后台人工加积分、扣积分、加经验的稳定幂等键
- 对应的接口、service、账本写入、测试、文档更新

### 2.2 本阶段不纳入范围

- 统一事件中心
- 统一通知模板/偏好/多渠道编排
- 任务奖励结算表
- 统一混合账本接口
- 评论审核后台
- 聊天 outbox 域闭环

这些内容放到 P1/P2。

## 3. 当前问题与代码证据

### 3.1 主题奖励时机不一致

当前发帖成功后，只有主题不是待审核状态时才会立即发 `CREATE_TOPIC` 奖励：

- `libs/forum/src/topic/forum-topic.service.ts`

但管理端审核通过接口只是改审核状态，没有补发逻辑：

- `apps/admin-api/src/modules/forum/topic/topic.controller.ts`
- `libs/forum/src/topic/forum-topic.service.ts`

这会导致：

- 敏感词命中进入待审核的主题，后续审核通过后拿不到发帖奖励
- 同一条主题是否有奖励，取决于创建时是否直接通过审核，而不是最终治理结论

### 3.2 举报奖励时机错误

当前举报创建后会立刻发积分/经验：

- `libs/interaction/src/report/report.service.ts`
- `libs/interaction/src/report/report-growth.service.ts`

但举报表本身已经有完整的处理字段：

- `db/schema/app/user-report.ts`

同时，成长规则枚举里已经存在：

- `REPORT_VALID`
- `REPORT_INVALID`

对应文件：

- `libs/growth/src/growth-rule.constant.ts`

这说明当前问题不是“缺字段”，而是“业务时机接错了”。

### 3.3 举报缺少管理端处理入口

当前只有 App 端举报创建、我的举报、详情：

- `apps/app-api/src/modules/report/report.controller.ts`

仓内没有管理端举报处理 controller，导致：

- `user_report.handlerId/status/handledAt/handlingNote` 没有真正进入运营流程
- 奖励也无法根据“有效/无效”裁决结果结算

### 3.4 管理端人工补发幂等性不足

当前后台人工加积分、扣积分、加经验都走账本，但 `bizKey` 是按 `Date.now()` 动态生成：

- `apps/admin-api/src/modules/app-user/app-user.service.ts`

直接后果：

- 管理员重复点击或请求重试会生成新的业务键
- 账本层的幂等唯一约束失去意义
- 审计时只能看“发生过几次”，不能稳定判断“是不是同一操作重试”

## 4. P0 目标状态

P0 完成后，预期口径如下：

### 4.1 发帖奖励口径

- 主题创建且直接审核通过：立即发 `CREATE_TOPIC`
- 主题创建后进入待审核：不发奖
- 待审核主题后续首次转为 `APPROVED`：补发一次 `CREATE_TOPIC`
- 之后再改审核状态，不再重复发奖

### 4.2 举报奖励口径

- 创建举报：只建单，不发奖
- 举报被裁决为有效：触发 `REPORT_VALID`
- 举报被裁决为无效：可触发 `REPORT_INVALID`
- 是否给无效举报扣分或不给分，由规则配置决定，但业务链路要先打通

### 4.3 管理端人工补发口径

- 每次人工补发/扣减都必须带稳定 `operationKey`
- 同一 `operationKey` 重试不重复落账
- 日志、账本、运营记录能串起同一操作

## 5. 推荐实施顺序

1. 先冻结业务口径
2. 再做举报处理闭环
3. 再做主题审核补发
4. 最后补人工补发幂等和回归测试

原因：

- 举报链路当前错误最明显，且已有字段最多
- 发帖审核补发改动较小，但依赖口径先确认
- 人工补发幂等改动会涉及管理端 DTO/调用约定，适合放在最后一起联调

## 6. 详细任务清单

### 6.1 业务口径冻结任务

- [ ] 在现有领域文档中写死 P0 口径
- [ ] 明确 `CREATE_TOPIC` 的结算时机为“最终通过”
- [ ] 明确举报奖励从“提交时结算”切为“裁决后结算”
- [ ] 明确 `REPORT_VALID/REPORT_INVALID` 是 P0 的标准规则类型
- [ ] 明确 `TOPIC_REPORT/COMMENT_REPORT/...` 这批 `*_REPORT` 规则在 P0 后视为“历史兼容/待废弃”
- [ ] 明确人工补发接口需要稳定 `operationKey`

建议同步更新文件：

- `task-growth-reward-domain-design.md`
- 新增的 P0/P1/P2 任务文档

### 6.2 举报管理端处理闭环

#### 6.2.1 管理端入口

- [ ] 新增管理端举报模块，推荐目录：`apps/admin-api/src/modules/report`
- [ ] 在 `admin.module.ts` 中注册举报模块
- [ ] 新增举报分页接口
- [ ] 新增举报详情接口
- [ ] 新增举报处理接口

推荐接口：

- `GET /admin/report/page`
- `GET /admin/report/detail`
- `POST /admin/report/process`

#### 6.2.2 DTO 设计

- [ ] 新增管理端举报查询 DTO
- [ ] 支持按 `status/targetType/reporterId/handlerId/dateRange` 筛选
- [ ] 新增举报处理 DTO，至少包含：
  - `id`
  - `status`
  - `handlingNote`
- [ ] 约束处理后的状态只允许进入 `RESOLVED` 或 `REJECTED`
- [ ] 禁止无意义回写，例如已处理记录再次被改成 `PENDING`

#### 6.2.3 Service 改造

- [ ] 在 `libs/interaction/src/report/report.service.ts` 增加管理端分页能力
- [ ] 增加管理端详情能力
- [ ] 增加处理方法，例如 `processReport(adminUserId, dto)`
- [ ] 处理时写入：
  - `handlerId`
  - `status`
  - `handlingNote`
  - `handledAt`
- [ ] 增加状态流转校验
- [ ] 明确只允许 `PENDING/PROCESSING -> RESOLVED/REJECTED`

#### 6.2.4 奖励改造

- [ ] 删除或停用 `createReport()` 末尾的即时发奖调用
- [ ] 新增“处理后发奖”逻辑
- [ ] 当状态变为 `RESOLVED` 时调用 `REPORT_VALID`
- [ ] 当状态变为 `REJECTED` 时调用 `REPORT_INVALID`
- [ ] 使用稳定业务键，推荐格式：
  - `report:handle:{reportId}:status:RESOLVED:POINTS`
  - `report:handle:{reportId}:status:RESOLVED:EXPERIENCE`
  - `report:handle:{reportId}:status:REJECTED:POINTS`
  - `report:handle:{reportId}:status:REJECTED:EXPERIENCE`
- [ ] 保证重复处理请求不会重复发奖

#### 6.2.5 规则与数据兼容

- [ ] 检查 `user_point_rule` / `user_experience_rule` 中是否已配置 `REPORT_VALID/REPORT_INVALID`
- [ ] 若未配置，补 seed 或运营初始化说明
- [ ] 标记原有 `*_REPORT` 规则为历史规则，不再作为举报奖励主链路
- [ ] 在运营文档中说明变更口径，避免继续配置旧规则

涉及文件：

- `apps/admin-api/src/modules/admin.module.ts`
- `apps/admin-api/src/modules/report/*`
- `libs/interaction/src/report/report.service.ts`
- `libs/interaction/src/report/report-growth.service.ts`
- `libs/interaction/src/report/report.type.ts`
- `libs/interaction/src/report/dto/report.dto.ts`

### 6.3 主题审核通过补发奖励

#### 6.3.1 审核流转识别

- [ ] 在 `updateTopicAuditStatus` 流程里拿到变更前审核状态
- [ ] 只在 `before=PENDING` 且 `after=APPROVED` 时触发补发检查
- [ ] `REJECTED -> APPROVED` 是否补发需要产品口径确认
  - 推荐 P0 先允许首次 `APPROVED` 即补发

#### 6.3.2 奖励触发

- [ ] 复用创建主题时已有的 `CREATE_TOPIC` 奖励逻辑
- [ ] 复用相同业务键格式：
  - `forum:topic:create:{topicId}:user:{userId}`
- [ ] 若主题创建时已经发过奖，补发路径应被账本幂等拦住
- [ ] 审核通过补发失败时写 warning log，不影响审核状态提交

#### 6.3.3 回归约束

- [ ] 直接审核通过的创建路径保持现状
- [ ] 审核通过补发只触发一次
- [ ] 重复提交 `update-audit-status` 不重复发奖
- [ ] 主题被拒绝时不发奖

涉及文件：

- `apps/admin-api/src/modules/forum/topic/topic.controller.ts`
- `libs/forum/src/topic/forum-topic.service.ts`

### 6.4 管理端人工补发幂等改造

#### 6.4.1 DTO 增补

- [ ] 为人工加积分 DTO 增加 `operationKey`
- [ ] 为人工扣积分 DTO 增加 `operationKey`
- [ ] 为人工加经验 DTO 增加 `operationKey`
- [ ] 如果后续有人工发徽章，也同步纳入

推荐字段要求：

- 类型：字符串
- 长度：建议 64 或 80
- 来源：管理端 UI 在提交前生成 UUID
- 语义：一次人工操作的唯一键，不随重试变化

#### 6.4.2 BizKey 规则

- [ ] 废弃 `Date.now()` 作为业务键一部分
- [ ] 新业务键推荐格式：
  - `admin:app-user:points:add:{operationKey}`
  - `admin:app-user:points:consume:{operationKey}`
  - `admin:app-user:experience:add:{operationKey}`
- [ ] 若 `operationKey` 缺失，接口直接报错，不再静默生成非幂等键

#### 6.4.3 审计串联

- [ ] 在 remark/context/request-log 中保留 `operationKey`
- [ ] 确保账本、后台请求日志、运营侧记录可以靠 `operationKey` 串起来

涉及文件：

- `apps/admin-api/src/modules/app-user/app-user.service.ts`
- `apps/admin-api/src/modules/app-user/dto/app-user.dto.ts`
- 如有后台前端联调，再补相应提交字段

### 6.5 测试任务

#### 6.5.1 举报链路测试

- [ ] 创建举报后不再产生积分账本
- [ ] 举报被处理为 `RESOLVED` 时产生 `REPORT_VALID` 账本
- [ ] 举报被处理为 `REJECTED` 时产生 `REPORT_INVALID` 或 0 变更
- [ ] 重复处理同一举报不重复发奖
- [ ] 非法状态流转被拒绝

#### 6.5.2 主题审核补发测试

- [ ] 主题直接通过时发奖
- [ ] 主题先待审核再通过时补发一次
- [ ] 重复通过不重复发奖
- [ ] 拒绝不发奖

#### 6.5.3 人工补发幂等测试

- [ ] 同一 `operationKey` 重试仅落一条账本
- [ ] 不同 `operationKey` 可视为不同操作
- [ ] 缺失 `operationKey` 的请求被拒绝

## 7. 验收标准

### 7.1 业务验收

- 后台可以分页查看举报、查看详情、处理举报
- 举报奖励只在处理后结算
- 待审核主题在首次审核通过后能补发发帖奖励
- 后台人工补发接口具备稳定幂等能力

### 7.2 数据验收

- 同一主题不会出现两次相同 `CREATE_TOPIC` 奖励
- 同一举报不会因为重复处理产生重复奖励
- 同一人工补发操作不会因重试产生多条账本

### 7.3 审计验收

- 运营可以解释“为什么这个主题发了/没发奖励”
- 运营可以解释“为什么这个举报发了/没发奖励”
- 运营可以通过 `operationKey` 追踪一次人工补发

## 8. 风险与注意事项

### 8.1 规则迁移风险

- 现网可能已经配置了 `TOPIC_REPORT/COMMENT_REPORT/...`
- 若直接切到 `REPORT_VALID/REPORT_INVALID`，需要同步更新运营规则配置

### 8.2 历史数据风险

- P0 不建议回补历史“已审核通过但未发奖”的老主题
- 若要回补，应单独做一次性脚本，避免和主流程耦合

### 8.3 联调风险

- 人工补发幂等如果要求前端传 `operationKey`，需要管理端 UI 配合
- 若当前没有对应前端仓，先在接口层强约束并写清调用契约

## 9. 推荐拆分为本地开发任务

### 任务 A：举报管理端处理闭环

- 管理端 controller / dto
- `ReportService` 查询与处理
- 奖励时机迁移
- 测试

### 任务 B：主题审核通过补发奖励

- `updateTopicAuditStatus` 流程改造
- 幂等奖励补发
- 测试

### 任务 C：人工补发幂等化

- DTO 加 `operationKey`
- `bizKey` 规则改造
- 审计串联
- 测试

