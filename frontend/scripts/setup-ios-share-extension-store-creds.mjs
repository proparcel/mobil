/**
 * Non-interactive APP_STORE provisioning for ShareExtension target.
 * Reuses main app distribution certificate.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const EAS_ROOT = path.join(process.env.APPDATA, 'npm', 'node_modules', 'eas-cli', 'build');
const PROJECT_DIR = path.resolve(import.meta.dirname, '..');
const PROJECT_ID = 'a489f2e9-e08e-46e9-9ce3-c1346de09384';
const MAIN_BUNDLE_ID = 'com.proparcel.app';
const EXT_BUNDLE_ID = 'com.proparcel.app.share-extension';
const APP_GROUP = 'group.com.proparcel.app.share';

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
const extApp = {
  account,
  projectName: exp.slug,
  bundleIdentifier: EXT_BUNDLE_ID,
  parentBundleIdentifier: MAIN_BUNDLE_ID,
};
const extTarget = {
  targetName: 'ShareExtension',
  bundleIdentifier: EXT_BUNDLE_ID,
  parentBundleIdentifier: MAIN_BUNDLE_ID,
  entitlements: {
    'com.apple.security.application-groups': [APP_GROUP],
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
if (!authed) {
  throw new Error('ASC API key auth failed');
}
console.log('ASC API key authenticated');

const existingExt = await ctx.ios.getIosAppCredentialsWithBuildCredentialsAsync(graphqlClient, extApp, {
  iosDistributionType: IosDistributionType.AppStore,
});
if (existingExt?.iosAppBuildCredentialsList?.length) {
  const b = existingExt.iosAppBuildCredentialsList[0];
  console.log('ShareExtension APP_STORE credentials already exist:', {
    dist: b.distributionCertificate?.serialNumber,
    profile: b.provisioningProfile?.developerPortalIdentifier,
  });
  process.exit(0);
}

const mainCreds = await getBuildCredentialsAsync(ctx, mainApp, IosDistributionType.AppStore);
const distCert = mainCreds?.distributionCertificate;
if (!distCert?.certificateP12) {
  throw new Error('Main app APP_STORE distribution certificate not found');
}
console.log('Reusing distribution certificate:', distCert.serialNumber);

await ctx.appStore.ensureBundleIdExistsAsync(
  {
    accountName: account.name,
    bundleIdentifier: EXT_BUNDLE_ID,
    projectName: exp.slug,
  },
  {
    entitlements: extTarget.entitlements,
    parentBundleIdentifier: MAIN_BUNDLE_ID,
  },
);

const profile = await new CreateProvisioningProfile(extApp, extTarget, distCert).runAsync(ctx);
const buildCreds = await assignBuildCredentialsAsync(
  ctx,
  extApp,
  IosDistributionType.AppStore,
  distCert,
  profile,
);
console.log('ShareExtension APP_STORE credentials created:', {
  id: buildCreds.id,
  dist: buildCreds.distributionCertificate?.serialNumber,
  profile: buildCreds.provisioningProfile?.developerPortalIdentifier,
});
