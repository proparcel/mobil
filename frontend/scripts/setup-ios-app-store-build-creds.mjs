/**
 * Non-interactive APP_STORE build credentials setup via EAS ASC API key.
 * Reuses existing distribution certificate from AD_HOC and creates App Store profile.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const EAS_ROOT = path.join(process.env.APPDATA, 'npm', 'node_modules', 'eas-cli', 'build');
const PROJECT_DIR = path.resolve(import.meta.dirname, '..');
const PROJECT_ID = 'a489f2e9-e08e-46e9-9ce3-c1346de09384';
const BUNDLE_ID = 'com.proparcel.app';

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
const { assignBuildCredentialsAsync } = await load('credentials/ios/actions/BuildCredentialsUtils.js');
const { IosDistributionType } = await load('graphql/generated.js');
const { AppleTeamType } = await load('credentials/ios/appstore/authenticateTypes.js');

const graphqlClient = createGraphqlClient({ accessToken: null, sessionSecret: state.auth.sessionSecret });
const user = await fetchUserAsync({ sessionSecret: state.auth.sessionSecret });
const exp = await getPrivateExpoConfigAsync(PROJECT_DIR, { skipSDKVersionRequirement: true });
const account = await getOwnerAccountForProjectIdAsync(graphqlClient, PROJECT_ID);

const app = { account, projectName: exp.slug, bundleIdentifier: BUNDLE_ID };
const target = {
  targetName: exp.name ?? 'ProParcel',
  bundleIdentifier: BUNDLE_ID,
  entitlements: {},
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
  app,
  AppleTeamType.COMPANY_OR_ORGANIZATION,
);
if (!authed) {
  throw new Error('ASC API key auth failed — run: node scripts/link-eas-asc-submit-key.mjs');
}
console.log('ASC API key authenticated');

const existing = await ctx.ios.getIosAppCredentialsWithBuildCredentialsAsync(graphqlClient, app, {
  iosDistributionType: IosDistributionType.AppStore,
});
if (existing?.iosAppBuildCredentialsList?.length) {
  const b = existing.iosAppBuildCredentialsList[0];
  console.log('APP_STORE credentials already exist:', {
    dist: b.distributionCertificate?.serialNumber,
    profile: b.provisioningProfile?.developerPortalIdentifier,
  });
  process.exit(0);
}

const adhocCert = await ctx.ios.getDistributionCertificateForAppAsync(
  graphqlClient,
  app,
  IosDistributionType.AdHoc,
);
if (!adhocCert?.certificateP12) {
  throw new Error('No AD_HOC distribution certificate with p12 found');
}
console.log('Reusing distribution certificate:', adhocCert.serialNumber);

const profile = await new CreateProvisioningProfile(app, target, adhocCert).runAsync(ctx);
const buildCreds = await assignBuildCredentialsAsync(
  ctx,
  app,
  IosDistributionType.AppStore,
  adhocCert,
  profile,
);
console.log('APP_STORE credentials created:', {
  id: buildCreds.id,
  dist: buildCreds.distributionCertificate?.serialNumber,
  profile: buildCreds.provisioningProfile?.developerPortalIdentifier,
});
