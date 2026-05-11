# DTO 规范

适用范围：`libs/*` 与 `apps/*` 中的 DTO 定义与使用。

## 默认动作

- 业务场景 DTO 统一定义在 `libs/*`；`apps/*` 只消费 DTO，不新增 `*.dto.ts`。
- HTTP Controller 的入参必须使用 DTO；出参优先使用输出 DTO，但允许 `boolean`、`number`、`string` 等基础类型作为稳定 contract；非 HTTP 的内部领域结构统一放在 `*.type.ts`，需要按职责拆分时可放在 owner 模块的 `types/*.type.ts` 中，不要混进 DTO 文件。
- DTO 中的定义必须直接服务 Swagger 文档、字段校验或对外 contract；如果一个结构既不服务文档，也不服务校验，就不要为了“统一都叫 DTO”硬造 DTO。
- 若跨模块复用现有字段，默认导入目标 DTO 并组合；不要在当前模块手写复制别的模块字段。
- 实体字段与物理约束以 Drizzle Table 为准；`BaseXxxDto` 及其衍生字段默认向对应 Drizzle table / schema 看齐，不手写脱锚字段。

## 分层与职责

- `libs/platform`：基础 DTO 复用层。
- `libs/*`：owner 域 DTO 定义层，承载实体基类 DTO（`BaseXxxDto`）与场景 DTO。
- `libs/*/*.type.ts`、`libs/*/**/types/*.type.ts`：仅承载非 HTTP 的内部领域结构。
- `apps/*`：入口装配层，仅消费 DTO。

## 命名约定

- 实体字段基类统一使用 `BaseXxxDto`；它是后续 `PickType`、`OmitType`、`PartialType`、`IntersectionType` 的字段来源。
- 场景 DTO 优先使用现有后缀：`CreateXxxDto`、`UpdateXxxDto`、`QueryXxxDto`、`XxxDetailDto`、`XxxPageItemDto`、`XxxResponseDto`、`XxxBriefDto`。
- 可复用字段块优先使用 `XxxFieldsDto`、`XxxWritableFieldsDto` 这类语义明确的命名；不要使用 `CommonDto`、`TempDto`、`PublicDto` 这类泛化名称。
- 命名不是穷举白名单，但新增 DTO 应优先贴近上述模式，避免同一语义出现多套命名。

## 复用与收敛

- DTO 组合工具统一使用 `@nestjs/swagger` 的 `PickType`、`OmitType`、`PartialType`、`IntersectionType`。
- 优先用组合工具复用字段，避免字段复制、重复定义。
- 跨模块复用 DTO 时，先导入目标 DTO，再做字段裁剪或合并；禁止重复定义其他模块已存在的字段。
- 同一 owner 模块内，若某个字段语义已经在 `BaseXxxDto`、同域基础 DTO 或同域稳定场景 DTO 中定义过，后续 DTO 必须优先通过 `PickType`、`OmitType`、`PartialType`、`IntersectionType` 复用；`QueryXxxDto`、筛选字段块 DTO 也不例外，禁止在另一个 DTO 文件里把同义字段重新手写一遍。
- DTO 文件禁止引入 `*.type.ts`；内部类型应反向复用 DTO 或 Drizzle，不允许 DTO 反向依赖 type。
- Controller 返回基础类型时，不要为了“统一都叫 DTO”额外包一层空心 DTO；只有当响应需要字段文档、嵌套结构、可扩展返回 contract 或校验语义时，才定义输出 DTO。
- 字段选择默认规则：保留字段更少时用 `PickType`；排除字段更少时用 `OmitType`。
- `PartialType` 仅用于现有字段集的“整体可选化”；优先写成 `PartialType(CreateXxxDto)` 或 `PartialType(PickType(...))`，不要重新手写一份“几乎一样但全可选”的 DTO。
- `FieldsDto` / `WritableFieldsDto` 只用于同域内可复用字段块；若字段块只服务单一场景且不会复用，直接放在对应场景 DTO 附近。
- DTO 字段装饰器中的短文本元信息（如 `description`、`example`、简单 `message`）默认就地内联；不要为了同文件内 2-3 处局部复用，额外抽出 `FOO_DESCRIPTION`、`BAR_EXAMPLE` 这类常量。
- 仅当文案需要跨文件共享、属于事实源长文本、或必须参与受控拼接时，才允许提取装饰器元信息常量；“少写几次同一句话”不构成提取理由。
- 禁止新增 DTO barrel。
- 禁止为了缩短路径、绕过组合工具或“看起来更像返回体”而新增纯别名 DTO。
- 平台通用 DTO（如 `IdDto`、`IdsDto`、`UserIdDto`、`PageDto`）只允许直接使用；禁止通过 `extends` 创建空心别名再改名，例如 `QueryXxxPageDto extends PageDto {}`、`QueryXxxDetailDto extends IdDto {}`。
- 允许语义型别名 DTO：仅当它仍然服务接口文档、字段校验或稳定返回 contract，同时能表达明确业务语义、对齐返回命名、或为后续扩展预留位置时才允许，例如 `XxxResponseDto extends XxxDetailDto {}`；该例外不适用于平台通用 DTO。
- `contract: false` 仅用于排除不对外字段、写入专用字段或内部辅助字段；不要用它掩盖一个本应拆出去的内部结构。
- 枚举数组字段统一使用 `ArrayProperty` + `itemEnum`，类型为 `XxxEnum[]`。

