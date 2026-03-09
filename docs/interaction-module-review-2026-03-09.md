# libs/interaction 模块审查与整改报告（2026-03-09，已执行）

## 1. 结论

本次已按文档问题清单完成整改，`libs/interaction` 当前不存在文档中列出的未完成问题（按“无需考虑历史数据”口径）。

## 2. 本次整改范围

- `libs/interaction/src/**`
- `apps/app-api/src/modules/view/view.controller.ts`
- `apps/app-api/src/modules/comment/comment.controller.ts`
- `prisma/models/app/user-download-record.prisma`
- `prisma/models/app/user-purchase-record.prisma`

## 3. 原高优先级问题整改结果

### 3.1 浏览记录未更新 `viewCount`

- 结果：已修复
- 处理：`recordView` 在同事务内写入 `user_view` 后，调用 `applyTargetCountDelta(..., 'viewCount', 1)`。
- 文件：
  - `libs/interaction/src/view/view.service.ts`

### 3.2 评论审核字段映射风险

- 结果：已清理风险源
- 处理：按已确认方案，未接入的 comment 管理侧方法整体清理，相关审核更新入口移除，不再存在错误映射路径。
- 文件：
  - `libs/interaction/src/comment/comment.service.ts`
  - `libs/interaction/src/comment/dto/comment.dto.ts`
  - `apps/app-api/src/modules/comment/comment.controller.ts`

### 3.3 `view` 校验吞错并静默成功

- 结果：已修复
- 处理：移除 `isTargetValid` 的吞异常语义，改为 `ensureTargetValid` 显式抛错；`recordView` 不再静默返回成功。
- 文件：
  - `libs/interaction/src/view/view-permission.service.ts`
  - `libs/interaction/src/view/view.service.ts`

### 3.4 下载/购买列表未过滤软删除

- 结果：已修复
- 处理：下载与购买列表 SQL 全量补齐 `wc.deleted_at IS NULL`、`w.deleted_at IS NULL`。
- 文件：
  - `libs/interaction/src/download/download.service.ts`
  - `libs/interaction/src/purchase/purchase.service.ts`

## 4. DTO 与规范类问题整改结果

### 4.1 DTO 旧风格（`ApiProperty + class-validator`）

- 结果：已修复
- 处理：`favorite/view` 已迁移到项目自定义装饰器；`base-interaction` 未使用 DTO 已删除。
- 文件：
  - `libs/interaction/src/favorite/dto/favorite.dto.ts`
  - `libs/interaction/src/view/dto/view.dto.ts`
  - `libs/interaction/src/dto/base-interaction.dto.ts`（删除）
  - `libs/interaction/src/dto/index.ts`
  - `libs/interaction/src/index.ts`

### 4.2 返回 DTO `validation:false` 不一致

- 结果：已修复
- 处理：`like/download/purchase/favorite` 的纯响应字段已统一显式 `validation:false`（仅入参字段保留校验）。
- 文件：
  - `libs/interaction/src/like/dto/like.dto.ts`
  - `libs/interaction/src/download/dto/download.dto.ts`
  - `libs/interaction/src/purchase/dto/purchase.dto.ts`
  - `libs/interaction/src/favorite/dto/favorite.dto.ts`

### 4.3 DTO 复用不足 / target DTO 重复

- 结果：已修复
- 处理：新增并统一复用 `InteractionTargetBodyDto`；comment/favorite/like 使用公共 target DTO，移除 comment 内重复定义。
- 文件：
  - `libs/interaction/src/dto/target.dto.ts`
  - `libs/interaction/src/comment/dto/comment.dto.ts`
  - `libs/interaction/src/favorite/dto/favorite.dto.ts`
  - `libs/interaction/src/like/dto/like.dto.ts`

### 4.4 枚举语义冲突（购买/下载）

- 结果：已修复
- 处理：`PurchaseTargetTypeEnum` 与章节类型统一为 `3/4`，并同步 DTO 与 Prisma 注释。
- 文件：
  - `libs/interaction/src/purchase/purchase.constant.ts`
  - `libs/interaction/src/purchase/dto/purchase.dto.ts`
  - `libs/interaction/src/download/dto/download.dto.ts`
  - `prisma/models/app/user-purchase-record.prisma`
  - `prisma/models/app/user-download-record.prisma`

