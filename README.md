# Moonshine Capital — Agent Onboarding Experience

A premium agent onboarding portal built with **React 19**, **TypeScript**, **Vite 6**, **Tailwind CSS v4**, and **Motion**.

## Architecture & Planning Documentation

All strategy, pricing, OAuth, workflow, and site-expansion guides are organized in order inside [`/docs`](./docs/README.md) (and can also be browsed directly inside the app via the **Blueprint Docs** link in the footer):

1. [01 — Authentication Strategy, Tech Stack & Design Styles](./docs/01-architecture-auth-and-design-styles.md)
2. [02 — Firebase Costs, Pass-Through Details & Auth Alternatives](./docs/02-firebase-costs-and-auth-alternatives.md)
3. [03 — Self-Serve OAuth 2.0 Setup Guide & Provider Catalog](./docs/03-self-serve-oauth-guide-and-providers.md)
4. [04 — Automated Onboarding Workflows & Selected Stack](./docs/04-automated-onboarding-workflows.md)
5. [05 — Complete Blueprint of Additional Pages & Supporting Files](./docs/05-site-pages-and-files-blueprint.md)
6. [06 — Searching & Surfacing Available Site Assets](./docs/06-asset-search-and-discovery.md)

See also [`config/integrations.yaml`](./config/integrations.yaml) for the declarative catalog of planned integrations across Phases 1–3.

## Run Locally

**Prerequisites:** Node.js

1. Install dependencies:
   ```bash
   npm install
   ```
2. Run the development server:
   ```bash
   npm run dev
   ```
3. Build for production:
   ```bash
   npm run build
   ```
