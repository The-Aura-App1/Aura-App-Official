import { Amplify } from 'aws-amplify';
// Finishes a Google sign-in when Cognito sends the person back (does nothing otherwise)
import 'aws-amplify/auth/enable-oauth-listener';

// "Continue with Google" goes through Cognito's hosted sign-in (OAuth). It
// switches on only when REACT_APP_COGNITO_DOMAIN is set to the user pool's
// hosted domain (like aura-app.auth.us-east-1.amazoncognito.com) after Google
// is added as an identity provider in Cognito (TODO console step 23).
// Without it the button stays hidden and nothing changes.
const OAUTH_DOMAIN = (process.env.REACT_APP_COGNITO_DOMAIN ?? '').trim();
export const GOOGLE_SIGN_IN = !!OAUTH_DOMAIN && typeof window !== 'undefined';

Amplify.configure({
  Auth: {
    Cognito: {
      userPoolId: 'us-east-1_fiuEOr0XM',
      userPoolClientId: '1b2uhsh7qdlmgbjj5vh09p64ds',
      signUpVerificationMethod: 'code',
      loginWith: {
        email: true,
        ...(GOOGLE_SIGN_IN && {
          oauth: {
            domain: OAUTH_DOMAIN,
            scopes: ['openid', 'email', 'profile'],
            redirectSignIn: [`${window.location.origin}/`],
            redirectSignOut: [`${window.location.origin}/welcome`],
            responseType: 'code',
            providers: ['Google'],
          },
        }),
      },
    },
  },
});
