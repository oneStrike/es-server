# HTTP 状态与字符串响应码覆盖清单

日期：2026-07-08

## 代码面覆盖

| 范围                                                                                      | 处理结果                                                                                                            |
| ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `libs/platform/src/constant/error-code.constant.ts`                                       | 成功、平台、业务响应码统一为字符串常量，并导出 `ApiResponseCode`、`ApiErrorCode` 等收窄类型。                       |
| `libs/platform/src/exceptions/*`                                                          | `BusinessException` 改为字符串业务码，并允许通过 `httpStatus` 覆盖特殊上下文。                                      |
| `libs/platform/src/filters/http-exception.filter.ts`                                      | 业务异常、HTTP 异常、PostgreSQL 异常都按真实 HTTP status 输出 envelope。                                            |
| `libs/platform/src/interceptors/transform.interceptor.ts`                                 | 成功 envelope 固定写入 `SUCCESS`，不再修改 HTTP status。                                                            |
| `db/core/error/*`                                                                         | PostgreSQL 唯一、非空、check、序列化失败映射到对应 HTTP status 与字符串 code。                                      |
| `apps/*/**/*.controller.ts`                                                               | 233 个非创建 POST action 加 `@HttpCode(200)`；创建、上传与归档会话类 POST 保留 201。                                |
| `libs/platform/src/decorators/api-doc.*`                                                  | Swagger 成功响应 code 改为字符串；错误响应补充常见 4xx/5xx envelope；创建类接口通过 `successStatus: 201` 显式声明。 |
| `libs/message/src/notification/*`、`libs/message/src/monitor/*`                           | WebSocket ACK、认证失败、指标成功判断改为字符串 code。                                                              |
| `apps/app-api/src/modules/auth/app-user-status.guard.ts`、`libs/user/src/user.service.ts` | 账号封禁业务码保留，HTTP status 显式覆盖为 403。                                                                    |
| `libs/content/src/work/third-party/services/remote-image-import.service.ts`               | 业务异常重抛时保留 `cause` 与 `httpStatus`。                                                                        |

## 扫描命令与当前结论

| 扫描目标               | 结论                                                                                |
| ---------------------- | ----------------------------------------------------------------------------------- |
| 数字 API 响应码        | 未发现平台、业务、成功响应码继续使用数字值。                                        |
| 非创建 POST action     | 覆盖脚本确认无缺失 `@HttpCode(200)` 的非创建 POST。                                 |
| 创建类 Swagger 状态    | 覆盖脚本确认使用 `ApiDoc` / `ApiAuditDoc` 的创建类 POST 都带 `successStatus: 201`。 |
| `@HttpCode` import     | 覆盖脚本确认所有使用 `@HttpCode` 的 controller 都已从 `@nestjs/common` 导入。       |
| WebSocket ACK 成功判断 | `recordAck` 与 ACK payload 类型均使用 `SUCCESS` 字符串。                            |

## 已审计保留项

| 文件                                                                | 字段                                                                        | 保留原因                                                                              |
| ------------------------------------------------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `libs/platform/src/modules/upload/upload.type.ts`                   | `SuperbedApiResponse.code?: string                                          | number`、`err?: number`                                                               | 第三方 Superbed 原始响应字段，仅 provider 内部解析。 |
| `libs/platform/src/modules/upload/qiniu-upload.provider.ts`         | `qiniuError.code?: number`                                                  | 七牛 SDK 原始错误码，用于识别上游删除状态。                                           |
| `libs/content/src/work/third-party/providers/copy-manga.type.ts`    | `CopyMangaResponse.code?: number`、`CopyMangaNetworkResponse.code?: number` | CopyManga 上游接口 envelope，不是本仓库 API response code。                           |
| `libs/growth/src/growth-reward/dto/growth-reward-settlement.dto.ts` | `GrowthRewardSettlementEventEnvelopeSnapshotDto.code!: number`              | 成长事件领域编码快照，不是 HTTP/API 响应码。                                          |
| `libs/growth/src/event-definition/event-definition.service.ts`      | `GrowthRuleTypeEnum                                                         | number`                                                                               | 兼容历史成长事件定义编码。                           |
| `libs/growth/src/event-definition/event-envelope.helper.ts`         | `typeof code !== 'number'`                                                  | 领域事件治理闸门解析逻辑。                                                            |
| `db/core/error/postgres-error.ts`                                   | SQLSTATE 字符串，如 `40001`                                                 | PostgreSQL 标准错误码，作为数据库输入分类源。                                         |
| `docs/superpowers/plans/2026-07-04-rules-audit-fix.md`              | 历史数字错误码描述                                                          | 历史修复计划快照，非当前规范事实源；当前事实源为 `.trae/rules/06-error-handling.md`。 |

## 当前事实源

- 代码事实源：`libs/platform/src/constant/error-code.constant.ts`
- 错误处理规则：`.trae/rules/06-error-handling.md`
- 破坏性变更说明：`docs/breaking-changes/http-status-string-code.md`
- 本次覆盖清单：`docs/breaking-changes/http-status-string-code-coverage.md`
