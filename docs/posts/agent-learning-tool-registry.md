---
title: Agent 学习（二十三）——Tool Registry 工具注册表
date: 2026-07-15
author: myWorldmakerTonyczk
series: Agent 学习
seriesOrder: 23
---

# Agent 学习（二十三）——Tool Registry 工具注册表

> 上一节问：为什么不能直接把所有 Tool 丢给 LLM？这一节从答案开始，然后深入 Agent 的核心基础设施——Tool Registry。

---

## 先看你的回答

> 首先是上下文窗口限制。当只有三个工具时无所谓，但到上千个工具后，全丢给 LLM 会使注意力分散，加上上下文窗口限制。所以 Tool Registry 是来解决这些问题的。

**很好。** 你的回答已经抓住了 Tool Registry 存在的核心原因，而且和前面 RAG 的理解形成了一个很好的连接。

你实际上发现了一个 Agent 设计中的**共同问题**：

> 不是信息越多越智能，而是需要在正确的时候提供正确的信息。

这句话同时适用于：**Memory、RAG、Tool Registry。**

---

## 1. 为什么三个 Tool 可以直接给 LLM？

假设你的 Agent 只有三个工具：

- `weather(city)` — 查询天气
- `search_file(keyword)` — 搜索文件
- `delete_file(path)` — 删除文件

Prompt：

```
你可以使用以下工具：

1. weather — 查询天气
2. search_file — 搜索文件
3. delete_file — 删除文件
```

用户说"看东京天气"→ LLM 轻松匹配 `weather(city="Tokyo")`。没有问题。

---

## 2. 但是现实 Agent 不是三个工具

一个 Windows Agent 可能拥有：

- 打开应用、关闭应用、读取文件、写文件
- 移动文件、复制文件、压缩文件、发送邮件
- 搜索网页、浏览网页、截图、OCR
- 修改注册表、安装软件、卸载程序
- 管理进程、查看日志、配置网络
- ……

**几十甚至几千个。**

---

## 3. 第一个问题：Context Window（上下文窗口）

你说得对——上下文窗口限制。

算一下。每个 Tool 描述大约：

```json
{
  "name": "some_tool",
  "description": "xxx",
  "parameters": {}
}
```

平均 **200 token**。

1000 个 Tool：`200 × 1000 = 200,000 token`。

光工具说明就占了大量上下文。用户真正的问题"帮我订机票"——反而被淹没了。

---

## 4. 第二个问题：Attention Dilution（注意力稀释）

你提到了"注意力分散"——这是更深的问题。

给 LLM 1000 个工具：

```
Tool 1: 修改 Excel
Tool 2: 删除文件
Tool 3: 发送邮件
...
Tool 999: 查询天气
```

用户："今天东京天气怎么样？"

理论上 LLM 可以找到 `weather`。但是注意力需要从大量无关信息中筛选——类似让程序员阅读公司所有 API 文档，然后找一个天气接口。不是不能找，而是**效率下降。**

---

## 5. Tool Registry 是什么？

### 正式定义

> **Tool Registry**：管理 Agent 可用工具的系统，负责保存工具描述、参数定义、权限信息，并根据任务提供合适工具给 LLM。

注意：它**不是**工具。它是**工具管理中心。**

### 架构对比

**没有 Registry：**

```
         LLM
          |
    所有 Tool（1000 个）
          |
      Tool1  Tool2  Tool3  ...  Tool1000
```

**有 Registry：**

```
         LLM
          |
    Tool Registry
          |
    Relevant Tools（3-5 个）
          |
   Tool1  Tool2  Tool3
```

---

## 6. Tool Registry 的三个核心职责

### ① Tool Discovery（工具发现）

问题：LLM 问"我有什么能力？"

Registry 回答："你现在可以：查询天气、搜索文件、读取邮件。"

### ② Schema 管理

你之前提过一个非常好的点：**Tool 不只是函数，还需要暴露名称、说明、参数。**

普通函数：

```python
def search():
    pass
```

LLM 不知道它叫什么、干什么、参数是什么。

Registry 保存：

```json
{
  "name": "search_file",
  "description": "搜索用户电脑文件",
  "parameters": {
    "keyword": "string"
  }
}
```

### ③ Permission 管理

这连接到我们前面讲的安全。

例如 Registry 标记：

- `delete_file` — 风险等级：**HIGH**，需要确认
- `read_file` — 风险等级：**LOW**，无需确认

所以 Tool Registry 不只是目录。它也是：**Agent 的能力边界。**

---

## 7. 连接 Function Calling

你之前回答过：程序提供工具列表，让 LLM 返回固定格式——这就是 Function Calling 的核心思想。

以前：LLM 输出"我要调用天气接口"→ 程序要猜，危险。

Function Calling：LLM 返回结构化响应：

```json
{
  "name": "weather",
  "arguments": {
    "city": "Tokyo"
  }
}
```

程序直接解析执行。

流程：

```
User → LLM → Function Call → Tool Registry → Execute Tool → Return Result → LLM
```

---

## 8. 但是还有一个问题

Tool Registry 有 1000 个工具。问题来了：**Registry 怎么知道给 LLM 哪几个工具？**

例如用户："帮我整理桌面。"

1000 个工具中，真正需要的是：`search_file`、`move_file`、`read_file`。而不是：`weather`、`send_email`、`stock_query`。

所以未来会出现：**Tool Retrieval（工具检索）**。

思想和 RAG 非常像：

| | RAG | Tool Retrieval |
|---|---|---|
| 输入 | Query（查询） | Task（任务） |
| 检索目标 | 相关文档 | 相关工具 |

这就是为什么 Tool Registry 和 RAG 有相似思想。

---

## 9. 现在 Agent 架构再次升级

```
                 Memory
                    ↑
User → Workflow → Planner → LLM
                |             |
              RAG       Tool Registry
                |             |
          Knowledge         Tools
                            |
                        Permission
                            |
                        Environment
```

你已经理解到 Agent 工程的核心层了。

---

## 下一步：Function Calling → MCP

为什么现在 Agent 需要一个统一的工具协议？

因为每家公司的 Tool 格式不同、API 不同、参数不同——Agent 很难连接。

**MCP 就是解决这个问题的。**

---

## 今天的思考题

在进入 MCP 之前，先来一个设计题。

假设你开发 Windows AI 助手，现在有 **1000 个 Tool**。你觉得应该——

- **A**：启动 Agent 时，把全部 Tool 描述发送给 LLM。
- **B**：启动时只告诉 LLM："我有一个 Tool Registry，需要时查询工具。"
- **C**：根据用户任务，动态检索相关 Tool，再给 LLM。

选一个，并说明原因。

（这个问题会直接连接 MCP 和现代 Agent 架构。）

---

**上一篇：**[Agent 学习（二十二）——Embedding 与 RAG 原理](/posts/agent-learning-embedding)
**下一篇：**[Agent 学习（二十四）——Tool Registry 深入与 Tool Retrieval](/posts/agent-learning-tool-registry-2)

---

*Agent 学习系列，未完待续。*
