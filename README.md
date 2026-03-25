# TOConline MCP Server

MCP (Model Context Protocol) server for TOConline API integration with Claude.

## Setup

1. Deploy to Vercel
2. Set environment variables:
   - `TOCONLINE_CLIENT_ID`: Your TOConline OAuth Client ID
   - `TOCONLINE_CLIENT_SECRET`: Your TOConline OAuth Client Secret
3. Add the MCP URL to Claude as a custom connector

## Available Tools

- **get_auth_url**: Get the OAuth2 authorization URL
- **exchange_code**: Exchange authorization code for access token
- **list_customers**: List customers
- **get_customer**: Get customer by ID
- **list_products**: List products and services
- **list_invoices**: List sales invoices
- **list_suppliers**: List suppliers

## OAuth Flow

1. Use `get_auth_url` to get the authorization URL
2. Visit the URL and authorize the application
3. Copy the `code` from the callback URL
4. Use `exchange_code` with the code to authenticate
5. All subsequent tools will use the stored access token
