# libs/moderation 代码规范审查报告

## 审查概览

- 审查模块：`libs/moderation`
- 审查文件数：14
- 读取范围：`libs/moderation/sensitive-word/src/**`、`libs/moderation/tsconfig.lib.json`
- 适用规范总条数：61
- 合规条数：52
- 违规条数：9
- 风险分布：CRITICAL 0 / HIGH 0 / MEDIUM 6 / LOW 3

## 规范条款逐条校验汇总

| 规范条款                                          | 校验结果 | 证据                                                         |
| ------------------------------------------------- | -------- | ------------------------------------------------------------ |
| 类型文件命名必须为 `*.type.ts`，禁止 `*.types.ts` | 违规     | `sensitive-word.types.ts`                                    |
| 纯类型定义应放在 `*.type.ts`                      | 违规     | `sensitive-word-cache.service.ts:14`                         |
| service 方法签名不得使用内联对象类型              | 违规     | `sensitive-word.service.ts:90`                               |
| DTO 对外契约必须可被 Swagger/校验准确表达         | 违规     | `sensitive-word.dto.ts:339-342` 使用 `Object` 与 union array |
| 方法注释使用简短行注释，不用 JSDoc 方法块         | 违规     | `sensitive-word-statistics.service.ts:44`、`:91`、`:102` 等  |
| 动态字段访问应保持类型可验证                      | 违规     | `sensitive-word.service.ts:48-50`                            |
| 性能敏感算法需与 DTO 输入上限匹配                 | 违规     | `sensitive-word.dto.ts:183`、`utils/fuzzy-matcher.ts:89-98`  |
| 缓存失败降级路径应保留可观测性                    | 违规     | `sensitive-word-detect.service.ts:170-176`                   |
| 导出枚举成员应有业务注释                          | 合规     | `sensitive-word-constant.ts` 枚举成员均有中文注释            |
| module/provider 边界清晰                          | 合规     | `sensitive-word.module.ts` 只注册敏感词服务族                |

## 按文件/模块拆分的详细违规清单

### sensitive-word/src/sensitive-word.types.ts

[MEDIUM] 类型文件命名违反 `*.type.ts` 规范

- 位置：`libs/moderation/sensitive-word/src/sensitive-word.types.ts`
- 对应规范：类型规范 1.2，纯类型文件必须命名为 `*.type.ts`，不得使用 `*.types.ts`
- 违规原因：该文件集中定义 `SensitiveWordHitFieldKey`、`SensitiveWordDetectedHit`、`CacheQueryConfig` 等类型，却使用了被规范禁止的 `.types.ts` 后缀。
- 整改建议：重命名为 `sensitive-word.type.ts`，同步修正所有 `./sensitive-word.types` 导入。

### sensitive-word/src/sensitive-word-cache.service.ts

[MEDIUM] service 文件内声明顶层类型别名

- 位置：`libs/moderation/sensitive-word/src/sensitive-word-cache.service.ts:14`
- 对应规范：类型规范 2.1，service/controller/module 文件不得承载纯类型定义
- 违规原因：`type SensitiveWord = typeof sensitiveWord.$inferSelect` 是纯类型别名，却声明在 service 实现文件内。
- 整改建议：移动到敏感词类型文件，并在 service 中以 type import 引入。

### sensitive-word/src/sensitive-word.service.ts

[MEDIUM] 删除方法参数使用内联对象类型

- 位置：`libs/moderation/sensitive-word/src/sensitive-word.service.ts:90`
- 对应规范：类型规范 2.2，复杂方法签名不得直接声明对象字面量类型
- 违规原因：`deleteSensitiveWord(dto: { id: number })` 与项目已有 `IdDto` / DTO 复用方式不一致。
- 整改建议：改为复用 `IdDto`，或定义 `DeleteSensitiveWordDto` 后在方法签名中使用命名类型。

[MEDIUM] 查询条件动态字段访问削弱类型安全

- 位置：`libs/moderation/sensitive-word/src/sensitive-word.service.ts:48-50`
- 对应规范：类型规范与工程风格，避免用宽泛字符串动态索引 DTO/table 对象
- 违规原因：`['isEnabled', 'level', 'type', 'matchMode'].forEach((key) => dto[key])` 依赖运行时字符串访问，字段名改动时编译器难以准确保护查询条件。
- 整改建议：将字段数组声明为 `const filterKeys = [...] as const`，并为 `key` 建立受限联合类型；或逐字段显式构建条件。

### sensitive-word/src/dto/sensitive-word.dto.ts

[MEDIUM] 统计响应 data 使用 `Object` 作为 itemClass，Swagger 契约不准确

- 位置：`libs/moderation/sensitive-word/src/dto/sensitive-word.dto.ts:339-342`
- 对应规范：DTO 规范，数组和嵌套字段应给出可识别的 DTO 类型，避免退化为 `Object`
- 违规原因：`data` 实际是多种统计 DTO 的 union，但 `ArrayProperty` 只声明 `itemClass: Object`，生成的接口文档无法表达真实结构。
- 整改建议：拆分不同统计响应 DTO，或定义稳定的统一统计项 DTO；如果必须保留 union，需要提供显式 discriminator/oneOf 支持。

[MEDIUM] 检测内容上限与模糊匹配复杂度组合存在性能隐患

- 位置：`libs/moderation/sensitive-word/src/dto/sensitive-word.dto.ts:183`
- 对应规范：性能规范，输入上限应与最坏路径算法复杂度匹配
- 违规原因：DTO 允许 `content` 长度达到 10000，模糊匹配路径会对文本窗口反复执行 BK-Tree 搜索，长文本和大量模糊词同时出现时存在明显 CPU 压力。
- 整改建议：根据线上词库规模重新评估 `maxLength`；为模糊模式增加更严格长度限制、超时/分片策略，或在检测服务中按文本长度禁用模糊路径。

