/**
 * Recreate main app APP_STORE provisioning profile with Associated Domains entitlement.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

process.env.IOS_STANDALONE = '1';
process.env.NODE_ENV = 'production';

const EAS_ROOT = path.join(process.env.APPDATA, 'npm', 'node_modules', 'eas-cli', 'build');
const PROJECT_DIR = path.resolve(import.meta.dirname, '..');
const PROJECT_ID = 'a489f2e9-e08e-46e9-9ce3-c1346de09384';
const MAIN_BUNDLE_ID = 'com.proparcel.app';

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
const { CreateProvisioningProfile } = await load('credentials/ios/actions/CreateProvisioningProfile.js');
const { assignBuildCredentialsAsync, getBuildCredentialsAsync } = await load(
  'credentials/ios/actions/BuildCredentialsUtils.js',
);
const { IosDistributionType } = await load('graphql/generated.js');
const { AppleTeamType } = await load('credentials/ios/appstore/authenticateTypes.js');

const graphqlClient = createGraphqlClient({ accessToken: null, sessionSecret: state.auth.sessionSecret });
const user = await fetchUserAsync({ sessionSecret: state.auth.sessionSecret });
const exp = await getPrivateExpoConfigAsync(PROJECT_DIR, { skipSDKVersionRequirement: true });
const account = await getOwnerAccountForProjectIdAsync(graphqlClient, PROJECT_ID);

const mainApp = { account, projectName: exp.slug, bundleIdentifier: MAIN_BUNDLE_ID };
const mainTarget = {
  targetName: 'ProParcel',
  bundleIdentifier: MAIN_BUNDLE_ID,
  entitlements: {
    'com.apple.security.application-groups': ['group.com.proparcel.app.share'],
  },
};

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

const authed = await tryAuthenticateAppStoreWithEasAscApiKeyAsync(
  ctx,
  mainApp,
  AppleTeamType.COMPANY_OR_ORGANIZATION,
);
if (!authed) throw new Error('ASC API key auth failed');
console.log('ASC API key authenticated');

await ctx.appStore.ensureBundleIdExistsAsync(
  { accountName: account.name, bundleIdentifier: MAIN_BUNDLE_ID, projectName: exp.slug },
  { entitlements: mainTarget.entitlements },
);
console.log('Bundle ID capabilities synced (App Groups)');

const mainCreds = await getBuildCredentialsAsync(ctx, mainApp, IosDistributionType.AppStore);
const distCert = mainCreds?.distributionCertificate;
const oldProfile = mainCreds?.provisioningProfile;
if (!distCert?.certificateP12) throw new Error('Main app distribution certificate not found');

console.log('Old profile:', oldProfile?.developerPortalIdentifier);
const newProfile = await new CreateProvisioningProfile(mainApp, mainTarget, distCert).runAsync(ctx);
await assignBuildCredentialsAsync(ctx, mainApp, IosDistributionType.AppStore, distCert, newProfile);
if (oldProfile?.id) {
  await ctx.ios.deleteProvisioningProfilesAsync(ctx.graphqlClient, [oldProfile.id]);
}
console.log('New profile:', newProfile.developerPortalIdentifier);
