# 导入边界规范

适用范围：全仓库 TypeScript/JavaScript 文件的导入语句。

## 核心原则

- 全仓统一使用文件直连导入；业务域不依赖 `index.ts`、`dto/index.ts`、`core/index.ts`、`module/index.ts`、`module.ts`、`contracts.ts` 等转发入口。
- `libs/platform` 允许目录级 public API：`libs/platform/src/**/index.ts` 可作为受控统一导出入口，但不允许根级 `@libs/platform` 总出口，也不允许 `@libs/platform/modules` 等宽聚合入口。
- DTO 文件只依赖稳定 DTO/常量/类型；禁止通过 DTO 拉起运行时对象。
- Service、Resolver、Module、Controller 直接依赖 owner 文件，不通过中间入口"顺手带出"其他符号。
- 禁止通过"调整导出顺序"掩盖循环依赖；应通过收敛共享字段或调整依赖方向解决根因。

## 明确禁止

- 禁止新增转发入口：`index.ts`、`dto/index.ts`、`core/index.ts`、`module/index.ts`、`module.ts`、`contracts.ts`、`base.ts`（仅转发时）
- 禁止为了缩短路径新增"公共出口文件"
- 唯一例外：`libs/platform/src/**/index.ts` 目录级 public API
- 禁止跨域导入目录语义路径，必须直达具体文件

## 分层导入规则

- DTO 文件仅可导入：同域 DTO、跨域 DTO 具体文件、`@libs/platform/*` 基础能力、必要的 `@db/schema` 类型或常量。
- DTO 文件禁止导入：任何 barrel、`*.service.ts`、`*.module.ts`、`*.resolver.ts`。
- Service / Resolver / Module / Controller 必须直连具体文件，不通过 DTO barrel。
- `apps/*` 也必须直连具体文件，不是例外。
