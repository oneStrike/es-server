# libs 全模块 Prisma → Drizzle 逐文件排查报告（2026-03-17）

## 1. 目标与范围

- 目标：基于 `docs/audit` 既有文档，提炼统一迁移规范与代码规范，并对 `libs` 下所有模块做逐文件排查，输出可直接执行的收口清单。
- 范围：`libs/*` 全部 TS 文件（本次扫描共 418 个），重点覆盖 service / resolver / worker / database 入口文件。
- 判定口径：
  - **已迁移**：无 `this.prisma`、无 `extends PlatformService`，并使用 `DrizzleService` 或 Drizzle 事务类型；
  - **Prisma 残留**：存在 `this.prisma` 或 `extends PlatformService` 的运行时代码；
  - **文案/类型残留**：代码已是 Drizzle，但注释/示例/类型仍含 Prisma 表述。

---

## 2. 规范来源与统一规范

本报告依据以下文档提炼规范并复核：

- `docs/audit/drizzle-guidelines.md`
- `docs/audit/CONTENT_PRISMA_TO_DRIZZLE_逐文件迁移报告_2026-03-17.md`
- `docs/audit/FORUM_PRISMA_TO_DRIZZLE_逐文件排查_2026-03-17.md`
- `docs/audit/INTERACTION_GROWTH_Drizzle逐文件审查_2026-03-17.md`
- `docs/audit/INTERACTION_GROWTH_PRISMA_TO_DRIZZLE_EXEC_PLAN.md`
- `docs/audit/INTERACTION_GROWTH_全量模块审查报告_2026-03-17.md`
- `docs/audit/RESOLVER_优化优先级清单_2026-03-17.md`

### 2.1 迁移强制规范（Must）

1. 数据库入口统一为 `DrizzleService`：`drizzle.db` + `drizzle.schema` + `drizzle.ext`。
2. 写操作统一包裹 `drizzle.withErrorHandling(() => ...)`。
3. 更新/删除后统一调用 `drizzle.assertAffectedRows(...)` 断言命中。
4. 分页统一 `drizzle.ext.findPagination(...)`。
5. 动态条件统一 `SQL[] + and(...conditions)` 或 `drizzle.buildWhere(...)`。
6. 不允许新增 `this.prisma`、`extends PlatformService`、Prisma 事务类型透出。

### 2.2 代码规范（Should）

1. 服务内优先使用 `private get db()` 与 `private get table()` 访问器。
2. 复用查询条件应抽成私有构建方法（如 `buildSearchConditions`）。
3. 业务校验失败抛 `BadRequestException`，资源不存在抛 `NotFoundException`。
4. 复杂列表查询优先“主表分页 + 关联补充”模式，避免不可维护的深层 join 嵌套。
5. 注释与示例需与当前 ORM 一致，不保留 Prisma 示例误导后续开发。

### 2.3 禁止项（Don’t）

1. 禁止新增字符串拼接 SQL。
2. 禁止跳过 `withErrorHandling` 与 `assertAffectedRows`。
3. 禁止在业务文件里通过 Prisma Delegate 继续扩展新能力。
4. 禁止新增 `tx: any` 与 `void tx` 这类绕过事务语义的写法。

---

## 3. 扫描方法与结果总览

### 3.1 逐文件扫描规则

对 `libs/**/*.ts` 逐文件扫描以下标记：

- Prisma 运行态残留：`this.prisma`、`extends PlatformService`
- Prisma 类型残留：`PrismaTransactionClientType` / `PrismaClientType` / `Prisma.*`
- Drizzle 覆盖度：`DrizzleService`、`withErrorHandling(...)`、`assertAffectedRows(...)`、`ext.findPagination(...)`、`buildWhere(...)`

### 3.2 模块级统计（418 文件）

| 模块 | 文件数 | this.prisma | extends PlatformService | Prisma 类型痕迹 | DrizzleService | withErrorHandling | assertAffectedRows | ext.findPagination | buildWhere |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| app-content | 15 | 0 | 0 | 0 | 3 | 3 | 3 | 3 | 2 |
| config | 16 | 0 | 0 | 0 | 3 | 3 | 1 | 1 | 1 |
| content | 60 | 0 | 0 | 0 | 22 | 3 | 13 | 5 | 5 |
| forum | 53 | 0 | 0 | 0 | 15 | 1 | 6 | 8 | 7 |
| growth | 43 | 0 | 0 | 0 | 9 | 5 | 4 | 6 | 6 |
| interaction | 65 | 1 | 1 | 1 | 17 | 6 | 1 | 4 | 5 |
| message | 25 | 6 | 6 | 7 | 0 | 0 | 0 | 0 | 0 |
| moderation | 16 | 0 | 0 | 0 | 3 | 0 | 0 | 1 | 0 |
| platform | 125 | 1 | 1 | 11 | 0 | 0 | 0 | 0 | 0 |

