---
name: accessibility-wcag
description: Web accessibility patterns following WCAG 2.2 guidelines — semantic HTML, ARIA, keyboard navigation, screen reader support, color contrast, and inclusive design.
origin: ECC
---

# Accessibility (WCAG) Patterns

Practical accessibility patterns for building inclusive web interfaces that comply with WCAG 2.2 AA standards. Accessibility is not optional — it is a legal requirement in many jurisdictions and a quality standard.

## When to Activate

- Building any user-facing interface (web, mobile web)
- Reviewing UI code for accessibility compliance
- Implementing forms, navigation, modals, or interactive components
- Choosing colors and typography
- Testing with screen readers or keyboard navigation

## Core Principles (POUR)

```
Perceivable     →  Content is available to all senses (sight, sound, touch)
Operable        →  Interface works with keyboard, mouse, touch, voice
Understandable  →  Content and behavior are predictable and clear
Robust          →  Works across browsers, devices, and assistive technologies
```

## Semantic HTML First

The most impactful accessibility improvement is using the right HTML elements.

```html
<!-- GOOD: Semantic HTML — free accessibility -->
<header>
  <nav aria-label="Main navigation">
    <ul>
      <li><a href="/">Home</a></li>
      <li><a href="/about">About</a></li>
    </ul>
  </nav>
</header>

<main>
  <article>
    <h1>Page Title</h1>
    <p>Content paragraph.</p>

    <section aria-labelledby="features-heading">
      <h2 id="features-heading">Features</h2>
      <ul>
        <li>Feature one</li>
        <li>Feature two</li>
      </ul>
    </section>
  </article>

  <aside aria-label="Related links">
    <h2>Related</h2>
    <nav aria-label="Related navigation">
      <ul>
        <li><a href="/related-1">Related Article 1</a></li>
      </ul>
    </nav>
  </aside>
</main>

<footer>
  <p>&copy; 2025 Company</p>
</footer>

<!-- BAD: div soup — no semantics, no accessibility -->
<div class="header">
  <div class="nav">
    <div class="link" onclick="goto('/')">Home</div>
  </div>
</div>
<div class="content">
  <div class="title">Page Title</div>
  <div class="text">Content paragraph.</div>
</div>
```

### Semantic Element Reference

```
<header>       →  Site or section header
<nav>          →  Navigation block (use aria-label if multiple navs)
<main>         →  Primary content (one per page)
<article>      →  Self-contained content
<section>      →  Thematic grouping (use with heading)
<aside>        →  Tangentially related content
<footer>       →  Site or section footer
<h1>–<h6>      →  Headings in order (don't skip levels)
<button>       →  Clickable actions (not <div onclick>)
<a>            →  Navigation links (has href)
<ul>/<ol>      →  Lists of items
<table>        →  Tabular data (not layout)
<form>         →  User input collection
<label>        →  Input labels (always associate with for/id)
<fieldset>     →  Group of related inputs
<legend>       →  Label for fieldset
<dialog>       →  Modal dialogs (native)
<details>      →  Expandable content (native accordion)
```

## ARIA — When Semantic HTML Isn't Enough

### ARIA Rules

```
Rule 1:  Don't use ARIA if native HTML can do it
         <button> is better than <div role="button">

Rule 2:  Don't change native semantics unnecessarily
         <h2 role="tab"> is wrong — use <button role="tab">

Rule 3:  All interactive ARIA elements must be keyboard-operable

Rule 4:  Don't use role="presentation" or aria-hidden="true"
         on focusable elements

Rule 5:  All interactive elements must have accessible names
```

### Common ARIA Patterns

```html
<!-- Tabs -->
<div role="tablist" aria-label="Account settings">
  <button role="tab" aria-selected="true" aria-controls="panel-1"
          id="tab-1">Profile</button>
  <button role="tab" aria-selected="false" aria-controls="panel-2"
          id="tab-2" tabindex="-1">Security</button>
</div>
<div role="tabpanel" id="panel-1" aria-labelledby="tab-1">
  Profile content...
</div>
<div role="tabpanel" id="panel-2" aria-labelledby="tab-2" hidden>
  Security content...
</div>

<!-- Alert for dynamic content -->
<div role="alert" aria-live="assertive">
  Error: Please fix the highlighted fields.
</div>

<!-- Status updates (less urgent) -->
<div role="status" aria-live="polite">
  3 results found.
</div>

<!-- Accessible icon button -->
<button aria-label="Close dialog">
  <svg aria-hidden="true"><!-- icon SVG --></svg>
</button>

<!-- Loading state -->
<div aria-busy="true" aria-live="polite">
  <span class="spinner" aria-hidden="true"></span>
  Loading results...
</div>
```

