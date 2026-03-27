---
name: css-styling-patterns
description: Modern CSS and Tailwind CSS patterns — layout (Flexbox, Grid), responsive design, theming, animations, and utility-first styling best practices.
origin: ECC
---

# CSS & Styling Patterns

Modern CSS patterns and Tailwind CSS best practices for building maintainable, responsive, and performant user interfaces.

## When to Activate

- Writing CSS, SCSS, or Tailwind CSS styles
- Building responsive layouts with Flexbox or Grid
- Implementing design tokens and theming
- Creating animations and transitions
- Reviewing CSS for performance and maintainability
- Converting designs to code

## Modern CSS Layout

### Flexbox — One-Dimensional Layout

```css
/* Center anything — the most useful pattern */
.center {
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Navigation bar */
.navbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 1rem;
  height: 64px;
}

/* Card row with equal-height cards */
.card-row {
  display: flex;
  gap: 1rem;
}

.card-row > * {
  flex: 1;            /* Equal width */
  min-width: 0;       /* Prevent overflow */
}

/* Sticky footer layout */
.page {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

.page > main {
  flex: 1;            /* Main expands, footer stays at bottom */
}
```

### CSS Grid — Two-Dimensional Layout

```css
/* Responsive card grid — no media queries needed */
.card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 1.5rem;
}

/* Dashboard layout */
.dashboard {
  display: grid;
  grid-template-columns: 250px 1fr;
  grid-template-rows: 64px 1fr;
  grid-template-areas:
    "sidebar header"
    "sidebar main";
  min-height: 100vh;
}

.sidebar { grid-area: sidebar; }
.header  { grid-area: header; }
.main    { grid-area: main; }

/* Holy grail layout */
.holy-grail {
  display: grid;
  grid-template: auto 1fr auto / auto 1fr auto;
  min-height: 100vh;
}

/* Responsive sidebar — collapses on mobile */
@media (max-width: 768px) {
  .dashboard {
    grid-template-columns: 1fr;
    grid-template-areas:
      "header"
      "main";
  }

  .sidebar {
    display: none; /* Or use off-canvas pattern */
  }
}
```

### Container Queries

```css
/* Style based on container size, not viewport */
.card-container {
  container-type: inline-size;
}

@container (min-width: 400px) {
  .card {
    display: grid;
    grid-template-columns: 150px 1fr;
    gap: 1rem;
  }
}

@container (max-width: 399px) {
  .card {
    display: flex;
    flex-direction: column;
  }
}
```

## CSS Custom Properties (Design Tokens)

### Token System

```css
:root {
  /* Colors */
  --color-primary-50: #eff6ff;
  --color-primary-500: #3b82f6;
  --color-primary-600: #2563eb;
  --color-primary-700: #1d4ed8;

  --color-neutral-50: #fafafa;
  --color-neutral-200: #e5e5e5;
  --color-neutral-500: #737373;
  --color-neutral-800: #262626;
  --color-neutral-900: #171717;

  --color-success: #22c55e;
  --color-warning: #f59e0b;
  --color-error: #ef4444;

  /* Typography */
  --font-sans: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  --font-mono: "JetBrains Mono", "Fira Code", ui-monospace, monospace;

  --text-xs: 0.75rem;      /* 12px */
  --text-sm: 0.875rem;     /* 14px */
  --text-base: 1rem;       /* 16px */
  --text-lg: 1.25rem;      /* 20px */
  --text-xl: 1.5rem;       /* 24px */
  --text-2xl: 2rem;        /* 32px */
  --text-3xl: 2.5rem;      /* 40px */

  /* Spacing (8px grid) */
  --space-1: 0.25rem;      /* 4px */
  --space-2: 0.5rem;       /* 8px */
  --space-3: 0.75rem;      /* 12px */
  --space-4: 1rem;         /* 16px */
  --space-6: 1.5rem;       /* 24px */
  --space-8: 2rem;         /* 32px */
  --space-12: 3rem;        /* 48px */
  --space-16: 4rem;        /* 64px */

  /* Borders */
  --radius-sm: 0.25rem;    /* 4px */
  --radius-md: 0.5rem;     /* 8px */
  --radius-lg: 0.75rem;    /* 12px */
  --radius-full: 9999px;

  /* Shadows */
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
  --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  --shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
  --shadow-xl: 0 20px 25px -5px rgba(0, 0, 0, 0.1);

  /* Transitions */
  --duration-fast: 150ms;
  --duration-normal: 250ms;
  --duration-slow: 400ms;
  --ease-default: cubic-bezier(0.4, 0, 0.2, 1);
}
```

