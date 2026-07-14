---
title: Agent 学习（十四）——Reflection 的深度与 Workflow 预告
date: 2026-07-14
author: myWorldmakerTonyczk
series: Agent 学习
seriesOrder: 14
---

# Agent 学习（十四）——Reflection 的深度与 Workflow 预告

> 上一节留了三个 Reflection 问题。这一节先看答案，然后深入，最后引出 Agent 架构的下一个关键组件——Workflow。

---

## 先看你的回答

**问题 1**：为什么 Reflection 不是简单的"再让 LLM 思考一次"？

如果你的回答是——

> Reflection 是要解决 Planner 中未预料到的情况，需要在不确定的环境中重新规划 Planner。

正确。但是我们进一步拆。

**问题 2**：每次 Tool 后都强制 Reflection，有什么问题？

> 首先是性能浪费，其次 Memory 负担加重。

正确。再补充两个。

**问题 3**：为什么 ReAct 比一次性 Planner 更适合不确定环境？

> 因为环境是不确定的，Planner 步骤不可能完全正确，所以要不断发现问题并调整 Planner。

**完全正确。** 这是 ReAct、Reflection、Agent Loop 存在的根本原因。

我们逐个深入。

## 1. Reflection 为什么不是"再让 LLM 思考一次"？

很多人误解：普通 LLM 思考一次，Reflection Agent 思考两次——**不是。** 区别不是次数，而是**思考对象不同。**

**普通 Think**：关注"我下一步应该做什么？"

例如——用户查询东京天气，LLM：需要调用天气工具。这是**面向未来。**

**Reflection**：关注"我刚刚做的事情是否正确？"

例如——Tool 返回天气 API 错误。Reflection：

> 目标：获取东京天气
> 当前状态：没有成功获得天气
> 原因：API 失败
> 选择：重试 / 换工具 / 询问用户

所以：

| Think | Reflection |
|---|---|
| 未来决策 | 过去评估 |

架构对比：

**没有 Reflection：**

```
LLM → Action → Tool → Result
```

**有 Reflection：**

```
              Reflection
                  ↑
                  |
LLM → Action → Tool → Result
                  |
              Evaluation
```

## 2. 每次 Tool 后都 Reflection 有什么问题？

除了你提到的性能和 Memory，再补充两个。

### 问题 1：成本

假设一次任务调用 Tool 20 次。如果每次：执行 → Reflection → 执行，那么 LLM 调用次数**翻倍。** LLM 调用意味着：时间、Token、金钱——全部增加。

### 问题 2：过度思考（Overthinking）

这个非常重要。

例如任务：打开微信。

正常流程：

```
LLM → open_wechat() → 完成
```

过度 Reflection：

```
打开微信
  ↓
Reflection: 我为什么打开微信？
  ↓
Reflection: 打开微信是否符合用户长期目标？
  ↓
Reflection: 是否应该优化微信布局？
```

是不是开始跑偏？

所以优秀 Agent 不是**永远思考**，而是**在需要的时候思考。**

这其实和人一样。你喝水——不会分析喝水行为是否符合人生规划。但是买房——会反复考虑。

所以 Agent 需要：**Adaptive Reflection（自适应反思）。**

## 3. 为什么 ReAct 比一次性 Planner 更适合不确定环境？

**一次 Planner**：类似瀑布开发。需求分析 → 设计 → 开发 → 测试。假设一开始规划 100% 正确——但现实经常需求变化，计划失效。

Agent 也是。例如旅行规划：

```
Planner:
Day1: 浅草
Day2: 迪士尼
Day3: 富士山
```

执行时发现：**台风。**

怎么办？整个计划可能废掉。

**ReAct**：更像人在陌生环境走路。

```
看前方 → 走一步 → 观察 → 调整方向 → 继续
```

架构：

**Planner：**

```
Goal → Plan → Execute all
```

适合：**环境稳定。**

**ReAct：**

```
Goal → Think → Act → Observe → Think → Act → ...
```

适合：**环境变化。**

这里我们得到一个非常重要的 Agent 设计原则：

> **计划能力和反馈能力必须平衡。**

- 没有 Planner：只走一步，容易迷路。
- 没有 Reflection：只按地图走，地图错了也继续。
- 成熟 Agent：先规划 → 执行 → 观察 → 修正 → 继续。

## 关键转折点：Workflow

目前 Agent 已经有了：LLM + Tool + Memory + Planner + Reflection。已经像一个智能系统。

但是出现一个工程问题：**这些组件之间——谁控制？**

例如任务"写代码"，流程到底是：

- 方案 A：Planner → LLM → Tool → Reflection
- 方案 B：LLM → Tool → Reflection → Planner
- 方案 C：Memory → Planner → LLM → Tool

**到底哪个？**

如果完全让 LLM 自己决定，可能：调用工具 → 忘记检查 → 忘记保存 Memory。

所以需要一个新的东西：

> **Workflow（工作流）**

注意：**Workflow 不是 Agent。** 这是一个非常重要的区别。很多人混淆"Workflow = Agent"——错误。

下一节我们讲 Workflow：为什么 Agent 需要"流程控制器"？你会理解：

- LangGraph 为什么出现
- AutoGen 为什么设计多 Agent 通信
- CrewAI 为什么有 Role
- 为什么企业 Agent 往往不是完全自主

## 今天的思考题

假设你设计一个 Windows AI 助手。任务：

> 删除桌面上的垃圾文件。

你觉得下面两种设计哪个更安全？为什么？

**方案 A：**

```
用户请求 → LLM判断 → delete_file() → 完成
```

**方案 B：**

```
用户请求 → LLM判断 → 生成删除计划
→ Reflection检查 → 请求用户确认 → delete_file()
```

为什么？

（这个问题会直接进入 Agent 的安全机制和 Workflow 设计。你已经走到真实 Agent 工程的门口了。）

---

**上一篇：**[Agent 学习（十三）——Reflection](/posts/agent-learning-reflection-full)
**下一篇：**[Agent 学习（十五）——Workflow](/posts/agent-learning-workflow)

---

*Agent 学习系列，未完待续。*