## Keyboard Navigation

### Every Interactive Element Must Be Keyboard-Accessible

```
Tab          →  Move to next focusable element
Shift+Tab    →  Move to previous focusable element
Enter/Space  →  Activate buttons and links
Escape       →  Close modals, menus, popups
Arrow keys   →  Navigate within components (tabs, menus, sliders)
Home/End     →  Jump to first/last item in a list
```

### Focus Management

```css
/* NEVER remove focus outlines without replacement */
/* BAD */
*:focus { outline: none; }

/* GOOD: Custom focus indicator */
:focus-visible {
  outline: 2px solid var(--color-primary-500);
  outline-offset: 2px;
}

/* Hide default outline only for mouse users */
:focus:not(:focus-visible) {
  outline: none;
}
```

### Focus Trap for Modals

```javascript
function trapFocus(modalElement) {
  const focusable = modalElement.querySelectorAll(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  );
  const first = focusable[0];
  const last = focusable[focusable.length - 1];

  modalElement.addEventListener('keydown', (e) => {
    if (e.key !== 'Tab') return;

    if (e.shiftKey) {
      if (document.activeElement === first) {
        e.preventDefault();
        last.focus();
      }
    } else {
      if (document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  });

  first.focus();
}
```

### Skip Link

```html
<!-- First element in <body> — lets keyboard users skip nav -->
<a href="#main-content" class="skip-link">
  Skip to main content
</a>

<style>
.skip-link {
  position: absolute;
  top: -100%;
  left: 0;
  padding: 0.5rem 1rem;
  background: var(--color-primary-500);
  color: white;
  z-index: 100;
}

.skip-link:focus {
  top: 0;
}
</style>

<main id="main-content">
  <!-- Page content -->
</main>
```

## Color and Contrast

### Minimum Contrast Ratios (WCAG AA)

```
Normal text (< 18pt / < 14pt bold):     4.5:1
Large text  (>= 18pt / >= 14pt bold):   3:1
UI components and graphics:              3:1
```

### Testing Contrast

```
Tools:
  - Chrome DevTools → Inspect element → color picker shows contrast ratio
  - WebAIM Contrast Checker (webaim.org/resources/contrastchecker)
  - Stark plugin for Figma
  - axe DevTools browser extension

Common failures:
  - Light gray text on white background (#999 on #fff = 2.85:1 — FAIL)
  - Placeholder text too low contrast
  - Disabled state still needs to be perceivable (don't reduce to 0 opacity)
```

### Don't Rely on Color Alone

```html
<!-- BAD: Color alone indicates error -->
<input style="border-color: red">

<!-- GOOD: Color + icon + text -->
<div class="input-group error">
  <input aria-invalid="true" aria-describedby="email-error"
         style="border-color: red">
  <span class="error-icon" aria-hidden="true">!</span>
  <p id="email-error" class="error-text" role="alert">
    Please enter a valid email address.
  </p>
</div>
```

## Forms

### Accessible Form Pattern

```html
<form aria-label="Contact form">
  <!-- Always associate labels with inputs -->
  <div class="field">
    <label for="name">Full name <span aria-hidden="true">*</span></label>
    <input id="name" type="text" required
           aria-required="true"
           autocomplete="name">
  </div>

  <div class="field">
    <label for="email">Email address <span aria-hidden="true">*</span></label>
    <input id="email" type="email" required
           aria-required="true"
           aria-describedby="email-hint"
           autocomplete="email">
    <p id="email-hint" class="hint">We'll never share your email.</p>
  </div>

  <!-- Error state -->
  <div class="field error">
    <label for="phone">Phone number</label>
    <input id="phone" type="tel"
           aria-invalid="true"
           aria-describedby="phone-error"
           autocomplete="tel">
    <p id="phone-error" class="error-text" role="alert">
      Please enter a valid phone number.
    </p>
  </div>

  <!-- Grouped inputs -->
  <fieldset>
    <legend>Preferred contact method</legend>
    <label>
      <input type="radio" name="contact" value="email"> Email
    </label>
    <label>
      <input type="radio" name="contact" value="phone"> Phone
    </label>
  </fieldset>

  <button type="submit">Send message</button>
</form>
```

