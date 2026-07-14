---
title: Agent 学习（九）——Memory 的工作原理
date: 2026-07-14
author: myWorldmakerTonyczk
series: Agent 学习
seriesOrder: 9
---

# Agent 学习（九）——Memory 的工作原理

> 上一节知道了 Memory 为什么需要。这一节来看 Memory 应该放在架构的什么位置，以及它到底怎么工作。

## Memory 应该放在哪里？

当前架构：

```
User
  |
LLM
  |
Tool
  |
Environment
```

加入 Memory：

```
              Memory
                 ↑
                 |
User → LLM → Tool → Environment
                 |
              结果
```

但是这里有一个问题：**LLM 自己会记忆吗？**

**不会。**

注意：LLM 每次调用，类似：

```python
response = model.generate(prompt)
```

它不知道上一次发生了什么。除非——**你把历史信息重新放进去。**

所以真正流程：

```
过去信息
     |
     v
 Memory
     |
整理相关内容
     |
     v
 Prompt
     |
     v
 LLM
```

这里出现一个非常重要的思想：

> **Memory 不是让 LLM "真的记住"，而是在每次决策之前，把需要的信息重新提供给 LLM。**

这和人的记忆有一点不同。

## Memory 的简单架构

```
              User
                |
                v
             Agent
                |
       ----------------
       |              |
      LLM          Memory
       |              |
       |         保存/读取
       |
      Tool
       |
 Environment
```

## 回到整理下载文件夹的例子

未来你的 Agent 可能会这样工作：

用户："帮我整理下载文件夹。"

第一次——

Memory 记录：

- 任务：整理下载文件夹
- 状态：扫描完成

第二天——

用户："继续昨天没完成的整理。"

Agent 读取 Memory：

- 昨天：图片已整理
- 视频未处理

→ 继续。

这就是 Memory 的价值。

## 但这里出现一个新问题

我们有 Memory 了。可是——**Memory 存什么？**

比如：

- 下载文件夹 1000 个文件——全部存？不现实。
- 用户聊天 10000 条——全部塞给 LLM？也不现实。

所以接下来会出现 Memory 的核心问题：

> **什么应该记？什么时候取？怎么组织？**

这会引出：

- Short-term Memory（短期记忆）
- Long-term Memory（长期记忆）
- Working Memory（工作记忆）
- Vector Memory（向量记忆）

## 先来回答三个问题

在进入下一节之前，请先自己想一想：

**问题 1**：为什么说"Memory 不只是为了提高性能"？请结合 Agent 的特点回答。

**问题 2**：如果没有 Memory，一个 Agent 在执行"帮我整理桌面"时，可能会出现什么问题？

**问题 3**：假设你设计一个 Windows Agent，下面两个信息——

- A：用户喜欢 Java
- B：刚才扫描桌面发现有 500 个文件

你觉得这两个应该存在哪一种 Memory？为什么？

（提示：这个问题会直接引出短期记忆和长期记忆。）

---

**上一篇：**[Agent 学习（八）——Memory 的诞生](/posts/agent-learning-5)
**下一篇：**[Agent 学习（十）——Memory 的三种形态](/posts/agent-learning-7)
