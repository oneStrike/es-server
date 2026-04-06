# app-api auth 模块改造任务清单

生成时间：2026-04-06（Asia/Shanghai）

## 目标

- 将本轮 code review 中确认的 `apps/app-api/src/modules/auth` 风险点收敛成可执行的改造清单。
- 优先处理会影响安全语义、并发一致性和回归验证的问题。
- 为后续实施、拆分工单和验收提供单一本地事实源。

## 输入来源

- Review finding 1：
  - `apps/app-api/src/modules/auth/password.service.spec.ts:26`
- Review finding 2：
  - `apps/app-api/src/modules/auth/auth.service.ts:73-111`
- Review finding 3：
  - `apps/app-api/src/modules/auth/auth.service.ts:228`
- Review finding 4：
  - `apps/app-api/src/modules/auth/auth.service.spec.ts:48`

## 改造范围

- `apps/app-api/src/modules/auth/auth.service.ts`
- `apps/app-api/src/modules/auth/password.service.ts`
- `apps/app-api/src/modules/auth/auth.service.spec.ts`
- `apps/app-api/src/modules/auth/password.service.spec.ts`
- 视实现方式可能波及：
  - `apps/app-api/src/modules/auth/auth.constant.ts`
  - `apps/app-api/src/modules/auth/token-storage.service.ts`
  - `apps/app-api/src/modules/auth/auth.module.ts`

## 任务清单

### P0-01 修复 auth 模块失效单测并补齐可运行回归

目标

- 让 `auth.service.spec.ts` 和 `password.service.spec.ts` 重新可运行。
- 把当前 review 命中的关键路径补成真实可执行的回归保护，而不是仅有文件存在。

范围

- `apps/app-api/src/modules/auth/auth.service.spec.ts`
- `apps/app-api/src/modules/auth/password.service.spec.ts`

当前问题

- 测试仍在 mock 已失效的 `@libs/user/core`。
- Jest 在装载测试文件阶段就失败，断言没有真正执行。

主要改动

- 把失效 alias 调整为当前仓库可解析的导入路径。
- 收敛 mock 结构，避免继续依赖历史导出入口。
- 补齐至少以下回归用例：
  - 验证码注册时，验证码失败应在写库前终止。
  - 验证码找回密码时，验证码失败应在改密前终止。
  - 密码登录时，RSA 解密失败应进入统一失败口径。
  - 注册时账号冲突/重试逻辑应有可验证覆盖。

完成标准

- `auth.service.spec.ts` 可独立运行通过。
- `password.service.spec.ts` 可独立运行通过。
- 新增或调整后的断言能够覆盖本轮 review 的 P1 风险路径。

建议验证

- `pnpm test -- --runInBand apps/app-api/src/modules/auth/auth.service.spec.ts`
- `pnpm test -- --runInBand apps/app-api/src/modules/auth/password.service.spec.ts`

### P0-02 收敛 app 端密码登录的解密失败语义

目标

- 让 app 端密码登录与 admin 端保持一致的失败处理口径。
- 防止非法密文绕过失败计数和锁定策略。

范围

- `apps/app-api/src/modules/auth/auth.service.ts`
- 如有必要，补充 `apps/app-api/src/modules/auth/auth.constant.ts`

当前问题

- `rsaService.decryptWith()` 直接抛错时，会返回“密码解密失败”。
- 该分支不会调用 `loginGuardService.recordFail(...)`。
- 对外错误语义与密码错误分支不一致，也会绕过锁定计数。

主要改动

- 为密码登录分支补充与 admin 端对齐的 `try/catch`。
- 将解密失败收敛到与密码错误相同的失败计数和锁定路径。
- 复用现有 `loginGuardService.recordFail(...)` 的剩余次数提示和锁定提示语义。
- 成功登录后继续保留清理失败历史的现有语义。

完成标准

- 非法密文会进入与错误密码相同的失败计数和锁定流程。
- 非法密文与错误密码复用现有剩余次数提示 / 锁定提示语义。
- 非法密文会记入失败次数。
- 达到阈值后仍能触发既有锁定逻辑。

建议验证

- `pnpm test -- --runInBand apps/app-api/src/modules/auth/auth.service.spec.ts`
- `pnpm exec tsc -p apps/app-api/tsconfig.app.json --noEmit --pretty false`

### P0-03 消除注册流程里的账号生成并发撞号窗口

目标