### 3.3 关键结论

1. `content/forum/growth/interaction` 主体已切到 Drizzle，整体迁移完成度高。
2. **主要阻塞集中在 `message` + `platform/auth token`**，仍是 Prisma 主实现。
3. `interaction-target-access.service.ts` 的 Prisma 命中为注释示例，不是运行时代码。
4. `platform/database` 当前是 Prisma 兼容层核心，仍被部分模块依赖。

---

## 4. 逐文件排查结果（Prisma 运行态残留）

以下文件包含运行态 Prisma 访问（`this.prisma`/`extends PlatformService`），属于优先迁移对象：

| 文件 | 当前状态 | 主要残留点 | 风险级别 | 建议优先级 |
|---|---|---|---|---|
| `libs/message/src/chat/chat.service.ts` | Prisma | 全链路会话/消息读写、事务均使用 Prisma | 高 | P0 |
| `libs/message/src/inbox/inbox.service.ts` | Prisma | 收件箱汇总与时间线查询全部 Prisma | 中高 | P0 |
| `libs/message/src/monitor/ws-monitor.service.ts` | Prisma | 指标 upsert 依赖 Prisma | 中 | P1 |
| `libs/message/src/notification/notification.service.ts` | Prisma | 通知 CRUD 与幂等处理依赖 Prisma 错误码 | 高 | P0 |
| `libs/message/src/outbox/outbox.service.ts` | 混合 | 默认走 Prisma，Drizzle tx 仅兼容分支 | 高 | P0 |
| `libs/message/src/outbox/outbox.worker.ts` | Prisma | outbox 消费/锁定/重试全 Prisma | 高 | P0 |
| `libs/platform/src/modules/auth/base-token-storage.service.ts` | Prisma 基类 | Token Delegate 体系基于 Prisma | 高 | P0 |

---

## 5. 逐文件排查结果（Prisma 类型/基础设施残留）

以下文件不是业务主链路，但仍携带 Prisma 类型或基座能力：

| 文件 | 残留类型 | 说明 | 处理建议 |
|---|---|---|---|
| `libs/message/src/outbox/dto/outbox-event.dto.ts` | `Prisma.InputJsonValue` | 仅 DTO 类型层依赖 | 切到 Drizzle JSON 类型或统一 JsonValue 类型别名 |
| `libs/platform/src/database/index.ts` | Prisma 导出汇聚 | 对外导出 Prisma client/models/service/types | 迁移后拆分为 legacy 导出与 Drizzle 导出 |
| `libs/platform/src/database/platform.service.ts` | Prisma 基类 | `this.prisma`、Prisma 错误码工具集 | 标记为 legacy，逐步下线 |
| `libs/platform/src/database/prisma.service.ts` | Prisma 连接服务 | 项目级 Prisma client 构建 | 与 message/token 完成迁移后下线 |
| `libs/platform/src/database/prisma.types.ts` | Prisma 事务类型 | 仍被 token/message 体系使用 | 迁移后删除或仅保留兼容层 |
| `libs/platform/src/database/extensions/*` | Prisma 扩展 | 旧 findPagination/exists/maxOrder 等 | 已有 Drizzle ext，逐步停止引用 |
| `libs/platform/src/modules/health/health.service.ts` | 健康检查依赖 Prisma | `$queryRaw SELECT 1` | 改为 Drizzle/pg 连接健康检查 |
| `libs/platform/src/modules/health/health.module.ts` | 注入 PrismaService | 模块 provider 仍绑定 PrismaService | 同步 health.service 改造后移除 |
| `libs/platform/src/platform.module.ts` | 启动时注入 CustomPrismaModule | 平台默认同时注入 Prisma + Drizzle | 迁移收口后移除 Prisma 模块注入 |

---

## 6. 逐模块审查结论

### 6.1 app-content