### Dark Mode with Custom Properties

```css
/* Light mode (default) */
:root {
  --bg-primary: var(--color-neutral-50);
  --bg-surface: #ffffff;
  --bg-elevated: #ffffff;
  --text-primary: var(--color-neutral-900);
  --text-secondary: var(--color-neutral-500);
  --border-color: var(--color-neutral-200);
}

/* Dark mode */
@media (prefers-color-scheme: dark) {
  :root {
    --bg-primary: #0a0a0a;
    --bg-surface: #171717;
    --bg-elevated: #262626;
    --text-primary: #ededed;
    --text-secondary: #a0a0a0;
    --border-color: #333333;
  }
}

/* Manual toggle override */
[data-theme="dark"] {
  --bg-primary: #0a0a0a;
  --bg-surface: #171717;
  /* ... */
}
```

## Tailwind CSS Patterns

### Component Composition

```html
<!-- Button variants -->
<button class="inline-flex items-center justify-center rounded-lg px-4 py-2
               text-sm font-medium transition-colors duration-150
               bg-blue-600 text-white hover:bg-blue-700
               focus-visible:outline-none focus-visible:ring-2
               focus-visible:ring-blue-500 focus-visible:ring-offset-2
               disabled:opacity-50 disabled:pointer-events-none">
  Primary Button
</button>

<!-- Card -->
<div class="rounded-xl border border-neutral-200 bg-white p-6
            shadow-sm transition-shadow hover:shadow-md
            dark:border-neutral-800 dark:bg-neutral-900">
  <h3 class="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
    Card Title
  </h3>
  <p class="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
    Card description text.
  </p>
</div>

<!-- Input with label and error -->
<div class="space-y-1.5">
  <label class="text-sm font-medium text-neutral-700 dark:text-neutral-300">
    Email
  </label>
  <input type="email"
         class="w-full rounded-lg border border-neutral-300 px-3 py-2
                text-sm placeholder:text-neutral-400
                focus:border-blue-500 focus:outline-none focus:ring-1
                focus:ring-blue-500
                dark:border-neutral-700 dark:bg-neutral-800" />
  <p class="text-xs text-red-500">Please enter a valid email address.</p>
</div>
```

### Responsive Patterns with Tailwind

```html
<!-- Stack on mobile, row on desktop -->
<div class="flex flex-col gap-4 md:flex-row md:items-center">
  <div class="flex-1">Content</div>
  <div class="flex-1">Content</div>
</div>

<!-- Responsive grid -->
<div class="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
  <div>Card</div>
  <div>Card</div>
  <div>Card</div>
</div>

<!-- Hide/show based on screen size -->
<nav class="hidden md:flex">Desktop Nav</nav>
<button class="md:hidden">Mobile Menu</button>

<!-- Responsive typography -->
<h1 class="text-2xl font-bold sm:text-3xl lg:text-4xl xl:text-5xl">
  Responsive Heading
</h1>
```

### Tailwind Config Best Practices

```javascript
// tailwind.config.js
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx,html}'],
  darkMode: 'class', // or 'media'
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eff6ff',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
        },
      },
      fontFamily: {
        sans: ['Inter', ...defaultTheme.fontFamily.sans],
      },
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
      },
      animation: {
        'fade-in': 'fadeIn 200ms ease-out',
        'slide-up': 'slideUp 300ms ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
}
```

## CSS Animations

### Transitions

