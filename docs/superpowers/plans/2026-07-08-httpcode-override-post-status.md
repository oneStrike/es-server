# @HttpCode 覆盖全局 POST 状态码归一化 实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）跟踪进度。

**目标：** 让 NestJS 官方 `@HttpCode(xxx)` 装饰器能够覆盖全局 `PostSuccessStatusInterceptor` 的 201→200 归一化行为，同时删除自定义的 `@SkipPostStatusNormalization` 装饰器，并同步更新规范文档。

**架构：** 拦截器在判断是否跳过归一化时，改为读取 NestJS 官方的 `HTTP_CODE_METADATA`（`'__httpCode__'`）元数据。只要 handler 上存在该元数据（即开发者显式使用了 `@HttpCode`），就跳过归一化。删除自定义装饰器文件及其 barrel 导出，同步修正规则文档与破坏性变更文档中的描述。

**技术栈：** NestJS 11、Fastify、RxJS 7、TypeScript

---

## 文件结构

| 文件                                                                       | 职责                         | 操作                       |
| -------------------------------------------------------------------------- | ---------------------------- | -------------------------- |
| `libs/platform/src/interceptors/post-success-status.interceptor.ts`        | 全局 POST 状态码归一化拦截器 | **修改**：替换元数据检测源 |
| `libs/platform/src/decorators/skip-post-status-normalization.decorator.ts` | 自定义跳过装饰器             | **删除**                   |
| `libs/platform/src/decorators/index.ts`                                    | 装饰器 barrel 导出           | **修改**：移除一行导出     |
| `.trae/rules/06-error-handling.md`                                         | 错误处理规范                 | **修改**：第 24-25 行      |
| `.trae/rules/02-controller.md`                                             | Controller 规范              | **修改**：第 31-32 行      |
| `docs/breaking-changes/http-status-string-code.md`                         | 破坏性变更说明               | **修改**：第 23、52 行     |
| `docs/breaking-changes/http-status-string-code-coverage.md`                | 覆盖清单                     | **修改**：第 14、25、27 行 |

**引用关系确认：** `@SkipPostStatusNormalization` 和 `SKIP_POST_STATUS_NORMALIZATION_KEY` 当前仅在 3 个文件中被引用——装饰器文件本身、barrel 导出、拦截器 import。全仓库无任何 controller 使用该装饰器。删除零风险。

---

### 任务 1：修改拦截器，替换元数据检测源

**文件：**

- 修改：`libs/platform/src/interceptors/post-success-status.interceptor.ts`（全文重写）

- [ ] **步骤 1：重写拦截器**

将 `SKIP_POST_STATUS_NORMALIZATION_KEY` 的检测替换为 `HTTP_CODE_METADATA`。当 handler 上存在 `@HttpCode` 元数据时跳过归一化。

```typescript
import type {
  CallHandler,
  ExecutionContext,
  NestInterceptor,
} from '@nestjs/common'
import type { FastifyReply } from 'fastify'
import type { Observable } from 'rxjs'
import { HttpStatus, Injectable } from '@nestjs/common'
import { HTTP_CODE_METADATA } from '@nestjs/common/constants'
import { Reflector } from '@nestjs/core'
import { tap } from 'rxjs'

@Injectable()
export class PostSuccessStatusInterceptor implements NestInterceptor {
  /** 缓存 handler → 是否跳过的映射，避免每次请求都走 Reflect.getMetadata */
  private readonly skipCache = new WeakMap<
    (...args: unknown[]) => unknown,
    boolean
  >()

  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle()
    }

    const http = context.switchToHttp()
    const request = http.getRequest<{ method?: string }>()
    if (request.method !== 'POST') {
      return next.handle()
    }

    const handler = context.getHandler() as (...args: unknown[]) => unknown
    let shouldSkip = this.skipCache.get(handler)
    if (shouldSkip === undefined) {
      shouldSkip = this.reflector.get(HTTP_CODE_METADATA, handler) !== undefined
      this.skipCache.set(handler, shouldSkip)
    }
    if (shouldSkip) {
      return next.handle()
    }

    const response = http.getResponse<FastifyReply & { statusCode: number }>()

    return next.handle().pipe(
      tap(() => {
        if (response.statusCode === HttpStatus.CREATED) {
          response.code(HttpStatus.OK)
        }
      }),
    )
  }
}
```

**关键变化点：**

1. 移除 `import { SKIP_POST_STATUS_NORMALIZATION_KEY } from '../decorators/skip-post-status-normalization.decorator'`
2. 新增 `import { HTTP_CODE_METADATA } from '@nestjs/common/constants'`
3. 判断逻辑从 `reflector.getAllAndOverride(SKIP_POST_STATUS_NORMALIZATION_KEY, [handler, class])` 改为 `reflector.get(HTTP_CODE_METADATA, handler) !== undefined`
4. 不再需要 `context.getClass()`，因为 `@HttpCode` 只装饰方法，不存在类级语义

- [ ] **步骤 2：运行类型检查与 lint**

