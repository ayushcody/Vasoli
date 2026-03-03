# Vasoli Neo-Brutal Paper UI Design System

## ✅ Implementation Complete

### Phase 1: Design Tokens ✓
**Files Modified:**
- `src/app/globals.css` - Added Paper UI color palette, fonts, and brutal utilities
- `tailwind.config.ts` - Extended with neo-brutal tokens

**Tokens Added:**
```css
/* Colors */
--paper-1: #FEEED5 (main background)
--paper-2: #E9DAC5 (surfaces/cards)
--ink: #1A1A1A (text/borders)
--taupe: #A2897D (muted text)
--mustard: #F6DD4D (header band/accents)
--cta: #FD712C (primary actions)
--teal: #2EC4B6 (success)
--danger: #E63946 (errors)

/* Borders */
--border-width: 1.5px
--border-width-thick: 2px

/* Shadows */
--shadow-brutal: 4px 4px 0 var(--ink)
--shadow-brutal-sm: 2px 2px 0 var(--ink)
```

**Fonts:**
- Body: Inter (sans-serif)
- Headings: Fraunces (serif)

### Phase 2: Neo-Brutal Components ✓
**New Components Created:**

1. **NeoButton** (`src/components/ui/neo-button.tsx`)
   - Variants: primary, secondary, ghost, danger, mustard
   - Sizes: sm, md, lg, icon
   - Features: brutal borders, shadow on hover, active state translation

2. **Panel** (`src/components/ui/panel.tsx`)
   - Variants: default (paper-2), mustard, bordered
   - Sub-components: PanelHeader, PanelTitle, PanelDescription, PanelContent
   - Features: brutal borders, dividers, rounded corners

3. **NeoInput** (`src/components/ui/neo-input.tsx`)
   - Features: brutal border, paper-2 background, focus ring

4. **NeoBadge** (`src/components/ui/neo-badge.tsx`)
   - Variants: default, success, warning, danger, teal, mustard
   - Features: uppercase text, brutal border, compact size

5. **NeoProgress** (`src/components/ui/neo-progress.tsx`)
   - Variants: default, success, warning, danger
   - Features: brutal border, tabular numbers, smooth animation

6. **StatCard** (`src/components/ui/stat-card.tsx`)
   - Variants: default, income, expense, balance
   - Features: icon box, brutal border, hover shadow

### Phase 3: Layout Updates ✓
**Sidebar** (`src/components/sidebar.tsx`)
- Fixed width: 256px (w-64)
- Paper-2 background
- Thick right border
- Logo in mustard box
- Nav items with brutal borders
- Active state: mustard background + shadow
- Hover: shadow + slight translate

**Layout Structure:**
```
┌─────────────────────────────────────────┐
│ Sidebar (256px)  │ Main Content         │
│ - Logo           │ - Header Band (80px) │
│ - Navigation     │ - Content Grid       │
│ - Sign Out       │                      │
└─────────────────────────────────────────┘
```

### Phase 4: Dashboard Transformation ✓
**Dashboard** (`src/app/dashboard/page.tsx`)

**Header Band:**
- Height: 80px (h-20)
- Background: mustard
- Thick bottom border
- Contains: Page title + Health Score widget

**Stats Grid:**
- 4 columns
- StatCard components
- Variants: income (green), expense (red), balance (mustard)

**Main Grid:**
- 3 columns
- Left 2 cols: Goals panel
- Right 1 col: Upcoming + Reminders + Tip

**Key Features:**
- All panels use brutal borders
- Dividers between list items
- Badges for transaction types
- Progress bars with brutal styling
- Empty states with centered icons

## Design Principles Applied

### 1. Heavy Outlines ✓
- All components: `border-brutal` (1.5px)
- Thick borders: `border-brutal-thick` (2px)
- Dividers: `border-ink/30`

### 2. Soft Brutalism ✓
- Rectangular shapes with small radius (8-16px)
- Warm palette (paper tones)
- Generous padding (p-6, p-8)
- Brutal shadows only on hover/active

### 3. Editorial Grid ✓
- Fixed sidebar (256px)
- Header band (80px)
- 12-column grid system
- Consistent spacing (gap-6)

### 4. Flat Color Blocking ✓
- Mustard header band (1 per page)
- No gradients (removed all)
- No glassmorphism
- Hierarchy via borders + color blocks