## 字段校验归属

- **只有纯输出 DTO 字段必须显式设置 `validation: false`**。纯输出字段只服务 Swagger / OpenAPI 文档和返回 contract，不经过 `ValidationPipe`，不得挂载 class-validator / class-transformer 请求阶段元数据。
- **入参字段，以及同一语义同时用于入参和出参的字段，必须保留默认 `validation: true`**。不要为了把输出 DTO 关掉校验而拆出一套重复字段；应定义一个 validation-enabled 的 owner 字段，再用 `PickType`、`PartialType`、`IntersectionType` 派生查询、命令和输出 DTO。
- 当共享字段在查询场景需要可选化时，必须从 required owner 字段通过 `PartialType(PickType(...))` 或等价组合派生；不要把 owner 字段本身改成 `required: false` 来迁就查询条件，除非该字段的真实输出 contract 也允许缺省或为 null。
- 当输出字段只是输入字段的别名、左连接 nullable 视图或派生展示字段时，应建立语义明确的字段块 DTO 作为当前 API contract owner，并在注释或命名中体现别名/nullable 边界；不得在 Query DTO 和 PageItem DTO 中各手写一份装饰器。
- `validation: false` 与 `contract: false` 不是同一件事：前者保留对外文档但关闭请求校验元数据，后者隐藏对外文档并用于非对外字段。不要混用。
- 测试输出 DTO contract 时，优先验证 Swagger / contract metadata 或 service 返回形状；不要用 class-validator 结果证明纯输出字段“有效”。测试输入 DTO 时，必须继续验证 class-validator 行为。

## 禁止项

- 禁止在 `apps/*` 新增同构 DTO。
- 禁止在 DTO 文件中引入 `*.type.ts`。
- 禁止在 DTO 文件中承载 service 调用、数据库访问或业务计算逻辑。
- 禁止在 DTO 文件中新增“字段完全复制但只改类名”的跨模块 DTO。
- 禁止在同一 owner 模块的多个 DTO 文件中，对同一业务语义字段重复声明装饰器、类型和描述文案；若基础 DTO 已有对应字段，必须从基础 DTO 选取，而不是再写一套同义字段。
- 禁止新增既不服务字段校验、也不服务文档描述、只为了代替 `type` 存在的空心 DTO。
- 禁止纯输出 DTO 字段遗漏 `validation: false`，导致返回模型意外携带请求阶段校验/转换元数据。
- 禁止把同一业务语义字段拆成“输入一份、输出一份”来规避 `validation` 归属；只要输入和输出都需要该字段，就必须收敛到同一个 validation-enabled 字段来源。
- 禁止为平台通用 DTO 新增空心别名或改名包装；需要单个 `id`、分页参数、`userId`、`ids` 时，直接在 controller / service 签名中使用 `IdDto`、`PageDto`、`UserIdDto`、`IdsDto`。
- 禁止在 DTO 文件中为了复用局部装饰器文案，新增 `*_DESCRIPTION`、`*_EXAMPLE`、`*_MESSAGE` 这类只服务当前文件的短文本常量。
- 禁止通过 `*.public.dto.ts`、`response.dto.ts`、`detail.dto.ts` 拆出仅做转发的文件；若属于同一 owner 域，优先收口在同一个 owner DTO 文件中。

