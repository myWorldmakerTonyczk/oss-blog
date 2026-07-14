---
title: Agent 学习（十七）——Agent Loop 与阶段测试
date: 2026-07-14
author: myWorldmakerTonyczk
series: Agent 学习
seriesOrder: 17
---

# Agent 学习（十七）——Agent Loop 与阶段测试

> 上一节留了一道阶段测试题。这一节先看答案，然后引出把一切串起来的核心——Agent Loop。

---

## 先看你的回答

> "Agent 不就是 ChatGPT 加几个 API 吗？"

如果你的回答是——

> 首先 Agent 确实包含了 API 层，API 属于 Agent 的 Tool，而 ChatGPT 属于 Agent 中的 LLM。所以这个回答确实在 Agent 的框架内，但缺少了很多关键部分。如果 Agent 只包含了这两个部分，那 LLM 就只能每个任务调用一个 API，只能完成很简单的任务，因为它没有 Planner 形成任务链，也没有 Reflection 进行纠错反思，也没有 Memory 进行记忆工作，这样的话，这个系统就无法在复杂环境中执行任务。

**很好。** 这次你的回答已经不是"背概念"，而是在用架构分层解释 Agent。

## 你的回答拆解

你说"Agent 确实包含 API 层，API 属于 Tool，ChatGPT 属于 LLM"——这个判断正确。

实际上：

```
Agent
├── LLM
├── Tool
├── Memory
├── Planner
├── Reflection
└── Workflow
```

所以"Agent = ChatGPT + API"不是完全错误——它只是**把 Agent 简化成了两个组件。**

这个很重要。优秀架构师不是简单说"这个说法错了"，而是：**这个说法描述了 Agent 的一个子集，但是缺少使系统具备自主性的关键机制。** 你的表达已经接近这个方向。

## 你的第二部分很好

你说"如果只有这两个部分，LLM 就只能每个任务调用一个 API，只能完成简单任务"——这里实际上指出了 Agent 和 API 调用最大的区别。

**API 调用：**

```
用户 → 程序 → API → 结果
```

流程固定。

**简单 LLM + API：**

```
用户 → LLM → 调用API → 回答
```

依然单轮。例如用户查询东京天气——很好。

但是用户说"帮我安排东京五日旅行"——单个 API 不够。需要：

```
获取需求 → 查询天气 → 查询酒店 → 比较价格 → 规划路线 → 生成方案
```

这已经变成了**任务链。** 所以你提到"Planner 形成任务链"——非常关键。

## Reflection 部分

你说"没有 Reflection 就无法纠错反思"——正确。但我想帮你区分一下：

Reflection 不只是"发现错误"。更准确：

> **Reflection 让 Agent 根据环境反馈，重新评估自己的行为是否仍然朝目标前进。**

例如——没有 Reflection：目标写爬虫 → Plan 写代码 → 运行 → 输出。运行失败 404 → Agent **继续。** 有 Reflection：运行代码 → 观察 404 → Reflection 判断"当前方法无法完成目标，原因网页结构改变" → 重新规划：修改解析逻辑，重新运行。

## Memory 部分

你说"没有 Memory 进行记忆工作"——正确。不过这里可以再升级。

Memory 不是简单"保存历史聊天"。Agent Memory 的作用是**保存对当前世界状态和用户状态的认知。**

比如整理文件——没有 Memory：扫描 → 移动 20 个 → **忘记状态。** 有 Memory：

```json
{
  "task": "整理桌面",
  "scanned": true,
  "moved": 20,
  "remaining": 80
}
```

Agent 可以继续。

## 架构师版本的回答

如果让我把你的回答升级一下，会这样说：

> Agent 不是简单的"ChatGPT 加几个 API"。这个说法只描述了 Agent 的基础结构：LLM 负责理解和决策，Tool/API 负责与外部世界交互。但是，一个真正的 Agent 系统还需要额外的控制机制。
>
> 如果只有 LLM + Tool，那么它只能完成简单的一次性调用，例如"查询天气"。面对复杂任务，它缺少任务拆解能力，需要 Planner 将目标分解为多个步骤；缺少 Reflection，无法根据执行结果发现错误并调整策略；缺少 Memory，无法保持任务状态和长期上下文；缺少 Workflow，无法保证多个组件按照可靠流程协作。
>
> 所以 Agent 的核心不是"让 LLM 调 API"，而是让 LLM 在一个包含规划、记忆、工具、反馈和控制机制的**闭环系统**中自主完成任务。

这个回答水平已经达到：能给别人解释 Agent 基础架构。

## 一个你还没完全掌握的地方

你现在理解 LLM + Tool + Planner + Memory + Reflection。但是还有一个核心概念：

> **Agent Loop（智能体循环）**

它其实是把这些东西串起来的核心。你之前提过"Agent loop 是观察、思考"——这个方向对。下一步我们应该把所有组件放进一个循环里。

## 阶段测试最后一题

请你尝试设计一个完整 Agent Loop。

任务：**Windows AI 助手帮用户整理桌面。**

不要写代码，只画流程。例如：

```
用户目标
  ↓
  ?
  ↓
  ?
  ↓
  ?
  ↓
完成
```

要求至少包含：Planner、Memory、Tool、Reflection、Workflow。

你自己设计一次。这题如果答出来，说明第一阶段真正掌握。

---

**上一篇：**[Agent 学习（十六）——Workflow 的深度与阶段总结](/posts/agent-learning-stage1-summary)
**下一篇：**[Agent 学习（十八）——Agent Loop 修正与第一阶段总结](/posts/agent-learning-loop-fix)

---

*Agent 学习系列，未完待续。*
