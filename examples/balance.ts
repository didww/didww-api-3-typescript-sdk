import { DidwwClient, Environment } from '../src/index.js';

const client = new DidwwClient({
  apiKey: process.env.DIDWW_API_KEY!,
  environment: Environment.SANDBOX,
});

async function main() {
  const result = await client.balance().find();
  console.log('Balance:', result.data.balance);
  console.log('Credit:', result.data.credit);
  console.log('Total:', result.data.totalBalance);
}

main().catch(console.error);
