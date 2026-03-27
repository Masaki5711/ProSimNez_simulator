---
name: ui-ux-design
description: Framework-agnostic UI/UX design principles — layout, typography, color, spacing, visual hierarchy, responsive design, and interaction patterns for building polished, user-friendly interfaces.
origin: ECC
---

# UI/UX Design Principles

Framework-agnostic design principles for building polished, intuitive, and user-friendly interfaces. These principles apply to any technology — web, mobile, desktop.

## When to Activate

- Designing or reviewing user interface layouts
- Choosing colors, typography, or spacing
- Building responsive or adaptive layouts
- Creating forms, navigation, modals, or other common UI patterns
- Improving visual hierarchy and readability
- Reviewing designs for usability issues

## Visual Hierarchy

The most important principle in UI design. Guide the user's eye to what matters most.

### Size and Weight

```
PRIMARY ACTION    →  Large, bold, high contrast    (e.g., "Submit" button)
Secondary action  →  Medium, normal weight          (e.g., "Cancel" link)
Tertiary info     →  Small, lighter color            (e.g., footnotes, timestamps)
```

### The Squint Test

Blur or squint at your interface. The elements that stand out should be:
1. The page title or primary heading
2. The primary call-to-action
3. Key data or content

If something unimportant stands out more than the primary action, fix the hierarchy.

### Hierarchy Checklist

- Headings are visually distinct from body text (size, weight, or color)
- Primary actions are immediately identifiable
- Related items are visually grouped
- Less important information is visually subdued
- Whitespace separates distinct sections

## Layout Principles

### The 8-Point Grid

Use multiples of 8px for all spacing and sizing. This creates consistent visual rhythm.

```
Spacing scale:  4px  8px  12px  16px  24px  32px  48px  64px  96px  128px

Micro spacing (within components):     4px, 8px
Component padding:                     12px, 16px
Section spacing:                       24px, 32px
Page-level spacing:                    48px, 64px, 96px
```

### Content Width

```
Optimal reading width:    45-75 characters (≈ 600-900px)
Max content width:        1200-1440px
Min touch target:         44x44px (mobile), 32x32px (desktop)
```

### Layout Patterns

```
Single column    →  Mobile, articles, forms, onboarding flows
Two column       →  Sidebar + content, settings pages
Three column     →  Dashboards, email clients
Card grid        →  Product listings, galleries, portfolios
Split screen     →  Comparison views, before/after
```

### Z-Pattern and F-Pattern

```
Z-Pattern (landing pages):          F-Pattern (text-heavy pages):
┌──────────────────┐                ┌──────────────────┐
│ Logo ──── Nav    │                │ ████████████████ │
│     ╲            │                │ ████████████     │
│      ╲           │                │ ██████████       │
│       ╲          │                │ ████████████████ │
│ CTA ──── Info    │                │ ██████           │
└──────────────────┘                └──────────────────┘
```

## Typography

### Type Scale

Use a consistent ratio (1.25 or 1.333) to generate font sizes:

```
Ratio 1.25 (Major Third):
  xs:    12px   (captions, labels)
  sm:    14px   (secondary text)
  base:  16px   (body text — browser default)
  lg:    20px   (large body, card titles)
  xl:    25px   (section headings)
  2xl:   31px   (page headings)
  3xl:   39px   (hero headings)
  4xl:   49px   (display headings)
```

### Line Height and Spacing

```
Body text:     line-height 1.5–1.75 (comfortable reading)
Headings:      line-height 1.1–1.3  (tighter for large text)
Paragraph gap: 1em–1.5em between paragraphs
Letter spacing: Normal for body, slightly wider for ALL CAPS, tighter for large headings
```

### Font Pairing Rules

```
Rule 1:  Maximum 2 typefaces per project (1 heading + 1 body)
Rule 2:  Pair a serif with a sans-serif, or two contrasting sans-serifs
Rule 3:  System fonts are fast and good enough for most apps:
         -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif

Good pairings:
  Inter + Inter             (single font, weight variation)
  Inter + Source Serif      (sans + serif)
  Montserrat + Open Sans   (geometric + humanist)
```

### Text Readability

```
Minimum body font size:   16px (web), 14pt (mobile)
Maximum line length:      75 characters
Contrast ratio:           4.5:1 normal text, 3:1 large text (WCAG AA)
Avoid:                    Justified text on web, ALL CAPS for body, light gray on white
```

## Color System

### Building a Color Palette