### sensitive-word/src/sensitive-word-detect.service.ts

[MEDIUM] `loadWordsWithFallback` 参数使用内联对象类型

- 位置：`libs/moderation/sensitive-word/src/sensitive-word-detect.service.ts:162`
- 对应规范：类型规范 2.2，方法签名内联对象类型应抽取命名类型
- 违规原因：`options: { preloadCache?: boolean } = {}` 直接在私有方法签名声明对象类型，和模块内已经存在的类型抽取方式不一致。
- 整改建议：抽取 `LoadSensitiveWordsOptions` 到类型文件并复用。

[LOW] 缓存降级 catch 未记录失败原因

- 位置：`libs/moderation/sensitive-word/src/sensitive-word-detect.service.ts:170-176`
- 对应规范：错误处理与可观测性，降级路径应保留排障证据
- 违规原因：缓存预热或读取失败后直接回退数据库直读，逻辑上可接受，但完全吞掉异常会导致 Redis/缓存链路故障难以定位。
- 整改建议：接入项目统一 logger，至少记录一次降级原因与敏感词加载路径。

### sensitive-word/src/sensitive-word-statistics.service.ts

[LOW] 多个方法使用 JSDoc 块作为方法注释

- 位置：`libs/moderation/sensitive-word/src/sensitive-word-statistics.service.ts:44`、`:91`、`:102`、`:114`、`:126`、`:138`、`:152`、`:162`、`:172`、`:182`、`:205`、`:228`、`:256`、`:284`
- 对应规范：注释规范 1.1，方法注释应使用简短紧邻行注释，方法上不使用 JSDoc 块
- 违规原因：统计服务大量方法使用多行 JSDoc 和 `@returns`，与项目当前方法注释规范不一致。
- 整改建议：将方法前 JSDoc 简化为单行或两行 `//` 中文说明，保留真正有额外约束价值的信息。

### sensitive-word/src/utils/fuzzy-matcher.ts

[MEDIUM] 模糊匹配路径存在长文本 CPU 放大风险

- 位置：`libs/moderation/sensitive-word/src/utils/fuzzy-matcher.ts:89-98`、`:133-142`
- 对应规范：性能规范，核心算法应控制最坏情况复杂度
- 违规原因：`matchWithBKTree` 对每个起点和窗口终点都调用 `bkTree.search`，暴力路径也会按每个词滑窗计算 Levenshtein。结合 DTO 10000 字输入上限，大词库情况下可能阻塞请求线程。
- 整改建议：增加最大可检测长度、最大词库规模保护、分批异步处理，或对长文本只启用 AC 精确匹配；同时补充基准测试确定阈值。

## 文件逐份审查结论

| 文件                                                                      | 结论                                     |
| ------------------------------------------------------------------------- | ---------------------------------------- |
| `libs/moderation/sensitive-word/src/dto/sensitive-word.dto.ts`            | 已读，发现统计响应契约与输入上限性能问题 |
| `libs/moderation/sensitive-word/src/sensitive-word-cache.constant.ts`     | 已读，未发现本轮适用规范违规             |
| `libs/moderation/sensitive-word/src/sensitive-word-cache.service.ts`      | 已读，发现 service 内顶层类型问题        |
| `libs/moderation/sensitive-word/src/sensitive-word-constant.ts`           | 已读，未发现本轮适用规范违规             |
| `libs/moderation/sensitive-word/src/sensitive-word-detect.service.ts`     | 已读，发现内联类型与降级可观测性问题     |
| `libs/moderation/sensitive-word/src/sensitive-word-statistics.service.ts` | 已读，发现方法注释风格问题               |
| `libs/moderation/sensitive-word/src/sensitive-word.module.ts`             | 已读，未发现本轮适用规范违规             |
| `libs/moderation/sensitive-word/src/sensitive-word.service.ts`            | 已读，发现内联参数与动态索引问题         |
| `libs/moderation/sensitive-word/src/sensitive-word.types.ts`              | 已读，发现文件命名违规                   |
| `libs/moderation/sensitive-word/src/utils/ac-automaton.ts`                | 已读，未发现本轮适用规范违规             |
| `libs/moderation/sensitive-word/src/utils/bk-tree.ts`                     | 已读，未发现本轮适用规范违规             |
| `libs/moderation/sensitive-word/src/utils/fuzzy-matcher.ts`               | 已读，发现长文本模糊匹配性能风险         |
| `libs/moderation/sensitive-word/src/utils/trie-node.ts`                   | 已读，未发现本轮适用规范违规             |
| `libs/moderation/tsconfig.lib.json`                                       | 已读，未发现本轮适用规范违规             |

## 整体合规率总结

- 合规率：85.25%
- 主要问题集中在类型文件命名、方法签名类型抽取、DTO 文档契约准确性和敏感词模糊匹配性能边界。

## 必改项清单

1. 将 `sensitive-word.types.ts` 重命名为 `sensitive-word.type.ts` 并修正所有导入。
2. 抽取 `deleteSensitiveWord` 与 `loadWordsWithFallback` 的内联对象类型。
3. 修正统计响应 `data` 的 DTO 表达，避免 Swagger 中退化成 `Object[]`。

## 优化建议清单

1. 为模糊匹配补充长文本/大词库基准测试，并加上运行时保护阈值。
2. 缓存降级路径记录日志，便于定位 Redis 或缓存服务故障。
3. 将统计服务方法 JSDoc 简化为项目统一的行注释风格。
