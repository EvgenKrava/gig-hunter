import { AdminRemoveUserFromGroupCommand, CognitoIdentityProviderClient, ListUsersCommand, UserNotFoundException } from '@aws-sdk/client-cognito-identity-provider'
import { InvokeCommand, LambdaClient } from '@aws-sdk/client-lambda'
import { verifyApiKey } from '@gighunter/core/llm'
import { handle } from 'hono/aws-lambda'
import { buildCoreDeps, env } from '../shared/deps'
import { createApp } from './app'
import { ACCESS_GROUP } from './auth'
import type { ApiDeps } from './deps'

const core = buildCoreDeps('api')
const region = process.env.AWS_REGION ?? 'us-east-1'
const lambda = new LambdaClient({ region })
const cognito = new CognitoIdentityProviderClient({ region })

const deps: ApiDeps = {
  ...core,
  apiBaseUrl: env('API_BASE_URL'),
  verifyLlmKey: (apiKey) => verifyApiKey(apiKey),
  invokePoller: async (userId) => {
    await lambda.send(
      new InvokeCommand({
        FunctionName: env('POLLER_FUNCTION_NAME'),
        InvocationType: 'Event',
        Payload: Buffer.from(JSON.stringify({ trigger: 'manual', userId })),
      }),
    )
  },
  // The account belongs to the shared Only Tools pool, so leaving GigHunter only removes the
  // gighunter-user role. The JWT `sub` is not the Cognito username (a Google-federated user is
  // `Google_<google-sub>`), so resolve the username first.
  deleteIdentity: async (userId) => {
    const pool = env('USER_POOL_ID')
    const { Users } = await cognito.send(new ListUsersCommand({ UserPoolId: pool, Filter: `sub = "${userId}"`, Limit: 1 }))
    const username = Users?.[0]?.Username
    if (!username) return
    try {
      await cognito.send(new AdminRemoveUserFromGroupCommand({ UserPoolId: pool, Username: username, GroupName: ACCESS_GROUP }))
    } catch (e) {
      if (!(e instanceof UserNotFoundException)) throw e
    }
  },
}

export const handler = handle(createApp(deps))
