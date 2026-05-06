import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';

export const GET: APIRoute = async () => {
  const baseUrl = 'https://kodek.in';

  // Static pages with their SEO priority and change frequency
  const staticPages = [
    { url: '/',     changefreq: 'weekly',  priority: '1.0' },
    { url: '/blog', changefreq: 'weekly',  priority: '0.8' },
  ];

  // Dynamically include all published blog posts
  const posts = await getCollection('blog', ({ data }) => !data.draft);
  const blogPages = posts.map((post) => ({
    url: `/blog/${post.id}`,
    changefreq: 'monthly',
    priority: '0.7',
    lastmod: post.data.date.toISOString().split('T')[0],
  }));

  const allPages = [...staticPages, ...blogPages];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${allPages
  .map(
    (page) => `  <url>
    <loc>${baseUrl}${page.url}</loc>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>${
      'lastmod' in page ? `\n    <lastmod>${page.lastmod}</lastmod>` : ''
    }
  </url>`
  )
  .join('\n')}
</urlset>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
};
