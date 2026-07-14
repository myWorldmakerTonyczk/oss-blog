---
title: Agent 学习（十一）——Planner
date: 2026-07-14
author: myWorldmakerTonyczk
series: Agent 学习
seriesOrder: 11
---

# Agent 学习（十一）——Planner

> 现在 Agent 有了 LLM + Tool + Memory。但复杂任务怎么办？这一节我们进入 Agent 架构的第四个核心组件。

---

## 先看你对上一节问题的回答

上一节留了一个问题：

**任务 A：帮我打开微信。** 需要 Planner 吗？

**任务 B：帮我规划一个 30 天减肥计划。** 需要 Planner 吗？

如果你的回答是——

> 第一个任务不需要，因为它的步骤很简单，而第二个需要，它的任务规划很复杂。

**很好。** 这个回答虽然很短，但是已经抓住了 Planner 存在的核心原因。

## Agent 演化过程

你现在已经走到了 Agent 架构演化的第四步。回顾一下：

**第一版：**

```
User
  |
  v
 LLM
```

问题：会想，但不会做。

→ 增加 Tool：

```
User → LLM → Tool → Environment
```

问题：会做，但不知道过去发生了什么。

→ 增加 Memory：

```
          Memory
             ↑
             |
User → LLM → Tool → Environment
```

问题：有能力、有状态，但是面对复杂目标容易混乱。

→ 于是 Planner 出现。

## 第六课：为什么需要 Planner？

### 先看一个没有 Planner 的 Agent

任务：

> 帮我规划一次东京旅行。

当前 Agent：User → LLM → Tool → Environment。

LLM 第一次思考："我要查天气。" → 调用 `get_weather()` → 结果：东京 25 度。

第二次："我要查酒店。" → 调用 `search_hotel()`。

第三次："我要查交通。" → 调用 `search_transport()`。

**看起来没问题。**

但是任务复杂一点——

> 帮我安排一个 5 天东京旅行，包括预算、路线、餐厅、交通。

可能出现：

```
查酒店 → 规划路线 → 发现路线需要交通
→ 重新调整酒店 → 发现预算超了
→ 重新规划 → 忘了之前决定
```

为什么？因为**每一步都是"临时决定"。**

## Think 和 Plan 的区别

这里非常重要。

你可能会说"Think 包含规划"，这个理解没有错。但是现在我们要细分。

**Think**：回答"**下一步应该做什么？**"

例如打开微信——当前桌面没有微信 → Think：搜索微信。它只关心**下一步。**

**Plan**：回答"**整个任务应该怎么完成？**"

例如东京旅行——

> Plan：
> Step1: 确定日期和预算
> Step2: 查询天气
> Step3: 选择区域
> Step4: 安排酒店
> Step5: 规划每天路线
> Step6: 生成行程表

区别：

| Think | Plan |
|---|---|
| 现在怎么办？ | 整体怎么办？ |

### 用游戏开发类比

你应该很好理解。

**游戏 AI——一个敌人：** 看到玩家，距离 10 米。下一步：攻击。这是 **Think。**

**RPG 任务系统：** 玩家接任务 → 去森林 → 打怪 → 获得材料 → 回城 → 制作装备。这是 **Plan。**

所以：**小动作 → Think。大任务 → Plan。**

## Planner 的职责是什么？

**定义：**

> Planner 是负责把一个目标拆解成可执行步骤的组件。

输入：目标——帮我准备东京旅行。

输出：

```json
{
  "steps": [
    { "task": "查询天气" },
    { "task": "寻找酒店" },
    { "task": "规划路线" }
  ]
}
```

架构：

```
             User Goal
                 |
                 v
             Planner
                 |
          ----------------
          Step1  Step2  Step3
                 |
                 v
                LLM
                 |
                Tool
```

## 是不是所有 Agent 都应该先 Planner？

答案：**不是。**

**简单任务**——例如打开微信：

如果 Planner：Step1 分析用户需求 → Step2 寻找微信 → Step3 打开微信 → Step4 确认。是不是有点浪费？因为**任务空间很小。** 直接 Think → Action 就够了。

**复杂任务**——例如帮我开发一个网站：

需要需求分析 → 数据库设计 → 后端开发 → 前端开发 → 测试 → 部署。没有 Planner：**很容易乱。**

所以：

> **Planner 的触发条件：任务复杂度超过单步决策能力。**

## 但是一个新问题出现了

现在 Agent 架构：

```
                  Memory
                     ↑
User → Planner → LLM → Tool → Environment
```

Planner 给出了：Step1 查询天气 → Step2 订酒店 → Step3 规划路线。

执行 Step1，结果：**天气——暴雨。**

那 Step2 的酒店选择是不是应该改变？**原计划还能执行吗？**

这时候发现：**计划不是永远正确的。**

于是下一个组件自然出现：Reflection（反思）或者 Replanning（重新规划）。

## 今天的思考题

**问题 1：**

为什么说"Planner 不是让 Agent 变聪明，而是管理复杂性"？

**问题 2：**

一个 Agent——"帮我查今天东京天气"和"帮我设计一个东京五日旅行"——为什么前者不需要 Planner，后者需要？

**问题 3：**

假设 Planner 输出：

```
Step1: 打开浏览器
Step2: 搜索酒店
Step3: 预订酒店
```

执行到 Step2 时发现：**用户没有告诉预算。**

你觉得 Agent 应该：

- A. 继续执行原计划
- B. 停止并询问用户
- C. 自己猜一个预算

为什么？

（第三题会引出 Agent 里面非常重要的东西：不确定性处理和人机协作 Human-in-the-loop。）

---

**上一篇：**[Agent 学习（十）——Memory 的三种形态](/posts/agent-learning-7)
**下一篇：**[Agent 学习（十二）——Planner 的深度与 Reflection 预告](/posts/agent-learning-planner-qa)
