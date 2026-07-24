---
title: Agent 学习（二十六）——MCP：从 API 到 Agent 基础设施
date: 2026-07-15
author: myWorldmakerTonyczk
series: Agent 学习
seriesOrder: 26
---

# Agent 学习（二十六）——MCP：从 API 到 Agent 基础设施

> 上一节问：Weather API 和 Weather MCP Server 有什么本质区别？这一节从你的答案开始，深入 MCP 为什么不是 API 标准化，而是 Agent 的基础设施层。

---

## 先看你的回答

> MCP 首先是一个统一规范，用来统一不同的 Tool 标准，提高复用性。

**很好。** 你的回答抓住了 MCP 最核心的一点。不过我们继续往深处挖——因为这里是很多人理解 MCP 时最容易停留的地方。

很多人会说：**MCP = API 标准化。** 这个说法接近但不完整。

MCP 不只是规定"怎么调用 API"，它解决的是：**Agent 如何发现、理解、连接和使用外部能力。**

---

## 1. API 和 MCP 的本质区别

先看普通 API。例如天气 API：

```
GET /weather?city=Tokyo

返回：{ temperature: 20, weather: "sunny" }
```

它解决：**一个程序如何调用另一个程序。**

```
Application → API → Weather Service
```

但 Agent 世界有一个额外问题：**LLM 不知道**——有哪些能力？每个能力干什么？参数是什么？权限是什么？怎么组合使用？

例如 Windows Agent 同时连接文件系统 API、浏览器 API、邮件 API、数据库 API——如果每个都是自己的文档、参数格式、鉴权方式——Agent 很痛苦。

---

## 2. MCP 解决的三个问题

MCP = **Model Context Protocol**。关键词是 **Context**，不是 API。

它提供一种标准方式，让 Agent 获取三类信息：

### ① Tools — 我能做什么？

```json
{
  "name": "read_file",
  "description": "读取本地文件",
  "input_schema": { "path": "string" }
}
```

### ② Resources — 我能访问什么数据？

例如：文件、数据库、Git 仓库、知识库。

### ③ Prompts — 有哪些预定义能力模板？

例如：代码审查模板、总结文档模板。

所以 MCP 不只是 Function Calling。它更像：**Agent 与外部世界之间的通用接口层。**

---

## 3. 为什么叫 USB-C？

你说"提高复用性"——这个理解非常接近。

以前：

```
手机 A → 充电器 A
手机 B → 充电器 B
手机 C → 充电器 C
```

USB-C：

```
所有设备 → USB-C 标准 → 所有充电器
```

MCP 同理。以前：

```
Agent A → 工具系统 A
Agent B → 工具系统 B
Agent C → 工具系统 C
```

MCP：

```
          Agent
            |
           MCP
            |
  ---------------------
  |        |          |
文件系统  GitHub    数据库
```

---

## 4. MCP 和 Tool Registry 的关系

这里连接前面的内容。

- **Tool Registry** 解决：我有哪些工具？
- **MCP** 解决：外部工具如何标准化接入？

```
             Agent
               |
        Tool Registry
               |
          MCP Client
               |
          MCP Protocol
               |
          MCP Server
               |
        External Tools
```

举例：Windows Agent 的 Tool Registry 记录着 `delete_file`、`read_file`、`open_app`——但这些工具来自哪里？可能：本机 Windows MCP Server、浏览器 Browser MCP Server、Git MCP Server——Agent 不需要为每个重新开发。

---

## 5. 回到你的 Windows AI 助手：最终架构

```
                 User
                   |
                   v
                Agent
                   |
             Workflow
                   |
                  LLM
                   |
          +--------+--------+
          |                 |
     Tool Registry        Memory
          |                 |
      MCP Client          RAG
          |
     MCP Protocol
          |
 ----------------------------
 |         |              |
Windows  Browser        Git
Server   Server        Server
```

---

## 6. 你已经走完的内容

| 阶段 | 主题 |
|---|---|
| ✅ | LLM 基础 |
| ✅ | Tool |
| ✅ | Function Calling |
| ✅ | Tool Registry |
| ✅ | Memory |
| ✅ | RAG |
| ✅ | Workflow |
| ✅ | Reflection |
| ✅ | MCP 基础 |

---

## 下一阶段：Multi-Agent

因为现在有一个新问题——

单个 Agent 越来越复杂：LLM + Planner + Tool + Memory + RAG + MCP……

比如开发一个软件，需要：产品经理 Agent、架构师 Agent、程序员 Agent、测试 Agent。

- 为什么不让一个 Agent 全干？
- 什么时候应该拆？
- 多 Agent 如何通信？
- CrewAI、AutoGen 为什么出现？

---

## 今天的思考题

假设你设计一个 Windows AI 助手。你有两个方案：

- **A**：直接把 Windows API 全封装成 Tool 给 Agent。
- **B**：Windows API → MCP Server → Agent。

为什么 **B 在大型 Agent 系统中更合理**？

从架构角度回答——你已经能答到这个层次了。

---

**上一篇：**[Agent 学习（二十五）——Tool Schema 与 Function Calling 演化路线](/posts/agent-learning-tool-schema)
**下一篇：**[Agent 学习（二十七）——MCP Client、Protocol、Server 详解](/posts/agent-learning-mcp-arch)

---

*Agent 学习系列，未完待续。*
