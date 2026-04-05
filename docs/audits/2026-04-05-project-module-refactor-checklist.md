# 项目模块规范改造清单

## 口径说明

本清单按「共享模块优先」的口径盘点项目。

- 主计数对象：`libs/*/src/*` 下识别为独立能力单元的共享模块。
- 判定规则：综合 `DTO_SPEC.md`、`COMMENT_SPEC.md`、`CONTROLLER_SPEC.md`、`TS_TYPE_SPEC.md` 四份规范。
- 盘点方法：结构化静态扫描 + 已改造模块人工复核。
- “改造完成”定义：
  1. 共享层场景 DTO 已收敛到 `libs/*`
  2. service 公开签名不再依赖镜像 `*.type.ts`
  3. apps 侧不再维护同构 DTO
  4. service 方法注释基本满足规范
  5. admin 变更入口具备审计语义
- apps 入口模块本次不单独计数，而是归属到对应共享模块下评估。

## 汇总结论

- 共享目标模块总数：52 个
- 已完成改造：52 个
- 未完成改造：0 个

### 问题类型分布

- `index` 仍对外导出镜像 type：0 个模块
- service 方法注释覆盖不足：0 个模块
- service 公开签名仍依赖镜像 type：0 个模块
- 共享层仍保留 HTTP 镜像 type/interface：0 个模块

## 已完成模块

- `app-content/agreement`
- `app-content/announcement`
- `app-content/page`
- `config/app-config`
- `config/dictionary`
- `config/system-config`
- `content/author`
- `content/category`
- `content/permission`
- `content/tag`
- `content/work`
- `content/work-counter`
- `forum/action-log`
- `forum/counter`
- `forum/moderator`
- `forum/moderator-application`
- `forum/permission`
- `forum/profile`
- `forum/search`
- `forum/section`
- `forum/section-group`
- `forum/tag`
- `forum/topic`
- `growth/badge`
- `growth/check-in`
- `growth/event-definition`
- `growth/experience`
- `growth/growth-ledger`
- `growth/growth-reward`
- `growth/level-rule`
- `growth/permission`
- `growth/point`
- `growth/task`
- `message/monitor`
- `message/notification`
- `message/outbox`
- `message/chat`
- `message/inbox`
- `interaction/browse-log`
- `interaction/comment`
- `interaction/download`
- `interaction/emoji`
- `interaction/favorite`
- `interaction/follow`
- `interaction/like`
- `interaction/purchase`
- `interaction/report`
- `interaction/reading-state`
- `interaction/user-assets`
- `platform/dto`
- `platform/modules`
- `user/dto`

## 分库清单

## app-content

| 模块 | 状态 | 问题 |
| --- | --- | --- |
| agreement | 已完成 | 无 |
| announcement | 已完成 | 无 |
| page | 已完成 | 无 |

## config

| 模块 | 状态 | 问题 |
| --- | --- | --- |
| app-config | 已完成 | 无 |
| dictionary | 已完成 | 无 |
| system-config | 已完成 | 无 |

## content

| 模块 | 状态 | 问题 |
| --- | --- | --- |
| author | 已完成 | 无 |
| category | 已完成 | 无 |
| permission | 已完成 | 无 |
| tag | 已完成 | 无 |
| work | 已完成 | 无 |
| work-counter | 已完成 | 无 |

## forum

| 模块 | 状态 | 问题 |
| --- | --- | --- |
| action-log | 已完成 | 无 |
| counter | 已完成 | 无 |
| moderator | 已完成 | 无 |
| moderator-application | 已完成 | 无 |
| permission | 已完成 | 无 |
| profile | 已完成 | 无 |
| search | 已完成 | 无 |
| section | 已完成 | 无 |
| section-group | 已完成 | 无 |
| tag | 已完成 | 无 |
| topic | 已完成 | 无 |

## growth

| 模块 | 状态 | 问题 |
| --- | --- | --- |
| badge | 已完成 | 无 |
| check-in | 已完成 | 无 |
| event-definition | 已完成 | 无 |
| experience | 已完成 | 无 |
| growth-ledger | 已完成 | 无 |
| growth-reward | 已完成 | 无 |
| level-rule | 已完成 | 无 |
| permission | 已完成 | 无 |
| point | 已完成 | 无 |
| task | 已完成 | 无 |

## interaction

