---
name: web-design-guidelines
description: Production web design guidelines — design systems, component architecture, performance-first design, image optimization, web fonts, SEO, and modern deployment patterns. Complements ui-ux-design, css-styling-patterns, and accessibility-wcag skills.
origin: vercel-labs-adapted
---

# Web Design Guidelines

Production-grade web design guidelines for building fast, beautiful, and maintainable websites and web applications. Focuses on design systems, component architecture, performance, and deployment — areas not covered by ui-ux-design, css-styling-patterns, or accessibility-wcag skills.

## When to Activate

- Building production websites or web applications
- Setting up a design system or component library
- Optimizing web performance (Core Web Vitals)
- Working with images, fonts, and media assets
- Implementing SEO and metadata
- Designing for modern frameworks (Next.js, Astro, Remix, SvelteKit)

## Design System Architecture

### Token-Based Design

Build from tokens up, not from components down:

```
Tokens → Primitives → Components → Patterns → Pages

Level 1 — Design Tokens (raw values):
  color.blue.500: #3b82f6
  space.4: 1rem
  font.size.base: 16px
  radius.md: 8px

Level 2 — Semantic Tokens (intent):
  color.action.primary: {color.blue.500}
  color.action.primary-hover: {color.blue.600}
  color.bg.surface: {color.neutral.50}
  color.text.primary: {color.neutral.900}

Level 3 — Component Tokens (scoped):
  button.bg: {color.action.primary}
  button.bg-hover: {color.action.primary-hover}
  button.radius: {radius.md}
  button.padding-x: {space.4}
```

### Component API Design

```
Component API principles:
  1. Composition over configuration — prefer children/slots over prop flags
  2. Variant pattern — use a `variant` prop for visual styles (primary, secondary, ghost)
  3. Size scale — use consistent sizes (xs, sm, md, lg, xl) across all components
  4. Polymorphic `as` — allow rendering as different HTML elements
  5. Forward refs — always forward refs for DOM access
  6. Spread remaining props — pass through className, id, data-*, aria-*

Component categories:
  Primitives:    Button, Input, Badge, Avatar, Icon
  Layout:        Stack, Grid, Container, Divider, Spacer
  Navigation:    NavBar, Sidebar, Breadcrumb, Tabs, Pagination
  Feedback:      Toast, Alert, Modal, Drawer, Tooltip, Popover
  Data Display:  Table, Card, List, Stat, Timeline
  Forms:         TextField, Select, Checkbox, Radio, Switch, DatePicker
```

### File Organization for Design Systems

```
src/
├── tokens/
│   ├── colors.ts        # Raw color values
│   ├── spacing.ts       # Spacing scale
│   ├── typography.ts    # Font sizes, weights, line heights
│   └── index.ts         # Unified token export
├── components/
│   ├── ui/              # Primitive UI components
│   │   ├── button/
│   │   │   ├── button.tsx
│   │   │   ├── button.test.tsx
│   │   │   └── index.ts
│   │   ├── input/
│   │   └── ...
│   ├── layout/          # Layout components
│   │   ├── stack.tsx
│   │   ├── grid.tsx
│   │   └── container.tsx
│   └── patterns/        # Composed patterns
│       ├── auth-form.tsx
│       ├── data-table.tsx
│       └── page-header.tsx
└── styles/
    ├── globals.css       # CSS reset, base styles, tokens
    ├── utilities.css     # Utility classes (if not using Tailwind)
    └── animations.css    # Shared keyframe animations
```

## Performance-First Design

### Core Web Vitals Targets

```
LCP  (Largest Contentful Paint):   < 2.5s     What to optimize: hero images, fonts, above-fold content
INP  (Interaction to Next Paint):  < 200ms    What to optimize: event handlers, JS bundle size, hydration
CLS  (Cumulative Layout Shift):    < 0.1      What to optimize: image dimensions, font loading, dynamic content

Key metrics to track:
  FCP  (First Contentful Paint):   < 1.8s
  TTFB (Time to First Byte):      < 800ms
  TBT  (Total Blocking Time):     < 200ms
```

### Image Optimization

```
Format selection:
  Photos:        WebP (fallback JPEG) — 25-35% smaller than JPEG
  Graphics/UI:   SVG for icons and logos — scalable, tiny file size
  Transparency:  WebP or AVIF (fallback PNG)
  Animation:     Use <video> instead of GIF — 90% smaller

Responsive images:
  <img
    src="hero-800.webp"
    srcset="hero-400.webp 400w,
            hero-800.webp 800w,
            hero-1200.webp 1200w,
            hero-1600.webp 1600w"
    sizes="(max-width: 640px) 100vw,
           (max-width: 1024px) 80vw,
           1200px"
    width="1200"
    height="630"
    alt="Descriptive alt text"
    loading="lazy"
    decoding="async"
  />

Rules:
  - ALWAYS set width and height attributes (prevents CLS)
  - Use loading="lazy" for below-the-fold images
  - Use loading="eager" + fetchpriority="high" for LCP image
  - Serve images from CDN with proper cache headers
  - Use <picture> element for art direction across breakpoints
  - Maximum quality: 80-85% for JPEG/WebP (diminishing returns above)
```

