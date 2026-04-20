# TypeScript 类型规范

适用范围：`libs/*` 与 `apps/*` 中可复用的 TypeScript 类型定义，以及 `*.type.ts`、`*.types.ts` 文件。

## 默认动作

- 涉及 HTTP 入参 / 出参、Swagger 文档、字段校验的结构，默认定义或复用 DTO；不要先写 `type` 再让 Controller / Service 手动对齐 DTO。
- 不属于文档、校验、对外 contract 的内部结构，先判断能否从现有 DTO 复用或组合；复用不了时，再判断能否从 Drizzle schema / owner type 推导。只有这些来源都无法满足时，才允许新增 `type` / `interface`。
- 能从现有 DTO、Drizzle schema、owner type 或 `typeof ...$inferSelect / $inferInsert` 推导出来的类型，默认直接推导；不要手写同构结构。
- 可复用的业务类型默认放在 owner 域的 `*.type.ts` 或 `*.types.ts` 中；不要为了图省事散落在多个 service / controller 文件里。
- `*.type.ts`、`*.types.ts` 只承载非 HTTP 的内部领域结构、查询上下文、聚合结果、事件 payload、适配器入参等类型。
- 纯类型依赖统一使用 `import type`；只有符号确实参与运行时执行时，才使用普通 `import`。

## 放置规则

- `*.type.ts`：单一 owner 域、单一主题的稳定类型文件，例如 `forum-topic.type.ts`、`task.type.ts`。
- `*.types.ts`：同一子模块下成组出现的通用类型文件，例如 `upload.types.ts`、`geo.types.ts`、`request-parse.types.ts`。
- `apps/*` 可以定义入口层专属类型，例如装饰器 metadata、全局声明合并、框架适配参数；但不得重复声明 `libs/*` 已有的业务类型。
- 新增类型文件时，默认贴近 owner 模块放置；不要新增 `*.public.type.ts`、`common.type.ts`、`shared.type.ts` 这类语义泛化文件。

## 复用与推导

- 类型复用优先顺序：已有 DTO -> 从 DTO 组合出的 TypeScript 类型 -> Drizzle schema / infer 类型 -> 既有 owner type -> 新增 `type` / `interface`。
- 优先复用 DTO、Drizzle 类型和既有 owner type，常用方式包括 `Pick`、`Omit`、`Partial`、交叉类型、联合类型、索引访问类型和 `typeof` 推导。
- `type` 可以依赖 DTO 或 Drizzle；DTO 不得反向依赖 `*.type.ts`、`*.types.ts`。
- 若所需结构已存在于 DTO 中，优先从 DTO 组合；不要再声明一份字段完全相同的 `type` / `interface`。
- 若所需结构本身需要 Swagger 文档或字段校验，就应该继续定义为 DTO；不要把本应是 DTO 的结构下沉成 `type`。
- 若所需结构只是内部领域类型，不承担文档和校验职责，也无法从 DTO 组合得到，才允许定义新的 `type` / `interface`。
- 若所需结构已存在于 schema select / insert 类型中，优先从 schema 推导；不要手写数据库字段镜像类型。
- 基于 Drizzle `typeof table.$inferSelect / $inferInsert` 导出的公共类型，统一直接命名为 `XxxSelect`、`XxxInsert`；不要先定义 `Xxx = typeof table.$inferSelect`，再把 `XxxSelect = Xxx` 作为二次别名。
- 字段裁剪默认规则：保留字段更少时用 `Pick`；排除字段更少时用 `Omit`。
- 禁止无意义别名：若新类型只是原类型改名，且没有新增语义、边界或复用价值，直接使用原类型。

## `type` 与 `interface`

- 对象形状、可扩展 contract、面向实现的协议，优先使用 `interface`。
- 联合类型、交叉类型、基础类型别名、`Pick` / `Omit` / `Record` / 条件类型结果，优先使用 `type`。
- 同一语义不要同时声明等价的 `type` 和 `interface`。

## 边界类型

- 禁止使用 `any`。
- `unknown` 仅允许出现在真实边界场景，例如 JSON blob、事件上下文、模板上下文、第三方原始 payload、暂未收敛的扩展字段。
- 使用 `unknown` 后，必须在消费前做收窄、校验或转换；不要把 `unknown` 沿调用链继续透传。
- `Record<string, unknown>` 仅用于开放键集合；如果键和值都已知，应改成明确字段结构。

## 禁止项

- 禁止在 `*.type.ts`、`*.types.ts` 中重复声明 DTO 同构结构。
- 禁止为了“统一都叫 DTO”而新增无文档价值、无校验价值的空心 DTO。
- 禁止期待通过新增 `type` 替代本应承担文档 / 校验职责的 DTO。
- 禁止在类型文件中承载 service 调用、数据库访问或业务执行逻辑。
- 禁止为了缩短路径或“看起来统一”而新增转发型类型文件。
- 禁止把仅当前文件内部使用的临时类型强行提升为公共导出类型。
- 禁止为 Drizzle `inferSelect` / `inferInsert` 再套一层无意义别名，例如 `type CheckInActivityStreak = typeof checkInActivityStreak.$inferSelect` 后再写 `type CheckInActivityStreakSelect = CheckInActivityStreak`。

## 正反例

- 允许：`type CommentVisibleState = Pick<UserCommentSelect, 'auditStatus' | 'isHidden' | 'deletedAt'>`
- 允许：`type TopicAuthorView = Pick<BaseAppUserDto, 'id' | 'nickname' | 'avatarUrl'>`，前提是它只是内部类型视图，DTO 侧没有必要新增一个只为改名存在的类。
- 允许：`interface ForumTopicClientContext extends GeoSnapshot { userAgent?: string }`
- 允许：`type SessionClientContext = ClientRequestContext`，前提是它表达了稳定业务语义。
- 允许：在 service 文件内定义仅本文件使用的私有 helper type，例如查询行结构、临时聚合结果。
- 允许：在事件、模板、开放 payload 边界使用 `Record<string, unknown>`，但后续必须收窄。
- 允许：`export type CheckInActivityStreakSelect = typeof checkInActivityStreak.$inferSelect`
- 禁止：为了让内部结构“看起来统一”，新建一个不带校验和文档价值的 `UserSummaryDto` 替代 `type TopicAuthorView = Pick<BaseAppUserDto, ...>`。
- 禁止：内部只想拿一个字段子集时，新建 `UserSummaryDto` 但既不用于 Swagger，也不参与校验。
- 禁止：为了复用 `BaseAppUserDto` 的字段，重新手写一个同构 `ForumTopicUserShape`。
- 禁止：把 HTTP 返回体结构改写成 `*.type.ts` 类型，再让 Controller 手动拼响应。
- 禁止：声明 `type UserInfo = BaseAppUserDto` 这类没有新增语义的纯改名别名。
- 禁止：`export type CheckInActivityStreak = typeof checkInActivityStreak.$inferSelect` + `export type CheckInActivityStreakSelect = CheckInActivityStreak`

## 示例

```ts
import type { UserCommentSelect } from '@db/schema'

export type CommentVisibleState = Pick<
  UserCommentSelect,
  'auditStatus' | 'isHidden' | 'deletedAt'
>
```
