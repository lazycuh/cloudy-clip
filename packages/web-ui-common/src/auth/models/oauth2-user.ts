import { Oauth2Provider } from './oauth2-provider';

export interface Oauth2User {
  authToken: string;
  displayName: string;
  email: string;
  provider: Oauth2Provider;
  userId: string;
}
