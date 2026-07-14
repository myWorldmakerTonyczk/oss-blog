---
title: Agent 学习（四）——Agent 的控制流
date: 2026-07-14
author: myWorldmakerTonyczk
series: Agent 学习
seriesOrder: 4
---

# Agent 学习（四）——Agent 的控制流

> 上一节说了 Tool 是什么。这一节回答：**谁来决定调用什么、什么时候调用？**

## 第二题

**普通程序调用函数，和 Agent 调用 Tool，最大的区别是什么？**

一个回答是：一个由程序调用，一个由 LLM 调用。

对，但是还能更深入。

真正最大的区别其实是——

普通程序：

```java
queryWeather();
```

程序员**已经决定了**什么时候调用。

Agent：

用户："今天东京冷吗？"

LLM → "我需要天气。" → 调用 Tool。

这里最重要的是：**调用时机（When）也是 LLM 决定的。**

所以一般总结成一句话：

> **普通程序：开发者决定控制流（Control Flow）。**
>
> **Agent：LLM 决定控制流。**

## 举一个 Spring Boot 的例子

Controller：

```java
userService.login();
```

这是程序员写死的。

但是 Agent：

用户："我忘记密码了。"

LLM → 不能 login → 应该调用 `reset_password()`

下一位用户："我要注册。"

LLM → 应该调用 `register()`

**控制流每次都不同。**

所以 Agent 的程序更像：

```python
while True:
    action = llm.decide()   # LLM 决定下一步
    execute(action)          # 执行
```

而不是：

```python
login()
query()
save()
```

这个思想以后会贯穿整个 Agent。

## 停下来想一想

现在你知道了：
- Tool 是什么（AI API）
- 谁决定调用（LLM）

但 Tool 应该设计成什么粒度？一个万能的 `click(x,y)` 就够了，还是为每个应用写专用 Tool？下一节我们进入 Tool 设计中最经典的问题。

---

**上一篇：**[Agent 学习（三）——什么是 Tool](/posts/agent-learning-1)
**下一篇：**[Agent 学习（五）——Tool 的层次设计](/posts/agent-learning-3)
