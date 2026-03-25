
// TOConline MCP Server - Pure Node.js implementation
// No external dependencies required

const TOCONLINE_API_URL = process.env.TOCONLINE_API_URL || 'https://api21.toconline.pt';
const TOCONLINE_OAUTH_URL = process.env.TOCONLINE_OAUTH_URL || 'https://app21.toconline.pt/oauth';
const CLIENT_ID = process.env.TOCONLINE_CLIENT_ID;
const CLIENT_SECRET = process.env.TOCONLINE_CLIENT_SECRET;

// In-memory token store
const tokenStore = {};

// MCP Protocol handler
const tools = {
  'get_auth_url': {
    description: 'Get the OAuth2 authorization URL to authenticate with TOConline',
    inputSchema: {
      type: 'object',
      properties: {
        redirect_uri: { type: 'string', description: 'OAuth callback URL' }
      }
    },
    handler: async (params) => {
      const redirectUri = params.redirect_uri || 'https://oauth.pstmn.io/v1/callback';
      const url = TOCONLINE_OAUTH_URL + '/auth?client_id=' + CLIENT_ID + 
        '&redirect_uri=' + encodeURIComponent(redirectUri) + 
        '&response_type=code&scope=commercial';
      return { content: [{ type: 'text', text: 'Visit this URL to authorize: ' + url }] };
    }
  },
  'exchange_code': {
    description: 'Exchange an OAuth2 authorization code for an access token',
    inputSchema: {
      type: 'object',
      properties: {
        code: { type: 'string', description: 'The authorization code' },
        redirect_uri: { type: 'string' },
        session_id: { type: 'string', description: 'Session identifier' }
      },
      required: ['code']
    },
    handler: async (params) => {
      const redirectUri = params.redirect_uri || 'https://oauth.pstmn.io/v1/callback';
      const sessionId = params.session_id || 'default';
      const credentials = Buffer.from(CLIENT_ID + ':' + CLIENT_SECRET).toString('base64');
      
      const body = new URLSearchParams({
        grant_type: 'authorization_code',
        code: params.code,
        scope: 'commercial',
        redirect_uri: redirectUri
      }).toString();
      
      const response = await fetch(TOCONLINE_OAUTH_URL + '/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json',
          'Authorization': 'Basic ' + credentials
        },
        body: body
      });
      
      if (!response.ok) {
        const err = await response.text();
        throw new Error('Token exchange failed: ' + err);
      }
      
      const tokenData = await response.json();
      tokenStore[sessionId] = tokenData;
      return { content: [{ type: 'text', text: 'Authentication successful! Session: ' + sessionId }] };
    }
  },
  'list_customers': {
    description: 'List customers from TOConline',
    inputSchema: {
      type: 'object',
      properties: {
        session_id: { type: 'string' },
        page: { type: 'number' },
        per_page: { type: 'number' }
      }
    },
    handler: async (params) => {
      const token = tokenStore[params.session_id || 'default'];
      if (!token) throw new Error('Not authenticated. Use exchange_code first.');
      const page = params.page || 1;
      const perPage = params.per_page || 20;
      const response = await fetch(TOCONLINE_API_URL + '/customers?page=' + page + '&per_page=' + perPage, {
        headers: { 'Authorization': 'Bearer ' + token.access_token, 'Accept': 'application/json' }
      });
      if (!response.ok) throw new Error('API Error: ' + response.status);
      const data = await response.json();
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    }
  },
  'list_products': {
    description: 'List products and services from TOConline',
    inputSchema: {
      type: 'object',
      properties: {
        session_id: { type: 'string' },
        page: { type: 'number' },
        per_page: { type: 'number' }
      }
    },
    handler: async (params) => {
      const token = tokenStore[params.session_id || 'default'];
      if (!token) throw new Error('Not authenticated.');
      const response = await fetch(TOCONLINE_API_URL + '/items?page=' + (params.page || 1) + '&per_page=' + (params.per_page || 20), {
        headers: { 'Authorization': 'Bearer ' + token.access_token, 'Accept': 'application/json' }
      });
      if (!response.ok) throw new Error('API Error: ' + response.status);
      const data = await response.json();
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    }
  },
  'list_invoices': {
    description: 'List sales invoices from TOConline',
    inputSchema: {
      type: 'object',
      properties: {
        session_id: { type: 'string' },
        page: { type: 'number' },
        per_page: { type: 'number' }
      }
    },
    handler: async (params) => {
      const token = tokenStore[params.session_id || 'default'];
      if (!token) throw new Error('Not authenticated.');
      const response = await fetch(TOCONLINE_API_URL + '/sales/invoices?page=' + (params.page || 1) + '&per_page=' + (params.per_page || 20), {
        headers: { 'Authorization': 'Bearer ' + token.access_token, 'Accept': 'application/json' }
      });
      if (!response.ok) throw new Error('API Error: ' + response.status);
      const data = await response.json();
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    }
  },
  'list_suppliers': {
    description: 'List suppliers from TOConline',
    inputSchema: {
      type: 'object',
      properties: {
        session_id: { type: 'string' },
        page: { type: 'number' }
      }
    },
    handler: async (params) => {
      const token = tokenStore[params.session_id || 'default'];
      if (!token) throw new Error('Not authenticated.');
      const response = await fetch(TOCONLINE_API_URL + '/suppliers?page=' + (params.page || 1), {
        headers: { 'Authorization': 'Bearer ' + token.access_token, 'Accept': 'application/json' }
      });
      if (!response.ok) throw new Error('API Error: ' + response.status);
      const data = await response.json();
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    }
  }
};