### Font Loading Strategy

```
System font stack (fastest — zero network requests):
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI",
               Roboto, "Helvetica Neue", Arial, sans-serif;

Custom fonts (when brand requires):
  1. Subset fonts — include only needed characters (latin, latin-ext)
  2. Use font-display: swap (shows text immediately, swaps when loaded)
  3. Preload critical fonts:
     <link rel="preload" href="/fonts/inter-var.woff2"
           as="font" type="font/woff2" crossorigin>
  4. Use variable fonts — one file instead of multiple weights
  5. Self-host fonts (avoid Google Fonts third-party request)
  6. Maximum 2 font families (one heading, one body)

@font-face {
  font-family: 'Inter';
  src: url('/fonts/inter-var.woff2') format('woff2');
  font-weight: 100 900;          /* Variable font range */
  font-display: swap;
  unicode-range: U+0000-00FF;    /* Latin subset */
}
```

### Critical Rendering Path

```
Above-the-fold optimization:
  1. Inline critical CSS (< 14KB) — render above-fold without blocking
  2. Defer non-critical CSS with media="print" trick or rel="preload"
  3. Async load JavaScript — use defer or async attributes
  4. Preconnect to critical origins:
     <link rel="preconnect" href="https://cdn.example.com">
  5. Prefetch next-page resources for likely navigation:
     <link rel="prefetch" href="/next-page.js">

JavaScript budget:
  Total JS bundle:    < 200KB gzipped (ideal < 100KB)
  Per-route JS:       < 50KB gzipped
  Third-party JS:     < 50KB total — audit ruthlessly
```

## SEO and Metadata

### Essential Meta Tags

```html
<head>
  <!-- Primary -->
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Page Title — Site Name</title>
  <meta name="description" content="Concise 150-160 char description">

  <!-- Open Graph (social sharing) -->
  <meta property="og:type" content="website">
  <meta property="og:title" content="Page Title">
  <meta property="og:description" content="Description for social cards">
  <meta property="og:image" content="https://example.com/og-image.png">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:url" content="https://example.com/page">

  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="Page Title">
  <meta name="twitter:description" content="Description">
  <meta name="twitter:image" content="https://example.com/twitter-image.png">

  <!-- Favicon -->
  <link rel="icon" href="/favicon.ico" sizes="32x32">
  <link rel="icon" href="/icon.svg" type="image/svg+xml">
  <link rel="apple-touch-icon" href="/apple-touch-icon.png">

  <!-- Canonical URL -->
  <link rel="canonical" href="https://example.com/page">
</head>
```

### Structured Data

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "WebPage",
  "name": "Page Title",
  "description": "Page description",
  "url": "https://example.com/page",
  "breadcrumb": {
    "@type": "BreadcrumbList",
    "itemListElement": [
      { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://example.com" },
      { "@type": "ListItem", "position": 2, "name": "Category", "item": "https://example.com/category" }
    ]
  }
}
</script>
```

### SEO Checklist

```
Technical:
  - [ ] Unique <title> per page (50-60 characters)
  - [ ] Unique <meta description> per page (150-160 characters)
  - [ ] Canonical URL set on every page
  - [ ] Open Graph and Twitter Card meta tags
  - [ ] Structured data (JSON-LD) for key content
  - [ ] XML sitemap generated and submitted
  - [ ] robots.txt properly configured
  - [ ] HTTPS everywhere (no mixed content)
  - [ ] 301 redirects for moved pages

Content:
  - [ ] One <h1> per page
  - [ ] Logical heading hierarchy (h1 > h2 > h3)
  - [ ] Descriptive alt text on images
  - [ ] Internal linking between related pages
  - [ ] Meaningful URLs (slug-based, not ID-based)
```

## Modern Framework Patterns

### Server Components vs Client Components

```
Server Components (default — render on server):
  - Fetch data directly (no API calls from client)
  - Access backend resources (database, file system)
  - Keep secrets server-side
  - Reduce client JavaScript bundle
  - Use for: layouts, pages, data-heavy sections

Client Components (opt-in with "use client"):
  - Interactive UI (onClick, onChange, onSubmit)
  - Browser APIs (localStorage, geolocation)
  - React hooks (useState, useEffect, useRef)
  - Third-party libraries that use browser APIs
  - Use for: forms, dropdowns, modals, animations

Decision guide:
  Does it need interactivity?     → Client Component
  Does it fetch data?             → Server Component
  Does it use browser APIs?       → Client Component
  Is it a layout or static page?  → Server Component
  Does it use useState/useEffect? → Client Component
