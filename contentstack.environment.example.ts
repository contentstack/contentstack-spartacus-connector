/**
 * EXAMPLE delivery-credentials file — the Angular equivalent of a `.env.example`.
 *
 * The connector reads its stack credentials from an environment file, not a
 * dotenv file. Copy this to your Spartacus app's
 *   src/environments/contentstack.environment.ts
 * and fill in your stack's values, then import `contentstackDelivery` into your
 * ContentstackConfig (see GETTING_STARTED.md, Step 4).
 *
 * You usually don't create this by hand: `ng add
 * @contentstack/contentstack-spartacus-connector` generates it for you (with
 * these same placeholders when you don't pass credentials). Use this template
 * only if you wire the connector manually.
 *
 * SECRETS
 * - `apiKey` + `deliveryToken` are READ-ONLY, environment-scoped delivery
 *   credentials — safe to ship in the client bundle.
 * - `previewToken` (Live Preview / Visual Builder only) grants read access to
 *   UNPUBLISHED drafts. Treat it as a secret: keep it out of committed source
 *   and out of production builds. The connector ignores Live Preview in prod.
 * - Never put a management token or SAP Commerce credentials in this file.
 *
 * Keep the real `contentstack.environment.ts` out of version control if it holds
 * a previewToken (e.g. commit this `.example.ts` and gitignore the real file, or
 * swap it per build via Angular `fileReplacements`).
 */
import { Region } from '@contentstack/delivery-sdk';

export const contentstackDelivery = {
  apiKey: '<STACK_API_KEY>', //     Settings → Stack settings → API Key
  deliveryToken: '<DELIVERY_TOKEN>', // Settings → Tokens → Delivery Tokens (scope to the environment below)
  environment: '<ENVIRONMENT>', //  the publishing environment, e.g. development
  region: Region.US, //             your stack's data center: US | EU | AZURE_NA | AZURE_EU | GCP_NA | ...

  // Live Preview / Visual Builder — NON-PRODUCTION only. Leave false unless you
  // use it; if true, `previewToken` is required and is a SECRET (see above).
  livePreview: false,
  // previewToken: '<PREVIEW_TOKEN>',
};