// Handle MCP JSON-RPC requests
async function handleMcpRequest(body) {
  const { jsonrpc, id, method, params } = body;
  
  try {
    if (method === 'initialize') {
      return {
        jsonrpc: '2.0',
        id,
        result: {
          protocolVersion: '2024-11-05',
          capabilities: { tools: {} },
          serverInfo: { name: 'TOConline MCP', version: '1.0.0' }
        }
      };
    }
    
    if (method === 'tools/list') {
      return {
        jsonrpc: '2.0',
        id,
        result: {
          tools: Object.entries(tools).map(([name, tool]) => ({
            name,
            description: tool.description,
            inputSchema: tool.inputSchema
          }))
        }
      };
    }
    
    if (method === 'tools/call') {
      const { name, arguments: args } = params;
      const tool = tools[name];
      if (!tool) {
        return {
          jsonrpc: '2.0',
          id,
          error: { code: -32601, message: 'Tool not found: ' + name }
        };
      }
      const result = await tool.handler(args || {});
      return { jsonrpc: '2.0', id, result };
    }
    
    if (method === 'notifications/initialized') {
      return null; // No response for notifications
    }
    
    return {
      jsonrpc: '2.0',
      id,
      error: { code: -32601, message: 'Method not found: ' + method }
    };
  } catch (error) {
    return {
      jsonrpc: '2.0',
      id,
      error: { code: -32603, message: error.message }
    };
  }
}

module.exports = async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept, Mcp-Session-Id');
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  
  if (req.method === 'GET') {
    // Return server info and check SSE support
    const accept = req.headers['accept'] || '';
    if (accept.includes('text/event-stream')) {
      // SSE not supported in serverless, return 405
      res.status(405).json({ error: 'SSE not supported in serverless mode. Use POST requests.' });
      return;
    }
    res.status(200).json({ 
      name: 'TOConline MCP Server', 
      version: '1.0.0',
      status: 'running',
      tools: Object.keys(tools)
    });
    return;
  }
  
  if (req.method === 'POST') {
    try {
      const body = req.body;
      
      if (Array.isArray(body)) {
        // Batch request
        const responses = await Promise.all(body.map(handleMcpRequest));
        res.status(200).json(responses.filter(Boolean));
        return;
      }
      
      const response = await handleMcpRequest(body);
      
      if (response === null) {
        res.status(202).end();
        return;
      }
      
      // Support SSE response format
      const accept = req.headers['accept'] || '';
      if (accept.includes('text/event-stream')) {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.write('data: ' + JSON.stringify(response) + '\n\n');
        res.end();
        return;
      }
      
      res.status(200).json(response);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
    return;
  }
  
  res.status(405).json({ error: 'Method not allowed' });
};
