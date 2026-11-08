import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import * as SecureStore from 'expo-secure-store';
import { GoogleSSOUserProfile, OIDCTokenClaims } from '../models/NoctisModels';
import { CryptoSecurityService } from '../security/CryptoSecurityService';
import { InputSanitizer } from '../security/InputSanitizer';

export class GoogleSSOAuthService {
  private static readonly GOOGLE_AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
  private static readonly GOOGLE_TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
  private static readonly GOOGLE_USERINFO_ENDPOINT = 'https://www.googleapis.com/oauth2/v3/userinfo';
  private static readonly OAUTH_REDIRECT_URI = 'noctis://oauthredirect';
  private static readonly SECURE_ACCESS_TOKEN_KEY = 'noctis_sso_access_token';
  private static readonly SECURE_REFRESH_TOKEN_KEY = 'noctis_sso_refresh_token';
  private static readonly SECURE_PROFILE_KEY = 'noctis_user_profile';

  // Configurable Client IDs (in production from app.json / env)
  private static readonly GOOGLE_CLIENT_ID_IOS = 'YOUR_GOOGLE_IOS_CLIENT_ID.apps.googleusercontent.com';
  private static readonly GOOGLE_CLIENT_ID_ANDROID = 'YOUR_GOOGLE_ANDROID_CLIENT_ID.apps.googleusercontent.com';
  private static readonly GOOGLE_CLIENT_ID_WEB = 'YOUR_GOOGLE_WEB_CLIENT_ID.apps.googleusercontent.com';

  private static activeProfile: GoogleSSOUserProfile | null = null;
  private static cachedAccessToken: string | null = null;

  public static async executeGoogleSSO(customClientId?: string): Promise<GoogleSSOUserProfile> {
    WebBrowser.maybeCompleteAuthSession();
    const clientId = customClientId || this.GOOGLE_CLIENT_ID_WEB;
    const { verifier, challenge } = await CryptoSecurityService.generatePkcePair();
    const { state, nonce } = await CryptoSecurityService.generateOidcStateAndNonce();

    const discovery: AuthSession.DiscoveryDocument = {
      authorizationEndpoint: this.GOOGLE_AUTH_ENDPOINT,
      tokenEndpoint: this.GOOGLE_TOKEN_ENDPOINT,
    };

    const request = new AuthSession.AuthRequest({
      clientId,
      scopes: [
        'openid',
        'profile',
        'email',
        'https://www.googleapis.com/auth/drive.appdata',
      ],
      responseType: AuthSession.ResponseType.Code,
      redirectUri: AuthSession.makeRedirectUri({ scheme: 'noctis', path: 'oauthredirect' }),
      codeChallenge: challenge,
      codeChallengeMethod: AuthSession.CodeChallengeMethod.S256,
      state,
      extraParams: {
        nonce,
        access_type: 'offline',
        prompt: 'consent',
      },
    });

    const result = await request.promptAsync(discovery);

    if (result.type !== 'success') {
      if (result.type === 'cancel' || result.type === 'dismiss') {
        throw new Error('Google SSO cancelled by user.');
      }
      throw new Error(`Google SSO failed: ${result.type}`);
    }

    const { code, state: responseState } = result.params;

    // Verify OAuth 2.0 state parameter to prevent CSRF (OWASP M3)
    if (responseState !== state) {
      throw new Error('OAuth State Mismatch: Possible CSRF attack detected.');
    }

    // Exchange auth code for tokens with PKCE verifier
    const tokenResponse = await AuthSession.exchangeCodeAsync(
      {
        clientId,
        code,
        redirectUri: request.redirectUri,
        extraParams: {
          code_verifier: verifier,
        },
      },
      discovery
    );

    if (!tokenResponse.accessToken) {
      throw new Error('Authentication succeeded but received no access token.');
    }

    // Decode and strictly validate ID token claims BEFORE persisting credentials (OWASP M3 / A07:2021)
    if (tokenResponse.idToken) {
      const claims = this.parseJwtClaims(tokenResponse.idToken);
      if (!claims || !InputSanitizer.validateOidcClaims(claims, clientId, nonce)) {
        throw new Error('OIDC ID Token validation failed: invalid issuer, audience, expiry, or nonce.');
      }
    }

    this.cachedAccessToken = tokenResponse.accessToken;
    await SecureStore.setItemAsync(this.SECURE_ACCESS_TOKEN_KEY, tokenResponse.accessToken, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });

    if (tokenResponse.refreshToken) {
      await SecureStore.setItemAsync(this.SECURE_REFRESH_TOKEN_KEY, tokenResponse.refreshToken, {
        keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
      });
    }

    // Fetch user profile via Google userinfo endpoint
    const userProfile = await this.fetchGoogleUserProfile(tokenResponse.accessToken);
    this.activeProfile = userProfile;
    await SecureStore.setItemAsync(this.SECURE_PROFILE_KEY, JSON.stringify(userProfile), {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });

    return userProfile;
  }

  public static async fetchGoogleUserProfile(accessToken: string): Promise<GoogleSSOUserProfile> {
    const response = await fetch(this.GOOGLE_USERINFO_ENDPOINT, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch Google profile: ${response.status}`);
    }

    const json = await response.json();
    return new GoogleSSOUserProfile({
      sub: InputSanitizer.sanitizeString(json.sub),
      email: InputSanitizer.sanitizeString(json.email),
      name: InputSanitizer.sanitizeString(json.name),
      picture: InputSanitizer.sanitizeString(json.picture),
      emailVerified: Boolean(json.email_verified),
    });
  }

  public static async getStoredAccessToken(): Promise<string | null> {
    if (this.cachedAccessToken) {
      return this.cachedAccessToken;
    }
    const token = await SecureStore.getItemAsync(this.SECURE_ACCESS_TOKEN_KEY, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
    if (token) {
      this.cachedAccessToken = token;
    }
    return token;
  }

  public static async getStoredUserProfile(): Promise<GoogleSSOUserProfile | null> {
    if (this.activeProfile) {
      return this.activeProfile;
    }
    const raw = await SecureStore.getItemAsync(this.SECURE_PROFILE_KEY, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
    if (!raw) {
      return null;
    }
    const parsed = InputSanitizer.sanitizeSafeJsonParse<GoogleSSOUserProfile>(raw);
    if (parsed) {
      this.activeProfile = new GoogleSSOUserProfile(parsed);
      return this.activeProfile;
    }
    return null;
  }

  public static async signOut(): Promise<void> {
    this.activeProfile = null;
    this.cachedAccessToken = null;
    await SecureStore.deleteItemAsync(this.SECURE_ACCESS_TOKEN_KEY, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
    await SecureStore.deleteItemAsync(this.SECURE_REFRESH_TOKEN_KEY, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
    await SecureStore.deleteItemAsync(this.SECURE_PROFILE_KEY, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
  }

  private static parseJwtClaims(jwt: string): OIDCTokenClaims | null {
    try {
      const parts = jwt.split('.');
      if (parts.length !== 3) {
        return null;
      }
      const payloadBase64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      const json = atob(payloadBase64);
      return InputSanitizer.sanitizeSafeJsonParse<OIDCTokenClaims>(json);
    } catch {
      return null;
    }
  }
}
