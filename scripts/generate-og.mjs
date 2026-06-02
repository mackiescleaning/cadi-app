import puppeteer from 'puppeteer';
import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, '../public/og');
mkdirSync(outDir, { recursive: true });

const articles = [
  {
    slug: 'blog',
    tag: 'Cadi Blog',
    tagColor: '#818cf8',
    title: 'Guides for UK Cleaning Business Owners',
    subtitle: 'Automation · Reputation · Compliance · Growth'
  },
  {
    slug: 'best-software-for-cleaning-businesses-uk',
    tag: 'Software Comparison',
    tagColor: '#818cf8',
    title: 'The Best Software for UK Cleaning Businesses in 2026',
    subtitle: 'An honest comparison'
  },
  {
    slug: 'how-to-automate-cleaning-business-bookings',
    tag: 'Bookings & Automation',
    tagColor: '#818cf8',
    title: 'How to Automate Your Cleaning Business Bookings',
    subtitle: 'And get your evenings back'
  },
  {
    slug: 'how-to-get-more-5-star-reviews-cleaning-business',
    tag: 'Reputation',
    tagColor: '#4ade80',
    title: 'How to Get More 5-Star Reviews for Your Cleaning Business',
    subtitle: 'Without begging for them'
  },
  {
    slug: 'cleaning-business-trends-2026',
    tag: 'Industry Trends',
    tagColor: '#fb923c',
    title: '5 Cleaning Industry Trends Shaping 2026',
    subtitle: 'And how to position your business for growth'
  },
  {
    slug: 'ai-is-reshaping-cleaning-businesses',
    tag: 'AI & Automation',
    tagColor: '#818cf8',
    title: 'AI Is Reshaping the Cleaning Industry',
    subtitle: "Here's what smart business owners are doing about it"
  }
];

function buildHtml({ tag, tagColor, title, subtitle }) {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body {
    width: 1200px;
    height: 630px;
    overflow: hidden;
  }
  body {
    background: #010a4f;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
    display: flex;
    flex-direction: column;
    padding: 56px 64px;
    position: relative;
  }
  .glow-1 {
    position: absolute;
    width: 520px;
    height: 520px;
    background: radial-gradient(circle, rgba(99,102,241,0.35) 0%, transparent 70%);
    top: -160px;
    right: -80px;
    border-radius: 50%;
    pointer-events: none;
  }
  .glow-2 {
    position: absolute;
    width: 300px;
    height: 300px;
    background: radial-gradient(circle, rgba(79,70,229,0.2) 0%, transparent 70%);
    bottom: -60px;
    left: 300px;
    border-radius: 50%;
    pointer-events: none;
  }
  .grid {
    position: absolute;
    inset: 0;
    background-image: linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
                      linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px);
    background-size: 60px 60px;
    pointer-events: none;
  }
  .content {
    position: relative;
    z-index: 1;
    display: flex;
    flex-direction: column;
    height: 100%;
  }
  .logo {
    font-size: 26px;
    font-weight: 800;
    color: #fff;
    letter-spacing: -0.04em;
  }
  .logo span {
    color: #818cf8;
  }
  .spacer { flex: 1; }
  .tag {
    display: inline-block;
    background: rgba(255,255,255,0.1);
    border: 1px solid rgba(255,255,255,0.15);
    color: ${tagColor};
    border-radius: 999px;
    padding: 7px 18px;
    font-size: 17px;
    font-weight: 600;
    letter-spacing: 0.01em;
    width: fit-content;
    margin-bottom: 20px;
  }
  .title {
    color: #fff;
    font-size: 52px;
    font-weight: 800;
    line-height: 1.12;
    letter-spacing: -0.03em;
    max-width: 880px;
    margin-bottom: 16px;
  }
  .subtitle {
    color: rgba(255,255,255,0.45);
    font-size: 22px;
    font-weight: 400;
    letter-spacing: -0.01em;
  }
  .footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: 36px;
    padding-top: 24px;
    border-top: 1px solid rgba(255,255,255,0.08);
  }
  .domain {
    color: #818cf8;
    font-size: 19px;
    font-weight: 700;
    letter-spacing: -0.01em;
  }
  .tagline {
    color: rgba(255,255,255,0.3);
    font-size: 17px;
    font-weight: 400;
  }
</style>
</head>
<body>
  <div class="glow-1"></div>
  <div class="glow-2"></div>
  <div class="grid"></div>
  <div class="content">
    <div class="logo">Cadi<span>.</span></div>
    <div class="spacer"></div>
    <div class="tag">${tag}</div>
    <div class="title">${title}</div>
    <div class="subtitle">${subtitle}</div>
    <div class="footer">
      <div class="domain">cadi.cleaning</div>
      <div class="tagline">The business OS for UK cleaning professionals</div>
    </div>
  </div>
</body>
</html>`;
}

const browser = await puppeteer.launch({ headless: true });
const page = await browser.newPage();
await page.setViewport({ width: 1200, height: 630, deviceScaleFactor: 2 });

for (const article of articles) {
  const html = buildHtml(article);
  await page.setContent(html, { waitUntil: 'domcontentloaded' });

  const outPath = join(outDir, `${article.slug}.png`);
  await page.screenshot({ path: outPath, type: 'png', clip: { x: 0, y: 0, width: 1200, height: 630 } });
  console.log(`✓  ${article.slug}.png`);
}

await browser.close();
console.log('\nDone — images saved to public/og/');
