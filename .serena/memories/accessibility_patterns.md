# Accessibility Patterns & Guidelines

## Overview

This document provides accessibility patterns and best practices for the KenmeiToAnilist application, ensuring WCAG 2.1 Level AA compliance.

## Core Principles

1. **Semantic HTML First** - Use native elements before ARIA
2. **Keyboard Accessible** - All functionality available via keyboard
3. **Screen Reader Friendly** - Proper labels, roles, and announcements
4. **Focus Management** - Logical focus order and visible indicators
5. **Responsive to User Needs** - Support various assistive technologies

## Component Patterns

### Buttons

**Icon-Only Buttons:**

```tsx
<Button ariaLabel="Close dialog" variant="ghost" size="icon">
  <X className="h-4 w-4" />
</Button>
```

**Loading State:**

```tsx
<Button disabled={isLoading} aria-busy={isLoading}>
  {isLoading ? <Loader2 className="animate-spin" /> : "Submit"}
</Button>
```

### Form Inputs

**With Label and Error:**

```tsx
<Label htmlFor="email">Email</Label>
<Input
  id="email"
  type="email"
  aria-describedby="email-error"
  aria-invalid={hasError}
  aria-required={true}
/>
{hasError && (
  <span id="email-error" role="alert" className="text-red-600">
    {errorMessage}
  </span>
)}
```

### Progress Indicators

```tsx
<Progress
  value={percentage}
  aria-label="Upload progress"
/>
<output className="sr-only" aria-live="polite">
  {percentage}% complete
</output>
```

### Dialogs/Modals

```tsx
<Dialog>
  <DialogTrigger>Open</DialogTrigger>
  <DialogContent aria-modal="true">
    <DialogHeader>
      <DialogTitle>Dialog Title</DialogTitle>
      <DialogDescription>Description text</DialogDescription>
    </DialogHeader>
    {/* Content */}
  </DialogContent>
</Dialog>
```

### Live Regions

**Polite Announcements:**

```tsx
<output className="sr-only" aria-live="polite">
  {statusMessage}
</output>
```

**Assertive Announcements (Errors):**

```tsx
<div className="sr-only" role="alert" aria-live="assertive">
  {errorMessage}
</div>
```

### Navigation

```tsx
<nav role="navigation" aria-label="Main navigation">
  <Link to="/" aria-current={isActive ? "page" : undefined}>
    Home
  </Link>
</nav>
```

### Skip Links

```tsx
<a
  href="#main-content"
  className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4"
>
  Skip to main content
</a>
```

## Focus Management

### Route Changes

```tsx
useEffect(() => {
  const mainContent = document.getElementById("main-content");
  if (mainContent) {
    mainContent.focus();
  }
}, [location.pathname]);
```

### Modal Open

```tsx
useEffect(() => {
  if (isOpen) {
    const firstFocusable = modalRef.current?.querySelector("button, [href], input");
    firstFocusable?.focus();
  }
}, [isOpen]);
```

## Keyboard Navigation

### Shortcuts

- Use Ctrl/Cmd + key combinations (not single keys)
- Document all shortcuts in ShortcutsPanel
- Provide alternatives for critical actions
- Allow users to disable/customize shortcuts

### Focus Traps

- Implement in modals and dialogs
- Tab cycles through focusable elements
- Shift+Tab reverses direction
- Escape closes modal

## Screen Reader Patterns

### Visually Hidden Text

```tsx
<span className="sr-only">Descriptive text for screen readers</span>
```

### Image Alt Text

```tsx
<img src={url} alt="Descriptive text" />
<img src={decorative} alt="" aria-hidden="true" />
```

### Icon Buttons

```tsx
<button aria-label="Delete item">
  <Trash2 aria-hidden="true" />
</button>
```

## Testing Checklist

### Keyboard Testing

- [ ] All interactive elements reachable via Tab
- [ ] Logical tab order
- [ ] Visible focus indicators
- [ ] No keyboard traps (except intentional in modals)
- [ ] Escape closes modals
- [ ] Enter/Space activates buttons

### Screen Reader Testing (NVDA/JAWS/VoiceOver)

- [ ] All images have alt text
- [ ] Form inputs have labels
- [ ] Buttons have descriptive names
- [ ] Headings create logical structure
- [ ] Live regions announce updates
- [ ] Error messages are announced
- [ ] Loading states are announced

### Visual Testing

- [ ] Focus indicators visible
- [ ] Color contrast meets WCAG AA (4.5:1)
- [ ] Text resizable to 200%
- [ ] No information conveyed by color alone

## Common Mistakes to Avoid

1. **Don't use placeholder as label**
   - ❌ `<input placeholder="Email" />`
   - ✅ `<Label>Email</Label><Input />`

2. **Don't hide focus indicators**
   - ❌ `outline: none` without replacement
   - ✅ Use visible focus styles

3. **Don't use div/span as buttons**
   - ❌ `<div onClick={handler}>Click</div>`
   - ✅ `<button onClick={handler}>Click</button>`

4. **Don't forget alt text**
   - ❌ `<img src={url} />`
   - ✅ `<img src={url} alt="Description" />`

5. **Don't use positive tabindex**
   - ❌ `tabindex="1"`
   - ✅ Use natural DOM order or `tabindex="0"`

## Resources

- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [ARIA Authoring Practices](https://www.w3.org/WAI/ARIA/apg/)
- [Radix UI Accessibility](https://www.radix-ui.com/primitives/docs/overview/accessibility)
- [WebAIM Screen Reader Testing](https://webaim.org/articles/screenreader_testing/)

## Maintenance

- Review accessibility on every PR
- Test with keyboard before merging
- Run automated accessibility tests
- Conduct periodic screen reader audits
- Update this document as patterns evolve
