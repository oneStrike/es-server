# AI 规范快速入口实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 为仓库新增 AI 规范快速入口、术语表和例外表，并把入口接入现有 `AGENTS.md` 与 `.trae/rules/PROJECT_RULES.md`。

**架构：** 在 `.trae/rules/` 新增三份辅助文档，保持专项规则不变，仅新增导航层；同时更新现有两个入口文件，让 AI 首次进入仓库时能快速路由到正确规则。所有辅助文档只做导航、释义和例外汇总，不成为新的规范事实源。

**技术栈：** Markdown、仓库现有规范文档、Prettier、TypeScript type-check 基线

---

### 任务 1：新增 AI 辅助文档

**文件：**

- 创建：`.trae/rules/AI_RULE_ROUTER.md`
- 创建：`.trae/rules/AI_TERMS.md`
- 创建：`.trae/rules/AI_EXCEPTIONS.md`

- [ ] **步骤 1：编写 AI 规则路由文档**

写入以下结构：

```md
# AI 规则快速路由

## 边界

- 仅作导航，不替代 AGENTS.md、PROJECT_RULES.md 和 01-08 专项规则

## 决策树

- 按改动类型跳转到对应规则

## 速查表

- 改动类型 / 必须先读 / 常见误判 / 最低验证 / 相关例外

## 组合改动提示

- Controller + DTO
- DTO + Type
- DTO + 错误语义
- Schema + DTO + Migration
- 文档 / 规则改动 + 仓库级验证

## 执行顺序

- 判定改动类型
- 阅读专项规则
- 查术语表
- 查例外表
- 执行最低验证
```

- [ ] **步骤 2：编写 AI 术语表**

写入以下结构：

```md
# AI 术语表

## owner 文件

## owner 模块

## 稳定 contract

## 闭集字段

## 事实源

## 兼容入口

## 最低验证
```

- [ ] **步骤 3：编写 AI 例外表**

写入以下结构：

```md
# AI 已知例外

## TypeScript / ESLint 基线差距

## 临时测试文件策略

## 测试依赖与脚本现状

## POST 200 / 201 约定

## migration 与 seed 边界
```

### 任务 2：把 AI 入口接入现有规范入口

**文件：**

- 修改：`AGENTS.md`
- 修改：`.trae/rules/PROJECT_RULES.md`

- [ ] **步骤 1：更新 AGENTS.md**

新增一段 AI 快速入口说明，链接到以下文件：

```md
- `AI_RULE_ROUTER.md`
- `AI_TERMS.md`
- `AI_EXCEPTIONS.md`
```

- [ ] **步骤 2：更新 PROJECT_RULES.md**

在“规范文件索引”前新增“AI 快速入口”区块，说明：

```md
- 第一次进入仓库时先读 AI_RULE_ROUTER.md
- 不确定术语时读 AI_TERMS.md
- 遇到现实差距时读 AI_EXCEPTIONS.md
```

### 任务 3：验证文档改动

**文件：**

- 验证：`AGENTS.md`
- 验证：`.trae/rules/PROJECT_RULES.md`
- 验证：`.trae/rules/AI_RULE_ROUTER.md`
- 验证：`.trae/rules/AI_TERMS.md`
- 验证：`.trae/rules/AI_EXCEPTIONS.md`

- [ ] **步骤 1：运行 Markdown 格式检查**

运行：`pnpm exec prettier --check AGENTS.md .trae/rules/PROJECT_RULES.md .trae/rules/AI_RULE_ROUTER.md .trae/rules/AI_TERMS.md .trae/rules/AI_EXCEPTIONS.md`

预期：全部文件通过格式检查。

- [ ] **步骤 2：运行仓库 type-check 基线**

运行：`pnpm type-check`

预期：命令退出码为 0，仓库基线未被规范文档改动破坏。
