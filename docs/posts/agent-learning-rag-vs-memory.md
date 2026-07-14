---
title: Agent 学习（十九）——Memory vs RAG
date: 2026-07-14
author: myWorldmakerTonyczk
series: Agent 学习
seriesOrder: 19
---

# Agent 学习（十九）——Memory vs RAG

> 上一节留了一个问题：为什么 Memory 不能替代 RAG？这一节从答案开始，然后深入两者的架构区别。

---

## 先看你的回答

**问题 1**：为什么 Memory 不能替代 RAG？

> 因为 Memory 不能做到事无巨细，记录每一个信息，即使是很重要的信息，也可能没有长期记忆，所以需要 B 方式去查找。

**问题 2**：为什么硬盘扫描不属于 Memory？

> B 是进行的硬盘扫描，并没有记录信息，所以不属于 Memory。

**很好。** 你的回答已经抓住了 Memory 和 RAG 的根本区别。尤其第一点——"Memory 不能做到事无巨细，记录每一个信息"——这是非常关键的。很多人学习 Agent 时最大的误区就是"既然有 Memory，为什么还需要 RAG？"你已经理解了核心原因。

## 1. 为什么 Memory 不能替代 RAG？

Memory 的目标不是保存所有知识。Memory 保存的是：**Agent 认为未来有价值的信息。**

例如：

```json
{
  "preference": "喜欢深入技术解释",
  "skill": "Java backend"
}
```

但是用户电脑里有：

- `SpringBoot项目设计.pdf`（100 页）
- `数据库设计.docx`（50 页）
- `接口文档.md`（2000 行）

这些怎么办？如果全部放 Memory：

**问题 1：存储爆炸。** 用户所有文件 → Memory——不可行。

**问题 2：检索困难。** Memory 中有用户偏好、项目 A、项目 B、项目 C……Agent 每次都读取？成本巨大。

**问题 3：生命周期不同。** 今天正在整理桌面，扫描 500 个文件——明天就没意义了。

所以：**Memory 不是知识库。**

## 2. 为什么硬盘扫描属于 RAG？

关键区别不是"有没有保存"，而是**保存目的不同。**

**Memory** 保存：关于用户和 Agent 自身状态的信息。

例如：用户喜欢 Java、上次任务失败原因、当前任务状态。

**RAG** 保存：外部知识。

例如：公司文档、代码库、PDF、产品手册、论文。

区别：

| Memory | RAG |
|---|---|
| 我是谁？ | 世界有什么？ |
| 用户是谁？ | 资料在哪里？ |
| 之前发生了什么？ | 知识是什么？ |

## 架构区别

**Memory：**

```
              Agent
                |
             Memory
                |
       用户历史/任务状态
```

**RAG：**

```
              Agent
                |
             Retriever
                |
          Vector Database
                |
          External Knowledge
```

## 举例：你的 Windows Agent

用户："找去年 Spring Boot 项目文档。"

**如果只用 Memory：**

Memory 中有 `{"user_skill": "Java", "project": "论坛情感分析系统"}`。Agent 知道你做过 Spring Boot 项目，但**不知道文件在哪里。** 所以它可能说："你之前做过相关项目，但我找不到文档。"

**如果使用 RAG：**

```
用户问题 → Embedding → 搜索硬盘文档索引
→ 找到 SpringBoot论坛情感平台设计.pdf
→ 返回给LLM → 回答
```

## RAG 的核心思想

其实一句话：

> **不让 LLM 记住所有知识，而是在需要时去查找知识。**

这和人类非常像。你不会记住大学所有教材，但是你知道**去哪里找。**

## 现在 Agent 架构增加 RAG

```
                  Memory
                     ↑
User → Workflow → LLM → Tool → Environment
                |
               RAG
                |
          Knowledge Base
```

但是这里马上出现一个新问题：RAG 怎么知道"哪个文档相关"？

比如硬盘 100 万个文件。用户问"Spring Boot 项目文档"——不能一个一个打开。

所以需要：Embedding、Vector Database、Similarity Search。

这就是下一节。

## 今天的思考题

不过在进入 RAG 技术细节之前，先确认一个更底层的问题。

假设你的 Windows Agent 拥有：

- **Memory**：用户喜欢 Java
- **RAG**：硬盘里有 10000 个文件索引

用户问：

> 帮我写一个 Spring Boot 项目的总结。

你觉得——应该优先使用 Memory 还是 RAG？为什么？

（这个问题会帮助你理解 Agent 中"什么时候调用什么能力"。）

---

**上一篇：**[Agent 学习（十八）——Agent Loop 修正与第一阶段总结](/posts/agent-learning-loop-fix)
**下一篇：**[Agent 学习（二十）——上下文管理与 RAG 前的检查](/posts/agent-learning-context-management)

---

*Agent 学习系列，未完待续。*
