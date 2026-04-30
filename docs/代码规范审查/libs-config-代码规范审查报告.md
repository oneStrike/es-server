# libs/config 模块代码规范审查报告

## 审查概览

- 审查模块：`libs/config`
- 已读源码/配置文件：14 个
- 规范来源总数：10 份
- 本模块适用校验点：50 项
- 已闭合校验点：50 项
- 合规校验点：43 项
- 违规校验点：7 项

### 风险分布

- HIGH：0
- MEDIUM：6
- LOW：1

## 规范条款逐条校验汇总

| 规范来源                  | 本模块适用校验点 | 结论                                        |
| ------------------------- | ---------------: | ------------------------------------------- |
| `AGENTS.md` 项目级约束    |                5 | 未发现模块边界级硬违例                      |
| `01-import-boundaries.md` |                7 | 导入基本直连 owner 文件，未发现 barrel 依赖 |
| `02-controller.md`        |                1 | 本模块无 Controller                         |
| `03-dto.md`               |                6 | 发现枚举描述暴露技术 key                    |
| `04-typescript-types.md`  |               10 | 发现类型定义位置与复杂签名问题              |
| `05-comments.md`          |                8 | 发现方法注释形式与常量字段注释问题          |
| `06-error-handling.md`    |                5 | 发现服务层 HTTP 异常表达业务失败            |
| `07-drizzle.md`           |                5 | 未发现明确 Drizzle 查询构造违规             |
| `08-testing.md`           |                3 | 本模块无 spec；本次审查未涉及行为变更       |

## 详细违规清单

### MEDIUM

#### M-01 类型定义放在非 `*.type.ts` 文件中

- 文件位置：`libs/config/src/system-config/config-reader.ts:7`
- 对应规范：`04-typescript-types.md`，纯 TypeScript 的 `type` / `interface` 定义统一放在 `*.type.ts`
- 违规原因：`SystemConfig` 类型定义在 `config-reader.ts`，而同域已存在 `system-config.type.ts`
- 整改建议：将 `SystemConfig` 移入 `system-config.type.ts`，`config-reader.ts` 仅 `import type`

#### M-02 类型文件中同一符号存在重复注释

- 文件位置：`libs/config/src/system-config/system-config.type.ts:1`、`libs/config/src/system-config/system-config.type.ts:5`
- 对应规范：`05-comments.md`，禁止为同一符号堆叠多段重复 JSDoc
- 违规原因：`ConfigAllowedTemplate` 前连续存在两段说明性质接近的 JSDoc
- 整改建议：保留一段能说明业务语义和复用边界的注释，删除重复说明

#### M-03 导出常量对象字段缺少逐项注释

- 文件位置：`libs/config/src/system-config/system-config.constant.ts:27`
- 对应规范：`05-comments.md`，导出的常量对象、映射常量、配置常量中的每一个字段都必须有紧邻注释
- 违规原因：`CONFIG_SECURITY_META.forumHashtagConfig` 未说明该配置块的安全语义
- 整改建议：为该字段补紧邻中文行注释，例如说明“话题配置无敏感字段，仅参与白名单过滤”

#### M-04 服务层用 HTTP 异常表达可预期业务失败

- 文件位置：
  - `libs/config/src/dictionary/dictionary.service.ts:76`
  - `libs/config/src/system-config/system-config.service.ts:596`
- 对应规范：`06-error-handling.md`，Service 对可预期业务失败抛 `BusinessException`
- 违规原因：字典编码为空、上传配置缺必填字段等可预期业务/配置失败直接抛 `BadRequestException`
- 整改建议：能由 DTO 表达的放到 DTO 校验；业务配置失败使用 `BusinessException` 和共享错误码

#### M-05 方法签名中直接书写复杂泛型/对象类型表达式

- 文件位置：
  - `libs/config/src/system-config/system-config.service.ts:186`
  - `libs/config/src/system-config/system-config.service.ts:366`
  - `libs/config/src/system-config/system-config.service.ts:434`
  - `libs/config/src/system-config/system-config.service.ts:472`
  - `libs/config/src/system-config/system-config.service.ts:502`
  - `libs/config/src/system-config/system-config.service.ts:554`
  - `libs/config/src/system-config/system-config.service.ts:582`
