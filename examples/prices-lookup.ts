/**
 * Prices lookup: looks up Voice IN, Voice OUT, SMS OUT and SMS IN prices for one number.
 *
 * Prices are served by separate hosts (api-vin, api-vout and api-sms); the SDK
 * obtains a token for each of them on first use. A read-scoped client
 * (scope: Scope.READ) is enough for prices. The account needs a price plan of
 * the service, otherwise the call fails with a DidwwPricesError of kind
 * PRICE_PLAN_NOT_ASSIGNED. Money is a decimal string in USD.
 *
 * Usage: DIDWW_API_KEY=xxx npx tsx examples/prices-lookup.ts [number]
 */
import { DidwwClient, DidwwClientError, DidwwPricesError, Environment, PricesErrorKind, Scope } from '../src/index.js';
import type { PricesService, SmsInPrice, SmsOutPrice, VoiceInPrice, VoiceOutPrice } from '../src/index.js';

const client = new DidwwClient({
  apiKey: process.env.DIDWW_API_KEY!,
  environment: Environment.SANDBOX,
  scope: Scope.READ,
});
const number = process.argv[2] || '18005550123';

const describeVoiceIn = (p: VoiceInPrice) =>
  `${p.country} ${p.destination} ${p.sourceType} from ${p.srcCountryName}:` +
  ` rate ${p.rate}, connection fee ${p.connectionFee},` +
  ` intervals ${p.initialInterval}/${p.nextInterval}, reject calls ${p.rejectCalls}`;

const describeVoiceOut = (p: VoiceOutPrice) =>
  `${p.category} ${p.country} ${p.network} ${p.prefix}:` +
  ` rate ${p.rate}, connection fee ${p.connectionFee},` +
  ` increments ${p.initialIncrement}/${p.recurringIncrement},` +
  ` next rate ${p.nextRate} from ${p.effectiveAt}`;

const describeSmsOut = (p: SmsOutPrice) =>
  `${p.country} ${p.mccName} ${p.mncName} (MCC ${p.mcc}, MNC ${p.mnc})` +
  ` ${p.sourcePrefix} -> ${p.destinationPrefix}: price ${p.price}, reject SMS ${p.rejectSms}`;

const describeSmsIn = (p: SmsInPrice) => `${p.country} ${p.sourcePrefix} -> ${p.destinationPrefix}: price ${p.price}`;

async function show<Row, Filters>(
  title: string,
  prices: PricesService<Row, Filters>,
  filters: Filters,
  describe: (row: Row) => string,
) {
  console.log(`\n=== ${title} ===`);
  try {
    const result = await prices.lookup(filters);
    console.log(`${result.totalRecords} matching price(s)`);
    for (const row of result.rows) {
      console.log(`  ${describe(row)}`);
    }
  } catch (e) {
    if (
      !(e instanceof DidwwPricesError) ||
      (e.kind !== PricesErrorKind.PRICE_PLAN_NOT_ASSIGNED && e.kind !== PricesErrorKind.PRICE_NOT_FOUND)
    ) {
      throw e;
    }
    console.log(`  ${e.kind}: ${e.message}`);
  }
}

async function main() {
  await show('Voice IN', client.voiceInPrices(), { number }, describeVoiceIn);
  await show('Voice IN, calls from the US', client.voiceInPrices(), { number, src_country_iso: 'US' }, describeVoiceIn);
  await show('Voice OUT', client.voiceOutPrices(), { number }, describeVoiceOut);
  await show('SMS OUT A2P', client.smsOutA2pPrices(), { dst_number: number }, describeSmsOut);
  await show('SMS OUT P2P, whole country', client.smsOutP2pPrices(), { dst_country_iso: 'US' }, describeSmsOut);
  await show('SMS OUT OTP', client.smsOutOtpPrices(), { dst_number: number, dst_country_iso: 'US' }, describeSmsOut);
  await show('SMS IN', client.smsInPrices(), { dst_number: number }, describeSmsIn);

  // Filters are checked before any request is sent (and by the compiler):
  // Voice OUT takes number only.
  try {
    // @ts-expect-error src_country_iso is not a Voice OUT filter
    await client.voiceOutPrices().lookup({ number, src_country_iso: 'US' });
  } catch (e) {
    if (!(e instanceof DidwwClientError)) throw e;
    console.log(`\nRejected locally: ${e.message}`);
  }
}

main().catch(console.error);
