# Examples

All examples except `webhook.ts`, which sends no API request, read the API key from the `DIDWW_API_KEY` environment variable.

## Prerequisites

- Node.js 18+
- DIDWW API key for sandbox account

## Environment variables

- `DIDWW_API_KEY` (required): your DIDWW API key
- `XDG_CACHE_HOME` (optional for `prices-download.ts`, Linux and other Unix systems): user cache directory, `~/.cache` if not set
- `DIDWW_README_PROXY_URL`, `DIDWW_README_CA_BUNDLE`, `DIDWW_README_REDIS_URL` (optional for `test-readme.ts`): an HTTP proxy that allows CONNECT, a CA bundle file that trusts the sandbox hosts, and a Redis server, for the README's proxy, CA bundle and Redis token store snippets. The proxy snippet also needs the `https-proxy-agent` package and the Redis snippet the `ioredis` package (`npm install --no-save https-proxy-agent@7.0.6 ioredis@5.11.1`). Without them those checks are skipped.
- `DIDWW_README_PRODUCTION_API_KEY` (optional for `test-readme.ts`): a production API key for its one production check, which only reads the balance, the countries and a Voice IN price with a read-scoped token. Without it the check is skipped.

## Install

```bash
npm install
```

## Run an example

```bash
DIDWW_API_KEY=your_api_key npx tsx examples/balance.ts
```

### Pass an argument

`prices-lookup.ts` takes an optional number:

```bash
DIDWW_API_KEY=your_api_key npx tsx examples/prices-lookup.ts 18005550123
```

## Available examples

