import { getRepositories } from "@/lib/repositories/index";
import { createId } from "@/lib/repositories/local";
import { readJson, writeJson, removeKey } from "@/lib/repositories/local/storage";
import { createEventId, domainEventBus } from "@/lib/events/bus";
import type { AuthProvider, UserProfile } from "@/lib/types";

const AUTH_SESSION_KEY = "auth-session";
const AUTH_ACCOUNTS_KEY = "auth-accounts";
const PROFILE_COLORS = ["#e50914", "#8b5cf6", "#0ea5e9", "#10b981", "#f59e0b"];

export type AuthSession = {
  userId: string;
  provider: AuthProvider;
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
  createdAt: string;
};

export type AuthAccountRecord = {
  userId: string;
  email: string | null;
  /** PBKDF2 hash (base64) — local mode only. */
  passwordHash: string | null;
  passwordSalt: string | null;
  provider: AuthProvider;
  createdAt: string;
};

export type AuthErrorCode =
  | "INVALID_CREDENTIALS"
  | "EMAIL_IN_USE"
  | "WEAK_PASSWORD"
  | "PROVIDER_UNAVAILABLE"
  | "SESSION_EXPIRED"
  | "NOT_AUTHENTICATED"
  | "NETWORK"
  | "UNKNOWN";

export class AuthError extends Error {
  readonly code: AuthErrorCode;

  constructor(code: AuthErrorCode, message: string) {
    super(message);
    this.name = "AuthError";
    this.code = code;
  }
}

async function derivePasswordHash(
  password: string,
  saltB64: string,
): Promise<string> {
  const enc = new TextEncoder();
  const salt = Uint8Array.from(atob(saltB64), (c) => c.charCodeAt(0));
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt,
      iterations: 100_000,
      hash: "SHA-256",
    },
    keyMaterial,
    256,
  );
  return btoa(String.fromCharCode(...new Uint8Array(bits)));
}

function randomSalt(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return btoa(String.fromCharCode(...bytes));
}

function randomToken(): string {
  return createId("tok");
}

function pickColor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash + seed.charCodeAt(i) * (i + 1)) % PROFILE_COLORS.length;
  }
  return PROFILE_COLORS[hash] ?? PROFILE_COLORS[0];
}

function sessionExpiresInHours(hours = 720): string {
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
}

function isCloudAuthConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

/**
 * Authentication service.
 * Local mode supports email/password + guest with persistent sessions.
 * Google/Apple are architected; they activate when Supabase (or another IdP) is configured.
 */
export class AuthenticationService {
  getSession(): AuthSession | null {
    const session = readJson<AuthSession | null>(AUTH_SESSION_KEY, null);
    if (!session) return null;
    if (new Date(session.expiresAt).getTime() < Date.now()) {
      this.clearSession("expired");
      return null;
    }
    return session;
  }

  async getCurrentProfile(): Promise<UserProfile | null> {
    const session = this.getSession();
    if (!session) return null;
    return getRepositories().users.getById(session.userId);
  }

  async signUpWithEmail(input: {
    email: string;
    password: string;
    displayName: string;
  }): Promise<{ profile: UserProfile; session: AuthSession }> {
    const email = input.email.trim().toLowerCase();
    const displayName = input.displayName.trim();
    if (!email || !displayName) {
      throw new AuthError("INVALID_CREDENTIALS", "Email and name are required.");
    }
    if (input.password.length < 8) {
      throw new AuthError(
        "WEAK_PASSWORD",
        "Password must be at least 8 characters.",
      );
    }

    if (isCloudAuthConfigured()) {
      // Supabase Auth path — wire when project credentials exist.
      throw new AuthError(
        "PROVIDER_UNAVAILABLE",
        "Cloud auth is configured but not yet connected in this build.",
      );
    }

    const accounts = readJson<AuthAccountRecord[]>(AUTH_ACCOUNTS_KEY, []);
    if (accounts.some((a) => a.email === email)) {
      throw new AuthError("EMAIL_IN_USE", "An account with this email exists.");
    }

    const existing = await getRepositories().users.getByEmail(email);
    if (existing) {
      throw new AuthError("EMAIL_IN_USE", "An account with this email exists.");
    }

    const salt = randomSalt();
    const passwordHash = await derivePasswordHash(input.password, salt);
    const now = new Date().toISOString();
    const profile: UserProfile = {
      id: createId("user"),
      displayName,
      email,
      avatarUrl: null,
      color: pickColor(email),
      provider: "email",
      isGuest: false,
      createdAt: now,
      updatedAt: now,
    };

    accounts.push({
      userId: profile.id,
      email,
      passwordHash,
      passwordSalt: salt,
      provider: "email",
      createdAt: now,
    });
    writeJson(AUTH_ACCOUNTS_KEY, accounts);
    await getRepositories().users.upsert(profile);

    const session = this.persistSession(profile.id, "email");
    return { profile, session };
  }

