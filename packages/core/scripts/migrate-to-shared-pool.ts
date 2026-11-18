/**
 * One-off: move a GigHunter user from the old gighunter pool to the shared Only Tools pool.
 * The JWT `sub` changes, and every key is derived from it, so this COPIES the user's data
 * (DynamoDB items, SSM secrets) to the new sub, points the Telegram webhook at the new user,
 * and deactivates the old copy so the poller ignores it. Nothing is deleted.
 *
 *   pnpm --filter @gighunter/core exec tsx scripts/migrate-to-shared-pool.ts --from <old-sub> --to <new-sub> [--apply]
 */
import { parseArgs } from 'node:util'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { BatchWriteCommand, DynamoDBDocumentClient, QueryCommand, UpdateCommand, GetCommand } from '@aws-sdk/lib-dynamodb'
import { GetParametersByPathCommand, PutParameterCommand, SSMClient } from '@aws-sdk/client-ssm'

const { values } = parseArgs({ options: { from: { type: 'string' }, to: { type: 'string' }, apply: { type: 'boolean', default: false }, table: { type: 'string', default: 'gighunter' }, 'api-url': { type: 'string' } } })
const from = values.from!
const to = values.to!
if (!from || !to || from === to) throw new Error('usage: --from <old-sub> --to <new-sub> [--apply]')
const apply = values.apply
const TABLE = values.table!
const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: 'us-east-1' }), { marshallOptions: { removeUndefinedValues: true } })
const ssm = new SSMClient({ region: 'us-east-1' })

const swap = (v: unknown): unknown =>
  typeof v === 'string' ? v.split(from).join(to)
  : Array.isArray(v) ? v.map(swap)
  : v && typeof v === 'object' && !(v instanceof Uint8Array) && !(v instanceof Set) ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, swap(x)]))
  : v

// 1. DynamoDB: every item under USER#<old>.
const items: Record<string, unknown>[] = []
let start: Record<string, unknown> | undefined
do {
  const out = await ddb.send(new QueryCommand({ TableName: TABLE, KeyConditionExpression: 'pk = :pk', ExpressionAttributeValues: { ':pk': `USER#${from}` }, ExclusiveStartKey: start }))
  items.push(...(out.Items ?? []))
  start = out.LastEvaluatedKey
} while (start)
const existing = await ddb.send(new QueryCommand({ TableName: TABLE, KeyConditionExpression: 'pk = :pk', ExpressionAttributeValues: { ':pk': `USER#${to}` }, Select: 'COUNT' }))
console.log(`items to copy: ${items.length}; already under the new sub: ${existing.Count}`)

// 2. SSM secrets.
const params: { Name: string; Value: string }[] = []
let next: string | undefined
do {
  const out = await ssm.send(new GetParametersByPathCommand({ Path: `/gighunter/users/${from}/`, Recursive: true, WithDecryption: true, NextToken: next }))
  params.push(...(out.Parameters ?? []).map((p) => ({ Name: p.Name!, Value: p.Value! })))
  next = out.NextToken
} while (next)
console.log(`secrets to copy: ${params.map((p) => p.Name.split(`/${from}/`)[1]).join(', ') || 'none'}`)

const settings = items.find((i) => i.sk === 'SETTINGS') as { telegram?: { tokenSet?: boolean; webhookSecret?: string } } | undefined
const needsWebhook = !!settings?.telegram?.tokenSet && !!settings.telegram.webhookSecret && !!values['api-url']
console.log(`telegram webhook: ${needsWebhook ? 'will point at the new user' : 'skipped (no bot or no --api-url)'}`)

if (!apply) { console.log('dry run; add --apply to write'); process.exit(0) }

for (let i = 0; i < items.length; i += 25) {
  const batch = items.slice(i, i + 25).map((it) => ({ PutRequest: { Item: swap(it) as Record<string, unknown> } }))
  let req: Record<string, unknown[]> | undefined = { [TABLE]: batch }
  while (req && Object.keys(req).length) {
    const out = await ddb.send(new BatchWriteCommand({ RequestItems: req as never }))
    req = out.UnprocessedItems as Record<string, unknown[]> | undefined
  }
}
console.log(`copied ${items.length} items`)

for (const p of params) {
  await ssm.send(new PutParameterCommand({ Name: p.Name.replace(`/${from}/`, `/${to}/`), Value: p.Value, Type: 'SecureString', Overwrite: true }))
}
console.log(`copied ${params.length} secrets`)

if (needsWebhook) {
  const token = params.find((p) => p.Name.endsWith('/telegram/bot-token'))?.Value
  if (token) {
    const url = `${values['api-url']!.replace(/\/+$/, '')}/telegram/webhook/${to}`
    const res = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ url, secret_token: settings!.telegram!.webhookSecret, allowed_updates: ['message', 'callback_query', 'my_chat_member', 'channel_post'] }),
    })
    console.log(`telegram setWebhook: ${res.status} ${(await res.json() as { description?: string }).description ?? ''}`)
  }
}

// Old copy: stop polling it (reversible: set active back to true and gsi1pk to ACTIVE_USER).
await ddb.send(new UpdateCommand({ TableName: TABLE, Key: { pk: `USER#${from}`, sk: 'SETTINGS' }, UpdateExpression: 'SET active = :f REMOVE gsi1pk, gsi1sk', ExpressionAttributeValues: { ':f': false } }))
const check = await ddb.send(new GetCommand({ TableName: TABLE, Key: { pk: `USER#${to}`, sk: 'SETTINGS' } }))
console.log(`new settings active=${check.Item?.active} gsi1sk=${check.Item?.gsi1sk}`)
