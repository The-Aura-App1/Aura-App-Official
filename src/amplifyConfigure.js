import { Amplify } from 'aws-amplify';

Amplify.configure({
  Auth: {
    Cognito: {
      userPoolId:       'us-east-1_fiuEOr0XM',
      userPoolClientId: '1b2uhsh7qdlmgbjj5vh09p64ds',
      signUpVerificationMethod: 'code',
      loginWith: { email: true },
    },
  },
});