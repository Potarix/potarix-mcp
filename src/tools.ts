import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { asJsonText, postPotarix } from "./potarix-api.js";

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
}
