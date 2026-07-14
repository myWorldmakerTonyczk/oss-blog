---
title: Agent 学习（十三）——Reflection
date: 2026-07-14
author: myWorldmakerTonyczk
series: Agent 学习
seriesOrder: 13
---

# Agent 学习（十三）——Reflection

> 上一节留了一个问题：爬虫报错 404，没有 Reflection 和有 Reflection 分别会怎么表现？这一节从答案开始，然后正式进入 Reflection。

---

## 先看你对上一节问题的回答

如果 Agent **没有 Reflection**：

> 它会强制按 Planner 执行接下来的计划。

如果 Agent **有 Reflection**：

> 应该发现问题，先判断能否自行解决，不行就问用户，并重新 Planner。

**很好。** 你这次的回答已经触碰到了 Reflection 的核心作用。尤其这句话——"先判断能否自行解决，不行就问用户，并重新 Planner"——这其实已经包含了三个工业 Agent 设计里的关键机制：

- **评估（Evaluate）**
- **修正（Correct）**
- **重新规划（Re-plan）**

我们展开。

## 第七课：Reflection（反思）为什么出现？

先回到没有 Reflection 的 Agent。

现在架构：

```
             Memory
                ↑
User → Planner → LLM → Tool → Environment
```

看起来很完整。

但是测试一下。任务：

> 写一个 Python 爬虫。

Planner：

```
Step1: 分析需求
Step2: 写代码
Step3: 运行
Step4: 输出结果
```

执行——Step1 完成。Step2 生成：

```python
import requests
requests.get(url)
```

Step3 运行。结果：**404 Not Found。**

**没有 Reflection：**

Tool 执行失败 → LLM 继续 Step4 → 输出"代码完成"。

问题：**它不知道——自己刚才失败了。**

所以第一个问题出现：

> Agent 需要知道自己的行为结果是否符合目标。

## Reflection 的定义

**Definition：**

> Reflection 是 Agent 对自己的行为结果进行评估，并决定下一步如何调整的机制。

简单说——

**普通 Agent：** 想 → 做 → 结束。

**Reflection Agent：** 想 → 做 → 检查 → 调整 → 继续。

架构变化：

之前：

```
LLM → Tool → Environment → 结果 → LLM
```

加入 Reflection：

```
              Reflection
                   ↑
                   |
LLM → Action → Tool → Result
                   |
              Evaluate
```

## 为什么需要 Reflection？

因为现实世界有三个特点。

### 1. 环境是不确定的

例如 Agent 要打开微信，计划：点击桌面图标。但是**桌面没有微信。**

没有 Reflection：失败。

有 Reflection：发现目标——打开微信，当前方法——失败。重新考虑：搜索菜单 → 找到微信 → 打开。

### 2. Tool 可能失败

例如天气 API 返回：

```json
{ "error": "timeout" }
```

Agent 需要判断：是否重试？是否换 API？是否告诉用户？

### 3. 初始计划可能错误

这个很重要。**Planner 不是上帝。** Planner 也会错。

例如用户说"帮我安排旅游"，Planner：Step1 订酒店。但是——**忘了问日期。**

执行到一半，发现没有日期。

Reflection 发现：计划缺少关键条件。于是——**重新 Planner。**

## Reflection 和普通 Think 的区别

这个非常容易混。

你之前说 LLM 负责思考——对。但是 Think 和 Reflection 关注点不同。

**Think**：面对**未来**——下一步怎么做？例如：我要查询天气。

**Reflection**：面对**过去**——刚才做得对不对？例如：查询天气失败。为什么？是不是参数错？是不是工具错？下一步怎么办？

简单记：

> **Think：未来。Reflection：过去。**

## ReAct：一个重要过渡

现在介绍一个非常经典的 Agent 模式：**ReAct**——Reason + Act（推理 + 行动）。

它的思想：不要一次性计划全部，而是循环：

```
Thought → Action → Observation → Thought → Action → Observation → ...
```

例如查天气：

```
Thought: 我需要天气信息。
  ↓
Action: 调用 weather_tool
  ↓
Observation: 东京25度
  ↓
Thought: 已经获得信息。
  ↓
Answer: 东京25度。
```

架构：

```
              +---------+
              |  LLM    |
              +---------+
                   |
              Thought
                   |
              Action
                   |
              Tool
                   |
              Observation
                   |
              LLM
```

你会发现：**这是不是和你之前说的 Agent Loop 很像？**

你之前回答：Agent loop 是观察、思考。完全正确。

ReAct 本质就是：**把 Agent Loop 明确化。**

## 但是 Reflection 有一个危险

你可能已经想到。如果 Agent 一直反思会怎样？

```
代码失败 → 修改 → 失败 → 修改 → 失败 → 修改 → ...
```

**无限循环。**

所以必须有：**Stop Condition（停止条件）**

例如：最多 retry = 3。或者：判断无法自动解决 → 转人工。

这就是为什么真实 Agent 一定有：**Safety Layer + Human Approval。**

## 现在完整架构

我们已经接近真实 Agent：

```
                    Memory
                       ↑
User → Planner → LLM → Tool → Environment
                |
            Reflection
```

## 回到你的 Windows AI 助手

例如用户说"帮我整理桌面"。

Planner：

```
1. 扫描文件
2. 分类
3. 移动
4. 确认
```

执行——Tool `scan_desktop()` 返回：发现 1000 个文件，其中 900 个图片。

Reflection 检查：

> 问题：图片过多。是否应该创建图片目录？是否需要用户确认？

如果移动文件风险高——Reflection：**需要用户确认。**

这就是成熟 Agent 和简单自动化脚本的区别。

## 一个重要节点

你已经理解了：LLM、Tool、Memory、Planner、Reflection。

下一步我们会遇到一个更大的问题——

现在 Agent 里面有很多东西：Planner、LLM、Memory、Tool、Reflection。**谁控制它们的执行顺序？**

比如：什么时候调用 Memory？什么时候 Planner？什么时候 Reflection？

如果全部交给 LLM：会混乱。

于是出现：**Workflow（工作流）**

这也是为什么后来 LangGraph、AutoGen、CrewAI 这些框架开始强调流程编排。

## 今天的思考题

**问题 1：**

为什么 Reflection 不是简单的"再让 LLM 思考一次"？

**问题 2：**

如果一个 Agent 每次调用 Tool 后，都强制 Reflection 一次——你觉得有什么问题？

**问题 3：**

ReAct 的 Thought → Action → Observation，为什么比"Planner 一次规划 100 步 → 执行"更适合不确定环境？

你先回答这三个，我们再进入 Workflow。你现在已经到了 Agent 架构的核心部分。

---

**上一篇：**[Agent 学习（十二）——Planner 的深度与 Reflection 预告](/posts/agent-learning-planner-qa)
**下一篇：**[Agent 学习（十四）——Reflection 的深度与 Workflow 预告](/posts/agent-learning-workflow-preview)

---

*Agent 学习系列，未完待续。*
