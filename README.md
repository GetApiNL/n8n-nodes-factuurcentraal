# n8n-nodes-factuurcentraal

This is an n8n community node for [Factuur Centraal](https://www.factuurcentraal.nl). It lets your n8n workflows create and manage invoices, clients, quotes, products, receipts and dimensions in your Factuur Centraal account.

This is an unofficial community package, built on the public [Factuur Centraal API](https://www.factuurcentraal.nl/api/v1/openapi.json) (OpenAPI). The API is part of Factuur Centraal Pro.

[n8n](https://n8n.io/) is a [fair-code licensed](https://docs.n8n.io/reference/license/) workflow automation platform.

- [Installation](#installation)
- [Operations](#operations)
- [Credentials](#credentials)
- [Files](#files)
- [Limits and errors](#limits-and-errors)
- [Example workflow](#example-workflow)
- [Compatibility](#compatibility)
- [Resources](#resources)

## Installation

Follow the [community nodes installation guide](https://docs.n8n.io/integrations/community-nodes/installation/) and install the package `n8n-nodes-factuurcentraal`.

## Operations

### Invoice

Create, Get, Get Many, Update, Delete, **Get PDF**, **Mark as Paid** and **Send** (email the invoice with the PDF attached). Creating an invoice can send it right away.

### Client

Create, Get, Get Many, Update and Delete.

### Quote

Create, Get, Get Many, Update and Delete.

### Product

Create, Get, Get Many, Update and Delete.

### Receipt

Create, Get, Get Many, Update and Delete, plus **Add Attachments** (upload files) and **Get Attachment** (download a file).

### Receipt Category

Get Many, Create, Update and Delete.

### Dimension (Pro)

Get Many, Get, Create, Update and Delete dimensions, Add, Update and Delete values, Update Settings (enable or disable dimensions) and Get Report (revenue, costs and result per value).

### Company

Get the company of your credential, Get Many (all companies you have access to, handy to find a company ID) and Update.

Lists return one item per record. With **Return All** the node follows the pages for you.

Login, passkey, logout and device token endpoints of the API are not part of this node: use a personal API token instead.

## Credentials

1. Log in to Factuur Centraal and create a personal token in your account, under **API**.
2. In n8n, create a **Factuur Centraal API** credential and paste the token.
3. Only if your account has more than one company: fill in the **Company ID** of the company you want to work with. Without it the first company is used. Use one credential per company.

Tokens created in the web app do not expire. The credential test reads your user and company (`GET /auth/me`), so it has no side effects.

If your company requires two-step verification and your user has no passkey or authenticator app yet, every request fails with `mfa_setup_required`. Set that up in Factuur Centraal first.

## Files

- **Invoice → Get PDF** puts the PDF in a binary field (default `data`). Attach it to an email or upload it to cloud storage with the next node.
- **Receipt → Add Attachments** uploads the file(s) in the binary field(s) of the input item. Allowed are jpg, png, pdf and heic, up to 10 MB per file.
- **Receipt → Get Attachment** downloads one attachment into a binary field.

## Limits and errors

Factuur Centraal allows 60 requests per minute per user, and less for sending invoices (20 per minute), PDFs (30) and uploads (20). When the limit is reached the node stops with a "Rate limit reached" error. Use n8n's **Retry On Fail** setting, or a **Loop Over Items** with a wait, for large batches.

Validation errors (HTTP 422) show the fields the API rejected. Enable **Continue On Fail** to handle errors per item.

## Example workflow

Invoice a new order and mail it:

1. **Trigger**: a new order in your shop.
2. **Factuur Centraal** → Client → Create (or Get Many with a search to find an existing client).
3. **Factuur Centraal** → Invoice → Create, with the client ID and the order lines.
4. **Factuur Centraal** → Invoice → Send, to email the invoice with the PDF.

## Compatibility

Built for n8n 2.x. Early version: not yet tested against a live account.

## Resources

- [Factuur Centraal](https://www.factuurcentraal.nl)
- [OpenAPI specification](https://www.factuurcentraal.nl/api/v1/openapi.json)
- [n8n community nodes documentation](https://docs.n8n.io/integrations/#community-nodes)

## Version history

See [CHANGELOG.md](CHANGELOG.md).

## License

[MIT](LICENSE)
