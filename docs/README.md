# Moonshine Capital — Platform Strategy & Architecture Docs

This directory contains the ordered architecture, authentication, integration, workflow, and site-expansion blueprints for the **Moonshine Capital Agent Onboarding Experience**.

## Document Index (In Order)

1. **[01 — Authentication Strategy, Tech Stack & Design Styles](./01-architecture-auth-and-design-styles.md)**
   - Adding Member Login, Universal Signed-Out Landing Page, and OAuth Sign-In
   - Current Platform Assessment (React + Vite vs. Static HTML vs. Next.js)
   - Three Additional Luxury Design Style Variations
2. **[02 — Firebase Costs, Pass-Through Details & Auth Alternatives](./02-firebase-costs-and-auth-alternatives.md)**
   - Firebase Authentication + Cloud Firestore Pricing & Free Tier Quotas
   - Pass-Through Expenses, Gemini API Key Clarification & Key Caveats
   - Complete List of Alternatives to Firebase Authentication
3. **[03 — Self-Serve OAuth 2.0 Setup Guide & Provider Catalog](./03-self-serve-oauth-guide-and-providers.md)**
   - How to Use "Enable OAuth Manually: Self-Serve Authentication"
   - Exact Callback URLs, Iframe/Popup Rules & Cookie Settings
   - Full Catalog of Self-Serve OAuth 2.0 Providers (Current Modules & Future Workflows)
4. **[04 — Automated Onboarding Workflows & Chosen Stack](./04-automated-onboarding-workflows.md)**
   - High-Impact Cross-Tool Workflows for Your Selected Stack
   - Additional Complementary Tools & Automation Glue
   - 3-Phase Rollout Plan
5. **[05 — Complete Blueprint of Additional Pages & Supporting Files](./05-site-pages-and-files-blueprint.md)**
   - Public, Authenticated Portal, Admin & Legal/OAuth Verification Pages
   - Supporting Files by Extension (`.ts`, `.md`, `.yaml`, `.html`, `.json`, `.rules`, `.sql`)
6. **[06 — Searching & Surfacing Available Site Assets](./06-asset-search-and-discovery.md)**
   - Searching Assets Across Google Drive, Notion, Wix, Canva & Vimeo
   - Federated Admin Asset Picker vs. Unified Master Asset Index
   - Folder & Tag Standardization for Automated Portal Sync
7. **[07 — AI Studio Packaging, Pricing & Unit Economics](./07-ai-studio-packaging-and-pricing.md)**
   - Credit Matrix (Chat, File Creator, Brand Image Generation)
   - Three-Tier Pricing & Top-Up Credit Packs with Margin Analysis
   - Brokerage Pass-Through & Stripe Webhook Wiring Checklist

## Related Files
- [Project README](../README.md)
- [Integrations Configuration](../config/integrations.yaml)
