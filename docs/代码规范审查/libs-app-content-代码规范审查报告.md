# libs/app-content 模块代码规范审查报告

## 审查概览

- 审查模块：`libs/app-content`
- 已读源码/配置文件：20 个
- 规范来源总数：10 份
- 本模块适用校验点：51 项
- 已闭合校验点：51 项
- 合规校验点：40 项
- 违规校验点：11 项

### 风险分布

- HIGH：0
- MEDIUM：9
- LOW：2

## 规范条款逐条校验汇总

| 规范来源                  | 本模块适用校验点 | 结论                                          |
| ------------------------- | ---------------: | --------------------------------------------- |
| `01-import-boundaries.md` |                7 | 导入基本直连 owner 文件                       |
| `03-dto.md`               |                7 | 发现 DTO 描述暴露技术 key                     |
| `04-typescript-types.md`  |               11 | 发现内联对象/泛型类型和 service 内 type alias |
| `05-comments.md`          |                9 | 发现枚举成员注释、方法注释形式问题            |
| `06-error-handling.md`    |                5 | 发现 service 内 HTTP 异常表达参数失败         |
| `07-drizzle.md`           |                7 | 未发现明确 Drizzle 查询构造违规               |
| `08-testing.md`           |                5 | 现有 spec 保留，未发现删除长期测试资产        |

## 详细违规清单

### MEDIUM

#### M-01 方法签名中直接书写复杂泛型/对象类型

- 文件位置：
  - `libs/app-content/src/agreement/agreement.service.ts:62`
  - `libs/app-content/src/agreement/agreement.service.ts:175`
  - `libs/app-content/src/announcement/announcement.constant.ts:60`
  - `libs/app-content/src/announcement/announcement.constant.ts:78`
  - `libs/app-content/src/announcement/announcement-notification-fanout.service.ts:379`
  - `libs/app-content/src/announcement/announcement-notification-fanout.service.ts:402`
  - `libs/app-content/src/announcement/announcement-notification-fanout.service.ts:437`
- 对应规范：`04-typescript-types.md`，方法/函数签名中的复杂类型表达式必须先在 `*.type.ts` 中命名后引用
- 违规原因：签名中直接使用 `T extends { ... }`、`options?: { ... }`、`input: { ... }`、`params: { ... }`、泛型 helper
- 整改建议：新增或复用 owner `*.type.ts`，如 `PublishedAgreementView`、`PublishedOnlyOption`、`AnnouncementFanoutContext`

#### M-02 服务层使用 HTTP 异常表达可预期参数失败

- 文件位置：
  - `libs/app-content/src/announcement/announcement.service.ts:369`
  - `libs/app-content/src/announcement/announcement.service.ts:373`
  - `libs/app-content/src/announcement/announcement.service.ts:382`
  - `libs/app-content/src/page/page.service.ts:190`
  - `libs/app-content/src/page/page.service.ts:194`
  - `libs/app-content/src/page/page.service.ts:203`
- 对应规范：`06-error-handling.md`，Service 对可预期业务失败抛 `BusinessException`；协议层参数错误应由 DTO/ValidationPipe 收口
- 违规原因：平台筛选 JSON 非法或枚举值非法时直接抛 `BadRequestException`
- 整改建议：把查询参数收敛为 DTO 校验；若保留 service 校验，改用 `BusinessException` 和共享错误码

#### M-03 DTO 描述直接暴露技术 key / 协议格式

- 文件位置：
  - `libs/app-content/src/announcement/dto/announcement.dto.ts:96`
  - `libs/app-content/src/announcement/dto/announcement.dto.ts:180`
  - `libs/app-content/src/page/dto/page.dto.ts:105`
  - `libs/app-content/src/update/dto/update.dto.ts:78`
  - `libs/app-content/src/update/dto/update.dto.ts:119`
