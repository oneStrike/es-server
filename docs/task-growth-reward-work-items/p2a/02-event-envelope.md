# P2-A-02 轻量 `EventEnvelope` 类型

## 目标

补一层最低限度统一事件外壳，先统一语义壳，不急着落库。

## 范围

- 定义轻量 `EventEnvelope`
- 先覆盖高频链路
- 不引入 `event_record`

## 主要改动

- 统一 `code / key / subject / target / operator / occurredAt / governanceStatus / context`
- 先让主题、评论、点赞、举报、任务完成可按需复用

## 完成标准

- 高频链路可以共享最低限度事件语义
- 不强迫各模块改成统一派发流程

## 执行信息

- 优先级：`S2`
- 硬前置：`P2-A-01`
- 软前置：无
- 直接后置：高频链路按需接入事件壳
- 可并行：`P2-A-03`