```

### Page Layout Pattern

```
Standard page structure:
  ┌──────────────────────────────────────────┐
  │  Announcement Bar (optional, dismissible) │
  ├──────────────────────────────────────────┤
  │  Navigation Bar (sticky)                  │
  ├──────────────────────────────────────────┤
  │  Hero Section (LCP target — optimize)     │
  ├──────────────────────────────────────────┤
  │  Content Sections                         │
  │  ┌──────────┐  ┌──────────┐              │
  │  │  Feature  │  │  Feature  │             │
  │  └──────────┘  └──────────┘              │
  ├──────────────────────────────────────────┤
  │  CTA Section                              │
  ├──────────────────────────────────────────┤
  │  Footer (sitemap, legal, social)          │
  └──────────────────────────────────────────┘

Key rules:
  - Hero section should render in < 2.5s (LCP)
  - Navigation: max 7 top-level items
  - Footer: include sitemap links for SEO
  - Every section needs a clear purpose
```

### Loading and Error States

```
Loading hierarchy:
  1. Skeleton screens   — for known layout (cards, lists, profiles)
  2. Spinner            — for unknown content or actions
  3. Progress bar       — for measurable progress (uploads, multi-step)
  4. Optimistic UI      — update immediately, rollback on error

Error hierarchy:
  1. Inline error       — field-level validation (forms)
  2. Toast notification — transient errors (network timeout)
  3. Error boundary     — component-level crash recovery
  4. Error page         — full-page errors (404, 500)

Empty state pattern:
  1. Illustration or icon (visual anchor)
  2. Headline (what is this area for)
  3. Description (why it's empty)
  4. CTA button (how to populate it)
```

## Deployment and Caching

### Cache Strategy

```
Static assets (CSS, JS, images, fonts):
  Cache-Control: public, max-age=31536000, immutable
  → Content-hashed filenames enable permanent caching

HTML pages:
  Cache-Control: public, max-age=0, must-revalidate
  → Always check for fresh HTML, serve cached if unchanged

API responses:
  Cache-Control: private, max-age=60, stale-while-revalidate=300
  → Fresh for 1 minute, serve stale while revalidating for 5 minutes

CDN headers:
  Vary: Accept-Encoding     (gzip/brotli variants)
  Vary: Accept              (WebP/AVIF image variants)
```

### Rendering Strategies

```
SSG (Static Site Generation):
  When: Content rarely changes (blog, docs, marketing)
  How:  Pre-render at build time
  Pros: Fastest TTFB, cheapest hosting, CDN-cacheable
  Cons: Build time grows with pages, stale until rebuild

ISR (Incremental Static Regeneration):
  When: Content changes periodically (product pages, news)
  How:  Serve cached, revalidate in background
  Pros: Fast TTFB + fresh content, scales well
  Cons: First request after revalidation shows stale data

SSR (Server-Side Rendering):
  When: Personalized or real-time content (dashboards, feeds)
  How:  Render on every request
  Pros: Always fresh, supports auth/personalization
  Cons: Slower TTFB, requires server, not CDN-cacheable

CSR (Client-Side Rendering):
  When: Highly interactive apps behind auth (admin panels)
  How:  Ship JS shell, fetch data on client
  Pros: Rich interactivity, simple deployment
  Cons: Slow FCP, poor SEO, large JS bundle
```

## Anti-Patterns

```
Performance:
  - Unoptimized images (no srcset, no lazy loading, no width/height)
  - Loading entire icon library for a few icons
  - Blocking third-party scripts in <head>
  - No font subsetting or font-display strategy
  - Client-side fetching data that could be server-rendered

Design:
  - Inconsistent spacing (mix of arbitrary pixel values)
  - More than 2 font families
  - No design tokens — hard-coded colors and sizes everywhere
  - Responsive as afterthought — desktop-first instead of mobile-first

Architecture:
  - "use client" on every component (negates server component benefits)
  - Prop drilling through 5+ levels (use composition or context)
  - Giant monolithic components (> 300 lines)
  - No error boundaries — one crash takes down the whole page

SEO:
  - Missing or duplicate <title> tags
  - No canonical URLs (duplicate content penalty)
  - JavaScript-only content with no SSR (search engines can't index)
  - Missing Open Graph tags (poor social sharing)
```

## Quick Reference: Web Design Checklist

Before shipping a web page:

- [ ] Core Web Vitals pass (LCP < 2.5s, INP < 200ms, CLS < 0.1)
- [ ] Images optimized (WebP, srcset, width/height, lazy loading)
- [ ] Fonts optimized (subset, preload, font-display: swap)
- [ ] JS bundle < 200KB gzipped
- [ ] Critical CSS inlined or loaded first
- [ ] Unique title and meta description
- [ ] Open Graph and Twitter Card meta tags
- [ ] Canonical URL set
- [ ] Structured data (JSON-LD) for key content
- [ ] Design tokens used consistently (no magic numbers)
- [ ] Component API follows composition pattern
- [ ] Error boundaries and loading states implemented
- [ ] Proper cache headers configured
- [ ] No horizontal scroll at any viewport

**Related skills**: See `ui-ux-design` for visual hierarchy and layout principles, `css-styling-patterns` for CSS/Tailwind implementation, `accessibility-wcag` for WCAG compliance.