- 对应规范：`03-dto.md` 枚举字段描述规范，描述必须使用中文业务语义，不允许直接写英文常量名、技术 key 或旧字符串枚举值
- 违规原因：描述中直接出现 `CSS background-position`、`center`、`UPLOAD`、`URL`、`CUSTOM`、`JSON` 等技术值
- 整改建议：描述改为中文业务语义，技术值放在 `example` 或由 enum/校验层表达

#### M-04 导出枚举成员缺少逐项注释

- 文件位置：
  - `libs/app-content/src/update/update.constant.ts:4`
  - `libs/app-content/src/update/update.constant.ts:5`
  - `libs/app-content/src/update/update.constant.ts:12`
  - `libs/app-content/src/update/update.constant.ts:13`
  - `libs/app-content/src/update/update.constant.ts:21`
  - `libs/app-content/src/update/update.constant.ts:22`
- 对应规范：`05-comments.md`，导出枚举的每一个成员都必须有紧邻注释
- 违规原因：`AppUpdatePlatformEnum`、`AppUpdatePackageSourceEnum`、`AppUpdateTypeEnum` 只给枚举整体写了说明，成员无逐项业务语义注释
- 整改建议：为每个成员补中文注释，例如 `// iOS 客户端。`

#### M-05 service 文件内声明顶层类型别名

- 文件位置：`libs/app-content/src/update/update.service.ts:33`
- 对应规范：`04-typescript-types.md`，禁止在 `*.type.ts` 之外的业务文件中声明顶层 `type` / `interface`
- 违规原因：`AppUpdateReleaseRecord` 在 service 文件中声明
- 整改建议：移入 `update.type.ts`，service 仅 `import type`

#### M-06 fanout 服务方法缺少方法级行注释

- 文件位置：
  - `libs/app-content/src/announcement/announcement-notification-fanout.service.ts:95`
  - `libs/app-content/src/announcement/announcement-notification-fanout.service.ts:106`
  - `libs/app-content/src/announcement/announcement-notification-fanout.service.ts:189`
  - `libs/app-content/src/announcement/announcement-notification-fanout.service.ts:231`
  - `libs/app-content/src/announcement/announcement-notification-fanout.service.ts:255`
  - `libs/app-content/src/announcement/announcement-notification-fanout.worker.ts:12`
- 对应规范：`05-comments.md`，所有方法定义前都必须有简短注释，方法注释使用紧邻行注释
- 违规原因：fanout 核心任务消费、游标推进、状态标记等方法缺少方法用途注释
- 整改建议：为每个任务生命周期方法补紧邻中文行注释，说明幂等/重试/游标语义

#### M-07 方法注释大量使用 JSDoc

- 文件位置示例：
  - `libs/app-content/src/agreement/agreement.service.ts:34`
  - `libs/app-content/src/announcement/announcement.service.ts:38`
  - `libs/app-content/src/page/page.service.ts:36`
  - `libs/app-content/src/update/update.service.ts:53`
- 对应规范：`05-comments.md`，方法注释统一使用紧邻方法定义的行注释，不使用 JSDoc
- 违规原因：service 方法普遍使用 `/** ... */`
- 整改建议：方法级说明改成紧邻 `//` 行注释

#### M-08 更新服务使用类型断言替代返回类型收敛

- 文件位置：`libs/app-content/src/update/update.service.ts:300`、`libs/app-content/src/update/update.service.ts:319`、`libs/app-content/src/update/update.service.ts:462`
- 对应规范：`04-typescript-types.md`，优先通过 owner type / DTO 收敛类型，不用断言掩盖真实结构
- 违规原因：查询结果和详情映射用 `as AppUpdateReleaseRecord`、`as AppUpdateReleaseDetailDto`
- 整改建议：基于 Drizzle select 类型定义明确返回类型，或用 mapper 显式构造 DTO

#### M-09 公告常量文件使用三斜线普通注释描述枚举