```
1. Primary color     →  Brand identity, primary actions, active states
2. Secondary color   →  Supporting actions, accents
3. Neutral scale     →  Text, backgrounds, borders (9-11 shades from white to black)
4. Semantic colors   →  Success (green), Warning (amber), Error (red), Info (blue)
```

### Neutral Scale (Example)

```
50:   #fafafa   (lightest background)
100:  #f5f5f5   (card backgrounds, hover states)
200:  #e5e5e5   (borders, dividers)
300:  #d4d4d4   (disabled text, placeholder)
400:  #a3a3a3   (secondary text)
500:  #737373   (body text)
600:  #525252   (strong text)
700:  #404040   (headings)
800:  #262626   (primary text)
900:  #171717   (darkest text)
```

### Color Usage Guidelines

```
DO:
  - Use color to communicate meaning (red = error, green = success)
  - Maintain consistent color roles across the app
  - Test with color-blindness simulators
  - Provide non-color indicators (icons, text, patterns) alongside color

DON'T:
  - Use more than 3-4 distinct hues (excluding neutrals)
  - Rely on color alone to convey information
  - Use pure black (#000) on pure white (#fff) — too harsh
  - Use saturated colors for large background areas
```

### Dark Mode Guidelines

```
- Don't simply invert colors — adjust saturation and brightness
- Use elevated surfaces (lighter shades) instead of shadows for depth
- Reduce saturation of accent colors to avoid eye strain
- Primary background: #121212–#1a1a1a (not pure black)
- Surface elevation: increase lightness by 5-8% per level
- Text: #e0e0e0–#ffffff (not pure white for body text)
```

## Spacing and Alignment

### Consistent Spacing

```
The single most impactful improvement to any UI is consistent spacing.

BAD:                          GOOD:
┌────────────────┐            ┌────────────────┐
│Title           │            │                │
│                │            │  Title         │
│   Subtitle     │            │  Subtitle      │
│ Content here   │            │                │
│   with text    │            │  Content here  │
│                │            │  with text     │
│     [Button]   │            │                │
└────────────────┘            │  [Button]      │
                              │                │
                              └────────────────┘
```

### Proximity Principle

Related items should be closer together than unrelated items:

```
GOOD:                          BAD:
┌────────────┐                 ┌────────────┐
│ Label      │  ← 4px gap     │ Label      │
│ [Input]    │                 │            │  ← same gap
│            │  ← 24px gap    │ [Input]    │
│ Label      │                 │            │  ← same gap
│ [Input]    │  ← 4px gap     │ Label      │
│            │                 │            │
│ [Submit]   │  ← 32px gap    │ [Input]    │
└────────────┘                 │ [Submit]   │
                               └────────────┘
```

## Responsive Design

### Breakpoint Strategy

```
Mobile first:    Start with mobile layout, add complexity for larger screens

Common breakpoints:
  sm:   640px    (large phones, landscape)
  md:   768px    (tablets)
  lg:   1024px   (small laptops)
  xl:   1280px   (desktops)
  2xl:  1536px   (large desktops)
```

### What Changes at Each Breakpoint

```
Mobile (< 640px):
  - Single column layout
  - Full-width buttons and inputs
  - Hamburger navigation
  - Stack cards vertically
  - Larger touch targets (48px minimum)

Tablet (640–1024px):
  - 2-column grid where appropriate
  - Side navigation or top tabs
  - Cards in 2-column grid

Desktop (> 1024px):
  - Multi-column layouts
  - Persistent sidebar navigation
  - Hover states and tooltips
  - Cards in 3-4 column grid
  - Keyboard shortcuts
```

### Responsive Typography

```
Mobile:   body 16px, h1 28px, h2 22px
Tablet:   body 16px, h1 36px, h2 26px
Desktop:  body 16px, h1 48px, h2 32px

Use clamp() for fluid scaling:
  font-size: clamp(1.75rem, 1rem + 2vw, 3rem);
```

## Common UI Patterns

### Forms

```
Layout:
  - Single column for most forms (faster completion)
  - Label above input (not inline — better mobile support)
  - Group related fields with visible sections
  - Primary action on the left (LTR) or full-width on mobile

Validation:
  - Inline validation on blur (not on every keystroke)
  - Error message directly below the invalid field
  - Use red border + icon + text (not color alone)
  - Show success state for validated fields
  - Disable submit only while submitting (not while form is invalid)

UX:
  - Mark optional fields, not required ones (most fields should be required)
  - Use appropriate input types (email, tel, number, date)
  - Provide placeholder text as example, not as label
  - Auto-focus the first field on page load
```

### Navigation

