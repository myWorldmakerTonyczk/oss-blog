---
layout: page
title: Blog Posts
---

<style>
.post-feed {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 24px;
  margin-top: 32px;
}

.post-card {
  border: 1px solid var(--vp-c-bg-soft);
  border-radius: 12px;
  padding: 24px;
  transition: border-color 0.25s, transform 0.25s;
  background: var(--vp-c-bg-soft);
}

.post-card:hover {
  border-color: var(--vp-c-brand);
  transform: translateY(-2px);
}

.post-card .post-title {
  font-size: 18px;
  font-weight: 600;
  margin: 0 0 8px 0;
}

.post-card .post-title a {
  color: var(--vp-c-text-1);
  text-decoration: none;
}

.post-card .post-title a:hover {
  color: var(--vp-c-brand);
}

.post-card .post-date {
  font-size: 13px;
  color: var(--vp-c-text-3);
  margin-bottom: 12px;
}

.post-card .post-excerpt {
  font-size: 14px;
  color: var(--vp-c-text-2);
  line-height: 1.6;
  margin: 0;
}

.page-header {
  margin-bottom: 8px;
}

.page-header h1 {
  font-size: 32px;
  margin-bottom: 8px;
}

.page-header .subtitle {
  color: var(--vp-c-text-2);
  font-size: 16px;
}
</style>

<div class="page-header">
  <h1>📝 博客文章</h1>
  <p class="subtitle">记录开源软件开发技术课程的学习与思考</p>
</div>

<div class="post-feed">

<div class="post-card">
  <p class="post-title"><a href="/posts/first-post">初识开源软件开发</a></p>
  <p class="post-date">2026-06-30 · myWorldmakerTonyczk</p>
  <p class="post-excerpt">介绍开源软件的基本概念、常见开源许可证（MIT、Apache 2.0、GPL v3、BSD），以及 Git、GitHub、VitePress 等现代开源开发工具的使用。</p>
</div>

</div>