### 5. Paper Material ✓
- Background: paper-1 (#FEEED5)
- Surfaces: paper-2 (#E9DAC5)
- Muted overall contrast
- Accents pop against paper

### 6. Icon-Forward ✓
- Lucide React icons throughout
- Consistent 16-20px sizing
- Icon boxes with brutal borders
- Utility signage aesthetic

## Tailwind Utilities Added

```css
/* Borders */
.border-brutal { border: 1.5px solid var(--ink); }
.border-brutal-thick { border: 2px solid var(--ink); }
.divider-brutal { border-top: 1.5px solid var(--ink); opacity: 0.3; }

/* Shadows */
.shadow-brutal { box-shadow: 4px 4px 0 var(--ink); }
.shadow-brutal-sm { box-shadow: 2px 2px 0 var(--ink); }
.shadow-brutal-hover { box-shadow: 6px 6px 0 var(--ink); }

/* Radius */
.rounded-neo { border-radius: 8px; }
.rounded-neo-md { border-radius: 12px; }
.rounded-neo-lg { border-radius: 16px; }

/* Colors */
.bg-paper-1, .bg-paper-2, .bg-mustard, .bg-cta, etc.
.text-ink, .text-taupe, etc.
.border-ink, .border-mustard, etc.
```

## Component Usage Examples

### Button
```tsx
<NeoButton variant="primary" size="md">
  Save Changes
</NeoButton>

<NeoButton variant="secondary" size="sm">
  Cancel
</NeoButton>

<NeoButton variant="ghost">
  View All <ArrowRight className="h-4 w-4 ml-1" />
</NeoButton>
```

### Panel
```tsx
<Panel variant="default">
  <PanelHeader>
    <PanelTitle>Your Goals</PanelTitle>
    <PanelDescription>Track your progress</PanelDescription>
  </PanelHeader>
  <PanelContent>
    {/* Content */}
  </PanelContent>
</Panel>
```

### StatCard
```tsx
<StatCard
  title="Total Income"
  value={formatCurrency(1234.56)}
  subtitle="This month"
  icon={ArrowUpRight}
  variant="income"
/>
```

### Progress
```tsx
<NeoProgress 
  value={75} 
  max={100}
  variant="success"
  showLabel
/>
```

### Badge
```tsx
<NeoBadge variant="success">Active</NeoBadge>
<NeoBadge variant="warning">Pending</NeoBadge>
<NeoBadge variant="danger">Overdue</NeoBadge>
```

## Next Steps (To Complete Full Transformation)

### Phase 5: Remaining Pages
1. **Transactions Page**
   - Table with brutal borders
   - Row dividers (not zebra stripes)
   - Hover: shadow + slight darken
   - Add transaction modal with brutal styling

2. **Budgets Page**
   - Budget cards in grid
   - Progress bars with brutal styling
   - Alert badges

3. **Goals Page**
   - Goal cards with progress
   - Contribution history list
   - Add goal modal

4. **Auth Pages**
   - Signin/Signup with brutal inputs
   - Centered card layout
   - Mustard accent elements

### Phase 6: Modals & Forms
- Modal overlay: paper-1 with opacity
- Modal content: brutal border + shadow
- Form inputs: NeoInput throughout
- Form buttons: NeoButton variants

### Phase 7: Polish
- Loading states: brutal skeleton boxes
- Error states: danger badge + message
- Empty states: centered icon + message
- Toast notifications: brutal borders

## File Structure

```
src/
├── app/
│   ├── globals.css (✓ Updated)
│   └── dashboard/
│       └── page.tsx (✓ Transformed)
├── components/
│   ├── sidebar.tsx (✓ Updated)
│   └── ui/
│       ├── neo-button.tsx (✓ New)
│       ├── panel.tsx (✓ New)
│       ├── neo-input.tsx (✓ New)
│       ├── neo-badge.tsx (✓ New)
│       ├── neo-progress.tsx (✓ New)
│       └── stat-card.tsx (✓ New)
└── tailwind.config.ts (✓ Updated)
```

## Testing Checklist

- [x] Design tokens applied
- [x] Fonts loaded (Inter + Fraunces)
- [x] Sidebar styled
- [x] Dashboard transformed
- [x] Components created
- [ ] Transactions page
- [ ] Budgets page
- [ ] Goals page
- [ ] Auth pages
- [ ] Modals
- [ ] Forms
- [ ] Mobile responsive

## Color Usage Guide

**Primary Actions:** cta (#FD712C)
**Header Bands:** mustard (#F6DD4D)
**Success/Income:** teal (#2EC4B6)
**Danger/Expense:** danger (#E63946)
**Backgrounds:** paper-1 (#FEEED5)
**Surfaces:** paper-2 (#E9DAC5)
**Text:** ink (#1A1A1A)
**Muted Text:** taupe (#A2897D)

## Typography Scale

**Headings (Fraunces):**
- H1: text-3xl font-bold (Dashboard title)
- H2: text-2xl font-bold (Panel titles)
- H3: text-lg font-bold (Section titles)

**Body (Inter):**
- Base: text-base (16px)
- Small: text-sm (14px)
- Tiny: text-xs (12px)
- Labels: text-xs uppercase tracking-wide

**Numbers:**
- Always use: tabular-nums class
- Amounts: font-bold font-serif

## Spacing Rhythm

- Component padding: p-6 (24px)
- Page padding: p-8 (32px)
- Grid gaps: gap-6 (24px)
- Stack spacing: space-y-6 (24px)
- Tight spacing: space-y-3 (12px)

---

**Status:** Phase 1-4 Complete ✓
**Next:** Apply to Transactions, Budgets, Goals pages
**Estimated Time:** 2-3 hours for remaining pages
