---
title: Agent 学习（十二）——Planner 的深度与 Reflection 预告
date: 2026-07-14
author: myWorldmakerTonyczk
series: Agent 学习
seriesOrder: 12
---

# Agent 学习（十二）——Planner 的深度与 Reflection 预告

> 上一节留了三个问题。这一节先看答案，然后深入 Task Decomposition 和 Handling Uncertainty，最后引出下一个组件。

---

## 先看你的回答

**问题 1**：为什么说"Planner 不是让 Agent 变聪明，而是管理复杂性"？

如果你的回答是——

> 因为 Planner 不负责思考，LLM 负责思考，Planner 只负责将复杂任务拆分。

这里需要稍微修正一下。你说"Planner 不负责思考"——严格来说，不完全正确。因为现实中的 Planner 通常也是由 LLM 驱动的。

例如：

```
Planner:
输入：帮我设计东京旅行
  ↓
LLM 推理：
应该拆成：
1. 获取需求  2. 查询天气  3. 安排交通
4. 选择酒店  5. 输出计划
```

所以 Planner 也可能使用 LLM 的推理能力。更准确的说法：

> **Planner 不负责执行具体任务，它负责管理任务结构。**

也就是：**Planner** → Thinking about the task structure（思考任务结构），**普通 LLM** → Thinking about the next action（思考下一步行动）。

我们画一下区别：

**没有 Planner：**

```
用户目标 → LLM → 下一步行动 → 执行
              → 下一步行动 → 执行
              → 下一步行动 → 执行
```

像：**边走边想。**

**有 Planner：**

```
用户目标 → Planner → 任务树 → LLM → 执行步骤
```

像：**先看地图，再开车。**

所以 Planner 的价值不是增加智力，而是**降低复杂任务的认知负担。**

---

**问题 2**：为什么旅行需要 Planner？

如果你的回答是——

> 前者任务简单，查天气不需要多余步骤，而计划旅程考虑的因素很多，从天气到酒店分很多步。

正确。这里我们引入一个 Agent 设计里非常重要的概念：

### Task Decomposition（任务分解）

复杂任务通常有两个特征：

**特征 1：多步骤。**

例如旅行：日期、预算、天气、交通、酒店、景点、餐饮。

**特征 2：有依赖关系。**

例如：预算影响酒店 → 酒店位置影响路线 → 路线影响交通。所以**不能随便执行。**

我们画一个依赖：

```
        预算
          |
          v
       酒店选择
          |
          v
       路线规划
          |
          v
       交通安排
```

但是查天气：

```
天气查询 → 返回结果 → 结束
```

没有复杂依赖。所以**不需要 Planner。**

---

**问题 3**：预算未知怎么办？

如果你的回答是——

> 我认为应该选 B，因为这是思考中重要的一环，预算是不可忽略的一环，所以要先询问用户才能进行接下来的思考。

**非常好。** 这里你其实已经触碰到了 Agent 的一个核心能力：

### Handling Uncertainty（处理不确定性）

很多人设计 Agent 时犯一个错误：认为 Agent 应该**自动完成一切。**

实际上，优秀 Agent 的特点不是"永远自己决定"，而是知道：**什么时候自己决定，什么时候询问人。**

例如用户说"帮我订酒店"——Agent 发现缺少日期、城市、预算。

- ❌ 错误：自己猜——预算 500 美元。**危险。**
- ✅ 正确：Agent："我还需要两个信息：1. 入住日期？2. 预算范围？请告诉我。"

所以成熟 Agent 有一个判断：

```
                 不确定性
                      |
          ---------------------
          |                   |
       可以推断             无法推断
          |                   |
       自己执行             询问用户
```

这会引出未来的：Human-in-the-loop、Approval、Permission、Safety Guard。

## 重新看 Agent 架构

现在已经非常接近真实系统：

```
                         Memory
                            ↑
User → Planner → LLM → Tool → Environment
                    |
                Reflection
```

但是你可能注意到了一个问题。

我们现在：Planner 制定计划、LLM 决定行动、Tool 执行、Memory 保存。

那么——**谁负责判断执行结果好不好？**

例如任务：写一个 Python 爬虫。

Agent：生成代码 → 运行 → 报错。**怎么办？**

如果没有新的机制，它可能：

```
生成代码 → 运行 → 失败 → 返回失败 → 结束。
```

但是人类不是这样：

```
写代码 → 运行 → 发现 Bug → 分析原因 → 修改 → 重新运行
```

这里出现一个新的能力：

> **Reflection（反思）**

## 下一课预告

我们会讲：

- Reflection 是不是让 Agent 自己骂自己？
- Reflection 和普通 LLM 思考有什么区别？
- ReAct 是 Reflection 吗？
- 为什么很多 Agent 会陷入无限循环？
- 如何设计停止条件？

## 最后一个问题

不过在进入 Reflection 前，先来想一个问题：

假设 Agent 任务：**写一个 Python 爬虫。**

流程：

```
Planner:
1. 写代码
2. 运行代码
3. 输出结果
```

执行 Step2 时，发现：**报错——网页不存在。**

- 如果 Agent **没有 Reflection**，它可能怎么表现？
- 如果 Agent **有 Reflection**，它应该增加什么步骤？

请按自己的理解回答。你已经到了可以自己推导这个组件的阶段。

---

**上一篇：**[Agent 学习（十一）——Planner](/posts/agent-learning-8)
**下一篇：**[Agent 学习（十三）——Reflection](/posts/agent-learning-reflection-full)

---

*Agent 学习系列，未完待续。*
