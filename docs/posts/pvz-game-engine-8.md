---
title: 从零搭建PVZ游戏引擎（八）——UI系统重构：从上帝模块到四层架构 + 双Bus事件驱动
date: 2026-07-06
author: myWorldmakerTonyczk
series: 从零搭建PVZ游戏引擎
seriesOrder: 8
---

# 从零搭建PVZ游戏引擎（八）——UI系统重构：从上帝模块到四层架构 + 双Bus事件驱动

> GitHub 仓库：[https://github.com/myWorldmakerTonyczk/gamePVZ](https://github.com/myWorldmakerTonyczk/gamePVZ)

[上一篇](/posts/pvz-game-engine-7) 讨论了组件化脚本系统的设计。那篇偏"实体行为怎么组织"，这篇聊另一个方向——**UI 界面怎么组织**。这次重构从头到尾都在和耦合作斗争，从"一个文件写完所有界面"到"四层各司其职"，中间踩了不少坑。

---

## 一、起点：UISystem 成了小上帝

上一版 UI 系统只有一个文件 `UISystem.js`，73 行，管了所有界面：

```js
// UISystem.js — 旧版，73行的"小型上帝模块"
// 管了：标题界面 + 关卡选择 + 胜利界面 + 失败界面 + 关卡数据 + 导航逻辑

const LEVELS = [ /* 关卡数据 */ ];
let currentLevel = 1;           // ← 状态管理

// START 状态
function showTitle() { /* 创建标题界面 */ }
function showLevelSelect() { /* 创建选关界面 */ }
onEnter(GameState.START, 'UISystem', () => { showTitle(); });
onExit(GameState.START, 'UISystem', () => { /* 清理 */ });

// WIN 状态
onEnter(GameState.WIN, 'UISystem', () => {
    /* 创建胜利界面，按钮回调里直接调 reloadLevel() */
});

// LOSE 状态
onEnter(GameState.LOSE, 'UISystem', () => {
    /* 创建失败界面，按钮回调里直接调 goToMenu() */
});
```

按钮的回调里什么都有——关界面、记状态、加载关卡、切游戏状态：

```js
// 一个 onClick 干了四件不同层面的事
onClick: () => {
    currentLevel = l.id;    // ← 记状态（数据层）
    _screen.close();         // ← 关界面（UI层）
    reloadLevel();           // ← 加载关卡（逻辑层）
    // reloadLevel 里面还有 transition(PLAYING)
}
```

初看没什么，毕竟就 73 行。但问题的本质是：**一个模块知道太多事**。

---

## 二、问题分析：UISystem 跨了多少层

画个图看看 UISystem 到底依赖了什么：

```
UISystem.js
  ├── import GameLoop / State Machine   ← 引擎核心
  ├── import overlayManager             ← UI 框架
  ├── import TitleScreen / LevelSelect  ← UI 工厂
  ├── import WinScreen / LoseScreen     ← UI 工厂
  ├── import loadLevel from level/      ← 关卡加载器
  ├── 持有 LEVELS 数据                  ← 关卡配置
  └── 持有 currentLevel 状态            ← 导航状态
```

一个文件跨了三个维度：

| 维度 | 代码 |
|------|------|
| **UI 渲染** | `_screen = createXxxScreen(...)`, `overlayManager.add(...)` |
| **数据持有** | `LEVELS`, `currentLevel` |
| **导航逻辑** | `reloadLevel()`, `goToMenu()`, `transition(...)` |

加新界面就是往这 73 行里继续堆——加个暂停菜单、加个设置页、加个确认弹窗……最终会变成 300 行的庞然大物，每改一个界面都要在 UISystem 里大海捞针。

**根本矛盾**：UI 渲染、数据状态、导航逻辑被揉在一个模块里。随便改一个就要动整个文件。

---

## 三、讨论过程：怎么拆

直接问了一个问题：**"怎么拆才能让 UI 只干 UI 的事？"**

### 第一刀：代码搬到哪

UISystem 在 `Service/system/systemPojo/` 下，这个目录当时已经有 9 个文件平铺。

```
systemPojo/
├── AnimationSystem.js
├── CollisionSystem.js
├── ScriptSystem.js
├── PlayerSystem.js
├── LevelFlowSystem.js
├── LoadSystem.js
├── PauseSystem.js
├── OverlaySystem.js
└── UISystem.js
```

引擎运行时、游戏玩法、应用层全部混在一起。所以不只 UISystem——整个 system 目录都需要分层。

先把 system 拆成三层：

```
system/
├── engine/        ← 通用引擎，不含游戏规则
│   ├── ScriptSystem.js
│   ├── AnimationSystem.js
│   └── CollisionSystem.js
│
├── gameplay/      ← PVZ 特有规则，不碰 UI
│   ├── PlayerSystem.js
│   ├── LevelFlowSystem.js
│   └── NavigationSystem.js    ← 🆕
│
└── app/           ← UI + 生命周期
    ├── LoadSystem.js
    ├── PauseSystem.js
    └── OverlaySystem.js
```

UISystem 从 system 层搬走。

### 第二刀：UI 自己的层次

UISystem 里面有三种东西：UI 组件基类（UIScreen/UIButton/UIText）、界面零件工厂（createTitleScreen 等）、编排逻辑（状态钩子 + emit 事件）。这三种东西混在一个目录 `pojo/` 里。

把它们拆开：

```
OverLay/
├── UI/             ← 框架基类：UIScreen, UIButton, UIText
├── widgets/        ← 纯 UI 零件工厂：createXxxScreen()
├── screens/        ← UI 编排：状态钩子 + 组合 widgets + emit 事件
└── pojo/           ← 游戏绑定 overlay：HealthBar（读 entity.hp）
```

**划分规则**——每层有明确的"能做"和"不能做"：

| 层 | 能做 | 不能做 |
|------|------|--------|
| `UI/` | 定义组件基类 | 不含具体界面 |
| `widgets/` | 组合 UI 组件，返回 UIScreen | 不含钩子、不含游戏数据、不 emit 事件 |
| `screens/` | 注册状态钩子 + 调 widgets + emit 事件 | 不直接操作游戏数据 |
| `pojo/` | 读 entity 数据 → 渲染 | 不改游戏逻辑 |

### 第三刀：UI 和逻辑怎么通信

拆完之后，UISystem 拆成了 3 个 screen 文件（StartScreen/WinScreen/LoseScreen），每个只管自己对应状态的界面。

但按钮的回调怎么办？原来回调里直接调 `loadLevel`、`transition`，现在 screens 和逻辑层（gameplay/）是两个独立的目录，不应该互相 import。

**事件驱动**。所有的跨层通信走 EventBus：

```
screens/（UI 层）                  gameplay/（逻辑层）
    │                                    │
    │  uiBus.emit(UI:LEVEL_SELECTED) ──→  scope.on(UI:LEVEL_SELECTED, ...)
    │  uiBus.emit(UI:RETRY)         ──→  scope.on(UI:RETRY, ...)
    │  uiBus.emit(UI:TO_MENU)       ──→  scope.on(UI:TO_MENU, ...)
    │                                    │
    │                                 NavigationSystem
    │  喊话的人                          干活的人
```

**瘦身后的 StartScreen**（对比旧的 UISystem，只管自己这一个状态）：

```js
// screens/StartScreen.js — 只做三件事：创建界面、关闭界面、emit 事件
onEnter(GameState.START, 'StartScreen', () => { showTitle(); });
onExit(GameState.START, 'StartScreen', () => { _screen.close(); _screen = null; });

function showTitle() {
    _screen = createTitleScreen({
        onStart: () => { _screen.close(); showLevelSelect(); },  // ← 同状态内切换，回调即可
    });
    overlayManager.add(_screen);
}

function showLevelSelect() {
    _screen = createLevelSelect({
        levels: LEVELS.map(l => ({
            title: l.title,
            onClick: () => {
                _screen.close();
                uiBus.emit(EventTypes.UI_LEVEL_SELECTED, { id: l.id });  // ← 跨状态，emit 事件
            },
        })),
        onBack: () => { _screen.close(); showTitle(); },
    });
    overlayManager.add(_screen);
}
```

标题页到选关页是同状态内的切换，用回调 props 足够了。**只有跨越游戏状态的操作**（选关→开始游戏、胜利→下一关、失败→重试）才走 EventBus。

---

## 四、双 Bus 分层：为什么一个 Bus 不够

当前 EventBus 只有一个实例，装了三种完全不同生命周期的事件：

```
一个 eventBus（混装）：
├── COLLISION         ← 每帧触发（只在 PLAYING）
├── DAMAGE            ← 随碰撞产生（只在 PLAYING）
├── ENTITY_DIED       ← 零血时触发（只在 PLAYING）
├── LEVEL_WIN/LOSE    ← 偶尔触发（只在 PLAYING）
└── UI_xxx × 6        ← 点击触发（在 START/WIN/LOSE）
```

控制台里 COLLISION 的日志刷屏和 UI 按钮点击混在一起，而且两者的生命周期完全不同——game 事件只活在 PLAYING 状态，UI 事件活在 START/WIN/LOSE 状态。

**拆成两个实例，同一个 EventBus 类**：

```js
// Service/core/EventBus/EventBus.js
export const gameBus = new EventBus();  // 游戏运行时事件
export const uiBus   = new EventBus();  // UI 交互事件
```

| | gameBus | uiBus |
|------|---------|-------|
| **事件** | COLLISION, DAMAGE, ENTITY_DIED, LEVEL_WIN/LOSE | UI:LEVEL_SELECTED, UI:NEXT_LEVEL, UI:RETRY, UI:TO_MENU … |
| **触发方** | CollisionSystem, ScriptSystem | screens/* 的按钮回调 |
| **监听方** | 实体脚本, LevelFlowSystem | NavigationSystem |
| **生命周期** | PLAYING | START / WIN / LOSE / PLAYING / PAUSED |

拆开后各管各的，调试时可以单独关掉 gameBus 的日志。

---

## 五、最关键的坑：事件注销时机

事件驱动最大的坑不是"怎么发"，是**"什么时候停"**。

UI 事件和状态强绑定——`UI:LEVEL_SELECTED` 只在 START 状态下有效。如果 START 切换到 PLAYING 时忘了注销，下次在 PLAYING 状态下不小心 emit 了 `UI:LEVEL_SELECTED`，回调还会执行，产生不可预期的行为。

### 方案讨论

**方案一**：手动维护 `_listeners` 数组，onExit 时遍历注销。

```js
const _listeners = [];

onEnter(GameState.START, 'Nav', () => {
    uiBus.on('UI:LEVEL_SELECTED', fn);
    _listeners.push(['UI:LEVEL_SELECTED', fn]);
});

onExit(GameState.START, 'Nav', () => {
    for (const [event, fn] of _listeners) {
        uiBus.off(event, fn);
    }
    _listeners.length = 0;
});
```

可靠，但每个 System 都要自己维护一个 `_listeners`，样板代码重复。

**方案二**：在 EventBus 上加 `scope` 机制。

```js
// EventBus 新增方法
scope(label) {
    return {
        on: (event, fn) => {
            this._scopes[label] ??= [];
            this._scopes[label].push([event, fn]);  // 自动追踪
            this.on(event, fn);
        },
        offAll: () => {
            (this._scopes[label] || []).forEach(([e, fn]) => this.off(e, fn));
            delete this._scopes[label];
        },
    };
}
```

使用方：

```js
const scope = uiBus.scope('NavigationSystem');

onEnter(GameState.WIN, 'NavigationSystem', () => {
    scope.on(EventTypes.UI_NEXT_LEVEL, nextLevel);
    scope.on(EventTypes.UI_TO_MENU, goToMenu);
    scope.on(EventTypes.UI_QUIT, quit);
    // 三个监听被自动追踪
});

onExit(GameState.WIN, 'NavigationSystem', () => {
    scope.offAll();  // 一行全注销，不会漏
});
```

选了方案二——把"追踪"的职责从使用者移到了 EventBus 内部。使用者只需要记住"退出时调 `scope.offAll()`"，不需要维护自己的数组。

---

## 六、NavigationSystem —— 预埋钩子

有了事件驱动，UI 层只管 emit、逻辑层只管 on。但还有一个问题：逻辑层怎么知道每个状态需要监听哪些事件？

做法：**NavigationSystem 在每个游戏状态的 onEnter 中预埋该状态可能用到的全部 UI 事件**。

```js
// NavigationSystem — 5 个状态，10 个预埋钩子

onEnter(GameState.START, 'NavigationSystem', () => {
    scope.on(EventTypes.UI_GAME_START,     () => { /* 占位 */ });
    scope.on(EventTypes.UI_LEVEL_SELECTED, ({ id }) => startLevel(id));
    scope.on(EventTypes.UI_BACK_TO_TITLE,  () => { /* 占位 */ });
    scope.on(EventTypes.UI_QUIT,           quit);
});

