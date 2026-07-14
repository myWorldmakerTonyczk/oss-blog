---
title: Agent 学习（二十）——上下文管理与 RAG 前的检查
date: 2026-07-14
author: myWorldmakerTonyczk
series: Agent 学习
seriesOrder: 20
---

# Agent 学习（二十）——上下文管理与 RAG 前的检查

> 上一节问：写项目总结时，优先 Memory 还是 RAG？这一节从答案开始，然后深入 Agent 的核心难题——上下文管理。

---

## 先看你的回答

> 首先查 Memory 中有没有概要的记录，然后再在 RAG 中查具体的文件位置和项目结构。

**很好。** 这个回答非常关键，因为你已经不再把 Memory 和 RAG 看成两个独立功能，而是在思考：**Agent 如何选择和组合能力。** 这正是 Agent 架构设计的思维方式。

## 为什么先查 Memory？

你的理由：Memory 中可能有概要记录。正确。

因为 Memory 的特点是**高层信息（High-level Context）。**

例如 Memory 中存着：

```json
{
  "project": "论坛情感管理平台",
  "tech_stack": ["Spring Boot", "Vue", "BERT"],
  "role": "backend"
}
```

它告诉 Agent：**这个项目是什么。**

但是 Memory 不应该保存 `PostController.java` 第 23 行、`EmotionService.java` 第 100 行、数据库字段设计——这些属于**具体知识。**

所以：

| | 回答的问题 |
|---|---|
| Memory | 这个东西是什么？ |
| RAG | 具体内容在哪里？ |

## 完整流程

用户："帮我写一个 Spring Boot 项目总结。"

**第一步：读取 Memory。**

Agent 查询"用户有什么相关背景？"得到：项目是论坛情感管理平台，技术栈 Spring Boot + MyBatis + BERT。Agent 获得**任务上下文。**

**第二步：判断是否需要 RAG。**

LLM 发现需要项目结构、具体功能、数据库设计、接口——Memory 不够。于是调用 RAG。

**第三步：RAG 检索。**

查询 Spring Boot 项目结构、Emotion 模块、数据库设计。找到 `README.md`、`architecture.pdf`、`database.sql`。

**第四步：LLM 总结。**

结合 Memory（用户背景）+ RAG（项目资料）→ 生成项目总结。

架构：

```
             User
               |
               v
             Agent
               |
        +------+------+
        |             |
     Memory          RAG
        |             |
 用户信息        外部知识
        |             |
        +------+------+
               |
               v
              LLM
               |
               v
             Answer
```

## 一个非常重要的 Agent 设计原则

> **不要让所有东西都进入 Prompt。**

为什么？例如用户有 10000 个项目文件。如果全部文件内容 → Prompt → LLM：

**问题 1：Token 爆炸。** LLM 输入几十万字，成本巨大。

**问题 2：注意力下降。** 信息太多，真正需要的信息反而被淹没。

所以 Agent 的思想不是"给模型更多信息"，而是：**在正确时间提供正确的信息。**

这就是：

> **Context Management（上下文管理）**

你现在实际上已经进入 Agent 的核心难题。不是"LLM 会不会推理"，而是——

**Agent 如何管理上下文？** 包括：Memory、RAG、Tool Result、Conversation History、Working Memory。

## 进入 RAG 前的检查

RAG 是 Agent 学习里第一个容易"会用但不理解"的东西。先回答三个问题：

**问题 1：**

为什么不直接把整个硬盘文件内容全部放入 LLM？

**问题 2：**

Memory 和 RAG 最大区别是什么？请不要用定义回答——用"它们分别回答什么问题"来回答。

**问题 3：**

假设用户问：

> "帮我修改去年那个 Java 项目的登录 Bug。"

Agent 应该——

- A. 只查 Memory
- B. 只查 RAG
- C. 先 Memory，再 RAG

为什么？

答完我们进入：Embedding 和 Vector Database——RAG 为什么能找到相关信息。

---

**上一篇：**[Agent 学习（十九）——Memory vs RAG](/posts/agent-learning-rag-vs-memory)
**下一篇：**[Agent 学习（二十一）——RAG 前的检查与 Embedding 预告](/posts/agent-learning-rag-check)

---

*Agent 学习系列，未完待续。*
