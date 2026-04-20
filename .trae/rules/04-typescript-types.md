# TypeScript 类型规范

适用范围：`libs/*` 与 `apps/*` 中的类型定义文件（`*.type.ts`）。

## 核心原则

- 实体字段类型以 `db/schema` 推导结果为单一事实源，同时应该尽量使用复用实体字段。
- 与 DTO 同构的 `Input/View` 类型应删除，直接复用 DTO。
- `*.type.ts` 仅承载非 HTTP 契约的内部领域结构。
- 纯类型依赖统一使用 `import type`，避免运行时副作用。
- 方法返回值优先类型推导，必要时才显式标注。

## 类型复用与组合

- 优先从 Drizzle 导出类型，使用 `Pick`、`Omit`、联合类型、交叉类型组合，避免手动定义。
- 禁止使用 `any`、`unknown` 等宽泛类型。

```ts
// ✅ 从 schema 推导，语义清晰
import type { UserCommentSelect } from '@db/schema'

export type CommentVisibleState = Pick<
  UserCommentSelect,
  'auditStatus' | 'isHidden' | 'deletedAt'
>
```