### 4.5 字段注释与文案中英文混用

- 结果：已修复
- 处理：本次涉及文件已统一中文业务文案与字段描述，清理旧的英文提示。
- 文件：
  - `libs/interaction/src/**`（本次改动文件）

## 5. 常量与结构性问题整改结果

### 5.1 `InteractionActionType` 重复定义

- 结果：已修复
- 处理：interaction 侧移除本地重复定义，仅从 base 统一 re-export。
- 文件：
  - `libs/interaction/src/common.constant.ts`
  - `libs/base/src/constant/interaction.constant.ts`（保留单一源）

### 5.2 未接入方法/DTO 清理

- 结果：已修复
- 处理：
  - comment/report 管理侧未接入方法已清理（此前已完成）
  - download/purchase 未接入方法和配套 DTO 已清理
- 文件：
  - `libs/interaction/src/comment/comment.service.ts`
  - `libs/interaction/src/report/report.service.ts`
  - `libs/interaction/src/download/download.service.ts`
  - `libs/interaction/src/download/dto/download.dto.ts`
  - `libs/interaction/src/purchase/purchase.service.ts`
  - `libs/interaction/src/purchase/dto/purchase.dto.ts`

### 5.3 重复代码（等级刷新 / 分页过滤）

- 结果：已修复
- 处理：
  - 抽取 `refreshUserLevelByExperience`，like/favorite/view/comment/report 统一复用
  - 抽取分页与日期过滤 helper，download/purchase 统一复用
- 文件：
  - `libs/interaction/src/user-level.helper.ts`
  - `libs/interaction/src/query.helper.ts`
  - `libs/interaction/src/like/like-growth.service.ts`
  - `libs/interaction/src/favorite/favorite-growth.service.ts`
  - `libs/interaction/src/view/view-growth.service.ts`
  - `libs/interaction/src/comment/comment-growth.service.ts`
  - `libs/interaction/src/report/report.service.ts`
  - `libs/interaction/src/download/download.service.ts`
  - `libs/interaction/src/purchase/purchase.service.ts`

## 6. 安全与性能整改结果

### 6.1 view 入参可信度问题（IP/设备/User-Agent）

- 结果：已修复
- 处理：`RecordViewDto` 不再接收 `ipAddress/device/userAgent`；改由请求上下文提取（`RequestMeta` + Header）。
- 文件：
  - `apps/app-api/src/modules/view/view.controller.ts`
  - `libs/interaction/src/view/dto/view.dto.ts`

### 6.2 Prisma 兜底减少查询

- 结果：已完成主要优化
- 处理：
  - download：移除预查重，改为直接创建 + `P2002` 幂等兜底
  - purchase：移除重复购买预检与余额预检冗余查询，保留事务内唯一约束与账本扣减结果兜底
- 文件：
  - `libs/interaction/src/download/download.service.ts`
  - `libs/interaction/src/purchase/purchase.service.ts`

## 7. 兼容性说明

- 本次按你的要求采用“无需考虑历史数据”口径执行。
- 如线上存在历史 `purchase targetType=1/2` 记录，是否迁移由你后续策略决定（本次不纳入整改范围）。

## 8. 验证结果

- 已执行：
  - `pnpm -s eslint libs/interaction/src apps/app-api/src/modules/view/view.controller.ts apps/app-api/src/modules/comment/comment.controller.ts --ext .ts`
- 结果：通过（仅存在 ESLintIgnoreWarning，不影响代码）

- 已尝试：
  - `pnpm -s tsc -p libs/interaction/tsconfig.lib.json --noEmit`
- 结果：被仓库无关文件阻断：
  - `libs/base/src/modules/upload/upload.service.ts:111`（非 interaction 改动引入）

## 9. 当前状态

- 文档中原问题已完成整改并同步到代码。
- 当前无需额外改造动作；如需我继续提交“历史数据迁移 SQL（可选）”，可单独追加。
