---
title: Agent 学习（二十七）——MCP Client、Protocol、Server 详解
date: 2026-07-15
author: myWorldmakerTonyczk
series: Agent 学习
seriesOrder: 27
---

# Agent 学习（二十七）——MCP Client、Protocol、Server 详解

> 上一节画了 MCP 架构图，你问：MCP Client、MCP Protocol、MCP Server 分别是什么？这一节拆开讲。

---

## 一句话概括

| 层 | 一句话 | 类比 |
|---|---|---|
| **MCP Client** | Agent 体内的"翻译官"，负责向外部发请求 | 手机上的 USB-C 接口芯片 |
| **MCP Protocol** | Client 和 Server 之间的"语言规范" | USB-C 协议标准 |
| **MCP Server** | 外部系统的"包装层"，把真实能力暴露出来 | 充电器/显示器/外设 |

---

## 1. MCP Server — 最外层的包装

MCP Server 是**真正和外部世界打交道**的东西。

例如你的 Windows Agent 想操作文件——需要一个 **Windows MCP Server**：

```
Windows MCP Server
    |
    |-- 暴露 Tool: read_file, write_file, delete_file
    |-- 暴露 Resource: 文件目录结构
    |-- 内部调用真实的 Windows API
```

它的职责：把底层的 Windows API / 文件系统调用，包装成 MCP 标准格式，供 Agent 使用。

类似：**充电器。** 它把墙上的 220V 交流电，转成 USB-C 标准的 5V 直流电。

不同的 MCP Server 连接不同的外部系统：

```
GitHub MCP Server    → GitHub API
Database MCP Server  → MySQL / PostgreSQL
Browser MCP Server   → Puppeteer / Playwright
FileSystem MCP Server → 本地文件系统
```

---

## 2. MCP Client — Agent 体内的翻译官

MCP Client 住在 Agent 这一侧。它是 **Agent 向 MCP Server 发请求的通道**。

```
Agent
  |
  |-- LLM
  |-- Tool Registry
  |-- MCP Client        ← 这个
  |-- Memory
  |-- RAG
```

当 Agent 需要调用外部工具时：

```
Agent 说："我要读文件 C:/test.txt"
    ↓
MCP Client 翻译成 MCP 格式请求
    ↓
发给 MCP Server
    ↓
MCP Server 执行
    ↓
结果返回 → MCP Client 解析 → Agent
```

类似：**你手机上的 USB-C 接口芯片。** 你插上充电器，芯片负责和充电器通信、协商电压、传输电流。你不用关心协议细节。

---

## 3. MCP Protocol — 两者之间的语言

MCP Protocol 是 Client 和 Server 之间**约定的通信格式**。

就像 USB-C 规定了引脚定义、电压档位、数据传输速率——MCP Protocol 规定了：

- 请求格式（JSON-RPC）
- 有哪些方法（`tools/list`、`tools/call`、`resources/read`）
- 参数怎么传
- 错误怎么报

举例。Client 问 Server"你有什么工具？"：

```json
// Client → Server
{ "jsonrpc": "2.0", "method": "tools/list", "id": 1 }

// Server → Client
{
  "jsonrpc": "2.0",
  "result": {
    "tools": [
      { "name": "read_file", "description": "读取文件", "inputSchema": { "path": "string" } }
    ]
  },
  "id": 1
}
```

调用工具：

```json
// Client → Server
{ "jsonrpc": "2.0", "method": "tools/call", "params": { "name": "read_file", "arguments": { "path": "C:/test.txt" } }, "id": 2 }

// Server → Client
{ "jsonrpc": "2.0", "result": { "content": [{ "type": "text", "text": "文件内容..." }] }, "id": 2 }
```

---

## 4. 三者关系：一张图

```
        Agent
          |
     Tool Registry
          |
      MCP Client          ← "翻译官"，住在 Agent 体内
          |
    ===== MCP Protocol ====   ← "语言"，JSON-RPC 规范
          |
      MCP Server          ← "包装层"，连接外部世界
          |
     Windows API / DB / Browser ...
```

或者用餐厅类比：

| 层 | 类比 |
|---|---|
| MCP Client | 服务员（听你说要什么，翻译给厨房） |
| MCP Protocol | 点餐规范（"前菜→主菜→甜点"，按顺序出） |
| MCP Server | 厨房（真正做菜的地方） |

---

## 5. 为什么分三层？

你之前的回答提到一个关键词：**复用性。**

如果 Client 和 Server 直接耦合：

```
Agent A → 专用协议 → Server A
Agent B → 专用协议 → Server B
```

每加一个 Server，Agent 要重写对接代码。

分三层之后：

```
Agent A → MCP Client → MCP Protocol → 任何 MCP Server
Agent B → MCP Client → MCP Protocol → 任何 MCP Server
```

**同一个 Server 可以被不同 Agent 使用。同一个 Agent 可以接不同 Server。**

工具生态共享——这就是 MCP 三层架构的设计目的。

---

## 下一节

回到主线：Multi-Agent——什么时候一个 Agent 不够用，需要拆成多个？

---

**上一篇：**[Agent 学习（二十六）——MCP：从 API 到 Agent 基础设施](/posts/agent-learning-mcp)
**下一篇：**[Agent 学习（二十八）——MCP 的解耦思想与三个阶段总结](/posts/agent-learning-mcp-decoupling)

---

*Agent 学习系列，未完待续。*
