import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const EAS_ROOT = path.join(process.env.APPDATA, 'npm', 'node_modules', 'eas-cli', 'build');
const PROJECT_FULL_NAME = '@sercanyanaz/frontend';
const BUNDLE_ID = 'com.proparcel.app';
const ASC_KEY_ID = 'de1d5da4-b0fe-43f4-9d33-b55cdb90217d';

async function load(rel) {
  return import(pathToFileURL(path.join(EAS_ROOT, rel)).href);
}

const state = JSON.parse(fs.readFileSync(path.join(os.homedir(), '.expo', 'state.json'), 'utf8'));
const { createGraphqlClient } = await load('commandUtils/context/contextUtils/createGraphqlClient.js');
const { AppleAppIdentifierQuery } = await load('credentials/ios/api/graphql/queries/AppleAppIdentifierQuery.js');
const { IosAppCredentialsQuery } = await load('credentials/ios/api/graphql/queries/IosAppCredentialsQuery.js');
const { IosAppCredentialsMutation } = await load('credentials/ios/api/graphql/mutations/IosAppCredentialsMutation.js');
const { getAscApiKeysForAccountAsync } = await load('credentials/ios/api/GraphqlClient.js');
const { AppQuery } = await load('graphql/queries/AppQuery.js');

const client = createGraphqlClient({ accessToken: null, sessionSecret: state.auth.sessionSecret });
const app = await AppQuery.byIdAsync(client, 'a489f2e9-e08e-46e9-9ce3-c1346de09384');

const appleAppId = await AppleAppIdentifierQuery.byBundleIdentifierAsync(
  client,
  app.ownerAccount.name,
  BUNDLE_ID,
);
if (!appleAppId) throw new Error(`Apple app identifier not found for ${BUNDLE_ID}`);

let creds = await IosAppCredentialsQuery.withCommonFieldsByAppIdentifierIdAsync(client, PROJECT_FULL_NAME, {
  appleAppIdentifierId: appleAppId.id,
});

if (!creds) throw new Error('iosAppCredentials not found — run eas credentials once interactively');

const keys = await getAscApiKeysForAccountAsync(client, app.ownerAccount);
const ascKey = keys.find((k) => k.id === ASC_KEY_ID) ?? keys[0];
if (!ascKey) throw new Error('No ASC key on account');

if (creds.appStoreConnectApiKeyForSubmissions?.id === ascKey.id) {
  console.log('already linked:', ascKey.name);
} else {
  creds = await IosAppCredentialsMutation.setAppStoreConnectApiKeyForSubmissionsAsync(
    client,
    creds.id,
    ascKey.id,
  );
  console.log('linked:', creds.appStoreConnectApiKeyForSubmissions?.name ?? ascKey.name);
}
