---
title: Agent 学习（六）——Tool 的通信协议
date: 2026-07-14
author: myWorldmakerTonyczk
series: Agent 学习
seriesOrder: 6
---

# Agent 学习（六）——Tool 的通信协议

> 前面讲了 Tool 是什么、谁决定调用、怎么设计层次。但还有一个根本问题没回答：**LLM 和程序之间，怎么可靠地通信？**

---

你可能会问这样一个问题——

> 即使程序把 Tool 列表给了 LLM，LLM 不还是可能写错工具名字吗？

例如：

工具列表里有 `open_wechat` 和 `search_weather`。

结果 LLM 输出 `open_wechatt`，或者 `start_wechat`。

程序还是解析不了。

答案是：**完全正确。**

如果只是 Prompt，这个风险一直存在。

这个问题，实际上就是 OpenAI、Anthropic、Google 这些公司当年真正遇到的问题。而且这个问题问得很好——因为你没有继续纠结"Tool 怎么写"，而是开始问"协议怎么保证可靠"。这就是架构师会问的问题。

## 三个阶段

你会发现，我们已经经历了三个阶段。

### 第一阶段：纯自然语言

```
用户
  ↓
LLM
  ↓
"建议点击微信"
```

**不能执行。**

### 第二阶段：Prompt + JSON

```json
{
  "action": "open_wechat"
}
```

**可以执行。**

但是：JSON 可能错。字段可能错。工具名可能错。

### 第三阶段：工具列表

LLM 知道只有两个工具 → 选择工具。

比前面好很多。但是——**理论上还是可能选错。**

你发现了吗？直到这里，问题都没有**真正**解决。

## 工业界怎么解决？

这里就是现代 Function Calling 最关键的一步。

很多教程会直接告诉你："Function Calling 就是让 LLM 调函数。"我一直觉得这是最糟糕的解释。

真正发生的是：

> **模型不再"生成 JSON"，而是在"生成一种受约束的结构"。**

这个区别非常非常重要。

### 举个你熟悉的 Java 例子

假设你写 Spring Boot，有一个 DTO：

```java
class WeatherRequest {
    String city;
}
```

前端发：

```json
{"city": "Tokyo"}
```

Spring 会自动绑定。为什么？因为**双方约定了 Schema（数据结构）。**

Function Calling 本质也是一样。

程序先告诉模型：

> 我这里有两个工具。
>
> 第一个：名字 `open_wechat`，参数：无。
>
> 第二个：名字 `search_weather`，参数：`city: string`。

注意——程序告诉的不只是**工具名字**，还有**参数结构（Schema）**。

然后模型不是自由发挥，而是在**这些 Schema 里面选择**。

### 但你的问题还没回答完

你问的是："那模型还是可以胡写啊。"

对。所以再往下推一步——

假设模型只能输出 A、B、C 三个选项。它还能输出 D 吗？**当然不能。**

为什么？因为**输出空间已经被限制了。**

这里就是现代模型训练的重要变化。

- **早期**：LLM 可以输出任何 Token。
- **后来（Function Calling）**：模型知道——现在不是聊天，现在是在**选择 Tool**。于是很多模型会进入一种特殊的生成模式。

也就是说：**不是所有 Token 都允许生成。** 而是根据 Schema，限制下一步只能生成合法字段。

这里其实已经涉及模型训练了，暂时不用深入。你现在只要知道一句话：

> **现代 Function Calling，不仅仅是 Prompt，而是模型能力的一部分。**

这是为什么 OpenAI、Anthropic、Gemini 都有 Function Calling。因为他们训练模型的时候，已经把"调用工具"作为一种能力训练进去了。不是靠 Prompt 魔法。

## 纠正一个流行误解

很多文章写：**Function Calling = 输出 JSON。**

这是错误的。

准确一点说：

> **Function Calling 的目标不是 JSON，而是保证 AI 和程序之间能够可靠通信。**

JSON 只是其中一种表现形式。

## 一个更大的概念：Protocol（协议）

你发现没有，我们一直在讨论：

```
LLM
  ↓
程序
```

他们之间**怎么交流**。

是不是很像网络编程？

- 浏览器：`GET /user` → 服务器：`200 OK`。为什么？因为 **HTTP**。
- Java 为什么能和 MySQL 通信？因为 **MySQL Protocol**。
- 前端为什么能调用 Spring Boot？因为 **HTTP + JSON**。

那 LLM 为什么能调用 Tool？

因为也需要**一种协议（Protocol）**。

是不是开始有点熟悉了？

## 你今天已经推导出了两件事

**第一件**：LLM 不能直接操作世界，所以需要一个执行层。

**第二件**：LLM 和程序之间需要一种统一协议。

如果你把这两件事情合起来——有没有觉得像你以前学 Spring Boot？

```
Controller
    ↓
  Service
    ↓
Repository
    ↓
  MySQL
```

Controller 不会直接操作数据库。为什么？因为需要：统一接口、统一协议、统一职责。

**Agent 也是一样。**

只是数据库变成了 Windows、浏览器、微信、Excel……而 Service 那一层，变成了 **Tool 层**。

## 最重要的一句话

> **Agent 不是"LLM + 一堆 API"。**
>
> **而是：LLM（负责决策） + 协议（负责沟通） + 能力（负责行动） + 环境（负责反馈）。**

后面的所有 Agent 框架，本质上都是在围绕这四个部分做工程化。

## 今天的思考题

**问题 1：**

为什么说"Function Calling = 输出 JSON"是错误的？请用自己的话解释 Function Calling 真正的目标是什么。

**问题 2：**

我们经历了三个阶段：纯自然语言 → Prompt + JSON → 工具列表。这三个阶段分别解决了什么问题？每个阶段又留下了什么问题？

**问题 3：**

如果把 LLM 和 Tool 之间的通信类比为网络编程中的 HTTP 协议——你觉得这个协议至少需要规定哪些内容？试着列出你觉得必不可少的字段。

---

**上一篇：**[Agent 学习（五）——Tool 的层次设计](/posts/agent-learning-3)
**下一篇：**[Agent 学习（七）——从 Tool 到 Memory](/posts/agent-learning-4)
