# Examples

All examples read the API key from the `DIDWW_API_KEY` environment variable.

## Prerequisites

- Node.js 18+
- DIDWW API key for sandbox account

## Environment variables

- `DIDWW_API_KEY` (required): your DIDWW API key
- `XDG_CACHE_HOME` (optional for `prices-download.ts`, Linux and other Unix systems): user cache directory, `~/.cache` if not set

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
| [`includes.ts`](includes.ts) | Demonstrates `isIncluded` type guard with regions and countries. |
| [`dids.ts`](dids.ts) | Lists DIDs, assigns trunk and capacity pool. |
| [`did-history.ts`](did-history.ts) | Lists DID ownership history (last 90 days). |
| [`trunks.ts`](trunks.ts) | Creates a PSTN trunk, lists all trunks, updates its name and point of presence (`pop`), deletes it. |
| [`shared-capacity-groups.ts`](shared-capacity-groups.ts) | Creates and deletes a shared capacity group. |
| [`orders-sku.ts`](orders-sku.ts) | Creates a DID order by SKU resolved from DID groups. |
| [`orders-nanpa.ts`](orders-nanpa.ts) | Orders a DID number by NPA/NXX prefix. |
| [`orders-available-dids.ts`](orders-available-dids.ts) | Orders a specific available DID. |
| [`orders-reservation-dids.ts`](orders-reservation-dids.ts) | Reserves a DID and then orders it. |
| [`orders-capacity.ts`](orders-capacity.ts) | Orders additional capacity from a capacity pool. |
| [`orders-all-item-types.ts`](orders-all-item-types.ts) | Creates an order with all three item types combined. |
| [`upload-file.ts`](upload-file.ts) | Encrypts sample data and uploads to `encrypted_files`. |
| [`identity-address-proofs.ts`](identity-address-proofs.ts) | Lists identities (birth country, company website), creates an identity and an address, deletes them. |
| [`address-verifications.ts`](address-verifications.ts) | Lists address verifications with reject_comment / external_reference_id. |
| [`voice-in-trunk-groups.ts`](voice-in-trunk-groups.ts) | CRUD for trunk groups with trunk relationships. |
| [`voice-out-trunks.ts`](voice-out-trunks.ts) | CRUD for voice out trunks with polymorphic authentication_method. Requires account configuration. |
| [`did-trunk-assignment.ts`](did-trunk-assignment.ts) | Demonstrates exclusive trunk/trunk group assignment on DIDs. |
| [`did-reservations.ts`](did-reservations.ts) | Creates, lists, finds and deletes DID reservations. |
| [`exports.ts`](exports.ts) | Creates a CDR export with from/to datetime range filters (UTC) and lists exports. |
| [`capacity-pools.ts`](capacity-pools.ts) | Lists capacity pools with included shared capacity groups. |
| [`voice-in-trunk-sip-registration.ts`](voice-in-trunk-sip-registration.ts) | End-to-end SIP registration flow: create with `enabledSipRegistration`, rename, disable by setting `host`, re-enable. |
| [`test-readme.ts`](test-readme.ts) | Runs all README code examples against the sandbox API. |

### Emergency Services

| Script | Description |
|---|---|
| [`emergency-requirements.ts`](emergency-requirements.ts) | Lists emergency service requirements per country/number type. |
| [`emergency-calling-services.ts`](emergency-calling-services.ts) | Lists and cancels customer emergency calling services. |
| [`emergency-verifications.ts`](emergency-verifications.ts) | Lists and creates emergency verifications. |
| [`emergency-requirement-validations.ts`](emergency-requirement-validations.ts) | Pre-validates an emergency order triple (requirement + address + identity). |
| [`emergency-scenario.ts`](emergency-scenario.ts) | End-to-end: find DID → check requirements → validate → create verification → get service. |
| [`orders-emergency.ts`](orders-emergency.ts) | Inspects server-created Emergency orders and `emergency_order_items`. |

### SMS

| Script | Description |
|---|---|
| [`sms-trunks.ts`](sms-trunks.ts) | Lists SMS trunks, creates and updates an HTTP IN trunk, regenerates the credentials of an HTTP OUT trunk, deletes both. |
| [`sms-trunk-groups.ts`](sms-trunk-groups.ts) | Creates two inbound SMS trunks, groups them by priority, lists groups, deletes the group (and its trunks). |
| [`sender-id-verifications.ts`](sender-id-verifications.ts) | Lists Sender ID verifications with their SMS trunks, renames an active one, then restores its name. |
| [`did-sms-routing.ts`](did-sms-routing.ts) | Routes a DID's inbound SMS to an SMS trunk, then to an SMS trunk group (exclusive), then restores the original routing. |
| [`exports-sms.ts`](exports-sms.ts) | Creates `sms_in` and `sms_out` exports with their filters and reads the columns of a completed one, downloaded in memory. |

### Prices

| Script | Description |
|---|---|
| [`prices-lookup.ts`](prices-lookup.ts) `[number]` | Looks up Voice IN, Voice OUT, SMS OUT (A2P, P2P, OTP) and SMS IN prices for a number with a read-scoped client. |
| [`prices-download.ts`](prices-download.ts) | Downloads the Voice IN price file, fetches it again with If-Modified-Since (304), reads the first rows. Directory: `didww-prices` in the user cache directory, created for the current user only. |

`sender-id-verifications.ts` and `did-sms-routing.ts` change existing account state and restore it at the end; `sms-trunks.ts` and `sms-trunk-groups.ts` delete what they create. Both happen also when a step fails.

## Upload file example

```bash
DIDWW_API_KEY=your_api_key npx tsx examples/upload-file.ts
```

## Troubleshooting

If `DIDWW_API_KEY` is missing, examples fail fast with:

`apiKey is required`
