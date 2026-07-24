---
title: Agent 学习（二十四）——Tool Registry 深入与 Tool Retrieval
date: 2026-07-15
author: myWorldmakerTonyczk
series: Agent 学习
seriesOrder: 24
---

# Agent 学习（二十四）——Tool Registry 深入与 Tool Retrieval

> 上一节问：1000 个 Tool，A（全部丢给 LLM）/ B（告诉 LLM 有 Registry）/ C（动态检索）——你选了 B 和 C。这一节从你的答案开始，深入 Tool Retrieval 的实现。

---

## 先看你的回答

> 我觉得 B 和 C 都有可能。Tool Registry 可能也是通过检测工具描述的语义向量来匹配相应工具的，也就是说 Tool Registry 也需要 LLM 驱动。我感觉 B、C 本质上相似。

**非常好。** 这个回答其实已经触碰到了现代 Agent 工具系统设计的核心问题。而且你提出的"Tool Registry 是不是也需要 LLM 驱动"——很多初学者不会想到，但实际工程里非常关键。

---

## 1. B 和 C 的关系

你的判断是对的：**B 和 C 都有可能。** 但它们处于不同层级。

- **B**：启动时只告诉 LLM"我有一个 Tool Registry，需要时查询工具"——这是**架构层面**。
- **C**：根据用户任务，动态检索相关 Tool，再给 LLM——这是**实现层面**。

实际上：**C 是 B 的具体实现方式之一。**

关系：

```
B：LLM 知道存在 Registry → 需要时查询

C：Registry 内部 → 根据任务 → 检索相关 Tool
```

所以不是二选一。更准确的表述是：

> **Tool Registry + Tool Retrieval**

---

## 2. 为什么 A 不好？

A 看起来简单：启动时把所有 Tool 描述丢给 LLM。

但问题你已经在前一节说过了。打个比方：

你去医院看感冒。医生桌子上放着**所有科室所有病历**——信息太多，真正有用的反而被淹没。

这就是 A 的问题：**Context 浪费。**

---

## 3. Tool Registry 是否需要 LLM？

你的问题：Tool Registry 也需要 LLM 驱动吗？

答案：**不一定。** 这里要区分 Registry 和 Retrieval。

### Tool Registry 本身

更像一个**数据库。**

```java
Map<String, Tool> registry = new HashMap<>();
registry.put("delete_file", new Tool("delete_file", "删除文件", Permission.HIGH));
```

查询 `select * from tools`——不需要 AI。

### Tool Retrieval 才需要智能

1000 个 Tool，怎么找最相关的 5 个？

---

## 4. Tool Retrieval 的三种方案

### 方案 1：关键词搜索

最简单。用户说"整理桌面"→ 匹配 `file`、`desktop`、`folder`。

缺点：和 SQL LIKE 一样——词汇鸿沟。

### 方案 2：Embedding 检索

**你刚才想到的——非常正确。**

流程：

```
工具描述（delete_file: 删除指定文件 / move_file: 移动文件 / compress_file: 压缩文件）
    ↓
Embedding → 变成向量
    ↓
存入 Vector Database
```

用户说"整理桌面"→ Embedding → 向量搜索 → 找到 `move_file`、`compress_file`、`delete_file`。

```
User Task → Embedding → Vector Search → Relevant Tools
                              ↑
                    Tool Description → Embedding → Vector Database
```

### 方案 3：LLM 选择工具

让 LLM 看候选工具（比如 10 个），然后判断：这些工具中，哪个适合"整理桌面"？

这是 **LLM-based Tool Selection。**

---

## 5. 实际工业系统：混合方案

真实架构不会只用一种：

```
User Task
    |
    v
Tool Retrieval (Embedding)    ← 快速过滤 1000 → 20
    |
    v
Top-K Tools
    |
    v
LLM 选择具体 Tool             ← 精细判断 20 → 3
    |
    v
Execute
```

为什么？因为 **Embedding 负责快速过滤，LLM 负责复杂判断。**

---

## 6. 和 RAG 的对比

你刚才发现 Tool Registry 和 RAG 相似——这个观察非常准确。

| | RAG | Tool Retrieval |
|---|---|---|
| 目标 | 找知识 | 找能力 |
| 输入 | 问题 | 任务 |
| 存储 | 文档向量 | 工具描述向量 |
| 输出 | 相关文本 | 相关工具 |
| 后续 | LLM 回答 | LLM 调用 |

可以说：

> **RAG = Knowledge Retrieval（知识检索）**
> **Tool Retrieval = Capability Retrieval（能力检索）**

---

## 7. 现在回到 MCP

为什么需要 MCP？

假设今天 OpenAI Agent 需要调用数据库工具，明天 Claude Agent 需要调用 GitHub 工具，后天你的 Windows Agent 需要调用文件工具——

如果每个工具自己定义格式：

```
Agent A → Tool Schema A
Agent B → Tool Schema B
Agent C → Tool Schema C
```

非常混乱。

MCP 的思想：**统一。**

```
Agent → MCP Protocol → Tools
```

类似 USB-C：一个接口，所有设备。

---

## 下一节：MCP

会重点讲：

- MCP 为什么出现？
- MCP 和 API 有什么区别？
- MCP Server / Client 是什么？
- MCP 和 Tool Registry 的关系？
- 为什么 MCP 不是 Agent，而是 Agent 的基础设施？

---

## 今天的思考题

假设你有一个工具：

```python
def delete_file(path):
    # 删除文件
    pass
```

为什么不能直接把这个 Python 函数交给 LLM？

为什么必须额外提供：

```json
{
  "name": "delete_file",
  "description": "删除文件",
  "parameters": {
    "path": "string"
  }
}
```

你之前其实已经回答过类似问题，现在用 **Agent 架构角度** 重新回答——你应该已经能答得更深了。

---

**上一篇：**[Agent 学习（二十三）——Tool Registry 工具注册表](/posts/agent-learning-tool-registry)
**下一篇：**[Agent 学习（二十五）——Tool Schema 与 Function Calling 演化路线](/posts/agent-learning-tool-schema)

---

*Agent 学习系列，未完待续。*