  async signInWithEmail(input: {
    email: string;
    password: string;
  }): Promise<{ profile: UserProfile; session: AuthSession }> {
    const email = input.email.trim().toLowerCase();
    const accounts = readJson<AuthAccountRecord[]>(AUTH_ACCOUNTS_KEY, []);
    const account = accounts.find((a) => a.email === email && a.provider === "email");
    if (!account?.passwordHash || !account.passwordSalt) {
      throw new AuthError("INVALID_CREDENTIALS", "Incorrect email or password.");
    }

    const hash = await derivePasswordHash(input.password, account.passwordSalt);
    if (hash !== account.passwordHash) {
      throw new AuthError("INVALID_CREDENTIALS", "Incorrect email or password.");
    }

    const profile = await getRepositories().users.getById(account.userId);
    if (!profile) {
      throw new AuthError("INVALID_CREDENTIALS", "Account data is missing.");
    }

    const session = this.persistSession(profile.id, "email");
    return { profile, session };
  }

  async signInWithGoogle(): Promise<never> {
    if (!isCloudAuthConfigured()) {
      throw new AuthError(
        "PROVIDER_UNAVAILABLE",
        "Google Sign-In requires cloud authentication. Configure Supabase to enable it.",
      );
    }
    throw new AuthError(
      "PROVIDER_UNAVAILABLE",
      "Google Sign-In is scaffolded and will use Supabase OAuth.",
    );
  }

  async signInWithApple(): Promise<never> {
    // Placeholder architecture — Apple requires platform-specific setup.
    throw new AuthError(
      "PROVIDER_UNAVAILABLE",
      "Apple Sign-In is reserved for a future native/web IdP configuration.",
    );
  }

  async continueAsGuest(displayName?: string): Promise<{
    profile: UserProfile;
    session: AuthSession;
  }> {
    const now = new Date().toISOString();
    const name = displayName?.trim() || "Guest";
    const profile: UserProfile = {
      id: createId("guest"),
      displayName: name,
      email: null,
      avatarUrl: null,
      color: pickColor(name + now),
      provider: "guest",
      isGuest: true,
      createdAt: now,
      updatedAt: now,
    };
    await getRepositories().users.upsert(profile);
    const session = this.persistSession(profile.id, "guest");
    return { profile, session };
  }

  async updateProfile(
    userId: string,
    patch: Partial<
      Pick<UserProfile, "displayName" | "avatarUrl" | "color" | "email">
    >,
  ): Promise<UserProfile> {
    const repos = getRepositories();
    const existing = await repos.users.getById(userId);
    if (!existing) {
      throw new AuthError("NOT_AUTHENTICATED", "Profile not found.");
    }
    const next: UserProfile = {
      ...existing,
      displayName: patch.displayName?.trim() || existing.displayName,
      avatarUrl:
        patch.avatarUrl === undefined ? existing.avatarUrl : patch.avatarUrl,
      color: patch.color ?? existing.color,
      email:
        patch.email === undefined
          ? existing.email
          : patch.email?.trim().toLowerCase() || null,
      updatedAt: new Date().toISOString(),
    };
    return repos.users.upsert(next);
  }

  async logout(): Promise<void> {
    this.clearSession("logout");
  }

  async deleteAccount(userId: string): Promise<void> {
    const repos = getRepositories();
    const accounts = readJson<AuthAccountRecord[]>(AUTH_ACCOUNTS_KEY, []).filter(
      (a) => a.userId !== userId,
    );
    writeJson(AUTH_ACCOUNTS_KEY, accounts);
    await repos.users.delete(userId);
    this.clearSession("deleted");
  }

  /** Restore session on app boot (auto-login). */
  async restoreSession(): Promise<UserProfile | null> {
    const session = this.getSession();
    if (!session) return null;
    const profile = await getRepositories().users.getById(session.userId);
    if (!profile) {
      this.clearSession("missing-profile");
      return null;
    }
    // Sliding expiry for persistent sessions.
    this.persistSession(profile.id, session.provider);
    return profile;
  }

  private persistSession(
    userId: string,
    provider: AuthProvider,
  ): AuthSession {
    const now = new Date().toISOString();
    const session: AuthSession = {
      userId,
      provider,
      accessToken: randomToken(),
      refreshToken: randomToken(),
      expiresAt: sessionExpiresInHours(720),
      createdAt: now,
    };
    writeJson(AUTH_SESSION_KEY, session);
    return session;
  }

  private clearSession(reason: string): void {
    const previous = readJson<AuthSession | null>(AUTH_SESSION_KEY, null);
    removeKey(AUTH_SESSION_KEY);
    if (previous && reason === "expired") {
      domainEventBus.publish({
        id: createEventId(),
        type: "auth.session.expired",
        occurredAt: new Date().toISOString(),
        actorUserId: previous.userId,
        payload: { reason },
      });
    }
  }
}

export const authenticationService = new AuthenticationService();
