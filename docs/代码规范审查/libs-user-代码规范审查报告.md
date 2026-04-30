# libs/user 代码规范审查报告

## 审查概览

- 审查模块：`libs/user`
- 审查文件数：14
- 读取范围：`libs/user/src/**`、`libs/user/tsconfig.lib.json`
- 适用规范总条数：57
- 合规条数：53
- 违规条数：4
- 风险分布：CRITICAL 0 / HIGH 0 / MEDIUM 2 / LOW 2

## 规范条款逐条校验汇总

| 规范条款                                                        | 校验结果 | 证据                                                                                |
| --------------------------------------------------------------- | -------- | ----------------------------------------------------------------------------------- |
| `libs/*` 承载可复用业务契约与领域逻辑                           | 合规     | 用户基础信息、计数、状态语义均在共享模块内收敛                                      |
| 类型定义放入 `*.type.ts`                                        | 合规     | `app-user-count.type.ts`、`user.type.ts` 命名与职责匹配                             |
| service/controller/module/dto/constant 文件不得声明顶层业务类型 | 合规     | 未发现违规顶层 type/interface                                                       |
| 方法必须有紧邻简短行注释                                        | 合规     | `AppUserCountService`、`UserService` 主要方法均有说明                               |
| service 预期业务失败使用 `BusinessException`                    | 违规     | `user.service.ts:249` 使用 `ForbiddenException`                                     |
| DTO 字段应表达稳定业务契约，不应退化为裸 number                 | 违规     | `admin-app-user.dto.ts:347` 的 `targetType?: number`                                |
| 测试代码不应通过 `as never` 绕过依赖类型                        | 违规     | `app-user-count.service.spec.ts:15`、`:31`、`:34`，`user.service.spec.ts:19`、`:22` |
| DTO 字段描述应为中文业务语义                                    | 合规     | `dto/*.dto.ts` 字段说明基本为中文业务说明                                           |
| 枚举成员与导出常量应有注释                                      | 合规     | `app-user.constant.ts` 枚举与常量均有说明                                           |
| 删除态/敏感字段不得对外泄露                                     | 合规     | `UserService.mapBaseUser` 显式排除 `deletedAt`，测试覆盖该契约                      |

## 按文件/模块拆分的详细违规清单

### src/user.service.ts

[MEDIUM] 共享用户服务直接抛出 Nest 协议异常

- 位置：`libs/user/src/user.service.ts:249`
- 对应规范：错误处理规范 2.1，service 层预期业务失败应使用 `BusinessException`，HTTP 协议异常留给 controller/guard 边界
- 违规原因：`ensureAppUserNotBanned` 属于共享领域服务方法，但直接抛出 `ForbiddenException`，会把 HTTP 语义泄漏到可复用业务层，并使 admin/app 调用侧难以统一错误码。
- 整改建议：改为抛出携带禁止访问语义的 `BusinessException`；如果 HTTP 403 必须保留，应在调用该服务的 guard/controller 边界做异常映射。

### src/dto/admin-app-user.dto.ts

[LOW] 目标类型字段使用裸 number，契约表达不够稳定

- 位置：`libs/user/src/dto/admin-app-user.dto.ts:347`
- 对应规范：DTO 规范，DTO 应以稳定枚举/命名类型表达业务契约，字段说明应避免只靠文字枚举值维持约束
- 违规原因：`ConsumeAdminAppUserPointsDto.targetType` 语义上是“关联目标类型”，但类型和装饰器均为 `number`，调用方无法从类型层得到合法取值范围。
- 整改建议：抽取或复用目标类型枚举，改用 `EnumProperty`；若确实跨多业务枚举，应定义专门的后台积分消费目标类型枚举。

### src/app-user-count.service.spec.ts

[LOW] 测试使用 `as never` 绕过依赖类型

- 位置：`libs/user/src/app-user-count.service.spec.ts:15`、`:31`、`:34`
- 对应规范：类型规范与测试规范，测试应通过最小 mock 类型表达依赖契约，避免用 `never` 掩盖不匹配
- 违规原因：`drizzle as never`、`{} as never`、`999 as never` 让测试绕过编译期约束，后续构造函数或枚举类型变化时测试无法及时暴露破坏。
- 整改建议：使用 `Pick<DrizzleService, 'withErrorHandling'>` 一类最小 mock 类型；非法枚举值可通过显式测试辅助类型或 `unknown as FollowTargetTypeEnum` 限定在测试入口。

[LOW] 测试断言使用类型断言读取异常属性

- 位置：`libs/user/src/app-user-count.service.spec.ts:26`
- 对应规范：类型规范，避免不必要的类型断言
- 违规原因：`(error as BusinessException).cause` 在 catch 分支强制断言，若异常类型变化，测试仍可能编译通过。
- 整改建议：在读取 `cause` 前使用 `expect(error).toBeInstanceOf(BusinessException)` 后用局部类型收窄，或封装断言辅助函数。

### src/user.service.spec.ts

[LOW] 测试依赖 mock 使用 `as never`

- 位置：`libs/user/src/user.service.spec.ts:19`、`:22`
- 对应规范：类型规范与测试规范，测试 mock 应保留依赖最小契约
- 违规原因：构造 `UserService` 时用 `as never` 注入 mock，会掩盖 `DrizzleService` 与 `AppUserCountService` 构造契约变化。
- 整改建议：定义最小 mock 类型并用 `satisfies Partial<...>` 或局部测试接口约束需要的成员。

## 文件逐份审查结论

| 文件                                              | 结论                              |
| ------------------------------------------------- | --------------------------------- |
| `libs/user/src/app-user-count.service.ts`         | 已读，未发现本轮适用规范违规      |
| `libs/user/src/app-user-count.type.ts`            | 已读，未发现本轮适用规范违规      |
| `libs/user/src/app-user.constant.ts`              | 已读，未发现本轮适用规范违规      |
| `libs/user/src/dto/admin-app-user.dto.ts`         | 已读，发现目标类型契约表达不足    |
| `libs/user/src/dto/app-user-growth-shared.dto.ts` | 已读，未发现本轮适用规范违规      |
| `libs/user/src/dto/base-app-user-count.dto.ts`    | 已读，未发现本轮适用规范违规      |
| `libs/user/src/dto/base-app-user.dto.ts`          | 已读，未发现本轮适用规范违规      |
| `libs/user/src/dto/user-self.dto.ts`              | 已读，未发现本轮适用规范违规      |
| `libs/user/src/user.module.ts`                    | 已读，未发现本轮适用规范违规      |
| `libs/user/src/user.service.ts`                   | 已读，发现 service 层协议异常问题 |
| `libs/user/src/user.type.ts`                      | 已读，未发现本轮适用规范违规      |
| `libs/user/src/app-user-count.service.spec.ts`    | 已读，发现测试类型断言问题        |
| `libs/user/src/user.service.spec.ts`              | 已读，发现测试 mock 类型断言问题  |
| `libs/user/tsconfig.lib.json`                     | 已读，未发现本轮适用规范违规      |

## 整体合规率总结

- 合规率：92.98%
- 模块整体结构清晰，主要风险不是目录职责，而是错误语义边界和测试类型安全。

## 必改项清单

1. 将 `UserService.ensureAppUserNotBanned` 的 `ForbiddenException` 改为领域业务异常或边界映射。

## 优化建议清单

1. 为 `ConsumeAdminAppUserPointsDto.targetType` 建立明确枚举契约。
2. 清理测试中的 `as never`，改为最小 mock 类型或 `satisfies` 约束。