onEnter(GameState.PLAYING, 'NavigationSystem', () => {
    scope.on(EventTypes.UI_PAUSE,    () => transition(GameState.PAUSED));
    scope.on(EventTypes.UI_RESTART,  retryLevel);
    scope.on(EventTypes.UI_TO_MENU,  goToMenu);
    scope.on(EventTypes.UI_QUIT,     quit);
});

onEnter(GameState.PAUSED, 'NavigationSystem', () => {
    scope.on(EventTypes.UI_RESUME,   () => transition(GameState.PLAYING));
    scope.on(EventTypes.UI_RESTART,  retryLevel);
    scope.on(EventTypes.UI_TO_MENU,  goToMenu);
});

onEnter(GameState.WIN, 'NavigationSystem', () => {
    scope.on(EventTypes.UI_NEXT_LEVEL, nextLevel);
    scope.on(EventTypes.UI_TO_MENU,    goToMenu);
});

onEnter(GameState.LOSE, 'NavigationSystem', () => {
    scope.on(EventTypes.UI_RETRY,   retryLevel);
    scope.on(EventTypes.UI_TO_MENU, goToMenu);
});

// 每个状态的 onExit 都调 scope.offAll()
```

**预埋的好处**：

- 暂停菜单的 UI 还没做，但 `UI:PAUSE`、`UI:RESUME` 的监听已经在了
- 以后做了暂停 UI，直接 `uiBus.emit(UI:PAUSE)` 就行，NavigationSystem 一行不用改
- 状态的 onEnter 就是一个"这个状态有什么导航能力"的清单，一眼看清楚

---

## 七、完整的用户操作链路

重构前后的对比，以"选第 3 关 → 进入游戏"为例：

**重构前**：

```
用户点击按钮 → UISystem.onClick()
  ├── currentLevel = 3              ← UISystem 记状态
  ├── _screen.close()                ← UISystem 管 UI
  ├── loadLevel(3)                   ← UISystem 调关卡加载
  └── transition(PLAYING)            ← UISystem 切状态
