# 注释规范

适用范围：`libs/*`、`apps/*` 与 `db/schema` 中的代码注释。

## 核心原则

- 注释解释原因、约束、语义和风险，不逐句翻译代码。
- 大型 Service/Helper 先整理结构，再补注释。
- 默认使用简体中文，专有名词保留英文。

## 必须写注释的场景

- Service/Resolver/Extension/Helper 的公共入口方法与关键私有方法。
- `*.type.ts` 中导出的稳定领域类型。
- 事务/幂等/重试/补偿/原生 SQL 等关键语义。
- `db/schema/**/*.ts` 中所有闭集 `smallint` / `smallint[]` 字段。
- `priority`、`sortOrder`、`dailyLimit`、`postInterval` 这类使用 `smallint` 的非枚举配置字段。

## 数据表字段注释要求

- 闭集状态 / 类型 / 模式 / 角色 / 平台 / 目标 / 场景字段，JSDoc 必须写清数值语义。
- `smallint` / `smallint[]` 字段统一写成 `1=...`、`2=...` 这样的中文说明，不要求读者跳转业务代码反推。
- 对 `priority`、`sortOrder`、`dailyLimit`、`postInterval` 等非枚举 `smallint` 字段，必须写清 `0` 或默认值的业务含义，例如 `0=默认优先级`、`0=不限制`、`0=默认排序`。
- 若字段是开放字符串、事件键、模板键、路由键、MIME 类型、来源快照或其他非闭集业务键，应继续保持字符串，并在注释中说明这是开放值，不要求改成 `smallint`。

## 禁止写法

- 模板化空注释、逐行翻译、与实际行为不一致的历史描述。
- 对闭集 `smallint` 字段只写"状态""类型""角色""模式"这类空泛描述。
- 在 `EnumProperty.description` 或字段注释中直接写英文常量名、旧字符串枚举值或技术 key。