| Script | Description |
|---|---|
| [`balance.ts`](balance.ts) | Fetches and prints current account balance and credit. |
| [`countries.ts`](countries.ts) | Lists countries and fetches one country by ID. |
| [`regions.ts`](regions.ts) | Lists regions filtered by country with includes. |
| [`did-groups.ts`](did-groups.ts) | Fetches DID groups with included relationships, number type and demo flag. |
| [`did-history.ts`](did-history.ts) | Lists DID ownership history (last 90 days). |
| [`dids.ts`](dids.ts) | Lists DIDs, assigns a trunk and a capacity pool to the newest one and updates its attributes. |
| [`did-trunk-assignment.ts`](did-trunk-assignment.ts) | Assigns a DID to a trunk, then to a trunk group (exclusive: the trunk is cleared), then restores the original routing. |
| [`did-sms-routing.ts`](did-sms-routing.ts) | Routes a DID's inbound SMS to an SMS trunk, then to an SMS trunk group (exclusive), then restores the original routing. |
| [`did-reservations.ts`](did-reservations.ts) | Reserves an available DID, lists and finds reservations, deletes the reservation. |
| [`capacity-pools.ts`](capacity-pools.ts) | Lists capacity pools with included shared capacity groups and qty-based pricings, finds one. |
| [`shared-capacity-groups.ts`](shared-capacity-groups.ts) | Creates a shared capacity group in a capacity pool, lists the groups, updates and deletes it. |
| [`orders.ts`](orders.ts) | Lists recent orders, orders a DID by SKU and cancels that order. |
| [`orders-sku.ts`](orders-sku.ts) | Orders a DID by SKU and quantity, with the SKU resolved from DID groups. |
| [`orders-available-dids.ts`](orders-available-dids.ts) | Orders a specific available DID. |
| [`orders-reservation-dids.ts`](orders-reservation-dids.ts) | Reserves a DID and then orders it. |
| [`orders-nanpa.ts`](orders-nanpa.ts) | Orders a DID number by NPA/NXX prefix. |
| [`orders-capacity.ts`](orders-capacity.ts) | Orders additional capacity from a capacity pool. |
| [`orders-all-item-types.ts`](orders-all-item-types.ts) | Creates one order with the three DID item types: by SKU, an available DID and a reserved DID. |
| [`orders-emergency.ts`](orders-emergency.ts) | Inspects server-created Emergency orders and `emergency_order_items`. |
| [`trunks.ts`](trunks.ts) | Lists Voice IN trunks with their trunk group, creates a SIP and a PSTN trunk, finds, updates and deletes them. |
| [`voice-in-trunk-groups.ts`](voice-in-trunk-groups.ts) | Creates two trunks and a trunk group with them, lists groups, renames the group, deletes the group and its trunks. |
| [`voice-in-trunk-sip-registration.ts`](voice-in-trunk-sip-registration.ts) | End-to-end SIP registration flow: create with `enabledSipRegistration`, rename, disable by setting `host`, re-enable. |
| [`voice-out-trunks.ts`](voice-out-trunks.ts) | CRUD for voice out trunks with polymorphic authentication_method, codecs in priority order and the ICE mode. Requires account configuration. |
| [`sms-trunks.ts`](sms-trunks.ts) | Lists SMS trunks, creates and updates an HTTP IN trunk, regenerates the credentials of an HTTP OUT trunk, deletes both. |
| [`sms-trunk-groups.ts`](sms-trunk-groups.ts) | Creates two inbound SMS trunks, groups them by priority, lists groups, deletes the group (and its trunks). |
| [`sender-id-verifications.ts`](sender-id-verifications.ts) | Lists Sender ID verifications with their SMS trunks, renames an active one, then restores its name. |
| [`identity-address-proofs.ts`](identity-address-proofs.ts) | Creates an identity and an address, uploads encrypted files, attaches a proof to each, prints the verified flags, deletes them. |
| [`address-verifications.ts`](address-verifications.ts) | Lists address verifications with reject_comment / external_reference_id. |
| [`upload-file.ts`](upload-file.ts) | Encrypts `sample.pdf` with the DIDWW public keys, uploads it to `encrypted_files` and prints the file ID. |
| [`exports.ts`](exports.ts) | Creates a CDR export with from/to datetime range filters (UTC) and lists exports. |
| [`exports-sms.ts`](exports-sms.ts) | Creates `sms_in` and `sms_out` exports with their filters and reads the columns of a completed one, downloaded in memory. |
| [`emergency-requirements.ts`](emergency-requirements.ts) | Lists emergency service requirements per country/number type. |
| [`emergency-requirement-validations.ts`](emergency-requirement-validations.ts) | Pre-validates an emergency order triple (requirement + address + identity). |
| [`emergency-verifications.ts`](emergency-verifications.ts) | Lists and creates emergency verifications. |
| [`emergency-calling-services.ts`](emergency-calling-services.ts) | Lists and cancels customer emergency calling services. |
| [`emergency-scenario.ts`](emergency-scenario.ts) | End-to-end: find DID → check requirements → validate → create verification → get service. |
| [`prices-lookup.ts`](prices-lookup.ts) `[number]` | Looks up Voice IN, Voice OUT, SMS OUT (A2P, P2P, OTP) and SMS IN prices for a number with a read-scoped client. |
| [`prices-download.ts`](prices-download.ts) | Downloads the Voice IN price file, fetches it again with If-Modified-Since (304), reads the first rows. Directory: `didww-prices` in the user cache directory, created for the current user only. |
| [`includes.ts`](includes.ts) | Reads regions, DID groups, available DIDs, DIDs and cities with included relationships and shows the `isIncluded` type guard. |
| [`webhook.ts`](webhook.ts) | Validates callback signatures with `RequestValidator`: a signed sample callback is valid, a tampered one is not. Sends no API request. |
| [`test-readme.ts`](test-readme.ts) | Runs every code snippet of the README against the sandbox API, one check per snippet, and cleans up what it creates. The address and emergency verifications it creates are printed on `REVIEW` lines. |

`did-trunk-assignment.ts`, `did-sms-routing.ts` and `sender-id-verifications.ts` change existing account state and restore it at the end; `trunks.ts`, `voice-in-trunk-groups.ts`, `shared-capacity-groups.ts`, `identity-address-proofs.ts`, `sms-trunks.ts` and `sms-trunk-groups.ts` delete what they create. Both happen also when a step fails.

## Upload file example

```bash
DIDWW_API_KEY=your_api_key npx tsx examples/upload-file.ts
```

## Troubleshooting

If `DIDWW_API_KEY` is missing, examples fail fast with:

`apiKey is required`