```

**重构后**：

```
用户点击按钮 → StartScreen.onClick()
  └── uiBus.emit(UI:LEVEL_SELECTED, {id:3})   ← UI 层只喊话
          │
          ▼
      NavigationSystem（逻辑层）
          │  收到 UI:LEVEL_SELECTED
          │  → startLevel(3)
          │    → loadLevel(3) → transition(PLAYING)
          │
      START.onExit
          └── scope.offAll()                   ← 清理 START 状态的全部 UI 监听
```

前后对比：UISystem 从"一个人干所有事"变成了"UI 喊话 + 逻辑层干事"。UI 层不知道 `loadLevel` 的存在，逻辑层不知道按钮长什么样。

---

## 八、四层最终架构

```
OverLay/
├── UI/             ← 1. 框架层：组件基类
│   ├── UIScreen.js
│   ├── UIButton.js
│   └── UIText.js
│
├── widgets/        ← 2. 零件层：纯 UI 工厂（零依赖）
│   ├── TitleScreen.js          createTitleScreen({ onStart })
│   ├── LevelSelect.js          createLevelSelect({ levels, onBack })
│   ├── WinScreen.js            createWinScreen({ onNext, onMenu })
│   └── LoseScreen.js           createLoseScreen({ onRetry, onMenu })
│
├── screens/        ← 3. 编排层：状态钩子 + 组合 + emit
│   ├── StartScreen.js          START → 标题 ↔ 选关
│   ├── WinScreen.js            WIN → 胜利界面
│   └── LoseScreen.js           LOSE → 失败界面
│
└── pojo/           ← 4. 游戏层：绑定实体的 overlay
    └── HealthBar.js            读 entity.hp → 渲染血条


