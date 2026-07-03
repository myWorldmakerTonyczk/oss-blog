---
title: 从零搭建PVZ游戏引擎（三）——importmap、架构解耦、鼠标输入、Overlay贴片与碰撞扣血
date: 2026-07-03
author: myWorldmakerTonyczk
---

# 从零搭建PVZ游戏引擎（三）——importmap、架构解耦、鼠标输入、Overlay贴片与碰撞扣血

> GitHub 仓库：[https://github.com/myWorldmakerTonyczk/gamePVZ](https://github.com/myWorldmakerTonyczk/gamePVZ)

[上一篇](/posts/pvz-game-engine-2) 搭好了 Entity/Scene、Input 和 EventBus。第三天的工作量最大：重构整个 System 层的耦合问题、引入 importmap 路径别名、实现鼠标输入系统、设计 Overlay 贴片框架、以及打通子弹射击→碰撞扣血→血条变化的完整闭环。

## importmap：告别 `../../../../`

### 问题：路径地狱

随着文件层级加深，相对路径变成了灾难。`system/systemPojo/PauseSystem.js` 引用 `core/EventBus.js`：

```js
import { eventBus } from '../../core/EventBus/EventBus.js';
```

每一层都依赖物理目录结构。以后重构文件夹——全部 import 崩掉。之前还有过路径写错，比如 `'../../../Service/core/EventBus/EventBus.js'`，多穿了两层直接 404。

### 方案：Import Map

浏览器原生支持 **Import Map**，一行配置零构建工具：

```html
<script type="importmap">
{
    "imports": {
        "@core/":    "./Service/core/",
        "@entity/":  "./Service/Entity/",
        "@system/":  "./Service/system/",
        "@input/":   "./Service/Input/",
        "@utils/":   "./Service/Utils/",
        "@overlay/": "./Service/OverLay/"
    }
}
</script>
```

所有文件统一使用 `@` 前缀别名，无论文件在哪个目录，import 路径永远一样：

```js
import { onUpdate } from '@core/GameLoop.js';
import { scene }     from '@entity/Scene.js';
```

### 让 VS Code 能跳转

换别名后 Ctrl+点击失效了——浏览器认识 importmap，但 VS Code 不认识。需要项目根目录加 `jsconfig.json`：

```json
{
    "compilerOptions": {
        "paths": {
            "@core/*":   ["./Service/core/*"],
            "@entity/*": ["./Service/Entity/*"],
            "@system/*": ["./Service/system/*"],
            "@input/*":  ["./Service/Input/*"],
            "@utils/*":  ["./Service/Utils/*"],
            "@overlay/*":["./Service/OverLay/*"]
        }
    },
    "include": ["Service/**/*.js", "main.js", "level/**/*.js"]
}
```

一个坑：新版本 TypeScript 弃用了 `baseUrl` 字段，直接用 `paths` 加 `./` 前缀即可。

## 架构重构：System 不该认识具体实体类

### 问题诊断

之前 PlayerSystem 干的事太多：

```js
// 旧版 PlayerSystem：同时依赖 Player、Bullet、Scene 三个具体类
import { Player } from '../../Entity/pojo/player.js';
import { Bullet } from '../../Entity/pojo/Bullet.js';
import { scene } from '../../Entity/Scene.js';

player.keyBoardMove(dt);           // 直接调实体具体方法
const bullet = new Bullet();       // 直接 new 具体类
scene.add(bullet);                 // 直接操作场景
```

三个问题：

- **调了具体方法**：`player.keyBoardMove(dt)` 而不是 `player.update(dt)`。以后改手柄操控，System 要改
- **new 了具体类**：`new Bullet()` 硬编码。换冰子弹要改 System
- **直接操作场景**：`scene.add()` 把创建和注入混在一起

本质问题是 System 知道了不该知道的细节。将来换 FireBullet、换鼠标操控、换子弹生成逻辑——全都要改 PlayerSystem。

### 解耦方案：事件驱动

```
优化前                               优化后
──────                              ──────
PlayerSystem                        PlayerSystem
  ├─ keyBoardMove()  → 删掉          └─ 按空格 → emit('player:shoot', {x,y,angle})
  ├─ new Bullet()    → 删掉          
  ├─ scene.add()     → 删掉         BulletSpawner（新建）
                                      └─ on('player:shoot') → new Bullet() → scene.add
                                    
Player                              Player
  └─ update(dt) 空壳                  └─ update(dt) → keyBoardMove(dt)  ← 移动回归自己
```

三个原则落地：

**1. System 只调 `entity.update(dt)`，不调具体方法**

`keyBoardMove` 塞回 `Player.update()` 里，Scene 的 `onUpdate` 遍历所有实体调 `update`——System 不知道玩家怎么移动。

**2. 创建走 Spawner，不走 System**

`BulletSpawner.js` 唯一知道 Bullet 类的存在：

```js
eventBus.on(EventTypes.PLAYER_SHOOT, ({ x, y, angle }) => {
    const bullet = new Bullet();
    bullet.x = x;
    bullet.y = y;
    bullet.speed = 500;
    bullet.shoot(angle);
    scene.add(bullet);
});
```

以后换冰子弹，只改这一个文件。

**3. PauseSystem 拆分**

之前 PauseSystem 混杂了暂停切换（正式功能）和碰撞暂停（测试代码）。拆成两个文件：`PauseSystem.js` 只管 P 键切换，`CollisionTest.js` 独立负责碰撞测试。

### 事件名常量集中管理

和 `EntityType` 一样，事件名用常量对象收拢散落的字符串，拼错直接报 ReferenceError：

```js
// EventTypes.js
export const EventTypes = {
    COLLISION:     'collision',
    PLAYER_SHOOT:  'player:shoot',
};
```

### 踩坑：import 顺序

PlayerSystem 模块加载时从 `scene.getEntities()` 搜 player。但 import 顺序错了：

```js
// 错误：system 先加载，scene 还是空的
import '@system/index.js';    // PlayerSystem 搜 player → null
import './level/level1.js';   // 这里才 scene.add(player) → 晚了

// 正确：level 先加载
import './level/level1.js';   // 先注入实体
import '@system/index.js';    // 后搜 player → 找到了
```

## 鼠标输入系统

和键盘 Input 保持对称设计：

| 键盘 | 鼠标 | 用途 |
|------|------|------|
| `isAction('left')` | `isMouseAction(button)` | 按住持续 |
| `isJustPressed('pause')` | `isJustClicked(button)` | 单次触发 |
| — | `getMousePos(canvas)` | 返回 Canvas 坐标 |
| `KEY_MAP` | `MouseMap` | 数字键值起可读名字 |

### MouseMap 怎么设计

鼠标 `mousedown` 事件的 `e.button` 直接返回数字 0/1/2。那 MouseMap 应该正着映射（key→数字）还是反着映射？

讨论结果是正着——和 KEY_MAP 一样，给数字起名字：

```js
export const MouseMap = {
    LEFT: 0, MIDDLE: 1, RIGHT: 2,
};

// 调用
isJustClicked(MouseMap.LEFT)  // 比 isJustClicked(0) 好读
```

### isJustClicked 的清除时机

最初设计是 `updateMouse()` 每帧清空 `justPressed`。但踩了一个坑：

```
鼠标点击 → mousedown → justPressed[0] = true
下一帧: updateMouse() → justPressed = {}  ← 全清
         isJustClicked(0) → false  ← 读不到！
```

原因是 `updateMouse` 注册在 onUpdate 里，执行顺序不确定。如果它跑在 isJustClicked 之前，点击就被吞掉了。

最终改成和 `isJustPressed` 一样——**读的时候清零**：

```js
export function isJustClicked(button) {
    if (mouseState.justPressed[button]) {
        mouseState.justPressed[button] = false;  // 读一次就清零
        return true;
    }
    return false;
}
```

`updateMouse()` 以及对应的 MouseSystem 直接删掉，逻辑更干净。

### 坐标转换

`mousemove` 的 `clientX/Y` 是相对浏览器窗口的坐标，Canvas 可能有偏移和缩放。`getMousePos(canvas)` 自动转换：

```js
export function getMousePos(canvas) {
    const rect = canvas.getBoundingClientRect();
    return {
        x: (mouseState.x - rect.left) * (canvas.width / rect.width),
        y: (mouseState.y - rect.top) * (canvas.height / rect.height),
    };
}
```

## 子弹随鼠标方向

有了鼠标位置，子弹射击方向不再写死：

```js
const { x: mx, y: my } = getMousePos(canvas);
const angle = Math.atan2(my - player.y, mx - player.x);
eventBus.emit(EventTypes.PLAYER_SHOOT, { x: player.x, y: player.y, angle });
```

Bullet 的 `update` 用 `Math.cos/sin` 沿角度飞行：

```js
update(dt) {
    this.x += Math.cos(this.angle) * this.speed * dt;
    this.y += Math.sin(this.angle) * this.speed * dt;
}
```

### 踩坑：shoot 里不该移动

初版 `shoot` 方法里用 `cos * speed` 加到了出生坐标上，导致 speed 越大子弹出生点越远。shoot 只管设初值，让 update 管移动——这是 Entity 设计就定好的职责分离。

## Overlay 贴片系统

游戏中飘在实体头顶的东西——血条、伤害数字、名字——需要一个统一框架。不能每个实体自己画，会造成代码重复和层级混乱。

### 三层设计

和 Entity/Scene 体系完全对称：

| 层 | Entity 体系 | Overlay 体系 |
|----|------------|-------------|
| 基类 | Entity | Overlay |
| 容器 | Scene | OverlayManager |
| 驱动 | Scene.onUpdate | OverlaySystem.js |

Overlay 基类：

```js
export class Overlay {
    x = 0; y = 0;
    offsetX = 0; offsetY = 0;  // 相对 target 的偏移
    target = null;              // 绑定实体，自动跟随
    duration = 0;               // 生命周期（秒），0=永久
    elapsed = 0;

    constructor(opts = {}) {
        Object.assign(this, opts);
    }

    getPos() {
        if (this.target) {
            return {
                x: this.target.x + this.offsetX,
                y: this.target.y + this.offsetY,
            };
        }
        return { x: this.x, y: this.y };
    }

    update(dt) { this.elapsed += dt; }

    isAlive() {
        return this.duration === 0 || this.elapsed < this.duration;
    }

    render(ctx) {}  // 子类覆写
}
```

核心设计决策：

- **`Object.assign(this, opts)`** — 参数直挂属性，子类构造函数不用一个个写 `this.xxx = opts.xxx`。扩展性好——加属性不用改构造函数
- **`getPos()`** — 有 target 就跟随实体坐标 + 偏移，没有就用绝对坐标。血条跟实体走，伤害数字定点飘，同一个接口
- **`isAlive()`** — `duration=0` 永久存活（血条），`duration>0` 到时间自动清理（飘字）。OverlayManager 每帧 `filter(o => o.isAlive())` 自动清理

### HealthBar 血条

绑定实体，满血不画，颜色随血量变化：

```js
export class HealthBar extends Overlay {
    constructor(target) {
        super({ target, offsetY: -8 });  // 实体头顶上方
    }

    render(ctx) {
        const t = this.target;
        if (!t || t.hp === undefined || t.hp === t.maxHp) return;

        const { x, y } = this.getPos();
        const w = t.w || 20;
        const ratio = t.hp / t.maxHp;

        ctx.fillStyle = '#333';
        ctx.fillRect(x, y, w, 4);       // 底色
        ctx.fillStyle = ratio > 0.5 ? '#4f4' : ratio > 0.25 ? '#ff0' : '#f44';
        ctx.fillRect(x, y, w * ratio, 4); // 当前血量
    }
}
```

### 渲染挂载点

OverlayManager 的 `update` 通过 OverlaySystem 走 hooks。`render` 挂在 Scene.render 末尾——实体全部画完之后才画 overlay，保证血条永远在最上层：

```js
// Scene.js
render(ctx) {
    for (const e of this.entities) e.render(ctx);  // 先画实体
    overlayManager.render(ctx);                      // 再画贴片
}
```

### 实体死亡时清理血条

Scene.del 里顺手清理该实体的所有 overlay：

```js
del(e) {
    this.entities = this.entities.filter(entity => entity !== e);
    overlayManager.removeByTarget(e);
}
```

不然实体没了、血条还在飘，幽灵血条。

## 碰撞扣血

之前的碰撞系统只做到"检测到碰撞 + 清除子弹"。现在加上伤害流程：

```js
eventBus.on(EventTypes.COLLISION, ({ a, b }) => {
    // 子弹命中敌人 → 子弹消失 + 扣血
    if (a.type === EntityType.BULLET && b.type === EntityType.ENEMY) {
        scene.del(a);
        b.hp -= 25;
        if (b.hp <= 0) scene.del(b);
    }
    // 敌人撞子弹（反过来）
    if (b.type === EntityType.BULLET && a.type === EntityType.ENEMY) {
        scene.del(b);
        a.hp -= 25;
        if (a.hp <= 0) scene.del(a);
    }
});
```

至此第一次形成完整体验链：**瞄准方向 → 左键射击 → 子弹飞行 → 碰撞检测 → 扣血 → 血条变色 → hp 归零实体消失**。所有系统各司其职，通过 EventBus 串联。

## 当前项目结构

```
gamePVZ/
├── index.html              ← 入口 + importmap
├── main.js                 ← 组装（import 系统 + 关卡 + 启动）
├── jsconfig.json           ← VS Code 路径别名
├── level/
│   └── level1.js           ← 第1关：创建实体 + 绑定血条
├── Service/
│   ├── core/               ← 引擎核心
│   │   ├── State Machine.js
│   │   ├── GameLoop.js
│   │   └── EventBus/
│   │       ├── EventBus.js
│   │       └── EventTypes.js
│   ├── Entity/             ← 实体层
│   │   ├── Entity.js       ← 基类（含 hp/maxHp）
│   │   ├── EntityType.js
│   │   ├── Scene.js
│   │   └── pojo/
│   │       ├── Box.js      ← 敌人（自动右移，100hp）
│   │       ├── player.js   ← 玩家（WASD移动）
│   │       └── Bullet.js   ← 子弹（角度飞行）
│   ├── OverLay/            ← 贴片系统
│   │   ├── Overlay.js      ← 基类
│   │   ├── OverlayManager.js ← 容器
│   │   └── pojo/
│   │       └── HealthBar.js ← 血条
│   ├── Input/
│   │   ├── Input.js        ← 键盘
│   │   └── Mouse.js        ← 鼠标
│   ├── Utils/
│   │   └── Collision.js    ← 碰撞工具
│   └── system/
│       ├── HookLabel.js
│       ├── index.js         ← 统一入口
│       └── systemPojo/
│           ├── PauseSystem.js
│           ├── PlayerSystem.js
│           ├── CollisionSystem.js
│           ├── CollisionTest.js
│           ├── BulletSpawner.js
│           └── OverlaySystem.js
└── README.md
```

## 调用链

```
main.js
  ├─ import level1.js  → 实体注入 Scene + 血条绑定
  ├─ import system/    → System 自注册到 hooks
  └─ transition(PLAYING) + start()

每帧 tick(timestamp)
  ├─ update(dt)  [while 循环，固定步长追赶]
  │    └─ hooks.onUpdate[当前状态]
  │         ├─ Scene       → scene.update(dt) → 遍历实体
  │         ├─ PlayerSystem → 按鼠标 → emit(PLAYER_SHOOT)
  │         ├─ CollisionSystem → 检测 + 扣血 + 清除
  │         └─ OverlaySystem → overlayManager.update(dt)
  │
  └─ render()  [每帧调用一次]
       └─ world.render(ctx)
            └─ Scene.render(ctx)
                 ├─ entities: e.render(ctx) × N
                 └─ overlayManager.render(ctx)  ← 最上层
```

[返回首页](/) | [上一篇](/posts/pvz-game-engine-2) | [GitHub 仓库](https://github.com/myWorldmakerTonyczk/gamePVZ)
