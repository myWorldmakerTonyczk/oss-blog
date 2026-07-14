---
title: Agent 学习（十八）——Agent Loop 修正与第一阶段总结
date: 2026-07-14
author: myWorldmakerTonyczk
series: Agent 学习
seriesOrder: 18
---

# Agent 学习（十八）——Agent Loop 修正与第一阶段总结

> 上一节让你设计一个完整 Agent Loop。这一节先看你的设计，修正几个关键点，然后做第一阶段总结，最后引出 RAG。

---

## 先看你的设计

你的流程：

```
用户目标 → Workflow → Memory → Planner → Tool → Reflection
  ↑                                                      |
  └──────── Tool 和 Reflection 循环直到达成目标 ←────────┘
```

**很好。** 你的流程已经抓到了 Agent Loop 的核心闭环，而且说明你已经开始从"组件列表"转向"系统运行过程"思考了。

不过有几个地方需要调整——这正是 Agent 架构设计里最容易混淆的地方。

### 修正 1：Workflow 不应该理解为第一个执行步骤

你写"用户目标 → Workflow"——容易产生一个误解：好像 Workflow 是 Agent 内部的一个"思考节点"。

实际上，**Workflow 更像整个系统的控制骨架，它包围整个过程。**

类似你开发游戏——不是"玩家输入 → GameLoop"然后 GameLoop 执行一次。而是：

```
GameLoop {
    输入处理
    更新逻辑
    碰撞检测
    渲染
}
```

GameLoop 是整个运行机制。Agent Workflow 也是：

```
Workflow {
    获取任务
    调用Memory
    Planner
    执行
    检查
    结束
}
```

所以更准确的图：

```
             Workflow
                |
User Goal ------+
                |
                v
             Memory
                |
                v
             Planner
                |
                v
             Execute
                |
                v
              Tool
                |
                v
          Environment
                |
                v
          Observation
                |
                v
          Reflection
                |
          +-----+-----+
          |           |
        成功        失败
          |           |
        End      Re-plan
```

### 修正 2：Memory 和 Planner 的关系

你写 `Memory → Planner`——基本正确。

为什么？因为 Planner 不能盲目规划。它需要知道：当前状态、历史信息、用户偏好。

例如用户说"整理桌面"——Memory 中：上次整理已创建图片目录，用户喜欢不删除文件。Planner 根据这些信息制定方案。

所以：**Memory 是 Planner 的输入。**

### 修正 3：Tool 和 Reflection 循环

你写"Tool 和 Reflection 循环直到达成目标"——**非常重要。** 这个已经接近 ReAct。

完整形式：

```
Reason → Act → Observe → Reflect → Reason
```

也就是：思考 → 行动 → 观察结果 → 评估 → 调整。

比如 Windows Agent 整理桌面：

```
Planner: 1.扫描文件 2.分类 3.移动
  ↓
Tool: scan_desktop() → 发现1000文件，其中100个.exe
  ↓
Reflection: .exe 可能是安装程序，不能直接删除，需要保留
  ↓
重新规划: 只整理图片和文档
  ↓
继续
```

## 你现在实际上已经理解了 Agent 最核心的东西

Agent 不是一个模型，而是一个**闭环系统**：

```
        Goal
         ↓
      Planning
         ↓
       Action
         ↓
     Environment
         ↓
     Observation
         ↓
     Evaluation
         ↓
    New Planning
```

这也是为什么——普通程序：输入 → 处理 → 输出。而 Agent：目标 → 行动 → 观察世界 → 调整行动 → 继续。

## 第一阶段总结

你已经掌握：

| 组件 | 职责 |
|---|---|
| ✅ LLM | 不是 Agent，它只是推理核心 |
| ✅ Tool | 给 LLM 改变世界的能力。LLM "我想删除文件" → Tool 真正执行 `delete()` |
| ✅ Memory | 让 Agent 具有连续性。过去状态 + 当前任务 |
| ✅ Planner | 处理复杂目标。大目标 → 多个子任务 |
| ✅ Reflection | 处理现实世界的不确定性。计划 → 执行 → 发现问题 → 调整 |
| ✅ Workflow | 控制整个系统可靠运行。谁什么时候执行 |

你现在已经具备继续学习高级 Agent 的基础。

## 下一阶段：RAG

这是非常重要的一章。因为很多人会混淆：**Memory = RAG。** 这是错误的。

我们下一课会回答：

- 为什么 ChatGPT 需要 RAG？
- 为什么 Agent 有 Memory 还需要 RAG？
- RAG 和数据库查询有什么区别？
- Embedding 是什么？
- Vector Database 为什么出现？
- 企业知识库 Agent 到底怎么设计？

## 进入 RAG 前的小挑战

假设用户问 Windows Agent：

> "帮我找一下去年我写的关于 Spring Boot 的项目文档。"

Agent 有——

**A（Memory）**：用户喜欢 Java，正在学习 Spring Boot。

**B（RAG）**：扫描用户硬盘文档，找到 `SpringBoot论坛项目设计.pdf`。

问题：

- 为什么 A 不能替代 B？
- 为什么 B 不属于 Memory？

这个问题答出来，你就真正理解为什么 RAG 是 Agent 的下一块拼图。

---

**上一篇：**[Agent 学习（十七）——Agent Loop 与阶段测试](/posts/agent-learning-agent-loop)
**下一篇：**[Agent 学习（十九）——Memory vs RAG](/posts/agent-learning-rag-vs-memory)
