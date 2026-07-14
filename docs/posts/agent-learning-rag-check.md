---
title: Agent 学习（二十一）——RAG 前的检查与 Embedding 预告
date: 2026-07-14
author: myWorldmakerTonyczk
series: Agent 学习
seriesOrder: 21
---

# Agent 学习（二十一）——RAG 前的检查与 Embedding 预告

> 上一节留了三个检查问题。这一节先看答案，然后深入，最后引出 RAG 的核心技术——Embedding。

---

## 先看你的回答

**问题 1**：为什么不直接把整个硬盘文件内容全部放入 LLM？

> 首先是上下文长度限制，其次就是注意力分散。

**问题 2**：Memory 和 RAG 最大区别是什么？

> Memory 记录更上层的信息，而 RAG 记录更具体的信息。

**问题 3**：修改登录 Bug——只查 Memory、只查 RAG、还是先 Memory 再 RAG？

> C，应该先查 Memory 中的记录获得信息概要，再思考具体需要的信息，所以去查 RAG。

**3 个问题全部正确。** 而且第三题非常关键——你已经开始理解 Agent 的一个核心能力：**Agent 不是固定调用所有组件，而是根据任务动态决定调用哪些能力。** 这就是后面讲 Tool Selection、Tool Registry、MCP 时的基础。

## 问题 1 深入：为什么不能全塞进 LLM？

你的回答提到了两个点，分别对应：

**1. Context Window 限制。** LLM 有输入长度限制。你的硬盘——项目 A 10000 行代码、项目 B 50000 行代码、100 个 PDF——全部塞进 Prompt，不现实。

**2. Attention Dilution（注意力稀释）。** 这个更重要。即使模型支持 100 万 token，也不代表效果好。你问"我的登录 Bug 在哪里？"Prompt 前面是无关日志、无关代码、无关文档……LLM 需要在大量噪声里寻找答案。

类似你让一个程序员阅读整个公司的所有代码然后找一个 Bug——不是能力问题，是**信息组织问题。**

所以 RAG 的思想不是"给更多信息"，而是：**先筛选，再提供。**

## 问题 2 深入：Memory 和 RAG 的区别（再抽象一层）

你说了"上层 vs 具体"——正确。再抽象一下：

**Memory** 回答：这个 Agent 和这个用户之间发生过什么？

例如：用户喜欢 Java、正在开发论坛系统、偏好深入解释。它描述**关系和状态。**

**RAG** 回答：外部世界有什么资料？

例如：Spring Boot 项目 Controller 设计、数据库结构、接口文档、代码实现。它描述**知识。**

一句话：

> **Memory = 关于人的记忆。RAG = 关于世界的知识。**

## 问题 3 深入：为什么选 C？

你回答"先查 Memory 获得概要，再思考具体需要的信息，然后去查 RAG"——**非常好。** 这已经接近真实 Agent 的运行流程。

模拟一下。用户："帮我修改去年那个 Java 项目的登录 Bug。"

**Step 1：Memory。** Agent 查询用户历史，得到：项目是论坛情感管理平台，后端 Spring Boot，数据库 MySQL，认证 JWT。现在 Agent 知道**这个项目是什么。**

**Step 2：LLM 判断缺什么。** 登录 Bug 在哪里？Memory 不知道。所以需要 RAG。

**Step 3：RAG。** 查询登录、JWT、Security、Controller。找到 `SecurityConfig.java`、`JwtFilter.java`、`UserController.java`、登录接口文档。

**Step 4：LLM 推理。** 结合 Memory（用户背景）+ RAG（具体代码）→ 生成修改方案。

架构：

```
                 User
                   |
                   v
                 Agent
                   |
        +----------+----------+
        |                     |
     Memory                  RAG
        |                     |
 用户背景/状态          外部知识
        \                     /
         \                   /
              LLM
               |
          Decision
```

到这里，你已经掌握一个非常重要的 Agent 思想：

> **Agent 的核心不是拥有所有信息，而是在正确的时候，找到正确的信息。**

这也是为什么 Agent = LLM + Tools + Memory + RAG——但真正困难的是：**什么时候调用哪个东西。**

## 下一步：Embedding 和 Vector Database

现在我们有一个问题：**RAG 怎么找到相关文档？**

比如你的硬盘有 100 万个文件。用户搜索"Spring Boot 登录相关代码"。系统怎么知道应该找 `JwtFilter.java`，而不是 `SpringBoot安装教程.pdf`？

这就需要理解：

> **Embedding（向量化）**

它解决：如何让计算机理解文本之间的语义关系。

下一课我们会从零讲：

- 什么是 Embedding
- 为什么文字可以变成数字
- 为什么"猫"和"狗"的向量距离近
- Vector Database 存什么
- 相似度搜索怎么工作
- RAG 完整流程

## 过渡问题

在进入之前，先想一个直觉题。

假设数据库里有：

- A：`Spring Boot 登录功能使用 JWT 认证`
- B：`今天学习 Java 的心得分享`
- C：`如何配置 Spring Security Filter`

用户搜索：**"登录认证问题"。**

你觉得——传统 SQL `WHERE text LIKE '%登录认证%'` 为什么可能找不到正确结果？而 RAG 为什么可能找到？

不用讲技术细节，先说你的直觉理解。

---

**上一篇：**[Agent 学习（二十）——上下文管理与 RAG 前的检查](/posts/agent-learning-context-management)

---

*Agent 学习系列，未完待续。*