## Images and Media

```html
<!-- Informative image — describe what it shows -->
<img src="chart.png" alt="Bar chart showing 40% increase in Q3 revenue">

<!-- Decorative image — hide from screen readers -->
<img src="decorative-border.png" alt="" role="presentation">

<!-- Complex image — provide detailed description -->
<figure>
  <img src="flowchart.png" alt="System architecture diagram"
       aria-describedby="flowchart-desc">
  <figcaption id="flowchart-desc">
    The system consists of three layers: client (React), API (Node.js),
    and database (PostgreSQL). Requests flow from client to API to database.
  </figcaption>
</figure>

<!-- Video with captions -->
<video controls>
  <source src="demo.mp4" type="video/mp4">
  <track kind="captions" src="captions-en.vtt" srclang="en" label="English"
         default>
  <track kind="captions" src="captions-ja.vtt" srclang="ja" label="Japanese">
</video>

<!-- SVG icons -->
<svg aria-hidden="true" focusable="false"><!-- decorative icon --></svg>
<svg role="img" aria-label="Warning icon"><use href="#warning" /></svg>
```

## Testing

### Automated Testing Tools

```
Browser extensions:
  - axe DevTools (Deque) — most comprehensive
  - WAVE (WebAIM) — visual overlay
  - Lighthouse (built into Chrome DevTools)

CI/CD integration:
  - axe-core (npm package)
  - pa11y
  - jest-axe (for React component tests)
```

### Manual Testing Checklist

```
Keyboard:
  [ ] Tab through entire page — logical order?
  [ ] All interactive elements reachable?
  [ ] Focus indicator visible at all times?
  [ ] Modals trap focus and return focus on close?
  [ ] Escape closes popups and modals?

Screen reader:
  [ ] Page title is descriptive
  [ ] Headings form a logical outline (h1 → h2 → h3, no skipping)
  [ ] Images have meaningful alt text (or alt="" if decorative)
  [ ] Form inputs have associated labels
  [ ] Error messages announced when they appear
  [ ] Dynamic content changes announced (aria-live)

Visual:
  [ ] Content readable at 200% zoom
  [ ] No horizontal scrolling at 320px width
  [ ] Color contrast meets 4.5:1 (or 3:1 for large text)
  [ ] Information not conveyed by color alone
  [ ] Focus indicator visible with sufficient contrast
  [ ] Text resizable without breaking layout
```

### Component Testing with jest-axe

```javascript
import { render } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';

expect.extend(toHaveNoViolations);

test('form should have no accessibility violations', async () => {
  const { container } = render(<ContactForm />);
  const results = await axe(container);
  expect(results).toHaveNoViolations();
});
```

## Quick Reference: WCAG AA Checklist

Before marking UI work complete:

- [ ] All images have appropriate alt text
- [ ] Color contrast meets minimum ratios (4.5:1 / 3:1)
- [ ] All interactive elements are keyboard-accessible
- [ ] Focus indicator is visible on all focusable elements
- [ ] Form inputs have associated `<label>` elements
- [ ] Heading hierarchy is logical (no skipped levels)
- [ ] Page has a descriptive `<title>`
- [ ] Language is declared (`<html lang="en">`)
- [ ] Dynamic content changes are announced to screen readers
- [ ] No content flashes more than 3 times per second
- [ ] Page is usable at 200% zoom
- [ ] Touch targets are at least 44x44px
- [ ] Error messages identify the field and describe the error
- [ ] Skip link is provided for keyboard users
- [ ] `prefers-reduced-motion` is respected

**Remember**: Accessibility benefits everyone — not just users with disabilities. Keyboard navigation helps power users, captions help users in noisy environments, and good contrast helps users in sunlight. Build for everyone from the start.

**Related skills**: See `ui-ux-design` for visual hierarchy and layout principles, `css-styling-patterns` for CSS/Tailwind implementation, `web-design-guidelines` for design systems and SEO.
