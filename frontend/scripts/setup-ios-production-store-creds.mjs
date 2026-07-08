/**
 * Non-interactive APP_STORE credentials for all iOS targets (main app + ShareExtension).
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const EAS_ROOT = path.join(process.env.APPDATA, 'npm', 'node_modules', 'eas-cli', 'build');
const PROJECT_DIR = path.resolve(import.meta.dirname, '..');
const PROJECT_ID = 'a489f2e9-e08e-46e9-9ce3-c1346de09384';

async function load(rel) {
  return import(pathToFileURL(path.join(EAS_ROOT, rel)).href);
}

const state = JSON.parse(fs.readFileSync(path.join(os.homedir(), '.expo', 'state.json'), 'utf8'));
const { createGraphqlClient } = await load('commandUtils/context/contextUtils/createGraphqlClient.js');
const { fetchUserAsync } = await load('user/fetchUser.js');
const { CredentialsContext } = await load('credentials/context.js');
const { getPrivateExpoConfigAsync } = await load('project/expoConfig.js');
const { getOwnerAccountForProjectIdAsync } = await load('project/projectUtils.js');
const { tryAuthenticateAppStoreWithEasAscApiKeyAsync } = await load(
  'credentials/ios/actions/AscApiKeyUtils.js',
);
const { SetUpBuildCredentials } = await load('credentials/ios/actions/SetUpBuildCredentials.js');
const { resolveXcodeBuildContextAsync } = await load('project/ios/scheme.js');
const { resolveTargetsAsync } = await load('project/ios/target.js');
const { AppleTeamType } = await load('credentials/ios/appstore/authenticateTypes.js');

const graphqlClient = createGraphqlClient({ accessToken: null, sessionSecret: state.auth.sessionSecret });
const user = await fetchUserAsync({ sessionSecret: state.auth.sessionSecret });
const exp = await getPrivateExpoConfigAsync(PROJECT_DIR, { skipSDKVersionRequirement: true });
const account = await getOwnerAccountForProjectIdAsync(graphqlClient, PROJECT_ID);

const ctx = new CredentialsContext({
  projectDir: PROJECT_DIR,
  projectInfo: { exp, projectId: PROJECT_ID },
  user,
  graphqlClient,
  analytics: null,
  vcsClient: null,
  nonInteractive: true,
  autoAcceptCredentialReuse: true,
  shouldAskAuthenticateAppStore: false,
});

const app = { account, projectName: exp.slug };
const authed = await tryAuthenticateAppStoreWithEasAscApiKeyAsync(
  ctx,
  { ...app, bundleIdentifier: exp.ios?.bundleIdentifier ?? 'com.proparcel.app' },
  AppleTeamType.COMPANY_OR_ORGANIZATION,
);
if (!authed) {
  throw new Error('ASC API key auth failed — run: node scripts/link-eas-asc-submit-key.mjs');
}
console.log('ASC API key authenticated');

const buildProfile = {
  distribution: 'store',
  env: { NODE_ENV: 'production', IOS_STANDALONE: '1' },
};
const xcodeBuildContext = await resolveXcodeBuildContextAsync(
  { projectDir: PROJECT_DIR, nonInteractive: true, exp, vcsClient: null },
  buildProfile,
);
const targets = await resolveTargetsAsync({
  exp,
  projectDir: PROJECT_DIR,
  xcodeBuildContext,
  env: buildProfile.env,
  vcsClient: null,
});

console.log(
  'Targets:',
  targets.map((t) => `${t.targetName} (${t.bundleIdentifier})`).join(', '),
);

await new SetUpBuildCredentials({
  app,
  targets,
  distribution: buildProfile.distribution,
}).runAsync(ctx);

console.log('All APP_STORE credentials ready.');