| 模块 | 状态 | 问题 |
| --- | --- | --- |
| browse-log | 已完成 | 无 |
| comment | 已完成 | 无 |
| download | 已完成 | 无 |
| emoji | 已完成 | 无 |
| favorite | 已完成 | 无 |
| follow | 已完成 | 无 |
| like | 已完成 | 无 |
| purchase | 已完成 | 无 |
| reading-state | 已完成 | 无 |
| report | 已完成 | 无 |
| user-assets | 已完成 | 无 |

## message

| 模块 | 状态 | 问题 |
| --- | --- | --- |
| chat | 已完成 | 无 |
| inbox | 已完成 | 无 |
| monitor | 已完成 | 无 |
| notification | 已完成 | 无 |
| outbox | 已完成 | 无 |

## platform

| 模块 | 状态 | 问题 |
| --- | --- | --- |
| dto | 已完成 | 无 |
| modules | 已完成 | 无 |

## user

| 模块 | 状态 | 问题 |
| --- | --- | --- |
| dto | 已完成 | 无 |

## 未纳入主计数的目录

以下目录未识别到独立的 service/dto 契约，按基础设施、聚合容器或测试目录处理，不计入“模块改造完成率”：

- `config/core`：未识别到独立 service/dto 契约，按基础设施或容器目录处理。
- `content/test`：未识别到独立 service/dto 契约，按基础设施或容器目录处理。
- `forum/badge`：未识别到独立 service/dto 契约，按基础设施或容器目录处理。
- `forum/config`：未识别到独立 service/dto 契约，按基础设施或容器目录处理。
- `forum/forum`：未识别到独立 service/dto 契约，按基础设施或容器目录处理。
- `forum/module`：未识别到独立 service/dto 契约，按基础设施或容器目录处理。
- `forum/reply`：未识别到独立 service/dto 契约，按基础设施或容器目录处理。
- `forum/reply-like`：未识别到独立 service/dto 契约，按基础设施或容器目录处理。
- `growth/growth`：未识别到独立 service/dto 契约，按基础设施或容器目录处理。
- `identity/core`：未识别到独立 service/dto 契约，按基础设施或容器目录处理。
- `identity/token`：未识别到独立 service/dto 契约，按基础设施或容器目录处理。
- `interaction/module`：未识别到独立 service/dto 契约，按基础设施或容器目录处理。
- `interaction/purchase-contract`：未识别到独立 service/dto 契约，按基础设施或容器目录处理。
- `message/message`：未识别到独立 service/dto 契约，按基础设施或容器目录处理。
- `message/module`：未识别到独立 service/dto 契约，按基础设施或容器目录处理。
- `platform/bootstrap`：未识别到独立 service/dto 契约，按基础设施或容器目录处理。
- `platform/config`：未识别到独立 service/dto 契约，按基础设施或容器目录处理。
- `platform/constant`：未识别到独立 service/dto 契约，按基础设施或容器目录处理。
- `platform/decorators`：未识别到独立 service/dto 契约，按基础设施或容器目录处理。
- `platform/filters`：未识别到独立 service/dto 契约，按基础设施或容器目录处理。
- `platform/interceptors`：未识别到独立 service/dto 契约，按基础设施或容器目录处理。
- `platform/module`：未识别到独立 service/dto 契约，按基础设施或容器目录处理。
- `platform/schema`：未识别到独立 service/dto 契约，按基础设施或容器目录处理。
- `platform/types`：未识别到独立 service/dto 契约，按基础设施或容器目录处理。
- `platform/utils`：未识别到独立 service/dto 契约，按基础设施或容器目录处理。
- `user/core`：未识别到独立 service/dto 契约，按基础设施或容器目录处理。

## 建议的下一轮改造顺序

1. 先处理同时命中“共享层仍保留 HTTP 镜像 type/interface + service 公开签名仍依赖镜像 type + `index` 仍导出镜像 type”的模块。
2. 再处理 service 注释覆盖不足的模块，优先大型 service。
3. 最后回收 apps 入口层残余的本地 DTO 与审计缺口。

## 逐模块整改清单

### content

- [x] `content/author`：已完成共享 DTO 收敛、service 签名替换、`index.ts` 清理和注释补齐。
- [x] `content/category`：已完成共享 DTO 收敛、service 签名替换、`index.ts` 清理和注释补齐。
- [x] `content/permission`：已完成 service 注释补齐。
- [x] `content/tag`：已完成共享 DTO 收敛、service 签名替换、`index.ts` 清理和注释补齐。
- [x] `content/work`：已完成共享 DTO 收敛、service 签名替换、`index.ts` 清理与注释补齐。