system/
├── engine/         ← 通用引擎
├── gameplay/
│   └── NavigationSystem.js  ← 导航调度：监听 uiBus → loadLevel → transition
└── app/            ← 生命周期
```

### 依赖方向

```
screens/ ──→ widgets/ ──→ UI/
    │                        ↑ 纯 UI，不碰游戏
    │
    ├──→ uiBus.emit() ──→ NavigationSystem
    │                         ↑ 纯逻辑，不碰 UI
    │
    └──→ pojo/（HealthBar）← 读 entity 数据，不改逻辑
```

---

## 九、总结

这次重构的四个关键决策：

1. **三层拆 system**（engine / gameplay / app）— 依赖单向，engine 不知道 gameplay 的存在
2. **四层拆 UI**（UI / widgets / screens / pojo）— 每层有明确的"能做"和"不能做"
3. **双 Bus**（gameBus + uiBus）— 不同生命周期的事件分开管理
4. **scope 机制** — onExit 时一行 `scope.offAll()`，不会漏注销

核心原则就一条：**一个模块只做一件事**。widgets 就是拼积木，screens 就是搭场景，NavigationSystem 就是做决策。拆得越细，以后加功能越不用动旧代码。

> 💡 完整 UI 系统设计文档见 [docs/ui-system.md](https://github.com/myWorldmakerTonyczk/gamePVZ/blob/czk/docs/ui-system.md)，包含了架构概览、事件流、开发指南和设计决策。

[返回首页](/) | [上一篇](/posts/pvz-game-engine-7) | [GitHub 仓库](https://github.com/myWorldmakerTonyczk/gamePVZ)