- 文件位置：`libs/app-content/src/announcement/announcement.constant.ts:5`、`libs/app-content/src/announcement/announcement.constant.ts:19`、`libs/app-content/src/announcement/announcement.constant.ts:31`
- 对应规范：`05-comments.md`，导出稳定符号和枚举优先使用 JSDoc；方法/局部说明使用行注释
- 违规原因：导出枚举整体说明使用 `///`，与仓库注释形式不一致
- 整改建议：改为 JSDoc 描述枚举整体语义，保留成员紧邻注释

### LOW

#### L-01 测试 helper 使用内联函数类型

- 文件位置：`libs/app-content/src/announcement/announcement.service.spec.ts:19`
- 对应规范：`04-typescript-types.md`，函数签名中复杂类型应命名后引用
- 违规原因：测试 helper 直接写 `fn: (db: typeof tx) => unknown`
- 整改建议：定义本地命名测试类型，或使用更小的 mock interface

#### L-02 安装包地址字段描述混用业务语义和技术枚举名

- 文件位置：`libs/app-content/src/update/dto/update.dto.ts:78`
- 对应规范：`03-dto.md`，DTO 描述应使用中文业务语义
- 违规原因：字段描述把 `UPLOAD`、`URL`、`CUSTOM` 写进正文，和枚举元数据重复
- 整改建议：正文只描述“上传文件地址、外部下载地址、外部中转页地址”，技术值交给 enum/example

## 逐文件审查结论

### 发现违规的文件

| 文件                                                                            | 结论                  |
| ------------------------------------------------------------------------------- | --------------------- |
| `libs/app-content/src/agreement/agreement.service.ts`                           | 发现 M-01、M-07       |
| `libs/app-content/src/announcement/announcement-notification-fanout.service.ts` | 发现 M-01、M-06       |
| `libs/app-content/src/announcement/announcement-notification-fanout.worker.ts`  | 发现 M-06             |
| `libs/app-content/src/announcement/announcement.constant.ts`                    | 发现 M-01、M-09       |
| `libs/app-content/src/announcement/announcement.service.spec.ts`                | 发现 L-01             |
| `libs/app-content/src/announcement/announcement.service.ts`                     | 发现 M-02、M-07       |
| `libs/app-content/src/announcement/dto/announcement.dto.ts`                     | 发现 M-03             |
| `libs/app-content/src/page/dto/page.dto.ts`                                     | 发现 M-03             |
| `libs/app-content/src/page/page.service.ts`                                     | 发现 M-02、M-07       |
| `libs/app-content/src/update/dto/update.dto.ts`                                 | 发现 M-03、L-02       |
| `libs/app-content/src/update/update.constant.ts`                                | 发现 M-04             |
| `libs/app-content/src/update/update.service.ts`                                 | 发现 M-05、M-07、M-08 |

### 已读且未发现明确违规的文件

- `libs/app-content/src/agreement/agreement.module.ts`
- `libs/app-content/src/agreement/dto/agreement.dto.ts`
- `libs/app-content/src/announcement/announcement.module.ts`
- `libs/app-content/src/page/page.constant.ts`
- `libs/app-content/src/page/page.module.ts`
- `libs/app-content/src/update/update.module.ts`
- `libs/app-content/src/update/update.service.spec.ts`
- `libs/app-content/tsconfig.lib.json`

## 必改项清单

1. 将 service/constant 中的内联对象类型迁移到 owner `*.type.ts`。
2. 将平台筛选解析错误改为 DTO 校验或 `BusinessException`。
3. 修正 DTO 描述中的技术 key / 枚举值暴露。
4. 为导出枚举成员补齐逐项注释。
5. 将 `AppUpdateReleaseRecord` 移入 type 文件。

## 优化建议清单

1. fanout 任务生命周期方法补齐紧邻行注释。
2. service 方法级 JSDoc 批量改为行注释。
3. 减少 `as XxxDto` 断言，改为显式 mapper。

## 合规率总结

- 本模块按校验点统计合规率：40 / 51 = 78.43%
- 按已读文件统计：8 个文件未发现明确违规，12 个文件存在至少 1 项违规
- 结论：`libs/app-content` 存在多项中等级规范问题，建议修复后复核。
