import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";

const TOCONLINE_API_URL = "https://api21.toconline.pt";
const TOCONLINE_OAUTH_URL = "https://app21.toconline.pt/oauth";
const CLIENT_ID = process.env.TOCONLINE_CLIENT_ID;
const CLIENT_SECRET = process.env.TOCONLINE_CLIENT_SECRET;

// Token storage (in-memory, per session)
const tokenStore = new Map();

async function getAccessToken(sessionId) {
  return tokenStore.get(sessionId);
}

async function setAccessToken(sessionId, tokenData) {
  tokenStore.set(sessionId, tokenData);
}

async function apiRequest(sessionId, path, method = "GET", body = null) {
  const tokenData = await getAccessToken(sessionId);
  if (!tokenData) throw new Error("Not authenticated. Use authenticate tool first.");
  
  const headers = {
    "Authorization": `Bearer ${tokenData.access_token}`,
    "Content-Type": "application/json",
    "Accept": "application/json"
  };

  const options = { method, headers };
  if (body) options.body = JSON.stringify(body);

  const response = await fetch(`${TOCONLINE_API_URL}${path}`, options);
  if (!response.ok) {
    const err = await response.text();
    throw new Error(`API Error ${response.status}: ${err}`);
  }
  return response.json();
}

const server = new McpServer({
  name: "TOConline MCP",
  version: "1.0.0"
});

// Tool: Get OAuth2 authorization URL
server.tool(
  "get_auth_url",
  "Get the OAuth2 authorization URL to authenticate with TOConline",
  {
    redirect_uri: z.string().optional().describe("OAuth callback URL (default: https://oauth.pstmn.io/v1/callback)")
  },
  async ({ redirect_uri }) => {
    const redirectUri = redirect_uri || "https://oauth.pstmn.io/v1/callback";
    const url = `${TOCONLINE_OAUTH_URL}/auth?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=commercial`;
    return { content: [{ type: "text", text: `Visit this URL to authorize: ${url}` }] };
  }
);

// Tool: Exchange authorization code for access token
server.tool(
  "exchange_code",
  "Exchange an OAuth2 authorization code for an access token",
  {
    code: z.string().describe("The authorization code from the OAuth callback"),
    redirect_uri: z.string().optional().describe("Must match the redirect_uri used in get_auth_url"),
    session_id: z.string().optional().describe("Session identifier to store the token")
  },
  async ({ code, redirect_uri, session_id }) => {
    const redirectUri = redirect_uri || "https://oauth.pstmn.io/v1/callback";
    const sessionId = session_id || "default";
    const credentials = btoa(`${CLIENT_ID}:${CLIENT_SECRET}`);
    
    const response = await fetch(`${TOCONLINE_OAUTH_URL}/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Accept": "application/json",
        "Authorization": `Basic ${credentials}`
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        scope: "commercial",
        redirect_uri: redirectUri
      }).toString()
    });
    
    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Token exchange failed: ${err}`);
    }
    
    const tokenData = await response.json();
    await setAccessToken(sessionId, tokenData);
    return { content: [{ type: "text", text: `Authentication successful! Access token obtained. Session ID: ${sessionId}` }] };
  }
);

// Tool: List customers
server.tool(
  "list_customers",
  "List customers from TOConline",
  {
    session_id: z.string().optional().describe("Session ID from exchange_code"),
    page: z.number().optional().describe("Page number"),
    per_page: z.number().optional().describe("Items per page")
  },
  async ({ session_id, page = 1, per_page = 20 }) => {
    const sessionId = session_id || "default";
    const data = await apiRequest(sessionId, `/customers?page=${page}&per_page=${per_page}`);
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
);

// Tool: Get customer by ID
server.tool(
  "get_customer",
  "Get a specific customer by ID",
  {
    customer_id: z.string().describe("Customer ID"),
    session_id: z.string().optional()
  },
  async ({ customer_id, session_id }) => {
    const sessionId = session_id || "default";
    const data = await apiRequest(sessionId, `/customers/${customer_id}`);
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
);

// Tool: List products/services
server.tool(
  "list_products",
  "List products and services from TOConline",
  {
    session_id: z.string().optional(),
    page: z.number().optional(),
    per_page: z.number().optional()
  },
  async ({ session_id, page = 1, per_page = 20 }) => {
    const sessionId = session_id || "default";
    const data = await apiRequest(sessionId, `/items?page=${page}&per_page=${per_page}`);
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
);

// Tool: List invoices/sales
server.tool(
  "list_invoices",
  "List sales documents (invoices) from TOConline",
  {
    session_id: z.string().optional(),
    page: z.number().optional(),
    per_page: z.number().optional()
  },
  async ({ session_id, page = 1, per_page = 20 }) => {
    const sessionId = session_id || "default";
    const data = await apiRequest(sessionId, `/sales/invoices?page=${page}&per_page=${per_page}`);
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
);

// Tool: List suppliers
server.tool(
  "list_suppliers",
  "List suppliers from TOConline",
  {
    session_id: z.string().optional(),
    page: z.number().optional(),
    per_page: z.number().optional()
  },
  async ({ session_id, page = 1, per_page = 20 }) => {
    const sessionId = session_id || "default";
    const data = await apiRequest(sessionId, `/suppliers?page=${page}&per_page=${per_page}`);
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
);

// Vercel serverless handler
export default async function handler(req, res) {
  if (req.method === "GET") {
    res.status(200).json({ 
      name: "TOConline MCP Server", 
      version: "1.0.0",
      status: "running"
    });
    return;
  }

  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  });

  res.on("close", () => transport.close());
  
  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
}
