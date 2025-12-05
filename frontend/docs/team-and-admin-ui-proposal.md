# Team Tab & Admin Settings Revamp (Desktop & Mobile)

This document proposes UX/UI updates to move user management into a dedicated **Team** tab and to refresh Admin Settings so the experience feels consistent across desktop and mobile.

---

## Navigation & Information Architecture

- **Tab order**: Assets → **Team** → Admin Settings → Other tabs (unchanged). Team is visible only to **Managers** and **Admins**; non-eligible roles do not see the tab.
- **Persistent tab bar**: Use the existing top/side tab bar pattern with icon + label for parity across pages.
- **Mobile**: Tabs collapse into a horizontally scrollable bar with a subtle shadow to indicate overflow; the active tab is sticky.

## Team Tab

### Layout (Desktop)
- **Header row** with page title, role chip (Manager/Admin), and primary CTAs: “Invite members” (primary) and “Bulk actions” (ghost button).
- **Filters bar** below header: search by name/email, role filter (All/Viewer/Contributor/Manager/Admin), status filter (Active/Pending/Disabled), and team filter (if applicable).
- **Table** with columns: Name, Email, Role (select), Status (badge), Last active, and actions (more menu: edit, reset MFA, deactivate).
- **Empty state**: Illustration + “Invite your team” button + quick help link.

### Layout (Mobile)
- **Stacked sections**: header → filters in a collapsible sheet → list of cards.
- **Member card**: name, email, role pill, status badge, last active, and kebab menu. Inline “Change role” uses a bottom sheet with role descriptions.

### Interaction Patterns
- **Inline role changes** via dropdown/select that saves on change; show toast confirmation.
- **Invite flow**: modal (desktop) / bottom sheet (mobile) with email(s), role select, optional message; show success state with next steps.
- **Bulk actions**: checkbox selection (desktop table) / multi-select mode (mobile cards); actions: change role, disable, resend invite.
- **Status badges**: neutral for Pending, success for Active, danger for Disabled; tooltips give context.

### Accessibility
- Tab focus order aligns with reading order; ensure role dropdowns are keyboard-accessible.
- Use `aria-live` for success/error toasts and inline validation.

## Admin Settings Revamp

### Design System Alignment
- Reuse **page shell**: title + description, segmented sections with cards, consistent padding (24px desktop / 16px mobile), neutral background.
- **Card pattern**: title, concise help text, actions top-right (Edit/Configure), body with inputs or toggles; footers for destructive actions.
- **Theming**: consistent typography scale and button styles as elsewhere (primary/secondary/ghost/destructive).

### Information Architecture
- Group settings into left-hand **anchor list** (desktop) / sticky top tabs (mobile):
  - General (branding, language, timezone)
  - Security & Access (auth methods, MFA, session duration, password policies)
  - Notifications (email/webhook toggles, digest cadence)
  - Integrations (OAuth apps, API keys, webhooks)
  - Billing (plan, payment method, invoices)
- Each anchor scrolls to a card cluster; highlight the active anchor on scroll.

### Interaction Patterns
- **Inline edit** for single-field settings (e.g., timezone) with Save/Cancel.
- **Guided modals** for complex items (API key creation, OAuth app setup) with progress indicator.
- **Confirmation** for destructive actions (disable SSO, rotate keys) using danger-styled buttons.
- **Review bars**: surface warnings at top if critical configs are missing (e.g., MFA off for admins).

### Mobile Adaptation
- Replace side anchors with top tabs; cards stack vertically with condensed padding.
- Use bottom sheets for multi-step flows (API key details, invite flows) and ensure sticky Save button.

### States & Feedback
- **Empty/disabled states**: show descriptions and primary CTA (e.g., “Enable MFA”).
- **Loading/skeletons** for cards while fetching settings; optimistic updates where safe.
- **Validation**: inline errors under fields; summary alert at top of card when multiple errors occur.

## Visual Language & Components

- **Color**: neutral background, strong contrast for primary buttons; consistent badge colors for status semantics.
- **Iconography**: Team tab uses grouped-people icon; Admin uses settings/gear icon.
- **Spacing**: 8px grid; 24px gutters desktop, 16px mobile.
- **Typography**: use existing heading scale (H1/H2/H3) with 14–16px body text for readability.

## Rollout Considerations

- **Feature flags** for Team tab visibility and Admin Settings revamp.
- **Migration**: redirect old user-management routes to the new Team tab; keep query params/back button behavior.
- **Analytics**: track invites sent, role changes, and admin setting saves to ensure adoption and detect friction.

## Acceptance Criteria (UX)

- Team tab appears after Assets and is visible only to Managers/Admins.
- Desktop: table layout with inline role/status controls; Mobile: cards with bottom-sheet role changes.
- Admin Settings uses consistent card-based layout, shared spacing/typography, and anchor navigation.
- All primary flows have success/error toasts, accessible focus states, and responsive layouts.
