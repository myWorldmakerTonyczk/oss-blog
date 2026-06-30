import { defineConfig } from 'vitepress'

export default defineConfig({
  title: "My Open Source Blog",
  description: "开源软件开发技术课程 - 个人Blog",
  base: "/oss-blog/",
  themeConfig: {
    nav: [
      { text: 'Home', link: '/' },
      { text: 'Blog', link: '/posts/' }
    ],
    sidebar: {
      '/posts/': [
        {
          text: 'Blog Posts',
          items: [
            { text: '初识开源软件开发', link: '/posts/first-post' }
          ]
        }
      ]
    },
    socialLinks: [
      { icon: 'github', link: 'https://github.com/myWorldmakerTonyczk/oss-blog' }
    ]
  }
})