- 结论：**已完成 Drizzle 化**。
- 核心文件：
  - `libs/app-content/src/agreement/agreement.service.ts`
  - `libs/app-content/src/announcement/announcement.service.ts`
  - `libs/app-content/src/page/page.service.ts`
- 观察：分页/写操作规范覆盖较好。

### 6.2 config

- 结论：**已完成 Drizzle 化**。
- 核心文件：
  - `libs/config/src/app-config/config.service.ts`
  - `libs/config/src/dictionary/dictionary.service.ts`（规范基准实现）
  - `libs/config/src/system-config/system-config.service.ts`

### 6.3 content

- 结论：**已完成 Drizzle 化，Prisma 运行态已清零**。
- 关注点：部分 resolver 注释仍提及 Prisma 事务语义，建议清理文案。

### 6.4 forum

- 结论：**主链路已切 Drizzle**。
- 关注点：`withErrorHandling` 覆盖率偏低，可继续规范化。

### 6.5 growth

- 结论：**主链路已切 Drizzle**。
- 关注点：关键写链路已基本收敛，后续可继续补齐 `assertAffectedRows` 一致性。

### 6.6 interaction

- 结论：**基本完成 Drizzle 化**。
- 唯一命中：
  - `libs/interaction/src/interaction-target-access.service.ts` 的 `@extends PlatformService` 与 `this.prisma.$transaction` 出现在注释示例，不是运行时代码。
- 建议：清理注释中的 Prisma 示例，避免误导。

### 6.7 message

- 结论：**仍是 Prisma 主战场，未完成迁移**。
- 现状：6 个核心文件直接运行在 Prisma 上，且与 outbox、实时通知、inbox 聚合、ws 指标联动较深。
- 建议：作为下一阶段 P0 专项。

### 6.8 moderation

- 结论：**已按 Drizzle / 非数据库算法服务混合稳定运行**。
- 备注：敏感词检测主链路偏算法逻辑，数据库依赖点已较少。

### 6.9 platform

- 结论：**平台层仍保留 Prisma 兼容基座**。
- 说明：这属于“全仓迁移末段收口”阶段，不建议在 message/token 未迁完前直接移除。

---

## 7. 规范符合度差异（基于当前代码）

### 7.1 已做得好的点

1. `content/forum/growth/interaction` 已广泛采用 `DrizzleService`。
2. 分页已在多个模块切到 `ext.findPagination`。
3. 关键更新删除场景多数引入了 `assertAffectedRows`。

### 7.2 当前不一致点

1. `message` 全链路仍未采用 `withErrorHandling + assertAffectedRows` 规范。
2. `platform` 仍通过 `CustomPrismaModule` 注入 `PrismaService`。
3. 少量注释仍保留 Prisma 示例（特别是 resolver 与 access service）。

---

## 8. 建议的迁移执行顺序（可直接落地）

### Phase 1（P0）：message 主链路迁移

1. `chat.service.ts`：会话/消息事务切到 Drizzle。
2. `notification.service.ts`：通知 CRUD 与幂等错误映射切到 Drizzle。
3. `outbox.service.ts` + `outbox.worker.ts`：统一 Drizzle 事务与状态流转。
4. `inbox.service.ts`：汇总与时间线聚合查询改造。

### Phase 2（P0）：token 基座迁移

1. `base-token-storage.service.ts` 从 Prisma Delegate 抽象迁至 Drizzle Repository 抽象。
2. 同步改造依赖该基类的 app/admin token-storage 实现（位于 apps 层）。

### Phase 3（P1）：平台层收口

1. `health.service.ts` 改为 Drizzle/pg 探针。
2. `platform.module.ts` 移除 `CustomPrismaModule` 默认注入。
3. `platform/database` 目录改为 legacy 子包并逐步下线导出。

### Phase 4（P2）：文案与类型清理

1. 清理 `interaction-target-access.service.ts` 注释示例中的 Prisma 代码。
2. 清理 resolver/service 内“Prisma 事务对象”历史注释。
3. 将 `Prisma.InputJsonValue` 迁移为中立 JSON 类型别名。

---

## 9. 验收标准（libs 维度）

- `libs/**` 不再出现运行态 `this.prisma`。
- `libs/**` 不再出现 `extends PlatformService`（如确需保留，仅允许 legacy 隔离目录）。
- `libs/**` 业务写操作统一具备 `withErrorHandling + assertAffectedRows`。
- `platform.module.ts` 不再在默认路径注入 Prisma。
- lint/typecheck 通过，且 message/token 主链路回归通过。

