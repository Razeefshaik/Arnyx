# Arnyx design direction

Arnyx is a personal observatory for AI capabilities: find something useful,
understand it, and bring it into your own workflow.

The downloaded Anthropic frontend-design skill informed this implementation.
Selected after reviewing the skills.sh leaderboard and the official source on
2026-10-09. Popularity is evidence of adoption, not proof of universal superiority.

Palette: graphite #141719, basalt #1b2023, chalk #eeebe5, apricot #f0a273,
periwinkle #a79de6, sea glass #81b6ad.

Type: Space Grotesk for headings, Manrope for navigation and reading. Fonts are
self-hosted; system fallbacks remain usable.

Layout: left navigation frames a capability catalog; a quieter right column
keeps the coordinator and source activity available. On small screens the
navigation becomes a compact bar and the coordinator follows the catalog.

The memorable element is an interactive capability constellation. Its moving
signals represent discovery, rather than invented statistics. Cards use
category-specific geometric diagrams, not third-party logos.

Review: a default neon dashboard would make tools hard to compare. This design
uses muted surfaces, a clear reading hierarchy, and accent color for actions.
Borders express containers; numerals appear only in actual walkthrough steps.
Motion explains opening, filtering, saving, and crawler progress. Reduced-motion
preferences suppress ambient movement and transition animations.

References:
- https://github.com/anthropics/skills/tree/main/skills/frontend-design
- https://skills.sh/anthropics/skills/frontend-design
- https://motion.dev/docs/react
