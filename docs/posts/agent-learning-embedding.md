---
title: Agent 学习（二十二）——Embedding 与 RAG 原理
date: 2026-07-14
author: myWorldmakerTonyczk
series: Agent 学习
seriesOrder: 22
---

# Agent 学习（二十二）——Embedding 与 RAG 原理

> 上一节问：SQL `LIKE '%登录认证%'` 为什么可能找不到正确结果，而 RAG 可能找到？这一节从答案开始，然后进入 RAG 的核心技术。

---

## 先看你的回答

> 首先是 SQL 的模糊匹配，存储的结果可能不带这几个字，因为相同的语义可以有很多不同的词组。其次 RAG 可能通过语义向量查相似的语义，所以不受限于上述问题。

**非常好。** 这一题你的回答已经触及了 RAG 出现的根本原因。你实际上已经说出了：**关键词匹配（Keyword Search）和语义匹配（Semantic Search）的区别。** 这是理解 Embedding 的入口。

## 1. 为什么传统 SQL LIKE 搜索不够？

你的回答：存储结果可能不带这几个字，因为相同语义可以有很多不同词组。完全正确。

例如数据库中有：

- A：`Spring Boot 登录功能使用 JWT 认证`
- B：`Spring Security Filter 配置`
- C：`用户身份校验模块设计`

用户搜索"登录认证问题"。SQL `WHERE content LIKE '%登录认证%'`——找的是**字符串。**

结果：A 命中了。但是 B（Spring Security Filter 配置）实际上高度相关——然而没有"登录认证"这几个字。**漏掉。**

这叫：**Lexical Gap（词汇鸿沟）。** 人表达同一个意思，可以使用不同词。例如用户说"电脑打不开"，文档写"系统启动失败处理方案"——人知道相关，SQL 不知道。

## 2. RAG 为什么能解决？

你的回答：通过语义向量查相似语义。正确。

核心：**Embedding。**

### Embedding 是什么？

**Definition：**

> Embedding 是把文本转换成能够表示语义关系的数字向量。

例如——文本"猫"转换：`[0.23, 0.51, -0.12, ...]`。文本"小猫"可能：`[0.21, 0.49, -0.10, ...]`——**距离比较近。** 文本"汽车发动机"可能：`[-0.7, 0.3, 0.8, ...]`——**距离远。**

计算机不知道"猫"和"小猫"意思接近，但是它可以计算**向量距离。**

架构：

```
文本 → Embedding Model → [0.23, 0.51, -0.12...]
```

## 3. RAG 完整流程

假设你的硬盘有 100 万个文件。

### 第一步：建立索引（离线）

```
JwtFilter.java
  ↓ 切片
"JWT验证逻辑"、"token解析"、"用户认证"
  ↓ Embedding
[0.21, 0.54, 0.11...]
  ↓ 保存
Vector Database: 向量 [0.21, 0.54...] → 文本 "JWT验证逻辑..."
```

形成：文件 → Chunk → Embedding → Vector DB。

### 第二步：用户查询

用户"登录认证问题"→ 也进行 Embedding → 得到 `[0.20, 0.55, 0.10...]`。

### 第三步：相似度搜索

比较——查询向量 `[0.20, 0.55...]` 与数据库中 JWT 向量 `[0.21, 0.54...]`——**距离近。** 返回 `JwtFilter.java`。

### 第四步：给 LLM

```
用户问题 + 检索结果 → LLM → 回答
```

完整架构：

```
             User
              |
              v
           Query
              |
              v
        Embedding Model
              |
              v
       Vector Search
              |
              v
      Vector Database
              |
              v
      Relevant Documents
              |
              v
             LLM
              |
              v
            Answer
```

## 一个关键提醒

你刚才说"RAG 不受词限制"——方向对。但是不要理解成 RAG 完全理解语言。它也有局限。

例如用户说"帮我修复那个问题"——Embedding 可能找到很多"问题"，但是不知道**哪个问题。**

所以 RAG 需要：好的切片策略、元数据过滤、重排序（Rerank）、Agent 推理。

这又回到 Agent：**RAG 本身不是智能，它只是给 Agent 提供更好的信息来源。**

## 现在你的 Agent 架构

已经进化：

```
                         Memory
                            ↑
User → Workflow → Planner → LLM → Tool → Environment
                |             |
              RAG         Reflection
                |
          Vector DB
```

## 下一步：Tool Registry（工具注册表）

为什么？因为现在 Agent 有：天气 Tool、文件 Tool、浏览器 Tool、数据库 Tool、RAG Tool……

如果有 1000 个 Tool——LLM 怎么知道有哪些工具？什么时候调用？参数是什么？

这就是：**Function Calling → Tool Registry → MCP** 的演化路线。

## 今天的思考题

假设 Agent 有三个工具：

- `weather(city)`
- `search_file(keyword)`
- `delete_file(path)`

用户说："帮我看看东京天气。"

为什么不能直接把三个函数全部丢给 LLM？为什么需要 Tool Registry？

先从架构角度回答。你现在已经进入 Agent 工程设计阶段。

---

**上一篇：**[Agent 学习（二十一）——RAG 前的检查与 Embedding 预告](/posts/agent-learning-rag-check)
**下一篇：**[Agent 学习（二十三）——Tool Registry 工具注册表](/posts/agent-learning-tool-registry)

---

*Agent 学习系列，未完待续。*
