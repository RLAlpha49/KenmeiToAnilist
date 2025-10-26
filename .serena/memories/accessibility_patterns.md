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

### Advanced User Sections Pattern

**Purpose**: Hide complex or power-user features by default, make them discoverable but clearly marked.

**Implementation** (`src/components/settings/CustomRulesManager.tsx`):

```tsx
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { ShieldAlert, ChevronDown } from "lucide-react";

export function CustomRulesManager() {
  return (
    <Collapsible defaultOpen={false}>
      <CollapsibleTrigger className="group flex items-center gap-2">
        <ShieldAlert className="h-5 w-5" />
        <span>Advanced: Custom Matching Rules</span>
        <Badge variant="secondary">Advanced</Badge>
        <ChevronDown className="h-4 w-4 transition-transform group-data-[state=open]:rotate-180" />
      </CollapsibleTrigger>

      <CollapsibleContent>
        <Alert className="mb-4 border-amber-200 bg-amber-50">
          <AlertDescription className="text-amber-900">
            ⚠️ <strong>Advanced Feature:</strong> Custom matching rules require knowledge of regular
            expressions. Incorrect patterns can skip desired manga or cause performance issues.
            <a
              href="https://developer.mozilla.org/docs/Web/JavaScript/Guide/Regular_expressions"
              target="_blank"
              rel="noopener noreferrer"
              className="ml-2 text-amber-700 underline"
            >
              Learn regex
            </a>
          </AlertDescription>
        </Alert>

        {/* Rest of component content */}
      </CollapsibleContent>
    </Collapsible>
  );
}
```

**Accessibility Features**:

- **`defaultOpen={false}`** - Hidden by default, no surprise cognitive load
- **Semantic button trigger** - Full keyboard support (Enter/Space to toggle)
- **Visual indicator** - ChevronDown icon rotates to show state
- **Badge label** - "Advanced" clearly marks feature tier
- **Icon** - ShieldAlert conveys safety/caution without text
- **Warning Alert** - `<Alert>` with role="alert" announces importance
- **External link** - Opens in new tab with `rel="noopener noreferrer"` for security
- **ARIA-compliant** - Radix UI Collapsible handles all ARIA attributes

**Best Practices**:

1. **Always mark as Advanced** - Use badge and warning alert
2. **Default to hidden** - Use `defaultOpen={false}`
3. **Explain why** - Include warning message with context
4. **Provide documentation link** - External resource for learning
5. **Keyboard accessible** - Full navigation without mouse
6. **Icon + text** - Don't rely on icon alone
7. **Clear hierarchy** - Advanced features below main features

### Metadata Field Selector Pattern

**Purpose**: Allow users to select which data fields should be checked against a pattern.

**Implementation** (`src/components/settings/MetadataFieldSelector.tsx`):

```tsx
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

interface MetadataFieldSelectorProps {
  selectedFields: CustomRuleTarget[];
  onFieldsChange: (fields: CustomRuleTarget[]) => void;
  disabled?: boolean;
}

export const MetadataFieldSelector = memo(function MetadataFieldSelector({
  selectedFields,
  onFieldsChange,
  disabled = false,
}: MetadataFieldSelectorProps) {
  // Field definitions with labels, descriptions, and categories
  const METADATA_FIELDS = {
    titles: { label: "Titles", category: "Text Fields", description: "All title variants" },
    author: {
      label: "Author/Staff",
      category: "Text Fields",
      description: "Author names and credits",
    },
    // ... more fields
  };

  return (
    <fieldset disabled={disabled}>
      <legend className="mb-3 font-semibold">Target Metadata Fields</legend>

      <div className="mb-4 grid grid-cols-2 gap-4">
        {/* Grouped by category */}
        {categories.map((category) => (
          <div key={category}>
            <div className="mb-2 text-sm font-medium text-gray-600">{category}</div>
            {fields.map((field) => (
              <div key={field} className="mb-2 flex items-center space-x-2">
                <Checkbox
                  id={field}
                  checked={selectedFields.includes(field)}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      onFieldsChange([...selectedFields, field]);
                    } else {
                      onFieldsChange(selectedFields.filter((f) => f !== field));
                    }
                  }}
                  aria-describedby={`${field}-description`}
                />
                <Label htmlFor={field} className="cursor-pointer font-normal">
                  {METADATA_FIELDS[field].label}
                </Label>
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Validation feedback */}
      {selectedFields.length === 0 && (
        <div role="alert" aria-live="assertive" className="mb-3 text-sm text-red-600">
          Please select at least one field
        </div>
      )}

      {/* Bulk actions */}
      <div className="flex gap-2">
        <Button onClick={selectAll} variant="outline" size="sm">
          Select All
        </Button>
        <Button onClick={clearAll} variant="outline" size="sm">
          Clear All
        </Button>
        <Button onClick={resetDefault} variant="outline" size="sm">
          Reset to Default
        </Button>
      </div>

      {/* Field count badge */}
      <Badge className="mt-3">{selectedFields.length} field(s) selected</Badge>
    </fieldset>
  );
});
```

**Accessibility Features**:

- **`<fieldset>` + `<legend>`** - Semantic grouping of related checkboxes
- **`htmlFor` on labels** - Click target area enlarged, screen reader linked
- **`aria-describedby`** - Tooltips/descriptions linked to form controls
- **`role="alert"`** - Validation errors announced immediately
- **`aria-live="assertive"`** - Error messages interrupt other screen reader output
- **Semantic grouping** - Related fields organized by category
- **Bulk actions** - Clear, Restore, Select All for power users
- **Visual feedback** - Badge shows count of selected fields
- **Grid layout** - 2-column responsive layout

**Best Practices**:

1. **Group by category** - Organize fields logically (Text Fields, Metadata, Content Info)
2. **Require minimum** - Force at least one field selected
3. **Provide bulk actions** - Select All, Clear All, Reset to Default
4. **Show feedback** - Badge with count, error message if none selected
5. **Use fieldset/legend** - Semantic HTML for field groups
6. **Descriptive labels** - Include category and field purpose

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

6. **Don't hide advanced features without warning**
   - ❌ Collapsible without "Advanced" designation
   - ✅ Clear badge, warning alert, documentation links

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