```
Top navigation:    5-7 items max, icons + labels for mobile
Sidebar:           Collapsible, icon-only on mobile, persistent on desktop
Breadcrumbs:       For hierarchical content (> 2 levels deep)
Tabs:              3-7 items, for same-page content switching
Bottom tabs:       Mobile apps, 3-5 items max with icons
```

### Feedback and States

```
Every interactive element needs these states:
  Default    →  Base appearance
  Hover      →  Subtle change (background, shadow, underline)
  Focus      →  Visible outline (keyboard users MUST see this)
  Active     →  Pressed/clicked state
  Disabled   →  Reduced opacity (0.5), cursor: not-allowed
  Loading    →  Spinner or skeleton, disable interactions
  Error      →  Red border/text, error icon
  Success    →  Green checkmark, confirmation message

Loading patterns:
  < 1 second:     No indicator needed
  1-3 seconds:    Spinner or progress bar
  > 3 seconds:    Skeleton screens with progress indication
  > 10 seconds:   Background processing with notification
```

### Modals and Dialogs

```
DO:
  - Use for confirmations, focused tasks, or critical alerts
  - Trap focus inside the modal
  - Close on Escape key and overlay click
  - Animate in/out (fade + scale)
  - Include a visible close button

DON'T:
  - Stack modals on modals
  - Use for content that could be inline
  - Make the modal larger than the viewport
  - Auto-open modals on page load (except for critical alerts)
```

### Empty States

```
Every empty state needs:
  1. Clear illustration or icon
  2. Explanation of what will appear here
  3. Call-to-action to populate the state

Example:
  ┌───────────────────────┐
  │      [icon/image]     │
  │                       │
  │   No projects yet     │
  │                       │
  │   Create your first   │
  │   project to get      │
  │   started.            │
  │                       │
  │   [Create Project]    │
  └───────────────────────┘
```

## Animation and Motion

### Timing Guidelines

```
Micro-interactions:      100-200ms  (button press, toggle, hover)
Small transitions:       200-300ms  (menu open, tooltip, fade)
Medium transitions:      300-500ms  (modal, page slide, card expand)
Large transitions:       500-800ms  (page transition, complex animations)

Easing:
  Enter:    ease-out        (fast start, slow end — element arriving)
  Exit:     ease-in         (slow start, fast end — element leaving)
  Move:     ease-in-out     (smooth acceleration and deceleration)
  Default:  cubic-bezier(0.4, 0, 0.2, 1)  (Material Design standard)
```

### Motion Principles

```
1. Purpose:      Every animation should serve a function (guide, feedback, context)
2. Speed:        Fast enough to not slow the user down (< 300ms for common actions)
3. Natural:      Follow physics — ease-in-out, not linear
4. Consistent:   Same type of action = same type of animation
5. Respect:      Honor prefers-reduced-motion for accessibility
```

## Quick Reference: Design Checklist

Before marking UI work complete:

- [ ] Visual hierarchy is clear (headings, actions, content are properly ranked)
- [ ] Spacing is consistent (8px grid)
- [ ] Typography scale is consistent (no arbitrary font sizes)
- [ ] Color contrast meets WCAG AA (4.5:1 for text)
- [ ] All interactive elements have hover, focus, active, and disabled states
- [ ] Forms have clear labels, validation feedback, and error states
- [ ] Layout works at mobile, tablet, and desktop breakpoints
- [ ] Empty states and loading states are handled
- [ ] Touch targets are at least 44x44px on mobile
- [ ] Animations respect prefers-reduced-motion
- [ ] No information conveyed by color alone (use icons, text, patterns)
- [ ] Text is readable (16px minimum, 75 char max line length, sufficient contrast)

## Anti-Patterns to Avoid

```
- Mystery meat navigation:     Icons without labels, unclear affordances
- Infinite scroll without position: No way to return to a specific location
- Disabled buttons without explanation: User doesn't know why they can't proceed
- Modal on page load:          Instantly annoys users
- Tiny click targets:          Frustrating on mobile and for motor-impaired users
- Low contrast text:           Beautiful but unreadable
- Layout shift:                Content jumping as images/fonts load
- Inconsistent patterns:       Different button styles for the same action
- Wall of text:                No headings, no whitespace, no visual breaks
- Too many fonts/colors:       Creates visual noise instead of clarity
```

**Remember**: Good UI design is invisible. The user should accomplish their goal without thinking about the interface. When in doubt, choose clarity over cleverness, consistency over novelty.

**Related skills**: See `css-styling-patterns` for CSS/Tailwind implementation, `accessibility-wcag` for WCAG compliance, `web-design-guidelines` for production design systems and performance optimization.
