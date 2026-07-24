---
title: Agent 学习（二十五）——Tool Schema 与 Function Calling 演化路线
date: 2026-07-15
author: myWorldmakerTonyczk
series: Agent 学习
seriesOrder: 25
---

# Agent 学习（二十五）——Tool Schema 与 Function Calling 演化路线

> 上一节问：为什么不能直接把 Python 函数丢给 LLM？这一节从你的答案开始，然后串联从 Function Calling 到 MCP 的完整演化路线。

---

## 先看你的回答

> 首先如果只有一个函数名称，没有描述，那 Agent 很难做工具检索。其次就是规范返回格式，因为程序的输入值格式很严格，不能让 LLM 随意生成，所以需要规范。

**很好。** 这次回答比之前更进一步，因为你已经从"函数调用"上升到了"Agent 系统接口设计"。你的两个点——**工具发现（Tool Discovery）**和**结构化接口约束（Schema Constraint）**——正是为什么 Tool 不能只是一个 Python 函数暴露给 LLM 的原因。

---

## 1. 为什么不能只给函数名？

你说得对：如果只有一个函数名称，没有描述，Agent 很难做工具检索。

例如给 LLM：

```python
delete_file(path)
```

问题：LLM 知道这是删除文件吗？删除哪个文件？是否危险？什么时候应该调用？

**不一定。** 因为函数名是给程序员看的。程序员看到 `rm()` 可能知道是 remove——但 LLM 不应该依赖猜测。

所以 Tool 需要暴露**语义描述（Semantic Description）：**

```json
{
  "name": "delete_file",
  "description": "删除指定路径的文件，需要用户确认",
  "parameters": {
    "path": {
      "type": "string",
      "description": "目标文件路径"
    }
  }
}
```

这本质上是：**给 LLM 提供能力说明书。**

---

## 2. Tool Schema 本质是什么？

你说"规范返回格式，因为程序输入值格式很严格"——方向对，稍微修正一下：主要不是返回格式，而是**参数调用格式约束。**

没有 Schema：

```
LLM：我要删除 C 盘垃圾文件
程序：？？？（不知道 path 是什么、参数在哪里、格式是什么）
```

有 Schema：

```json
{
  "name": "delete_file",
  "arguments": {
    "path": "C:/temp/a.txt"
  }
}
```

程序可以直接解析 `args["path"]`，执行 `delete_file(path)`。

所以：**Schema 是 LLM 和程序之间的协议。**

---

## 3. 串起来：Function Calling 演化

最原始的方式：

```
User → LLM → 文本 → 程序猜测      ← 危险
```

Function Calling：

```
User → LLM → 结构化调用 {tool, args} → 程序执行
```

```
          User
            |
            v
           LLM
            |
            v
    Function Call JSON
            |
            v
      Tool Executor
            |
            v
        Real World
```

---

## 4. 更深的问题：1000 个 Tool 谁来管？

你现在理解 Tool = 函数 + 描述 + 参数 Schema。正确。

但如果有 1000 个 Tool——谁来管理？

没有 Registry：

```
Agent → 1000 个散落函数
```

有 Registry：

```
              Agent
                |
          Tool Registry
                |
     -------------------
     |       |         |
  weather delete   search_file
```

Registry 保存：

```json
{
  "name": "delete_file",
  "description": "删除文件",
  "schema": {},
  "permission": "HIGH"
}
```

---

## 5. 再往前一步：为什么需要 MCP？

假设每个平台都有自己的 Tool 格式：

```
OpenAI:  { function: "xxx" }
Claude:  { tool: "xxx" }
你的系统: { action: "xxx" }
```

问题：**工具生态无法共享。**

MCP 做的事情——统一 Tool Interface、Resource Interface、Prompt Interface，让 Agent 不关心工具是谁写的。

```
          Agent
            |
            v
        MCP Client
            |
            v
       MCP Protocol
            |
     -----------------
     |       |       |
 MCP Server  MCP Server  MCP Server
     |       |       |
 Database  Browser  FileSystem
```

---

## 6. 完整演化路线

你现在已经掌握了 Agent 的一条完整演化路线：

```
LLM
  ↓
LLM + API
  ↓
LLM + Tool
  ↓
LLM + Function Calling
  ↓
LLM + Tool Registry
  ↓
LLM + MCP
```

这条路线非常重要。因为以后你看到 LangChain Tools、OpenAI Function Calling、MCP Server、CrewAI Tools——本质都是在解决同一个问题：

> **如何让 LLM 安全、可靠、标准化地使用外部能力。**

---

## 下一节：MCP 深入

会重点讲：

- MCP 和普通 API 的区别
- MCP Client / Server 架构
- MCP 为什么叫"USB-C"
- 一个 Windows Agent 如何通过 MCP 控制电脑
- MCP 与 Tool Registry 的关系

---

## 今天的思考题

假设你有：

- **Weather API**：可以查询天气
- **Weather MCP Server**：也可以查询天气

两者都可以查询天气。问题：

**它们有什么本质区别？**

不要从代码格式回答，从 **Agent 架构角度** 回答。

可以先思考：API 解决的是"调用能力"，MCP 解决的可能是**什么**？

---

**上一篇：**[Agent 学习（二十四）——Tool Registry 深入与 Tool Retrieval](/posts/agent-learning-tool-registry-2)
**下一篇：**[Agent 学习（二十六）——MCP：从 API 到 Agent 基础设施](/posts/agent-learning-mcp)

---

*Agent 学习系列，未完待续。*
