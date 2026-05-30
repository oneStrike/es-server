# OMX Workflow Priority Rule

你应尽可能使用 oh-my-codex / OMX 的工作流程组织任务。

路由判断必须发生在回答之前。先匹配显式 `$workflow`，再匹配自然语言意图。命中工作流后，不要退回普通聊天建议。

## 优先级

- 需求不清楚：使用 `$deep-interview`。
- 需要计划、架构、权衡、测试规格：使用 `$ralplan`。
- 清晰多步骤执行：使用 `$ultragoal`。
- 用户要求全自动：使用 `$autopilot`。
- 需要并行：使用 `$team`。
- 用户要求 review：使用 `$code-review`。
- 需要强验证：使用 `$ultraqa`。
- 清理 AI 味代码：使用 `$ai-slop-cleaner`。

## 自然语言触发

触发 `$deep-interview`：

- “你认为应该怎么……”
- “你觉得怎么做合适”
- “我希望合理……”
- “这个文件太大了，我希望合理拆分，你认为应该怎么拆分合适？”
- “要不要……”
- “怎么拆比较合理”
- “先问清楚”
- “不要假设”

触发 `$ralplan`：

- “帮我规划一个方案”
- “给我技术方案”
- “制定实施方案”
- “重构方案”
- “迁移路线”
- “测试方案”
- “先不要写代码，先做方案”

显式 `$workflow` 命令是硬指令。用户写 `$deep-interview`、`$ralplan`、`$autopilot` 等命令时，必须执行或模拟对应工作流，不得只给普通回答。

## `$ralplan` 审查门

进入 `$ralplan` 后，必须按以下顺序：

```text
Planner Draft -> Architect Review -> Critic Review -> Final Plan
```

- Architect Review 必须先于 Critic Review。
- Architect 检查架构边界、模块职责、接口、可维护性和迁移风险。
- Critic 检查隐藏假设、过度设计、缺失验收标准、测试盲区和回滚策略。
- 两者都 approve 后才能输出最终方案。
- 如果无法启动真实子代理，必须明确说“当前环境未启动真实子代理，我用模拟角色审查”。

## 真实 OMX 与模拟 OMX

如果当前环境可以运行 OMX CLI：

1. 优先调用真实 OMX 工作流。
2. 读取 `.omx/specs/`、`.omx/plans/`、`.omx/state/`、`.omx/ultragoal/` 等产物。
3. 不绕过已经生成的计划、验收标准、review 或 QA 结论。

如果当前环境不能运行 OMX CLI：

1. 不要假装已经调用 OMX。
2. 明确告诉用户：“当前环境未实际运行 OMX，我按 OMX 流程模拟执行。”
3. 按同样的澄清、规划、执行、审查、QA 逻辑推进。

默认链路：

```text
$deep-interview if unclear -> $ralplan if architecture matters -> $ultragoal or $autopilot -> $code-review -> $ultraqa
```
