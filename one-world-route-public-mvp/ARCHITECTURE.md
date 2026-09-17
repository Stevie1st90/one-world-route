# Architecture

## MVP

The public release is intentionally static:

- `index.html` — application shell
- `styles.css` — glassmorphism design system and responsive layout
- `app.js` — state, globe interaction, filters, search, timeline, playback and URL state
- `data/public-route.json` — sanitized operational route data
- `data/country-centroids.json` — local country coordinates/metadata
- Globe.GL is loaded from jsDelivr at runtime

There is no database, authentication layer or server-side API.

## State model

The application maintains:

- selected segment / selected country
- Explore vs Operations mode
- active visualization layer
- active route phase
- transport/tier/feasibility/alert filters
- timeline playback position and speed
- globe visualization preferences

The important shareable state is persisted in the URL query string.

## Production migration

When the project needs SEO landing pages, automated data publishing, an admin workflow or server-side caching, migrate the same public JSON schema into Next.js. Keep the public/private export boundary unchanged.
