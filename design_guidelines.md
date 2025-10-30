# SentinelScope - Cybersecurity Design Guidelines

## Core Design Principles

**Framework:** Material Design 3 adapted for enterprise cybersecurity
- Information clarity over decoration
- Scannable data hierarchies for rapid threat assessment
- Consistent, predictable interactions
- Professional enterprise aesthetic
- Efficient screen real estate usage

---

## Typography

**Fonts:**
- **Primary:** Inter (UI, body, tables)
- **Monospace:** JetBrains Mono (IPs, logs, code)

**Scale:**
- Display Large: `text-5xl font-bold` - Dashboard headers
- Display Medium: `text-4xl font-bold` - Section headers
- Headline: `text-3xl font-semibold` - Panel titles
- Title Large: `text-2xl font-semibold` - Card headers, modals
- Title Medium: `text-xl font-medium` - Subsections
- Body Large: `text-base` - Primary content
- Body Medium: `text-sm` - Secondary content
- Body Small: `text-xs` - Captions, timestamps
- Label: `text-sm font-medium` - Forms, buttons
- Monospace: `font-mono text-sm` - Technical data

**Line Heights:** Tight (headings), Normal (body), Relaxed (long-form)

---

## Layout & Spacing

**Spacing Units:** 2, 4, 6, 8, 12, 16, 20, 24

**Common Patterns:**
- Component padding: `p-4`, `p-6`
- Section spacing: `py-8`, `py-12`
- Element gaps: `gap-4`, `gap-6`
- Containers: `mx-auto max-w-7xl`

**Grids:**
- Dashboard: 12-column
- Cards: `grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4`

**Breakpoints:** Mobile <768px, Tablet 768-1024px, Desktop 1024px+, Wide 1536px+

---

## Components

### Navigation

**Top Bar:**
- `h-16` fixed, logo left (`w-40`), primary nav center, user menu/notifications/theme right
- Search integrated, divider at bottom

**Sidebar:**
- `w-64` desktop, `w-16` icon-only tablet, collapsible
- Grouped items, 4px active indicator (left edge), `p-4` items
- User info and plan badge at bottom

### Dashboard Elements

**Stat Cards:**
- `grid-cols-1 md:grid-cols-2 lg:grid-cols-4`, `rounded-lg border p-6`
- Structure: Icon (size-8), Value (text-3xl font-bold), Label (text-sm), Change indicator
- `min-h-[140px]`

**Threat Feed:**
- `max-h-[500px] overflow-y-auto`, `p-4 border-b` items
- Severity indicator (w-1), icon, title (font-medium), timestamp (text-xs), action button
- Grouped by time

**Threat Map:**
- `rounded-lg border`, header with live indicator (pulsing dot)
- `aspect-video` or `min-h-[400px]`
- Controls top-right, legend bottom-left

**Alert Timeline:**
- Horizontal (desktop) / vertical (mobile), `gap-8`
- Nodes with icons, time, description, severity badge
- Expandable on click

### Data Tables

**Threat Log:**
- Sticky header, alternating row backgrounds, `h-12` rows
- Columns: Timestamp (w-40 mono), Severity (w-24 badge), Type (w-48), Source IP (mono), Target, Status (w-32), Actions (w-24)
- Sortable headers, pagination centered

**Report Table:**
- Dense (`text-sm`), expandable rows, column customization
- Export buttons (CSV/PDF/JSON), search/filter bar (`h-12`)

### Forms

**Layout:**
- `max-w-2xl`, label-above with `mb-2`, `space-y-6` groups

**Inputs:**
- `h-12 px-4 rounded-md` with 1px border
- Focus: 2px outline with offset
- Error: Red border + `text-sm` message
- Helper: `text-xs` below

**Buttons:**
- Primary: `px-6 py-3 rounded-md font-medium`
- Secondary: `px-6 py-3 rounded-md border`
- Small: `px-4 py-2 text-sm`
- Icon-only: `w-10 h-10 rounded-md`

**Subscription Selector:**
- `grid-cols-1 md:grid-cols-3 gap-6`, `p-6 rounded-lg`
- Featured: `border-2` + "Most Popular" badge
- Equal heights: `min-h-[520px]`

### Modals & Overlays

**Modal:**
- `max-w-lg` centered, `p-6`, backdrop with `backdrop-blur-sm`
- Content: `max-h-[60vh] overflow-y-auto`
- Footer: `flex justify-end gap-4`

**Toast:**
- Fixed top-right, `gap-4` stacked, `p-4 rounded-lg min-w-[320px]`
- Structure: Icon, message, close button
- Auto-dismiss with progress bar

**Dropdown:**
- `min-w-[200px] rounded-md`, `px-4 py-2` items
- `max-h-80 overflow-y-auto` for long lists

### Charts

**Time-Series:**
- `aspect-[16/9]` or `min-h-[300px]`
- Grid lines, interactive tooltips, legend top-right/bottom
- Time selector: 1H, 24H, 7D, 30D buttons

**Pie Chart:**
- `max-w-md` centered, percentage labels, clickable filters

**Heatmap:**
- 24×7 grid, `aspect-square rounded` cells, intensity-based, hover tooltips

### Authentication

**Login/Register:**
- `max-w-md mx-auto` card, logo with `mb-8`
- `space-y-6` form, full-width social buttons
- "OR" divider, links right/center aligned
- 2FA: 6-digit with `gap-2`

**Empty States:**
- `py-12` centered, icon (size-20), heading (text-2xl), description
- `max-w-md` primary action

---

## Images & Visuals

**Dashboard:** No hero images - data-first interface
**Auth Pages:** Optional subtle background pattern (low opacity)
**Empty States:** Icon-based (shield/checkmark, document/magnifying glass, radar)
**Threat Map:** Interactive dark map (Leaflet/Mapbox) with animated markers and attack vectors

---

## Responsive Strategy

**Mobile (<768px):**
- Sidebar → bottom nav/hamburger
- `grid-cols-1` cards
- Tables: horizontal scroll or condensed view
- Full-screen modals

**Tablet (768-1024px):**
- 2-column layouts
- Toggleable sidebar with overlay
- 4-5 critical table columns

**Desktop (1024px+):**
- Multi-column layouts
- Persistent sidebar
- Full tables, larger charts

---

## Accessibility

**Keyboard:**
- All elements focusable with 2px offset outline
- Logical tab order
- ESC closes modals/dropdowns
- Arrow keys navigate lists/tables

**Screen Readers:**
- ARIA labels on icon buttons
- Live regions for real-time alerts
- Associated table headers/form labels

**Visual:**
- 44×44px minimum touch targets (mobile)
- WCAG AA contrast ratios
- No color-only information
- Text alternatives for icons

---

## Animation

**Use Only for Functional Feedback:**
- Loading: Subtle rotation
- Toasts: Slide-in 200ms
- Modals: Fade + scale 150ms
- Dropdowns: Fade + translate-y 100ms
- Live indicators: 2s pulse

**Avoid:** Decorative animations, scroll effects, hover animations on tables (except subtle bg), auto-play, page transitions

---

## Theme Implementation

- Same structure/spacing/typography across themes
- Toggle in top nav (moon/sun icon)
- Persist in localStorage
- Theme classes apply visual treatment only