# HTML Labels and Form Accessibility Audit

## Overview
This document catalogs all native HTML labels, form labeling patterns, and accessibility attributes used throughout the Database Palace application.

## 1. Native `<label>` Tags

### File: `src/components/connection-form.tsx`

| Line | Code Snippet | CSS Classes | Labeling Pattern | Accessibility Issue |
|------|--------------|-------------|-------------------|---------------------|
| 215 | `<label className="text-sm font-medium mb-2 block">Connection Name</label>` | `text-sm font-medium mb-2 block` | Standalone label | ❌ Missing `htmlFor` |
| 228 | `<label className="text-sm font-medium mb-2 block">Database Type</label>` | `text-sm font-medium mb-2 block` | Standalone label | ❌ Missing `htmlFor` |
| 242 | `<label className="text-sm font-medium mb-2 block">Database Path</label>` | `text-sm font-medium mb-2 block` | Standalone label | ❌ Missing `htmlFor` |
| 256-258 | `<label className="text-sm font-medium mb-2 block">Connection String</label>` | `text-sm font-medium mb-2 block` | Standalone label | ❌ Missing `htmlFor` |

**CSS Class Pattern Used:** `text-sm font-medium mb-2 block`

## 2. `htmlFor` Attributes

**Status:** ❌ **No instances found**

All form labels lack proper `htmlFor` attributes to associate them with their corresponding form controls.

## 3. `aria-label` Attributes

### File: `src/components/logo.tsx`

| Line | Code Snippet | Element | Purpose |
|------|--------------|---------|---------|
| 19 | `aria-label="Dora Logo"` | SVG with `role="img"` | Logo accessibility |

## 4. Placeholder Text (Serving as Labels)

### File: `src/components/connection-form.tsx`

| Line | Code Snippet | Form Element | Purpose |
|------|--------------|--------------|---------|
| 219 | `placeholder="My Database"` | Connection Name input | Example value |
| 231 | `<SelectValue placeholder="Select database type" />` | Database Type select | Instructional text |
| 247 | `placeholder="/path/to/database.db"` | Database Path input | Example file path |
| 263 | `placeholder="postgresql://user:password@localhost:5432/database"` | Connection String input | Example format |

## 5. Title Attributes (Tooltips)

### File: `src/components/connections-complete.tsx`
- Line 58: `title="Add"` - Add button
- Line 66: `title="Edit"` - Edit button  
- Line 74: `title="Disconnect"` - Disconnect button

### File: `src/components/script-tabs.tsx`
- Line 108: `title="Close tab"` - Close button
- Line 127: `title="New Tab"` - New tab button

### File: `src/components/app-sidebar-complete.tsx`
- Line 81: `title="Expand sidebar"` - Expand button
- Line 90: `title="Add Connection"` - Add connection button
- Line 101: `title="Connections"` - Connections tab
- Line 109: `title="Database Items"` - Database items tab
- Line 117: `title="Scripts"` - Scripts tab
- Line 125: `title="Query History"` - Query history tab
- Line 144: `title="Collapse sidebar"` - Collapse button
- Line 162: `title="Connections"` - Connections item (collapsed)
- Line 173: `title="Items"` - Items item (collapsed)
- Line 184: `title="Scripts"` - Scripts item (collapsed)
- Line 195: `title="History"` - History item (collapsed)

### File: `src/components/database-schema-items.tsx`
- Line 97: `title="Browse table data"` - Table browse button

### File: `src/components/table.tsx`
- Line 48: `title={CellFormatter.formatCellTitle(cell)}` - Dynamic cell tooltips

### File: `src/components/ui/toast.tsx`
- Line 147: `title={toast.title}` - Toast title tooltip

## 6. Screen Reader Only Text (`sr-only`)

### File: `src/components/editor-toolbar.tsx`
- Line 133: `<span className="sr-only">Format code</span>` - Format button
- Line 206: `<span className="sr-only">More format options</span>` - Dropdown button

### File: `src/components/ui/simple-toast.tsx`
- Line 82: `<span className="sr-only">Close</span>` - Close button

### File: `src/components/ui/toast.tsx`
- Line 56: `<span className="sr-only">Close</span>` - Close button

## 7. ARIA Roles and Attributes

### File: `src/components/ui/autocomplete-input.tsx`

| Attribute | Value | Purpose |
|-----------|-------|---------|
| `role="combobox"` | Input | Autocomplete combobox |
| `aria-expanded={isOpen}` | Input | Dropdown state |
| `aria-haspopup="listbox"` | Input | Popup indicator |
| `aria-controls="autocomplete-listbox"` | Input | Controls relationship |
| `aria-autocomplete="both"` | Input | Autocomplete behavior |
| `role="listbox"` | Suggestions list | List container |
| `role="option"` | List items | Option items |
| `aria-selected={index === selectedIndex}` | List items | Selection state |

### File: `src/components/logo.tsx`
- Line 18: `role="img"` - Logo as image

## 8. ID Attributes

### File: `src/components/ui/autocomplete-input.tsx`
- Line 238: `id="autocomplete-listbox"` - Listbox target for aria-controls

### File: `src/app/page.tsx`
- Line 441: `id="app"` - Main application container

## Summary Statistics

| Label Type | Count | Files |
|------------|-------|-------|
| Native `<label>` tags | 4 | 1 |
| `htmlFor` attributes | 0 | 0 |
| `aria-label` attributes | 1 | 1 |
| Placeholder attributes | 4 | 1 |
| Title attributes | 19 | 5 |
| `sr-only` elements | 3 | 3 |
| ARIA roles | 3 | 2 |
| ID attributes | 2 | 2 |

## CSS Classes Used for Labels

| Class | Usage | File |
|-------|-------|------|
| `text-sm font-medium mb-2 block` | All native labels | `connection-form.tsx` |
| `sr-only` | Screen reader text | Multiple files |

## Accessibility Issues Identified

### Critical Issues
1. **Missing `htmlFor` associations**: All 4 native labels lack `htmlFor` attributes
2. **No form input IDs**: Form inputs don't have corresponding `id` attributes
3. **No `aria-describedby`**: Error messages and help text aren't associated with form fields

### Recommendations
1. Add `id` attributes to all form inputs
2. Add corresponding `htmlFor` attributes to labels
3. Implement `aria-describedby` for validation messages
4. Consider `aria-invalid` for form validation states
5. Add fieldset/legend for form grouping where appropriate

## Positive Accessibility Practices
1. ✅ Comprehensive ARIA attributes in autocomplete component
2. ✅ Consistent use of title attributes for tooltips
3. ✅ Proper use of `sr-only` for screen reader text
4. ✅ Semantic use of ARIA roles
5. ✅ Logo has proper `aria-label` and `role="img"`