---
title: Agent 学习（七）——从 Tool 到 Memory
date: 2026-07-14
author: myWorldmakerTonyczk
series: Agent 学习
seriesOrder: 7
---

# Agent 学习（七）——从 Tool 到 Memory

> Tool 已经讲完了。但在进入下一个组件之前，先建立 Agent 和传统开发的整体映射。这一节还会抛出一个问题——它会让 Memory "自然诞生"。

## 发现一个特点

如果你有 Java 背景，现在其实是学 Agent 最好的时机。

因为你已经不是在学 AI。你其实是在学：**如何设计一个新的软件架构。**

所以以后我们会不断和 Spring Boot 对比。例如：

| Spring Boot | Agent |
|---|---|
| Controller | User Input |
| Service | LLM 决策 |
| Repository | Tool |
| Database | Environment |

当然，这个对应不是完全一致，但能帮助你快速建立模型。

## 现在来想一个问题

这个问题没有标准答案。但是如果你想明白了，后面 Memory、Planner、Workflow 都会特别顺。

假设现在已经有了：

```
User
  ↓
LLM
  ↓
Tool
  ↓
Environment
```

用户说：

> 帮我整理下载文件夹。

LLM 第一步决定：调用 `list_files()`。

Tool 返回：**1000 个文件。**

现在问题来了——

**下一步怎么办？**

LLM 要不要把这 1000 个文件全部重新读一遍，再决定下一步？

还是应该有一个地方保存"刚才已经扫描过目录了"？

如果每一步都重新扫描，会发生什么？

如果有一个地方记住"已经扫描完成"，又会带来什么好处？

你会发现，我们不是因为"Memory 很高级"才去学 Memory。而是因为：**Tool 已经够用了，但是系统开始重复劳动了。**

这就是为什么下一课，Memory 会"自然诞生"。

---

**上一篇：**[Agent 学习（六）——Tool 的通信协议](/posts/agent-learning-tool-protocol)
**下一篇：**[Agent 学习（八）——Memory 的诞生](/posts/agent-learning-5)