---

## 10. 本次逐文件排查结论

1. 你当前“libs 大部分已迁移”的判断是准确的。
2. 真正还需重点推进的是 **message + platform token 基座**。
3. 其余模块主要是规范一致性与注释/类型残留清理问题。
4. 若按本报告执行顺序推进，可在较低回归风险下完成 libs 侧 Prisma 收口。

---

## 11. 本轮执行进展（2026-03-17）

### 11.1 已完成迁移文件

1. `libs/message/src/monitor/ws-monitor.service.ts`
   - 已从 `PlatformService + Prisma upsert` 迁移为 `DrizzleService`。
   - 指标增量更新改为 Drizzle `update + onConflictDoUpdate` 语义。

2. `libs/message/src/outbox/outbox.service.ts`
   - 已移除 Prisma 依赖，统一改为 Drizzle 插入。
   - 幂等冲突改为 `onConflictDoNothing` + 唯一冲突兜底。
   - `tx` 参数已收敛为 `Db` 类型，不再使用 `any`。

3. `libs/message/src/outbox/outbox.worker.ts`
   - 已移除 Prisma 轮询与状态更新逻辑，改为 Drizzle 查询/更新。
   - 锁定、恢复、成功、失败、重试链路均改为 Drizzle 写法。

4. `libs/message/src/outbox/dto/outbox-event.dto.ts`
   - 已移除 `Prisma.InputJsonValue`，改为中立 `unknown` 载荷类型。

5. `libs/message/src/inbox/inbox.service.ts`
   - 已移除 Prisma 依赖。
   - 摘要与时间线查询改为 Drizzle `select/join/$count`。

6. `libs/message/src/notification/notification.service.ts`
   - 已移除 Prisma 依赖。
   - 列表分页改为 `drizzle.ext.findPagination` + actor 信息补齐。
   - 标记已读、批量已读、outbox 入站创建通知均改为 Drizzle 写法。

7. `libs/message/src/notification/notification-realtime.service.ts`
   - 已去除 Prisma 模型类型耦合，改为中立结构化输入类型。

8. `libs/message/src/chat/chat.service.ts`
   - 已完成从 Prisma 事务链路迁移到 Drizzle 事务链路。
   - 会话创建、消息发送幂等、已读标记、消息分页、成员状态推送已统一 Drizzle 实现。

9. `libs/platform/src/modules/health/health.service.ts`
   - 数据库健康探针已由 `PrismaService.$queryRaw` 切换为 `DrizzleService.db.execute`。

10. `libs/platform/src/modules/health/health.module.ts`
   - 已移除 `PrismaService` provider 依赖。

11. `libs/platform/src/modules/auth/base-token-storage.service.ts`
   - 已移除 `PlatformService` 继承，改为 ORM 无关的抽象存储基类。

12. `libs/interaction/src/interaction-target-access.service.ts`
   - 已清理注释中的 Prisma 示例，避免误导后续开发。

13. `libs/platform/src/platform.module.ts`
   - 已移除 `CustomPrismaModule` 与 `PrismaService` 注入，数据库入口统一为 `DrizzleModule`。

14. `libs/platform/src/database/index.ts`
   - 已统一导出 Drizzle 能力（`@db/core`、`@db/schema`）。

15. `libs/forum/src/config/forum-config.constant.ts`
   - 已移除 `@libs/platform/database` 的 Prisma 模型类型依赖，改为 Drizzle schema infer 类型。

16. `libs/moderation/sensitive-word/src/sensitive-word-detect.service.ts`
   - 已移除 `@libs/platform/database` 的 Prisma 模型类型依赖，改为 Drizzle schema infer 类型。

17. `libs/platform/src/database/*`
   - 已删除 legacy Prisma database 目录（含 `platform.service.ts`、`prisma.service.ts`、`prisma.types.ts`、`extensions/*`）。

### 11.2 当前剩余收口项

1. `libs` 业务主链路侧已无 Prisma 运行态依赖。
2. `libs/platform` 数据库入口已统一为 Drizzle。

### 11.3 本轮校验结果

1. `pnpm type-check`：通过。
2. `pnpm lint`：通过（仅存在 ESLintIgnoreWarning，不影响迁移结果）。
