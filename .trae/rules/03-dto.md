# DTO 规范

适用范围：`libs/*` 与 `apps/*` 中的 DTO 定义与使用。

## 目标与原则

- 业务场景 DTO 统一定义在 `libs/*`，`apps/*` 不重复定义同构 DTO。
- Controller 与 Service 的公开方法入参、出参与 DTO 保持 1:1。
- 实体字段与物理约束以 Drizzle Table 为准。
- DTO 文件默认按 schema / table 收口，不新增 `*.public.dto.ts`。
- 与 DTO 同构的 `Input/View` 类型应删除，直接使用 DTO。

## 分层与职责

- `libs/platform`：基础 DTO 复用层。
- `libs/*`：实体基类 DTO（`BaseXxxDto`）与场景 DTO（`Create/Update/Query/Response`）。
- `libs/*/*.type.ts`：仅承载非 HTTP 的内部领域结构。
- `apps/*`：入口装配层，仅消费 DTO。

## 复用与收敛

- 优先 `PickType`、`OmitType`、`PartialType`、`IntersectionType` 组合，避免字段复制、重复定义。
- 禁止新增纯别名 DTO 或 DTO barrel。
- `contract: false` 用于排除不对外字段。
- 枚举数组字段统一使用 `ArrayProperty` + `itemEnum`，类型为 `XxxEnum[]`。

## 枚举字段描述规范

- 若 DTO、通知快照、JSON payload 中的字段语义直接对应数据库闭集枚举值（如 `reward.items[].assetType`），必须直接复用数据库一致的数字值域 / 共享枚举类型；禁止改成 `'points'`、`'experience'` 这类字符串标签，也禁止无依据收窄成仅覆盖当前业务子集的字面量联合类型。
- `EnumProperty`、`EnumArrayProperty` 的 `description` 必须使用中文业务语义，不允许直接写英文常量名、技术 key 或旧字符串枚举值。
- 枚举字段描述统一使用"实际枚举值=业务含义"，例如 `1=草稿；2=已发布；3=已下线`。
- 禁止写法：`PENDING`、`FAILED`、`BASE_REWARD`、`weekly`、`upload`、`ios`、`android` 这类直接暴露常量名的描述。
- 若字段本质上是开放业务键（如 `eventKey`、`categoryKey`、`projectionKey`），应继续使用字符串说明，不适用枚举描述规则。
