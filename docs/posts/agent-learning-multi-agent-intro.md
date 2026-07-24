---
title: Agent 学习（二十九）——Single Agent vs Multi-Agent：不是升级，是选择
date: 2026-07-15
author: myWorldmakerTonyczk
series: Agent 学习
seriesOrder: 29
---

# Agent 学习（二十九）——Single Agent vs Multi-Agent：不是升级，是选择

> 上一节问：多 Agent 一定比单 Agent 好吗？这一节从你的答案开始，分析什么时候该用 Single，什么时候该拆。

---

## 先看你的回答

> 方案 A 一个 Agent 可以通过 Planner 来合理安排流程。而方案 B 多 Agent 协同，不同专精可以发挥各自优势。不一定说哪个更有优势——非常庞大的项目 B 更有优势，小项目 A 更有优势。

**很好。** 这次回答非常好，因为你没有掉入一个常见陷阱："Multi-Agent 一定比 Single-Agent 高级。"

你的回答实际上已经接近目前业界比较成熟的观点：**Multi-Agent 不是为了替代 Single-Agent，而是在任务复杂度、组织结构、专业分工达到一定程度后才有价值。**

---

## 1. 方案 A：Single Agent

你的观点——一个 Agent 可以通过 Planner 来合理安排流程——正确。

架构：

```
              User
               |
               v
             Agent
               |
      +--------+--------+
      |                 |
   Planner             LLM
      |
   Tools
```

用户说"开发一个论坛系统"→ Planner 拆分：分析需求 → 设计数据库 → 设计接口 → 编写代码 → 测试 → 执行。

**优点：**

① **简单。** 一个大脑，不用考虑 Agent 通信、协调、冲突。

② **成本低。** 多个 Agent = 多个 LLM 调用。

③ **小任务更高效。** 写一个登录接口，没必要上产品 Agent + 架构 Agent + 测试 Agent。

---

## 2. 方案 B：Multi-Agent

你的观点——不同专精可以发挥优势——也正确。核心思想：**Division of Labor（分工）**，类似软件公司。

```
             Manager Agent
                  |
     +------------+------------+
     |            |            |
 Product      Architect    Developer
 Agent        Agent        Agent
                              |
                         Tester Agent
```

每个 Agent 拥有：**不同 Prompt、不同 Memory、不同 Tool。**

产品 Agent 负责需求和功能列表，架构 Agent 负责系统设计和数据库，开发 Agent 负责代码实现，测试 Agent 负责 Bug 发现。

---

## 3. 为什么 Multi-Agent 不是一定更好？

你"不一定哪个更有优势"的判断非常重要。

### 问题 1：通信成本

单 Agent：一次上下文。Multi-Agent：Agent A → Agent B → Agent C，需要传递状态、结果、上下文。产品 Agent 写了 100 页需求文档——架构 Agent 需要全部理解。通信成本很高。

### 问题 2：协调困难

多个 Agent 可能意见不同。架构 Agent 选 MySQL，开发 Agent 想用 MongoDB——谁决定？需要 Manager Agent。

### 问题 3：Token 成本

4 个 Agent，每个调用 LLM，成本翻倍。

所以：**Multi-Agent 引入了新的复杂度。**

---

## 4. 什么时候该用 Multi-Agent？

你的判断基本正确：大项目 B，小项目 A。更精确：

| | Single Agent | Multi-Agent |
|---|---|---|
| **任务目标** | 明确 | 复杂、多维度 |
| **工具数量** | 有限 | 不同角色需要不同工具 |
| **流程** | 相对固定 | 动态变化 |
| **领域差异** | 单一 | 差异大（法律+财务+开发） |
| **并行度** | 低 | 高（同时搜酒店+交通+景点） |

---

## 5. 一个重要设计原则

不要看到复杂任务就马上 Multi-Agent。正确顺序：

```
Single Agent
     |
复杂度增加
     |
加入 Planner
     |
加入 Workflow
     |
加入 Tool Registry
     |
仍然不足
     |
Multi-Agent
```

**Multi-Agent 是复杂度的解决方案，不是智能升级按钮。**

---

## 6. 和你之前学的组件连接

Single Agent：

```
LLM → Planner → Tools → Reflection
```

Multi-Agent 就是多个这样的系统：

```
Agent A              Agent B
LLM                   LLM
Memory         ↕      Memory
Tools         通信    Tools
```

所以 Multi-Agent 的难点不是创建多个 LLM，而是 **Agent Coordination（协作）**：

- 谁负责什么？
- 怎么通信？
- 怎么共享 Memory？
- 谁拥有最终决策权？

---

## 下一阶段：Multi-Agent 通信模型

会讲：

- Agent 为什么需要通信？
- Blackboard Architecture（黑板模型）
- Manager-Agent 模式
- Debate（辩论）模式
- AutoGen 的核心思想
- CrewAI 的 Role 思想

---

## 今天的思考题

假设任务是：**帮用户写一封请假邮件。**

你觉得应该——

- **A**：Single Agent + Tool
- **B**：Multi-Agent（HR Agent + Writer Agent + Reviewer Agent）

哪个更合理？为什么？

不要只说"简单"——用 **"任务复杂度"和"协作成本"** 来分析。

---

**上一篇：**[Agent 学习（二十八）——MCP 的解耦思想与三个阶段总结](/posts/agent-learning-mcp-decoupling)
**下一篇：**敬请期待

---

*Agent 学习系列，未完待续。*