- 对应规范：`04-typescript-types.md`，方法/函数签名中的复杂类型表达式必须先在 `*.type.ts` 中命名后引用
- 违规原因：多个 helper 方法在签名中直接写 `T extends Record<string, unknown>`、`Record<string, unknown>`、类型谓词等复杂表达式
- 整改建议：把配置快照、配置节点、路径值等内部类型收敛到 `system-config.type.ts`

#### M-06 枚举字段描述直接暴露技术 key

- 文件位置：`libs/config/src/system-config/dto/config.dto.ts:342`、`libs/config/src/system-config/dto/config.dto.ts:350`
- 对应规范：`03-dto.md` 枚举字段描述规范，描述必须使用中文业务语义，不允许直接写英文常量名、技术 key 或旧字符串枚举值
- 违规原因：上传提供方描述直接写 `local`、`qiniu`、`superbed`，并在布尔字段描述中写 `provider`
- 整改建议：改成中文业务语义说明，例如“本地存储、七牛云存储、Superbed 图床”；技术 key 可放 example 或由 enum 元数据表达

### LOW

#### L-01 方法注释大量使用 JSDoc

- 文件位置示例：
  - `libs/config/src/system-config/config-reader.ts:47`
  - `libs/config/src/system-config/config-reader.ts:57`
  - `libs/config/src/system-config/system-config.service.ts:186`
  - `libs/config/src/system-config/system-config.service.ts:554`
- 对应规范：`05-comments.md`，方法注释统一使用紧邻方法定义的行注释，不使用 JSDoc
- 违规原因：服务方法和 helper 方法普遍使用 `/** ... */`
- 整改建议：方法级说明改为紧邻 `//` 行注释；导出稳定符号和 DTO/schema 继续保留 JSDoc

## 逐文件审查结论

### 发现违规的文件

| 文件                                                      | 结论                  |
| --------------------------------------------------------- | --------------------- |
| `libs/config/src/dictionary/dictionary.service.ts`        | 发现 M-04             |
| `libs/config/src/system-config/config-reader.ts`          | 发现 M-01、L-01       |
| `libs/config/src/system-config/dto/config.dto.ts`         | 发现 M-06             |
| `libs/config/src/system-config/system-config.constant.ts` | 发现 M-03             |
| `libs/config/src/system-config/system-config.service.ts`  | 发现 M-04、M-05、L-01 |
| `libs/config/src/system-config/system-config.type.ts`     | 发现 M-02             |

### 已读且未发现明确违规的文件

- `libs/config/src/app-config/config.constant.ts`
- `libs/config/src/app-config/config.module.ts`
- `libs/config/src/app-config/config.service.ts`
- `libs/config/src/app-config/dto/config.dto.ts`
- `libs/config/src/dictionary/dictionary.module.ts`
- `libs/config/src/dictionary/dto/dictionary.dto.ts`
- `libs/config/src/system-config/system-config.module.ts`
- `libs/config/tsconfig.lib.json`

## 必改项清单

1. 将 `SystemConfig` 类型迁移到 `system-config.type.ts`。
2. 服务层可预期失败改用 DTO 校验或 `BusinessException`。
3. 配置 DTO 枚举描述去掉技术 key，改用中文业务语义。
4. 将复杂配置 helper 类型命名并收敛到 owner type 文件。

## 优化建议清单

1. 方法级 JSDoc 批量改成紧邻行注释。
2. 导出常量对象逐字段补齐语义注释。
3. 清理 `ConfigAllowedTemplate` 的重复注释。

## 合规率总结

- 本模块按校验点统计合规率：43 / 50 = 86.00%
- 按已读文件统计：8 个文件未发现明确违规，6 个文件存在至少 1 项违规
- 结论：`libs/config` 存在中等级规范问题，建议修复后复核。
