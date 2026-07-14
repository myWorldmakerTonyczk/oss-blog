---
title: Agent 学习（十六）——Workflow 的深度与阶段总结
date: 2026-07-14
author: myWorldmakerTonyczk
series: Agent 学习
seriesOrder: 16
---

# Agent 学习（十六）——Workflow 的深度与阶段总结

> 上一节留了三个 Workflow 问题。这一节先看答案，然后深入，最后做第一阶段总结。

---

## 先看你的回答

**问题 1**：为什么 Workflow 不是限制 Agent，而是提高可靠性？

> Workflow 确定了节点的执行顺序，使 Agent 不会混乱步骤。

正确。再深入一点。

**问题 2**：普通代码 vs Agent Workflow 的本质区别？

> 普通代码顺序固定，Agent Workflow 提供不同节点供选择。

方向对，但有一个地方需要修正——这个区别非常关键。

**问题 3**：哪些操作需要 Human Approval？

> 删除文件、修改系统设置，这两个要用户确认。

正确。

我们逐个深入。

## 1. 为什么 Workflow 不是限制 Agent？

很多初学者会觉得：Agent 的优势就是自由，如果加 Workflow，不就变回普通程序了吗？这是一个误区。

实际上：**Workflow 限制的是危险的不确定性，不限制智能。**

**没有 Workflow：**

用户说"帮我整理电脑"——LLM：我先删除一些文件？还是分类？还是压缩？可能**流程混乱。**

**有 Workflow：**

```
输入任务 → 分析需求 → 生成计划 → 风险检查 → 执行 → 总结
```

流程固定。但是——**每个节点内部，仍然可以让 LLM 发挥。**

例如"分析需求"节点：LLM 决定用户真正想整理什么。

所以：

- **Workflow 负责**：什么时候做什么类型的事情。
- **LLM 负责**：这个事情具体怎么做。

这个关系非常像游戏引擎：

```
Game Loop:
Update → Render
```

是固定的。但是 Update 里面，AI 怎么移动、玩家怎么操作——是不固定的。

> **Workflow ≈ Agent 的 Game Loop。**

这个类比非常准确。

## 2. 普通代码 vs Agent Workflow（修正）

你的回答方向对，但需要精确一点。

**普通代码：**

```java
login();
query();
save();
```

控制权在程序员。也就是：**Developer → Control Flow。**

**Agent Workflow：**

```
Input → Classifier → Planner → Executor → Checker
```

节点顺序仍然可能固定——比如一定先检查权限、一定后执行。所以 **Workflow 本身也是固定的。**

**真正区别在节点内部。**

例如 Executor 节点——

普通代码：`executeDelete()`，固定行为。

Agent：Executor → LLM → 选择 `delete_file()` / `move_file()` / `compress_file()`。

所以更准确的说法：

> **普通程序的控制流和行为都由开发者决定；Agent Workflow 固定系统结构，但允许 LLM 在结构内动态决策。**

这是 Agent 和普通程序最核心的区别之一。

## 3. 哪些操作需要 Human Approval？

这里我们进入一个非常重要的设计原则：

### Risk-based Permission（基于风险的权限）

不是看"是不是 Tool"——而是看**这个 Tool 对现实世界造成的影响有多大。**

**低风险——可以自动执行：**

查询天气、搜索网页、读取文件、查看日历。因为**失败成本低。**

**中风险——可能需要确认：**

发送邮件、修改文档、移动文件。因为**会改变数据。** 例如 Agent 帮你整理桌面，它想移动"毕业论文.docx"——如果判断错，影响较大。

**高风险——必须确认：**

删除文件、修改系统设置、安装软件、转账、发送敏感信息。

架构：

```
            Tool Request
                 |
                 v
          Permission Layer
                 |
       --------------------
       |                  |
    Low Risk          High Risk
       |                  |
   自动执行          用户确认
```

这就是未来 Windows AI 助手必须有的一层。不是 `LLM → Windows API`，而是：

```
LLM → Tool → Permission Manager → OS
```

## 第一阶段总结：Agent Core Architecture

到这里，我们已经把 Agent 的核心组件串起来了。

现在完整模型：

```
                         Memory
                            ↑
User → Workflow → Planner → LLM → Tool → Environment
                  |                    |
              Human Check         Reflection
                                    |
                                Permission
```

你已经学完 Agent 第一阶段，包括：

| 组件 | 解决的问题 |
|---|---|
| ✅ LLM | 思考能力 |
| ✅ Tool | 行动能力 |
| ✅ Memory | 状态连续性 |
| ✅ Planner | 复杂任务管理 |
| ✅ Reflection | 自我评估与修正 |
| ✅ Workflow | 流程控制 |
| ✅ Human Approval | 安全边界 |

下一阶段进入 Agent 的高级能力：

1. **RAG（检索增强生成）**——为什么 Agent 需要外部知识？为什么 Memory ≠ RAG？
2. **Tool Registry**——大量 Tool 如何管理？为什么 MCP 会出现？
3. **Multi-Agent**——为什么需要多个 Agent？什么时候反而更差？
4. **Computer Use**——为什么操作电脑比调用 API 难？视觉 Agent 的架构。
5. **MCP**——为什么 MCP 被称为 Agent 的 USB-C？

## 阶段测试

不过在进入 RAG 前——做一次阶段测试。不用背概念，用自己的话回答：

> 假设一个朋友问你："Agent 不就是 ChatGPT 加几个 API 吗？"
>
> 你会怎么反驳？

请尽量用我们这几节学到的架构回答。

（这个问题非常重要，因为它检验你是否真的形成了 Agent 思维。）

---

**上一篇：**[Agent 学习（十五）——Workflow](/posts/agent-learning-workflow)
**下一篇：**[Agent 学习（十七）——Agent Loop 与阶段测试](/posts/agent-learning-agent-loop)

---

*Agent 学习系列，未完待续。*
