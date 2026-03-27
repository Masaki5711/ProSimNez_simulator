---
name: ui-design-rules
description: UI/UX design rules enforcing visual hierarchy, consistent spacing, responsive design, accessibility, and interaction patterns.
origin: ECC
---

# UI Design Rules

## Visual Hierarchy
- Every page must have a clear visual hierarchy: heading > actions > content > metadata
- Primary actions must be immediately identifiable (size, color, position)
- Related items must be visually grouped with proximity and whitespace

## Spacing & Layout
- Use 8px grid for all spacing (4, 8, 12, 16, 24, 32, 48, 64px)
- No magic number spacing — use design tokens or spacing scale
- Content max-width: 1200-1440px; reading width: 45-75 characters
- Mobile-first: start with single column, add complexity for larger screens

## Typography
- Maximum 2 typefaces per project
- Minimum body font size: 16px (web)
- Use a consistent type scale (1.25 or 1.333 ratio)
- Line height: 1.5-1.75 for body, 1.1-1.3 for headings

## Color
- Maximum 3-4 distinct hues (plus neutral scale and semantic colors)
- Never convey information by color alone — add icons, text, or patterns
- Contrast: 4.5:1 for normal text, 3:1 for large text (WCAG AA)
- Dark mode: don't invert — adjust brightness and saturation

## Accessibility (MANDATORY)
- All interactive elements keyboard-accessible
- Visible focus indicators on all focusable elements (never outline: none without replacement)
- All form inputs must have associated `<label>` elements
- All images must have appropriate `alt` text
- Touch targets minimum 44x44px on mobile
- Respect `prefers-reduced-motion` for animations
- Heading hierarchy must be logical (h1 > h2 > h3, no skipping)

## Interaction States
- Every interactive element needs: default, hover, focus, active, disabled states
- Loading states for operations > 1 second
- Error and success feedback for all user actions
- Empty states with explanation and call-to-action

## Responsive
- Test at: 320px (mobile), 768px (tablet), 1024px (laptop), 1440px (desktop)
- No horizontal scrolling at any breakpoint
- Full-width buttons and inputs on mobile
- Content readable at 200% zoom

## CSS
- Use CSS custom properties for design tokens
- Use Flexbox/Grid for layout — no floats
- Prefer `transform` and `opacity` for animations (GPU-accelerated)
- Keep selector specificity flat (classes only, no IDs in CSS)
- Animations: 150-300ms for micro-interactions, ease-out for enter, ease-in for exit

## Performance (Web)
- Images must have `width` and `height` attributes (prevents CLS)
- Use `loading="lazy"` for below-fold images, `fetchpriority="high"` for LCP image
- JS bundle target: < 200KB gzipped per route
- Custom fonts: subset, preload, `font-display: swap`
- Core Web Vitals: LCP < 2.5s, INP < 200ms, CLS < 0.1

## SEO (Web)
- Every page must have a unique `<title>` (50-60 chars) and `<meta description>` (150-160 chars)
- Set canonical URL on every page
- Include Open Graph and Twitter Card meta tags
- Use structured data (JSON-LD) for key content

## Related Skills
- `ui-ux-design` — visual hierarchy, layout, typography, color, spacing
- `css-styling-patterns` — CSS/Tailwind implementation patterns
- `accessibility-wcag` — WCAG 2.2 AA compliance
- `web-design-guidelines` — design systems, performance, SEO, framework patterns