- 去掉 `register()` 中事务外的账号唯一性预检查窗口。
- 让账号生成逻辑满足仓库里“开启事务后继续透传 tx”的约束。

范围

- `apps/app-api/src/modules/auth/auth.service.ts`

当前问题

- `generateUniqueAccount()` 通过 `this.db` 在事务外做查询。
- 并发注册时，即使前置查询未命中，也可能在 insert 阶段撞到数据库唯一约束。
- 当前行为更接近“碰撞后抛数据库异常”，而不是稳定业务重试。

主要改动

- 把账号生成逻辑收敛到事务上下文内，满足“开启事务后继续透传 tx”的约束。
- 不将“事务内预检查”视为唯一兜底手段；最终仍由数据库唯一约束作为最后防线。
- 如果 insert 命中账号唯一约束，需要基于原始错误码 / 约束信息做有限次数重试，或转换为明确业务失败。
- 若走重试路径，不要先经过会丢失原始错误类型的通用包装。
- 避免无限递归和不受控重试，并明确最大重试次数。
- 保持 `profileService.initUserProfile(tx, userId)` 继续复用同一事务。

完成标准

- 注册流程不再在事务外做账号唯一性查询。
- 并发撞号时由数据库唯一约束兜底，并具备稳定的重试或失败语义，而不是裸数据库异常泄露。
- 账号生成、插入和后续资料初始化之间的事务边界清晰且可追踪。
- 相关逻辑有对应单测覆盖。

建议验证

- `pnpm test -- --runInBand apps/app-api/src/modules/auth/auth.service.spec.ts`
- `pnpm exec tsc -p apps/app-api/tsconfig.app.json --noEmit --pretty false`

### P1-01 收紧 auth 模块类型与 DI 组织

目标

- 解决当前 auth 模块中遗留的 `any`、重复 provider 和死代码问题。
- 让模块组织更符合仓库的 NestJS / TypeScript / Drizzle 规范。

范围

- `apps/app-api/src/modules/auth/auth.service.ts`
- `apps/app-api/src/modules/auth/token-storage.service.ts`
- `apps/app-api/src/modules/auth/auth.module.ts`
- `apps/app-api/src/modules/auth/password.service.ts`

当前可优化点

- `handleLoginSuccess()`、`sanitizeUser()` 仍使用 `any`。
- `AppTokenStorageService` 以 `useClass` 形式重复注册。
- `PasswordService.findUserByPhone()` 当前未被使用。

主要改动

- 复用 `@db/schema` 中的推导类型，替换 `any`。
- 评估 `AuthModule` 中 `ITokenStorageService` 的提供方式，尽量收敛为单实现来源。
- 删除未使用私有方法或在确认后复用它，避免死代码漂移。

完成标准

- auth 模块核心路径不再新增 `any` 类型逃逸。
- `AuthModule` 的 token storage provider 组织清晰，没有重复注册带来的歧义。
- 无未使用的本地私有方法残留。

建议验证

- `pnpm exec tsc -p apps/app-api/tsconfig.app.json --noEmit --pretty false`
- `pnpm test -- --runInBand apps/app-api/src/modules/auth/auth.service.spec.ts apps/app-api/src/modules/auth/password.service.spec.ts`
- `pnpm exec eslint apps/app-api/src/modules/auth/auth.service.ts apps/app-api/src/modules/auth/password.service.ts apps/app-api/src/modules/auth/auth.module.ts apps/app-api/src/modules/auth/token-storage.service.ts apps/app-api/src/modules/auth/auth.service.spec.ts apps/app-api/src/modules/auth/password.service.spec.ts`

## 建议执行顺序

1. 先做 `P0-01`，让测试恢复可运行，后续改动才有回归支撑。
2. 再做 `P0-02`，优先补上登录安全口径。
3. 接着做 `P0-03`，处理注册并发一致性问题。
4. 最后做 `P1-01`，把类型和模块组织顺手收口。

## 验收口径

- `apps/app-api/src/modules/auth` 相关单测可运行且通过。
- `app-api` 的 targeted TypeScript 编译通过。
- `auth` 模块涉及的 service / module / spec 文件通过 targeted ESLint 校验。
- 登录失败、改密、注册这 3 条关键路径的错误语义与现有规范一致。
- 不引入新的 DTO 分叉、事务边界漂移或类型逃逸。

## 备注

- 本文档是改造任务清单，不直接替代实现方案或 PR 描述。
- 如果后续决定拆成多张工单，建议以 `P0-01 ~ P1-01` 为最小拆分单位。
