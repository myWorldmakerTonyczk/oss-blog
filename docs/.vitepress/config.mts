import { defineConfig } from 'vitepress'
import { readdirSync, readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

interface PostMeta {
  text: string
  link: string
  date: string
  series?: string
  seriesOrder?: number
}

function getPosts(): { series: PostMeta[]; standalone: PostMeta[] } {
  const postsDir = resolve(__dirname, '../posts')
  const files = readdirSync(postsDir).filter(f => f.endsWith('.md') && f !== 'index.md')

  const all: PostMeta[] = files.map(file => {
    const content = readFileSync(resolve(postsDir, file), 'utf-8')
    const match = content.match(/^---\s*\n([\s\S]*?)\n---/)
    const frontmatter = match?.[1] || ''
    const title = frontmatter.match(/title:\s*(.+)/)?.[1] || file.replace('.md', '')
    const date = frontmatter.match(/date:\s*(.+)/)?.[1] || ''
    const series = frontmatter.match(/series:\s*(.+)/)?.[1] || ''
    const seriesOrder = parseInt(frontmatter.match(/seriesOrder:\s*(\d+)/)?.[1] || '0')

    return { text: title, link: `/posts/${file.replace('.md', '')}`, date, series: series || undefined, seriesOrder: seriesOrder || undefined }
  })

  all.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  const seriesPosts = all.filter(p => p.series).sort((a, b) => (a.seriesOrder || 0) - (b.seriesOrder || 0))
  const standalone = all.filter(p => !p.series)

  return { series: seriesPosts, standalone }
}

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
      '/posts/': (() => {
        const { series, standalone } = getPosts()
        const items: any[] = []

        // 按 series 字段分组，每个合集一个折叠分组
        const seriesGroups = new Map<string, PostMeta[]>()
        for (const p of series) {
          const name = p.series!
          if (!seriesGroups.has(name)) seriesGroups.set(name, [])
          seriesGroups.get(name)!.push(p)
        }
        for (const [seriesName, seriesPosts] of seriesGroups) {
          items.push({
            text: seriesName,
            collapsed: false,
            items: seriesPosts.map(p => ({ text: p.text, link: p.link })),
          })
        }
        // 非合集帖子
        if (standalone.length) {
          items.push({
            text: '其他文章',
            items: standalone.map(p => ({ text: p.text, link: p.link })),
          })
        }

        return items
      })(),
    },
    socialLinks: [
      { icon: 'github', link: 'https://github.com/myWorldmakerTonyczk/oss-blog' }
    ]
  }
})