运行：`pnpm type-check`
预期：PASS（exit code 0），无类型错误

运行：`pnpm exec eslint libs/platform/src/interceptors/post-success-status.interceptor.ts`
预期：PASS（exit code 0），无 lint 错误

---

### 任务 2：删除自定义装饰器文件并清理 barrel 导出

**文件：**

- 删除：`libs/platform/src/decorators/skip-post-status-normalization.decorator.ts`
- 修改：`libs/platform/src/decorators/index.ts:6`（移除第 6 行）

- [ ] **步骤 1：删除装饰器文件**

删除 `libs/platform/src/decorators/skip-post-status-normalization.decorator.ts` 整个文件。

该文件当前内容为：

```typescript
import { SetMetadata } from '@nestjs/common'

export const SKIP_POST_STATUS_NORMALIZATION_KEY = 'skipPostStatusNormalization'

export const SkipPostStatusNormalization = () =>
  SetMetadata(SKIP_POST_STATUS_NORMALIZATION_KEY, true)
```

- [ ] **步骤 2：移除 barrel 导出**

修改 `libs/platform/src/decorators/index.ts`，删除第 6 行：

```diff
 export * from './api-doc.decorator'
 export * from './api-doc.type'
 export * from './current-user.decorator'
 export * from './current-user.type'
 export * from './public.decorator'
-export * from './skip-post-status-normalization.decorator'
 export * from './validate'
 export * from './validate.decorator'
```

- [ ] **步骤 3：运行类型检查**

运行：`pnpm type-check`
预期：PASS（exit code 0），确认删除后无残留引用导致编译错误

---

### 任务 3：更新错误处理规范

**文件：**

- 修改：`.trae/rules/06-error-handling.md:24-25`

- [ ] **步骤 1：替换第 24-25 行**

将：

```markdown
- 平台层全局将 `POST` 成功响应状态码归一为 `200`；Controller 不再显式书写 `@HttpCode(200)`，Swagger 成功状态也应保持 `200`。
- 若极少数 `POST` 接口必须保留非 `200` 成功状态码，必须通过受控例外显式声明，并同步更新 Swagger 文档与规则说明。
```

替换为：

```markdown
- 平台层全局将未显式声明状态码的 `POST` 成功响应归一为 `200`；Controller 不需要书写 `@HttpCode(200)`。
- 需要保留 `201` 的创建/上传类 `POST` 接口，使用 NestJS 官方 `@HttpCode(201)` 显式声明；Swagger 成功状态也应同步保持一致。
- 禁止用 `@HttpCode(200)` 做冗余声明；未加 `@HttpCode` 的 POST 默认即为 `200`。
```

- [ ] **步骤 2：运行 Markdown 格式检查**

运行：`pnpm exec prettier --check .trae/rules/06-error-handling.md`
预期：PASS

- [ ] **步骤 3：运行类型检查（规则文档改动基线验证）**

运行：`pnpm type-check`
预期：PASS（exit code 0）

---

### 任务 4：更新 Controller 规范

**文件：**

- 修改：`.trae/rules/02-controller.md:31-32`

- [ ] **步骤 1：替换第 31-32 行**

将：

```markdown
- 项目通过平台层全局拦截器统一将 `POST` 成功响应状态码归一为 `200`；Controller 不再重复书写 `@HttpCode(200)`。
- 若极少数 `POST` 接口必须保留非 `200` 成功状态码，必须显式标注例外并同步更新 Swagger 文档，禁止静默绕过全局约定。
```

替换为：

```markdown
- 项目通过平台层全局拦截器将未显式声明状态码的 `POST` 成功响应归一为 `200`；Controller 不需要书写 `@HttpCode(200)`。
- 创建/上传类 `POST` 接口需要保留 `201` 时，使用 `@HttpCode(201)` 显式声明，并同步 Swagger `successStatus: 201`。
```

- [ ] **步骤 2：运行 Markdown 格式检查**

运行：`pnpm exec prettier --check .trae/rules/02-controller.md`
预期：PASS

- [ ] **步骤 3：运行类型检查（规则文档改动基线验证）**

运行：`pnpm type-check`
预期：PASS（exit code 0）

---

### 任务 5：更新破坏性变更说明文档

**文件：**

- 修改：`docs/breaking-changes/http-status-string-code.md:23,52`

- [ ] **步骤 1：替换第 23 行**

将：

```markdown
- 非创建语义的 POST action 显式返回 HTTP 200；创建或上传语义 POST 保留 HTTP 201。
```

替换为：

```markdown
- 非创建语义的 POST action 默认返回 HTTP 200（由全局拦截器归一化）；创建或上传语义 POST 通过 `@HttpCode(201)` 显式保留 HTTP 201。
```

- [ ] **步骤 2：替换第 52 行**

将：

```markdown
- 新增非创建 POST action 必须加 `@HttpCode(200)`。
```

替换为：

```markdown
- 新增非创建 POST action 不需要加 `@HttpCode(200)`，全局拦截器自动归一化。
- 新增创建或上传 POST action 必须加 `@HttpCode(201)` 显式保留 201。
```

