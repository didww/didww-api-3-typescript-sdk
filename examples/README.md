# Examples

All examples read the API key from the `DIDWW_API_KEY` environment variable.

## Prerequisites

- Node.js 18+
- DIDWW API key for sandbox account

## Environment variables

- `DIDWW_API_KEY` (required): your DIDWW API key

## Install

```bash
npm install
```

## Run an example

```bash
DIDWW_API_KEY=your_api_key npx tsx examples/balance.ts
```

## Available examples

| Script | Description |
|---|---|
| [`balance.ts`](balance.ts) | Fetches and prints current account balance and credit. |
| [`countries.ts`](countries.ts) | Lists countries and fetches one country by ID. |
| [`did-groups.ts`](did-groups.ts) | Fetches DID groups with included relationships. |
| [`trunks.ts`](trunks.ts) | Creates a PSTN trunk, lists all trunks, updates and deletes. |
| [`orders-sku.ts`](orders-sku.ts) | Creates a DID order by SKU resolved from DID groups. |
| [`upload-file.ts`](upload-file.ts) | Encrypts sample data and uploads to `encrypted_files`. |
| [`identity-address-proofs.ts`](identity-address-proofs.ts) | Creates identity and address, then cleans up. |

## Upload file example

```bash
DIDWW_API_KEY=your_api_key npx tsx examples/upload-file.ts
```

## Troubleshooting

If `DIDWW_API_KEY` is missing, examples fail fast with:

`apiKey is required`