## 枚举字段描述规范

- 若 DTO、通知快照、JSON payload 中的字段语义直接对应数据库闭集枚举值（如 `reward.items[].assetType`），必须直接复用数据库一致的数字值域 / 共享枚举类型。
- 所有 `description` 必须使用中文业务语义，不允许直接写英文常量名、技术 key 或旧字符串枚举值。
- 枚举字段描述统一使用“实际枚举值=业务含义”，例如 `1=草稿；2=已发布；3=已下线`。
- 禁止写法：`PENDING`、`FAILED`、`BASE_REWARD`、`weekly`、`upload`、`ios`、`android` 这类直接暴露常量名的描述。
- 若字段本质上是开放业务键（如 `eventKey`、`categoryKey`、`projectionKey`），应继续使用字符串说明，不适用枚举描述规则。

## 正反例

- 允许：在 owner 域 DTO 文件中定义 `BaseForumTopicDto`，再用 `PickType(BaseForumTopicDto, ['id', 'title'] as const)` 组合列表项 DTO。
- 允许：导入跨模块 DTO 后组合，例如 `PickType(BaseAppUserDto, ['id', 'nickname'] as const)`。
- 允许：`ForumTopicWritableFieldsDto`、`UserPointDeltaFieldsDto` 这类语义明确、可复用的字段块 DTO。
- 允许：`UserNotificationDto extends BaseUserNotificationDto {}`，前提是它用于稳定返回体命名或后续扩展锚点。
- 允许：热门话题分页接口直接把 controller 入参声明为 `PageDto`，而不是额外定义 `QueryPublicForumHashtagHotPageDto extends PageDto {}`。
- 允许：Controller 直接返回 `boolean`、`number`、`string` 等基础类型，前提是接口 contract 本身就是该基础类型，且不需要额外字段描述或嵌套结构。
- 允许：长文案、事实源说明或跨文件共享文案提取为常量，例如多个 DTO/文档共用的统一提示语。
- 禁止：在 DTO 文件里 `import type { GrowthRewardItem } from '../reward-item.type'` 再把内部 type 暴露成 DTO 字段来源。
- 禁止：在 `apps/app-api` 下新增一个和 `libs/forum/.../forum-topic.dto.ts` 同构的 `forum-topic.dto.ts`。
- 禁止：为了少写几行，把 `BaseAppUserDto` 的字段重新抄一份到 `ForumTopicUserDto`。
- 禁止：在同一模块里，`sceneType`、`status`、`userId` 这类已在基础 DTO 中存在的字段，又在 `query.dto.ts`、`app.dto.ts`、`admin.dto.ts` 里重新定义一遍。
- 禁止：新增 `QueryPublicForumHashtagHotPageDto extends PageDto {}`、`QueryTaskDefinitionDetailDto extends IdDto {}` 这类平台通用 DTO 的空心别名。
- 禁止：新增 `forum-topic.public.dto.ts` 只为了转发或改名现有 DTO。
- 禁止：为 `description: '通知分类键...'`、`example: 'comment_reply,topic_like'` 这类只在当前 DTO 文件内使用的短文本，再额外定义 `NOTIFICATION_CATEGORY_KEY_DESCRIPTION`、`NOTIFICATION_CATEGORY_KEYS_FILTER_DESCRIPTION` 之类常量。
