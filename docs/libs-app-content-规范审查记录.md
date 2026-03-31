# libs/app-content 规范审查记录

## 范围

- 目标目录：`libs/app-content`
- 审查文件总数：19
- 覆盖类型：`service`、`dto`、`type`、`module`、`constant`、`test`、`index`、`tsconfig`
- 审查维度：注释规范、DTO 规范、TypeScript 类型规范、Drizzle 使用规范

## 判定依据

- `.trae/rules/COMMENT_SPEC.md`
- `.trae/rules/DTO_SPEC.md`
- `.trae/rules/TS_TYPE_SPEC.md`
- `.trae/rules/drizzle-guidelines.md`
- `.trae/rules/ERROR_HANDLING_SPEC.md`

## 审查结论

- 结论：`libs/app-content` **不完全符合**规范。
- 主要问题集中在：
  - DTO 枚举数组字段声明方式；
  - Base DTO 与 Schema 可空性一致性；
  - 局部类型收敛（宽类型/`as any`）；
  - 页面权限枚举与 schema 语义存在漂移风险。
- Drizzle 主路径（`withErrorHandling`、`assertAffectedRows`、`findPagination`）整体符合规范主线。

## 不符合项明细

| 序号 | 维度 | 文件 | 行号 | 现象 | 判定 |
| --- | --- | --- | --- | --- | --- |
| 1 | DTO | `libs/app-content/src/announcement/dto/announcement.dto.ts` | 98-104 | `ArrayProperty` 使用 `itemType: 'number'` | 枚举数组字段应使用 `itemEnum` |
| 2 | DTO | `libs/app-content/src/page/dto/page.dto.ts` | 47-53 | `ArrayProperty` 使用 `itemType: 'number'` | 枚举数组字段应使用 `itemEnum` |
| 3 | DTO/Schema 一致性 | `libs/app-content/src/agreement/dto/agreement.dto.ts` | 59-64 | `publishedAt?: Date` | 对应 schema 字段可空，DTO 未体现 `null` 语义 |
| 4 | DTO/Schema 一致性 | `libs/app-content/src/announcement/dto/announcement.dto.ts` | 35-41 | `summary?: string` | 对应 schema 字段可空，DTO 未体现 `null` 语义 |
| 5 | DTO/Schema 一致性 | `libs/app-content/src/announcement/dto/announcement.dto.ts` | 61-66 | `publishStartTime?: Date` | 对应 schema 字段可空，DTO 未体现 `null` 语义 |
| 6 | DTO/Schema 一致性 | `libs/app-content/src/announcement/dto/announcement.dto.ts` | 68-73 | `publishEndTime?: Date` | 对应 schema 字段可空，DTO 未体现 `null` 语义 |
| 7 | DTO/Schema 一致性 | `libs/app-content/src/announcement/dto/announcement.dto.ts` | 75-80 | `pageId?: number` | 对应 schema 字段可空，DTO 未体现 `null` 语义 |
| 8 | DTO/Schema 一致性 | `libs/app-content/src/announcement/dto/announcement.dto.ts` | 82-88 | `popupBackgroundImage?: string` | 对应 schema 字段可空，DTO 未体现 `null` 语义 |
| 9 | DTO/Schema 一致性 | `libs/app-content/src/page/dto/page.dto.ts` | 72-78 | `description?: string` | 对应 schema 字段可空，DTO 未体现 `null` 语义 |
| 10 | DTO/Schema 一致性 | `libs/app-content/src/page/dto/page.dto.ts` | 55-62 | 使用 `PageRuleEnum`（含 `VIP=3`） | schema 注释语义为 `0/1/2/9`，存在语义漂移风险 |
| 11 | 类型声明 | `libs/app-content/src/agreement/agreement.service.ts` | 67-69 | `Record<string, unknown>` 承载稳定更新结构 | 可进一步收敛为基于实体字段的 `Pick/Partial` |
| 12 | 类型声明（测试） | `libs/app-content/src/announcement/test/announcement.service.spec.ts` | 71-72,85,135-136,140 | 使用 `as any` | 存在类型逃逸 |

## 关联 schema 锚点

- `db/schema/app/app-agreement.ts:42`
- `db/schema/app/app-announcement.ts:18,30,54,62,66`
- `db/schema/app/app-page.ts:34,36-38`

## 已通过项

- 注释：service 和 type 文件的核心导出/方法注释整体齐全，未发现明显缺失。
- Drizzle：
  - 写操作使用 `withErrorHandling`；
  - 需要存在性保证的更新使用 `assertAffectedRows`；
  - 分页查询使用 `drizzle.ext.findPagination`。

## 验证记录

- `pnpm eslint "libs/app-content/src/**/*.ts"`：通过
- `pnpm type-check`：通过
- `pnpm jest libs/app-content/src/announcement/test/announcement.service.spec.ts`：通过（2/2）

## 整改优先级建议

- P0（先改）
  - DTO 枚举数组改为 `ArrayProperty + itemEnum`
  - Base DTO 与 schema 可空语义对齐
- P1（随后）
  - `PageRuleEnum` 与页面访问级别语义统一
  - `agreement.service.ts` 更新结构类型收敛
- P2（持续）
  - 测试中的 `as any` 逐步收敛为显式 mock 类型
