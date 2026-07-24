---
title: Agent 学习（二十八）——MCP 的解耦思想与三个阶段总结
date: 2026-07-15
author: myWorldmakerTonyczk
series: Agent 学习
seriesOrder: 28
---

# Agent 学习（二十八）——MCP 的解耦思想与三个阶段总结

> 上一节问：A（直接封 API）vs B（MCP Server）——为什么 B 更合理？这一节从你的答案开始，然后总结三个阶段，准备进入 Multi-Agent。

---

## 先看你的回答

> 首先是提高复用率。MCP 只需暴露 Client 层给 LLM 就行，底层可以连接不同的 Service，而 A 方法太耦合了。

**很好。** 你的回答已经抓住了 MCP 在大型 Agent 系统里的核心价值：**解耦 Agent 和具体能力实现。** 这其实已经接近软件架构设计，而不仅仅是 AI 概念。

---

## 1. 稍微调整一下术语

你说"MCP 只需暴露 Client 层给 LLM"——方向对，但严格来说 LLM 通常并不直接理解 MCP 协议。

完整结构：

```
              LLM
               |
          Agent Runtime
               |
          MCP Client
               |
        MCP Protocol
               |
          MCP Server
               |
       Windows Service / API
```

**Agent Runtime** 负责：发现工具、转换调用、管理上下文。

---

## 2. 为什么 A 会耦合？

方案 A：Windows API → Tool 封装 → Agent。

看起来简单：

```python
def open_app(name):
    os.start(name)
```

然后注册 `{"name": "open_app"}`。问题：**Agent 和 Windows 强绑定。**

以后换 Linux → `open_app()` 失效。换 Mac → 重新写。甚至让 Claude Agent 使用 → 也需要重新适配。

这就是 **Tight Coupling（紧耦合）。**

---

## 3. MCP 的抽象——你熟悉的方式

你用 Java，应该很熟悉接口思想。

**没有接口：**

```java
class WindowsFileSystem {
    void delete();
}
// 业务直接依赖 WindowsFileSystem
// 换 LinuxFileSystem → 大量修改
```

**有接口：**

```java
interface FileSystem {
    void delete();
}
// 业务依赖 FileSystem
// 实现：WindowsFileSystem / LinuxFileSystem / CloudFileSystem
```

MCP 类似：**它提供 Agent 和能力之间的接口标准。**

---

## 4. MCP 带来的三个解耦

### ① Agent 和工具实现解耦

Agent 不知道文件怎么删除、浏览器怎么打开——只知道有一个能力 `delete_file`。

### ② Agent 和平台解耦

Windows → Windows MCP Server
Linux → Linux MCP Server

Agent 不变。

### ③ 工具生态复用

一个 MCP Server 可以被 ChatGPT Agent、Claude Agent、自研 Agent 共同使用。

---

## 5. 一个澄清：MCP 不是为了替代 API

很多人误解"有 MCP 就不用 API"——错误。

| | 作用 |
|---|---|
| **API** | 服务之间通信方式 |
| **MCP** | Agent 访问能力的标准接口 |

MCP Server 内部仍然可以调用 API。例如天气服务内部调用 Weather API → Database → Weather Model，对外通过 Weather MCP Server → Agent。

**MCP 是包装层，不是替代层。**

---

## 6. 完整 Agent 技术栈

```
              User
                |
                v
             Agent
                |
        +---------------+
        |               |
      LLM          Workflow
        |
 +------+-------+
 |              |
Memory        Planner
 |
RAG

        Tool Registry
                |
            MCP Client
                |
           MCP Protocol
                |
            MCP Server
                |
         External World
```

你现在已经理解：为什么现代 Agent 框架不是简单 `LLM + Prompt + Tool`，而是一套系统工程。

---

## 7. 三个阶段回顾

| 阶段 | 内容 | 核心问题 |
|---|---|---|
| **第一阶段：Agent Core** | Agent Loop、LLM、Tool、Function Calling | Agent 如何思考和行动？ |
| **第二阶段：Memory & Knowledge** | Memory、RAG、Embedding | Agent 如何记忆和查找知识？ |
| **第三阶段：Infrastructure** | Tool Registry、MCP | Agent 如何管理能力和连接外部？ |

---

## 下一阶段：Multi-Agent Systems

为什么一个 Agent 不够？

比如让一个 AI 完成软件开发——

- 方案 A：一个超级 Agent（LLM + 所有工具 + 所有能力）
- 方案 B：多个 Agent（Product Agent → Architect Agent → Developer Agent → Tester Agent）

为什么 B 有时候更好？为什么有时候反而更差？AutoGen、CrewAI 的设计思想是什么？

---

## 今天的思考题

假设你设计一个"AI 软件开发团队"，任务是开发一个论坛系统。

- **方案 A**：一个 Agent 负责需求分析、架构、写代码、测试。
- **方案 B**：多个 Agent——产品 Agent、架构 Agent、开发 Agent、测试 Agent。

你认为 **B 一定比 A 好吗？** 为什么？

可以结合我们前面学的 Workflow、Memory、Tool 来思考。

---

**上一篇：**[Agent 学习（二十七）——MCP Client、Protocol、Server 详解](/posts/agent-learning-mcp-arch)
**下一篇：**[Agent 学习（二十九）——Single Agent vs Multi-Agent：不是升级，是选择](/posts/agent-learning-multi-agent-intro)

---

*Agent 学习系列，未完待续。*
