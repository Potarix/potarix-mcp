import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { asJsonText, getPotarix, postPotarix } from "./potarix-api.js";

const PAID_USAGE_NOTE = "Uses Potarix Enricher API credits.";

function jsonContent(value: Awaited<ReturnType<typeof postPotarix>>) {
  return {
    content: [
      {
        type: "text" as const,
        text: asJsonText(value)
      }
    ]
  };
}

export function registerPotarixTools(server: McpServer): void {
  server.registerTool(
    "lookup_company_website",
    {
      title: "Look Up Company Website",
      description: `Find the best website URL for a company name. ${PAID_USAGE_NOTE}`,
      inputSchema: {
        company_name: z.string().min(1).describe("Company name, such as 'Stripe Inc.'."),
        context: z.string().optional().describe("Optional disambiguation hint, such as location or industry.")
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true
      }
    },
    async ({ company_name, context }) =>
      jsonContent(await postPotarix("/find-website", { company_name, context }))
  );

  server.registerTool(
    "find_person_email",
    {
      title: "Find Person Email",
      description: `Find a verified email for a named person at a company or domain. ${PAID_USAGE_NOTE}`,
      inputSchema: {
        first_name: z.string().optional().describe("First name, if known."),
        last_name: z.string().optional().describe("Last name, if known."),
        full_name: z.string().optional().describe("Full name, if first and last are not split."),
        domain: z.string().optional().describe("Company domain, such as 'stripe.com'."),
        company_name: z.string().optional().describe("Company name, used when a domain is not known.")
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true
      }
    },
    async ({ first_name, last_name, full_name, domain, company_name }) =>
      jsonContent(
        await postPotarix("/find-email/person", {
          first_name,
          last_name,
          full_name,
          domain,
          company_name
        })
      )
  );

  server.registerTool(
    "find_decision_maker_email",
    {
      title: "Find Decision Maker Email",
      description: `Find a likely decision maker and verified email for a domain. ${PAID_USAGE_NOTE}`,
      inputSchema: {
        domain: z.string().min(1).describe("Company domain, such as 'stripe.com'."),
        category: z.string().min(1).describe("Decision maker category, such as 'ceo', 'sales', or 'operations'.")
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true
      }
    },
    async ({ domain, category }) =>
      jsonContent(
        await postPotarix("/find-email/decision-maker", {
          domain,
          decision_maker_category: category
        })
      )
  );

  server.registerTool(
    "find_linkedin_email",
    {
      title: "Find LinkedIn Email",
      description: `Find a verified email from a LinkedIn profile URL. ${PAID_USAGE_NOTE}`,
      inputSchema: {
        linkedin_url: z.string().url().describe("LinkedIn profile URL.")
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true
      }
    },
    async ({ linkedin_url }) =>
      jsonContent(await postPotarix("/find-email/linkedin", { linkedin_url }))
  );

  server.registerTool(
    "find_company_emails",
    {
      title: "Find Company Emails",
      description: `Find public company email contacts for a domain. ${PAID_USAGE_NOTE}`,
      inputSchema: {
        domain: z.string().min(1).describe("Company domain, such as 'stripe.com'.")
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true
      }
    },
    async ({ domain }) =>
      jsonContent(await postPotarix("/find-email/company", { domain }))
  );

  server.registerTool(
    "find_all",
    {
      title: "Find All Company Data",
      description:
        `Kitchen-sink: resolve a company's website, find decision-maker emails for the categories you request, and pull the company-wide email roster — all in one call. Pricing is the sum of underlying sub-calls; see /find-all docs. ${PAID_USAGE_NOTE}`,
      inputSchema: {
        company_name: z.string().min(1).describe("Company name, such as 'Stripe Inc.'."),
        context: z.string().optional().describe("Optional disambiguation hint passed through to website resolution."),
        dm_categories: z
          .array(z.string())
          .max(6)
          .optional()
          .describe(
            "Decision-maker role categories (e.g. 'ceo', 'sales', 'operations'). Defaults to ceo + sales + operations. Capped at 6."
          ),
        skip_company_emails: z
          .boolean()
          .optional()
          .describe("Skip the company-wide email scrape to save credits. Defaults to false.")
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true
      }
    },
    async ({ company_name, context, dm_categories, skip_company_emails }) =>
      jsonContent(
        await postPotarix("/find-all", {
          company_name,
          context,
          dm_categories,
          skip_company_emails
        })
      )
  );

  server.registerTool(
    "check_balance",
    {
      title: "Check Potarix Balance",
      description:
        "Show the calling key's profile: email, credits remaining, total purchased, whether a card is on file, and how many active API keys exist. Free — does not consume credits.",
      inputSchema: {},
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false
      }
    },
    async () => jsonContent(await getPotarix("/me"))
  );

  server.registerTool(
    "topup_credits",
    {
      title: "Top Up Potarix Credits",
      description:
        "Buy a credit pack. Charges the saved card off-session if one is on file (returns immediately on success). If no card is saved yet, run `start_checkout` first to capture one.",
      inputSchema: {
        tier_key: z
          .enum(["1k", "5k", "25k"])
          .describe("Credit pack: '1k' ($10), '5k' ($50), or '25k' ($250).")
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true
      }
    },
    async ({ tier_key }) =>
      jsonContent(await postPotarix("/billing/topup", { tier_key }))
  );

  server.registerTool(
    "start_checkout",
    {
      title: "Start Potarix Checkout (one-time card capture)",
      description:
        "Return a Stripe Checkout URL the human clicks once to add a card. After the human completes checkout, future `topup_credits` calls are silent off-session charges. Hand the returned `url` to the user, do not try to follow it yourself.",
      inputSchema: {
        tier_key: z
          .enum(["1k", "5k", "25k"])
          .describe("Credit pack to purchase on first checkout: '1k', '5k', or '25k'.")
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true
      }
    },
    async ({ tier_key }) =>
      jsonContent(await postPotarix("/billing/checkout", { tier_key }))
  );
}