### forum

- [x] `forum/action-log`：已完成共享 DTO 收敛与 service 签名替换。
- [x] `forum/counter`：已完成 service 注释补齐。
- [x] `forum/moderator`：已完成共享 DTO 收敛、service 签名替换、`index.ts` 清理与注释补齐。
- [x] `forum/moderator-application`：已完成共享 DTO 收敛、service 签名替换、`index.ts` 清理与注释补齐。
- [x] `forum/profile`：已完成共享 DTO 收敛、service 签名替换与 `index.ts` 清理。
- [x] `forum/search`：已完成共享 DTO 收敛、service 签名替换、`index.ts` 清理与注释补齐。
- [x] `forum/section`：已完成共享 DTO 收敛与 service 签名替换。
- [x] `forum/section-group`：已完成共享 DTO 收敛、service 签名替换与注释补齐。
- [x] `forum/tag`：已完成共享 DTO 收敛与 service 签名替换。
- [x] `forum/topic`：已完成共享 DTO 收敛、service 签名替换与注释补齐。

### growth

- [x] `growth/badge`：已完成 service 注释补齐。
- [x] `growth/check-in`：已完成共享导出清理，内部类型仅保留域内使用。
- [x] `growth/event-definition`：已完成内部筛选类型命名收口与共享导出清理。
- [x] `growth/experience`：已完成共享 DTO 收敛、service 签名替换与 `index.ts` 清理。
- [x] `growth/growth-ledger`：已完成共享 DTO 收敛、内部类型拆分与 `index.ts` 清理。
- [x] `growth/growth-reward`：已完成内部类型命名收口与 `index.ts` 对外导出清理。
- [x] `growth/level-rule`：已完成共享 DTO 收敛、service 签名替换、`index.ts` 清理与注释补齐。
- [x] `growth/point`：已完成共享 DTO 收敛、service 签名替换、`index.ts` 清理与注释补齐。
- [x] `growth/task`：已完成共享 DTO 收敛、service 签名替换、`index.ts` 清理与注释补齐。

### interaction

- [x] `interaction/comment`：已完成共享 DTO 收敛、service 签名替换与 `index.ts` 清理。
- [x] `interaction/download`：已完成共享 DTO 收敛、service 签名替换与 `index.ts` 清理。
- [x] `interaction/emoji`：已完成共享 DTO 收敛、service 签名替换与 `index.ts` 清理。
- [x] `interaction/favorite`：已完成共享 DTO 收敛、service 签名替换与 `index.ts` 清理。
- [x] `interaction/follow`：已完成共享 DTO 收敛、service 签名替换与 `index.ts` 清理。
- [x] `interaction/like`：已完成共享 DTO 收敛与 `index.ts` 清理。
- [x] `interaction/purchase`：已完成共享 DTO 收敛与 `index.ts` 清理。
- [x] `interaction/reading-state`：已完成共享 DTO 收敛与 service 签名替换。
- [x] `interaction/report`：已完成共享 DTO 收敛、service 签名替换与 `index.ts` 清理。
- [x] `interaction/user-assets`：已完成 `userId` 查询契约清理与 `index.ts` 清理。

### message

- [x] `message/chat`：已完成共享 DTO 收敛、service 签名替换与 `index.ts` 清理。
- [x] `message/inbox`：已完成共享 DTO 收敛、service 签名替换与 `index.ts` 清理。
- [x] `message/monitor`：已完成 service 注释补齐。
- [x] `message/notification`：已完成共享 DTO 收敛、service 签名替换、`index.ts` 清理与注释补齐。
- [x] `message/outbox`：已完成共享 DTO 收敛、service 签名替换、`index.ts` 清理与注释补齐。

### platform

- [x] `platform/modules`：已完成镜像契约清理、对外导出收敛与关键服务注释补齐。

## 使用方式

- 每完成一个模块，就同步更新上面的状态表和对应复选框。
- 若某个模块因为兼容性原因需要保留旧入口或旧字段，在对应条目后面追加“兼容例外说明”。
- 若后续人工复核发现静态扫描误报，应直接修正文档中的模块问题描述，不只在会话里口头说明。