```css
/* Standard interactive transition */
.button {
  transition: background-color 150ms ease, transform 100ms ease;
}

.button:hover {
  background-color: var(--color-primary-600);
}

.button:active {
  transform: scale(0.98);
}

/* Smooth height animation (for accordions) */
.accordion-content {
  display: grid;
  grid-template-rows: 0fr;
  transition: grid-template-rows 300ms ease;
}

.accordion-content[data-open] {
  grid-template-rows: 1fr;
}

.accordion-content > div {
  overflow: hidden;
}
```

### Keyframe Animations

```css
/* Skeleton loading shimmer */
@keyframes shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}

.skeleton {
  background: linear-gradient(90deg,
    var(--color-neutral-200) 25%,
    var(--color-neutral-100) 50%,
    var(--color-neutral-200) 75%
  );
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
  border-radius: var(--radius-md);
}

/* Spinner */
@keyframes spin {
  to { transform: rotate(360deg); }
}

.spinner {
  width: 1.25rem;
  height: 1.25rem;
  border: 2px solid var(--color-neutral-200);
  border-top-color: var(--color-primary-500);
  border-radius: 50%;
  animation: spin 600ms linear infinite;
}
```

### Respect Reduced Motion

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

## CSS Performance

### Critical Practices

```css
/* Avoid layout thrashing — use transform instead of top/left */
.animate-position {
  /* BAD: Triggers layout */
  /* top: 10px; left: 20px; */

  /* GOOD: GPU-accelerated, no layout */
  transform: translate(20px, 10px);
}

/* Use will-change sparingly */
.frequently-animated {
  will-change: transform, opacity;
}

/* Contain layout for performance */
.card {
  contain: layout style paint;
}

/* Use content-visibility for off-screen content */
.below-fold-section {
  content-visibility: auto;
  contain-intrinsic-size: auto 500px;
}
```

### Minimize Reflows

```
Properties that trigger LAYOUT (expensive):
  width, height, margin, padding, border-width
  top, left, right, bottom
  font-size, line-height
  display, position, float

Properties that trigger PAINT only (cheaper):
  color, background-color, border-color
  visibility, text-decoration, box-shadow

Properties that trigger COMPOSITE only (cheapest):
  transform, opacity, filter
  → Always prefer these for animations
```

## Quick Reference: CSS Selector Specificity

```
Type selectors:        0-0-1    (div, p, h1)
Class selectors:       0-1-0    (.card, .active)
ID selectors:          1-0-0    (#header)
Inline styles:         override
!important:            nuclear option — avoid

Best practice:
  - Use classes for everything
  - Avoid ID selectors in CSS
  - Avoid !important (except for utility overrides)
  - Keep specificity flat and predictable
```

## Anti-Patterns to Avoid

```css
/* BAD: Magic numbers */
.header { margin-top: 37px; }
/* GOOD: Use design tokens */
.header { margin-top: var(--space-8); }

/* BAD: Fixed heights on content containers */
.content { height: 500px; }
/* GOOD: Use min-height or auto */
.content { min-height: 500px; }

/* BAD: Pixel-based media queries with arbitrary values */
@media (max-width: 743px) { }
/* GOOD: Standard breakpoints */
@media (max-width: 768px) { }

/* BAD: Styling with IDs */
#submit-button { background: blue; }
/* GOOD: Use classes */
.btn-primary { background: blue; }

/* BAD: Deep nesting */
.page .content .sidebar .nav .item .link { }
/* GOOD: Flat selectors */
.sidebar-link { }

/* BAD: Overriding frameworks with !important */
.my-button { color: red !important; }
/* GOOD: Increase specificity or use proper cascade layers */
```

**Remember**: Good CSS is predictable, maintainable, and performant. Use design tokens for consistency, modern layout (Grid/Flexbox) for structure, and custom properties for theming. Prefer utility-first (Tailwind) or BEM for naming, and always test across browsers and screen sizes.

**Related skills**: See `ui-ux-design` for visual hierarchy and layout principles, `accessibility-wcag` for WCAG compliance, `web-design-guidelines` for design systems and performance optimization.