- [ ] **步骤 3：运行 Markdown 格式检查**

运行：`pnpm exec prettier --check docs/breaking-changes/http-status-string-code.md`
预期：PASS

---

### 任务 6：更新覆盖清单文档

**文件：**

- 修改：`docs/breaking-changes/http-status-string-code-coverage.md:14,25,27`

- [ ] **步骤 1：替换第 14 行**

将：

```markdown
| `apps/*/**/*.controller.ts` | 233 个非创建 POST action 加 `@HttpCode(200)`；创建、上传与归档会话类 POST 保留 201。 |
```

替换为：

```markdown
| `apps/*/**/*.controller.ts` | 非创建 POST action 不加 `@HttpCode`，由全局拦截器归一为 200；创建/上传类 POST 加 `@HttpCode(201)` 显式保留 201。 |
```

- [ ] **步骤 2：替换第 25 行**

将：

```markdown
| 非创建 POST action | 覆盖脚本确认无缺失 `@HttpCode(200)` 的非创建 POST。 |
```

替换为：

```markdown
| 非创建 POST action | 覆盖脚本确认非创建 POST 未使用 `@HttpCode(200)` 冗余声明。 |
```

- [ ] **步骤 3：替换第 27 行**

将：

```markdown
| `@HttpCode` import | 覆盖脚本确认所有使用 `@HttpCode` 的 controller 都已从 `@nestjs/common` 导入。 |
```

替换为：

```markdown
| `@HttpCode` import | 覆盖脚本确认所有使用 `@HttpCode(201)` 的 controller 都已从 `@nestjs/common` 导入。 |
```

- [ ] **步骤 4：运行 Markdown 格式检查**

运行：`pnpm exec prettier --check docs/breaking-changes/http-status-string-code-coverage.md`
预期：PASS

- [ ] **步骤 5：扫描验证文档声明**

运行：`rg "@HttpCode" apps/ --glob "*.ts"`
预期：0 匹配（当前仓库无任何 controller 使用 `@HttpCode`，与新文档声明一致）

---

### 任务 7：最终验证与提交

- [ ] **步骤 1：全量类型检查与 lint**

运行：`pnpm type-check`
预期：PASS（exit code 0）

运行：`pnpm exec eslint libs/platform/src/interceptors/post-success-status.interceptor.ts libs/platform/src/decorators/index.ts`
预期：PASS（exit code 0）

- [ ] **步骤 2：确认无残留引用**

搜索全仓库（排除 `.history/`），确认不存在以下任何字符串：

- `SKIP_POST_STATUS_NORMALIZATION`
- `SkipPostStatusNormalization`
- `skipPostStatusNormalization`
- `skip-post-status-normalization`

运行：在 `apps/`、`libs/`、`db/` 目录中搜索上述字符串
预期：0 匹配

- [ ] **步骤 3：Commit**

```bash
git add libs/platform/src/interceptors/post-success-status.interceptor.ts libs/platform/src/decorators/index.ts libs/platform/src/decorators/skip-post-status-normalization.decorator.ts .trae/rules/06-error-handling.md .trae/rules/02-controller.md docs/breaking-changes/http-status-string-code.md docs/breaking-changes/http-status-string-code-coverage.md
git commit -m "refactor(platform): 用 @HttpCode 替代自定义跳过装饰器

- PostSuccessStatusInterceptor 改为检测 HTTP_CODE_METADATA 元数据
- 删除 @SkipPostStatusNormalization 装饰器及其 barrel 导出
- 同步更新 06-error-handling.md 与 02-controller.md 规范
- 同步更新 breaking-changes 文档描述

开发者现在可以用 NestJS 官方 @HttpCode(201) 覆盖全局 201→200 归一化。"
```

---

## 自检

### 1. 规格覆盖度

| 需求                                      | 对应任务  |
| ----------------------------------------- | --------- |
| 拦截器增加 `@HttpCode` 检测               | 任务 1    |
| 删除 `SkipPostStatusNormalization` 装饰器 | 任务 2    |
| 清理 barrel 导出                          | 任务 2    |
| 调整规范文档                              | 任务 3、4 |
| 调整破坏性变更文档                        | 任务 5、6 |
| 验证与提交                                | 任务 7    |

无遗漏。

### 2. 占位符扫描

无 "TODO"、"待定"、"类似任务 N" 等占位符。每个步骤均包含完整代码或精确命令。

### 3. 类型一致性

- `HTTP_CODE_METADATA` 来自 `@nestjs/common/constants`，已在 `node_modules/@nestjs/common/constants.d.ts` 中确认导出
- `reflector.get(HTTP_CODE_METADATA, handler)` 返回 `number | undefined`，与 `!== undefined` 判断一致
- `skipCache` 的 value 类型仍为 `boolean`，无需改变
- 删除文件后 barrel 导出无断裂，因为全仓库无 controller 引用 `SkipPostStatusNormalization`
