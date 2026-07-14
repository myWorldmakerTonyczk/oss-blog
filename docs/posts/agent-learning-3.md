---
title: Agent 学习（五）——Tool 的层次设计
date: 2026-07-14
author: myWorldmakerTonyczk
series: Agent 学习
seriesOrder: 5
---

# Agent 学习（五）——Tool 的层次设计

> Tool 不是越底层越好，也不是越高级越好。第三题带你走进系统设计中最经典的问题：**Trade-off。**

## 第三题

**方案 A：`click(x, y)`** — 通用，操作任何软件。

**方案 B：`open_wechat()` / `send_email()` —** 专用，每个功能一个 Tool。

你选哪个？

如果你觉得"A 更通用，但是需要很强视觉能力；B 更简单"——**评分：10/10。**

而且这个答案已经和目前整个 AI 行业的发展方向一致。

## 方案 A 分析

`click(x, y)` 是不是万能？

是。

理论上：

- 打开微信 → 找到图标 → 点击坐标
- 打开 Excel → 找到图标 → 点击
- 浏览网页 → 点击

所以：**一个 click，几乎能干所有事情。**

但是——Agent 怎么知道微信在 `(512, 398)` 呢？

必须：

- 看屏幕
- 识别图标
- 理解 UI
- 定位按钮

是不是一下子变难了？

| 方案 A | |
|---|---|
| 优点 | 通用 |
| 缺点 | 依赖视觉 |

## 方案 B 分析

例如 `open_wechat()` / `send_email()` / `open_browser()`。

优点：简单。因为开发者已经知道微信在哪、怎么打开。Agent 不需要理解屏幕。

缺点呢？

有没有发现？如果 Windows 升级、微信改版、路径变化——是不是每个 Tool 都要改？

**维护成本越来越高。**

## 这其实是一个经典架构问题

不是 Agent 才有，软件工程一直都有。

你应该听过一句话：**高层抽象 vs 底层抽象。**

我们画一下：

```
高层 Tool：                  底层 Tool：
open_wechat()               move_mouse()
  ↓                           ↓
点击微信                    click()
  ↓                           ↓
等待启动                    type()
                            scroll()
```

是不是有点像 Java？

你可以：

```java
saveUser(user);
```

也可以：

```sql
INSERT INTO user ...
```

哪个更底层？SQL。
哪个更高级？`saveUser`。

Agent Tool 也是一样。

## 工业界怎么选？

**答案是：都要。**

例如 OpenAI 的 Computer Use。它主要就是 `mouse_move()` / `click()` / `type()` / `scroll()`。为什么？因为要操作**任何软件**。

但是企业内部 Agent，通常不会这样。例如银行，不会 `click(100, 200)`，而是 `transfer_money()` / `query_balance()`。为什么？因为**安全、稳定、快**。

## 真正的架构

```
                 LLM
                  |
          Tool Registry
                  |
      ---------------------
      |                   |
高层 Tool            底层 Tool
open_wechat()      click()
query_weather()    type()
send_email()       move_mouse()
```

> **Tool 的设计，不是越底层越好，也不是越高级越好，而是要和环境匹配。**

## 停下来想一想

现在 Tool 的三层理解你已经有了：
1. Tool 是 AI API（不是普通函数）
2. LLM 决定控制流（不是程序员）
3. Tool 有层次（不是越底层越好）

接下来要进入一个新话题——在你理解了 Tool 之后，下一步自然会遇到的问题。

---

**上一篇：**[Agent 学习（四）——Agent 的控制流](/posts/agent-learning-2)
**下一篇：**[Agent 学习（六）——Tool 的通信协议](/posts/agent-learning-tool-protocol)
