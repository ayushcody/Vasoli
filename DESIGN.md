# Vasoli visual direction

## Existing product identity

Vasoli's app uses warm paper surfaces, dark ink, a mustard action color, and direct, tactile controls. The colorful Vasoli wordmark is an existing brand asset and remains unchanged. The public site uses the same paper and ink palette, with mustard reserved for emphasis and primary actions.

## Public landing page

The landing page speaks to salaried people in India who want to understand the cash they record, their commitments, everyday spending, and a chosen goal. The visual language is bold, editorial, and practical: the existing wordmark leads a compact public header; an asymmetrical split hero holds an editable example plan; a drawn line connects the import, commitment, and payday steps; and a direct list links to the product's working areas. The calculator is illustrative and says so next to the example; its totals reflect only the fields shown.

Use the existing Inter body font and wordmark, high-contrast ink typography, warm paper, and one mustard accent. Keep the interaction keyboard operable and keep useful content visible when animation is unavailable. GSAP animates one short hero entrance, the calculator's selected amount, and a scroll-linked line through the payday journey. The journey remains naturally scrolling and `prefers-reduced-motion` skips movement.

Product copy must not imply automatic bank connections, payments, guaranteed projections, customer outcomes, endorsements, or regulatory approval. The current pilot uses manual statement imports and user-entered account and commitment details. Primary calls to action go to the existing contact route for pilot access; sign-in is secondary for invited users.

Landing tokens: paper `#fbf6e9`, deeper paper `#efe4cf`, ink `#171719`, muted ink `#5c5146`, action yellow `#f2d13f`. The landing extends the existing product system; the full-color wordmark stays as requested. A fresh review identified the prospective-user CTA and negative example wording; both were corrected. The detector found one layout-property transition, removed in favor of color-only hover feedback. Desktop/mobile, calculator keyboard controls and reduced motion were checked.

## Focused application surfaces

Today keeps the existing paper, ink and tactile controls, and shows the payday position plus up to three corrective actions. Setup and scenarios stay on `/app/cashflow`. On narrow screens, action text stacks above wrapping controls. Empty and configured desktop/mobile captures were inspected after the final production build; review assets use synthetic local test accounts.
