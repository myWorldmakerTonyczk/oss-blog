---
title: Agent 学习（十五）——Workflow
date: 2026-07-14
author: myWorldmakerTonyczk
series: Agent 学习
seriesOrder: 15
---

# Agent 学习（十五）——Workflow

> 上一节留了一个架构题：删除垃圾文件，方案 A 还是方案 B？这一节从答案开始，然后进入 Agent 架构的流程骨架——Workflow。

---

## 先看你对上一节问题的回答

方案 A（直接执行）vs 方案 B（计划 → Reflection → 用户确认 → 执行）：

> B 更安全，因为进行了 Reflection 检查，还询问了用户的许可。

**很好。** 你的答案是正确的，而且你已经自然引出了两个企业级 Agent 必须考虑的东西：

- **Reflection（自检）**
- **Human-in-the-loop（人在回路中）**

不过这里要稍微提升一下你的理解：B 安全，不只是因为多了一次 Reflection，而是因为**它改变了 Agent 的控制边界。**

这是我们进入 Workflow 前非常重要的一步。

## 先分析两个方案

### 方案 A

```
用户："删除桌面垃圾文件"
  ↓
LLM
  ↓
delete_file()
  ↓
完成
```

问题在哪里？不是 LLM 不聪明，而是：**危险操作直接连接执行层。**

例如——用户说"删除垃圾文件"，LLM 判断 temp 文件 → 删除。调用 `delete_file()`——结果**误删了 project.zip。**

怎么办？已经执行了。

所以问题：**Agent 有决策能力，但是缺少权限控制。**

### 方案 B

```
用户请求 → LLM分析 → 生成计划 → Reflection → 用户确认 → 执行删除
```

这里多了几层防线。

**第一层：Plan。** Agent 不直接删，而是生成计划：

```json
{
  "action": "delete",
  "files": ["a.tmp", "b.log"]
}
```

用户看到："我要删除这些文件。"

**第二层：Reflection。** Agent 自己检查：这些文件是否真的垃圾？是否包含重要文件？数量是否异常？

**第三层：Human Approval。** 最后，用户确认删除。

这就是：**安全闸门（Guardrail）。**

## 现在引出 Workflow

我们现在有：LLM、Planner、Memory、Tool、Reflection、Human Approval。

问题：**谁决定顺序？**

例如删除文件——必须是：分析 → 生成计划 → 检查 → 确认 → 执行。

不能是：分析 → 执行 → 再检查。因为**已经晚了。**

所以需要：**Workflow。**

## 第八课：Workflow（工作流）

### Definition

> Workflow：定义 Agent 中各个组件如何连接、以什么顺序运行的控制逻辑。

简单说：**Workflow 是 Agent 的流程骨架。**

**没有 Workflow：**

```
       LLM
    想调用谁调用谁
```

问题：不可控。

**有 Workflow：**

```
             Workflow
User → Planner → LLM → Tool → Reflection → Finish
```

### Workflow 和普通程序有什么区别？

这里结合你的 Java 背景。

**普通程序：**

```java
public void order() {
    checkStock();
    pay();
    ship();
}
```

流程：开发者**写死。**

**Workflow：** 也是流程。但是——节点可能是 **AI。**

例如：

```
Node1: Planner
Node2: LLM
Node3: Tool
Node4: Reflection
```

区别：

| 普通程序 | Agent Workflow |
|---|---|
| 代码决定流程 | 代码**约束**流程 |
| | + AI 决定节点内部行为 |

这是非常重要的一句话。

### 举例：客服 Agent

**没有 Workflow：**

```
用户问题 → LLM → 随便回答
```

**有 Workflow：**

```
用户问题
    |
    v
问题分类节点
    |
    +----------+
    |          |
售后问题       技术问题
    |          |
售后Agent    技术Agent
    |
人工审核
```

这里已经接近 **Multi-Agent。**

## 为什么 LangGraph 出现？

你之后学习框架时会看到。它核心思想：**用图（Graph）描述 Agent Workflow。**

例如：

```
        Start
          |
          v
       Planner
          |
          v
       Execute
          |
          v
        Check
          |
     +----+----+
     |         |
   成功       失败
     |         |
    End      Retry
```

这比 `while True: llm()` 强很多。

## 为什么企业 Agent 很少完全自主？

因为真实世界不是游戏。不能"AI 觉得可以 → 执行。"

例如：

- 金融：转账 → 必须审批
- 医疗：诊断建议 → 医生确认
- 文件：删除 → 用户确认

所以成熟 Agent 不是**越自主越好**，而是**在安全范围内自主。**

## 现在我们的 Agent 架构

```
                  Memory
                     ↑
User                 |
  |                  |
  v                  |
Workflow             |
  |                  |
  +----------------+ |
  |                | |
Planner        Human Check
  |                  |
  v                  |
 LLM                 |
  |                  |
  v                  |
Tool                 |
  |                  |
  v                  |
Environment ←--------+
  |
  v
Reflection
```

## 今天的思考题

**问题 1：**

为什么说"Workflow 不是限制 Agent，而是让 Agent 更可靠"？

**问题 2：**

普通代码 `a(); b(); c();` 和 Agent Workflow `Planner → Tool → Reflection`，有什么本质区别？

**问题 3：**

如果设计 Windows AI 助手，哪些操作你认为必须加入 Human Approval？

例如：打开浏览器、删除文件、修改系统设置、安装软件——你怎么分类？

（这个问题会直接连接下一阶段：Agent 安全机制 + Permission System 权限系统。你现在已经从 Agent 原理进入 Agent 系统设计了。）

---

**上一篇：**[Agent 学习（十四）——Reflection 的深度与 Workflow 预告](/posts/agent-learning-workflow-preview)
**下一篇：**[Agent 学习（十六）——Workflow 的深度与阶段总结](/posts/agent-learning-stage1-summary)

---

*Agent 学习系列，未完待续。*
