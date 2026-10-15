import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { randomBytes, createHash } from "node:crypto";
import { userRepository } from "../repositories/user.repository.js";
import { authRepository } from "../repositories/auth.repository.js";
import { emailService } from "./email.service.js";
import { generateUniqueUsername } from "./profile.service.js";
import { AppError, UnauthorizedError } from "../utils/errors.js";
import { logger } from "../utils/logger.js";
import type {
  SignupRequest,
  SignupResponse,
  LoginRequest,
  AuthenticatedUser,
  ForgotPasswordResponse,
  ResetPasswordResponse,
  VerifyEmailResponse,
  RequestedRole,
  UserStatus,
} from "@app/shared-types";
import type { User, Prisma } from "@prisma/client";

// ============================================================================
// Config — all values read here MUST already be documented in ENVIRONMENT.md.
// ============================================================================

const BCRYPT_SALT_ROUNDS = 12;

// Verification / password-reset links are self-verifying JWTs rather than a
// DB-backed token table — see DECISIONS.md D-011 for why no schema change
// was needed. Both purposes are signed with JWT_ACCESS_SECRET (the only
// general-purpose signing secret ENVIRONMENT.md documents outside of the
// refresh-token secret, which is reserved for session refresh tokens) and
// disambiguated via a `purpose` claim so one can never be used as the other.
const EMAIL_VERIFICATION_TTL = "24h";
const PASSWORD_RESET_TTL = "1h";

function getAccessSecret(): string {
  const secret = process.env.JWT_ACCESS_SECRET;
  if (!secret) {
    throw new Error("JWT_ACCESS_SECRET is not set (see ENVIRONMENT.md)");
  }
  // Fail safely in production: default/dev placeholders must never sign
  // real tokens (spec §2 — fail safely when production secrets are invalid)
  if (
    process.env.NODE_ENV === "production" &&
    (secret.includes("dev-") || secret.includes("change-me") || secret.length < 32)
  ) {
    throw new Error(
      "JWT_ACCESS_SECRET is a development placeholder — set a strong production secret (see ENVIRONMENT.md)",
    );
  }
  return secret;
}

function getRefreshSecret(): string {
  const secret = process.env.JWT_REFRESH_SECRET;
  if (!secret) {
    throw new Error("JWT_REFRESH_SECRET is not set (see ENVIRONMENT.md)");
  }
  return secret;
}

function getAccessTtl(): string {
  return process.env.JWT_ACCESS_TTL || "15m";
}

function getRefreshTtl(): string {
  return process.env.JWT_REFRESH_TTL || "7d";
}

function getRefreshTtlMs(): number {
  const raw = getRefreshTtl();
  const match = /^(\d+)([smhd])$/.exec(raw.trim());
  if (!match) {
    // Fall back to the documented default (7 days) if the env value is malformed.
    return 7 * 24 * 60 * 60 * 1000;
  }
  const value = Number(match[1]);
  const unitMs: Record<string, number> = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  };
  return value * (unitMs[match[2] as string] ?? unitMs.d!);
}

function getUniversityDomains(): string[] {
  const raw = process.env.UNIVERSITY_EMAIL_DOMAINS;
  if (!raw) return [];
  return raw
    .split(",")
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean);
}

// ============================================================================
// Password hashing
// ============================================================================

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_SALT_ROUNDS);
}

export async function comparePassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

// ============================================================================
// Access tokens (JWT, 15 min per ARCHITECTURE.md §3)
// ============================================================================

export interface AccessTokenPayload {
  sub: string;
  purpose: "access";
}

export function signAccessToken(user: Pick<User, "id">): string {
  const payload: AccessTokenPayload = { sub: user.id, purpose: "access" };
  return jwt.sign(payload, getAccessSecret(), { expiresIn: getAccessTtl() } as jwt.SignOptions);
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  const decoded = jwt.verify(token, getAccessSecret()) as AccessTokenPayload;
  if (decoded.purpose !== "access") {
    throw new Error("Token is not an access token");
  }
  return decoded;
}

// ============================================================================
// Refresh tokens (JWT, 7 day, httpOnly cookie, hashed at rest per
// ARCHITECTURE.md §3 for revocation support). Signed with JWT_REFRESH_SECRET
// — distinct from the access-token secret, per ENVIRONMENT.md. Verifying the
// JWT signature/expiry catches garbage/expired tokens cheaply before ever
// touching the database; the DB hash lookup is what makes a still-unexpired
// token revocable (logout, rotation, password reset).
// ============================================================================

interface RefreshTokenPayload {
  sub: string;
  jti: string;
  purpose: "refresh";
}

function signRefreshToken(userId: string): string {
  const payload: RefreshTokenPayload = {
    sub: userId,
    jti: randomBytes(16).toString("hex"),
    purpose: "refresh",
  };
  return jwt.sign(payload, getRefreshSecret(), { expiresIn: getRefreshTtl() } as jwt.SignOptions);
}

function verifyRefreshToken(token: string): RefreshTokenPayload {
  const decoded = jwt.verify(token, getRefreshSecret()) as RefreshTokenPayload;
  if (decoded.purpose !== "refresh") {
    throw new Error("Token is not a refresh token");
  }
  return decoded;
}

export function hashOpaqueToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

// ============================================================================
// Purpose-scoped JWTs: email verification + password reset
// ============================================================================

interface PurposeTokenPayload {
  sub: string;
  purpose: "email_verification" | "password_reset";
  /** Only present for password_reset — see resetPassword() below. */
  pwh?: string;
}

function signPurposeToken(
  userId: string,
  purpose: PurposeTokenPayload["purpose"],
  ttl: string,
  extra?: Partial<PurposeTokenPayload>,
): string {
  const payload: PurposeTokenPayload = { sub: userId, purpose, ...extra };
  return jwt.sign(payload, getAccessSecret(), { expiresIn: ttl } as jwt.SignOptions);
}

function verifyPurposeToken(
  token: string,
  purpose: PurposeTokenPayload["purpose"],
): PurposeTokenPayload {
  let decoded: PurposeTokenPayload;
  try {
    decoded = jwt.verify(token, getAccessSecret()) as PurposeTokenPayload;
  } catch {
    throw new AppError("Invalid or expired token", 400, "BAD_REQUEST");
  }
  if (decoded.purpose !== purpose) {
    throw new AppError("Invalid or expired token", 400, "BAD_REQUEST");
  }
  return decoded;
}

/**
 * A short fingerprint of the current password hash. Embedding it in a
 * password-reset token means the token is automatically invalidated the
 * moment the password changes (whether via this same reset or any other
 * means) — without needing a revocable token row in the database.
 */
function fingerprintPasswordHash(passwordHash: string): string {
  return createHash("sha256").update(passwordHash).digest("hex").slice(0, 16);
}

// ============================================================================
// Response shaping
// ============================================================================

function toAuthenticatedUser(user: User): AuthenticatedUser {
  return {
    id: user.id,
    email: user.email,
    // The schema/API contract has a single `role` field; the authoritative
    // *privileged* role check still lives in requireRole (D-003) and reads
    // the verifications table, never this field alone. See DECISIONS.md D-011.
    role: user.requestedRole as AuthenticatedUser["role"],
    status: user.status as UserStatus,
  };
}

// ============================================================================
// Public service functions — one per API_CONTRACT.md §1 endpoint
// ============================================================================

/**
 * Every signup must produce the role-appropriate 1:1 profile row (per
 * SignupRequestSchema's required `fullName` and the shape seed.ts already
 * establishes for each role) plus an always-present `privacySettings` row
 * (all-defaults, matching seed.ts's `{ create: {} }` for every role).
 *
 * `club_rep` and `startup_member` have no profile model in the schema
 * (only StudentProfile/ProfessorProfile/ResearcherProfile exist) — those
 * roles associate via Organization/Membership instead, so no profile is
 * created for them here; `fullName` is still validated at the wire but has
 * nowhere to be stored for these two roles in this schema.
 *
 * `researcherType` isn't collected at signup (SignupRequestSchema has no
 * field for it); defaults to "research_assistant", the same default
 * profile.service.ts already uses when a caller omits it on profile update.
 */
function buildRoleProfileCreateData(
  requestedRole: RequestedRole,
  fullName: string,
): Pick<
  Prisma.UserCreateInput,
  "studentProfile" | "professorProfile" | "researcherProfile" | "professionalProfile"
> {
  switch (requestedRole) {
    case "student":
    case "alumni":
      return { studentProfile: { create: { fullName } } };
    case "professor":
      return { professorProfile: { create: { fullName } } };
    case "researcher":
      return {
        researcherProfile: { create: { fullName, researcherType: "research_assistant" } },
      };
    case "professional":
      return { professionalProfile: { create: { fullName } } };
    case "club_rep":
    case "startup_member":
      return {};
  }
}

export async function signup(input: SignupRequest): Promise<SignupResponse> {
  const existing = await userRepository.findByEmail(input.email.toLowerCase());
  if (existing) {
    throw new AppError("An account with this email already exists", 409, "EMAIL_TAKEN");
  }

  const passwordHash = await hashPassword(input.password);
  const domain = input.email.split("@")[1]?.toLowerCase();
  const username = await generateUniqueUsername(input.email);

  const user = await userRepository.create({
    email: input.email.toLowerCase(),
    username,
    passwordHash,
    requestedRole: input.requestedRole,
    status: "pending_verification",
    universityDomain: domain,
    ...buildRoleProfileCreateData(input.requestedRole, input.fullName),
    privacySettings: { create: {} },
  });

  const verificationToken = signPurposeToken(user.id, "email_verification", EMAIL_VERIFICATION_TTL);

  try {
    await emailService.sendVerificationEmail(user.email, verificationToken);
  } catch (err: unknown) {
    // Don't fail signup if the transactional email provider is unavailable —
    // the user can request another verification email later. Log loudly.
    logger.error(err, "Failed to send verification email after signup");
  }

  return { userId: user.id, status: "pending_verification" };
}

export async function verifyEmail(token: string): Promise<VerifyEmailResponse> {
  const payload = verifyPurposeToken(token, "email_verification");
  const user = await userRepository.findById(payload.sub);
  if (!user) {
    throw new AppError("Invalid or expired verification token", 400, "BAD_REQUEST");
  }

  const universityDomains = getUniversityDomains();
  const isUniversityVerified =
    universityDomains.length > 0 &&
    !!user.universityDomain &&
    universityDomains.includes(user.universityDomain.toLowerCase());

  await userRepository.update(user.id, {
    status: user.status === "pending_verification" ? "active" : user.status,
    isUniversityVerified,
  });

  return { verified: true, isUniversityVerified };
}

export interface LoginResult {
  accessToken: string;
  refreshToken: string;
  refreshTokenMaxAgeMs: number;
  user: AuthenticatedUser;
}

export async function login(input: LoginRequest): Promise<LoginResult> {
  const user = await userRepository.findByEmail(input.email.toLowerCase());
  if (!user) {
    throw new AppError("Invalid email or password", 401, "INVALID_CREDENTIALS");
  }

  const valid = await comparePassword(input.password, user.passwordHash);
  if (!valid) {
    throw new AppError("Invalid email or password", 401, "INVALID_CREDENTIALS");
  }

  if (user.status === "suspended" || user.status === "banned") {
    throw new AppError("This account has been suspended", 403, "ACCOUNT_SUSPENDED");
  }

  const accessToken = signAccessToken(user);
  const refreshToken = signRefreshToken(user.id);
  const refreshTokenMaxAgeMs = getRefreshTtlMs();

  await authRepository.createRefreshToken({
    user: { connect: { id: user.id } },
    tokenHash: hashOpaqueToken(refreshToken),
    expiresAt: new Date(Date.now() + refreshTokenMaxAgeMs),
  });

  return { accessToken, refreshToken, refreshTokenMaxAgeMs, user: toAuthenticatedUser(user) };
}

export interface RefreshResult {
  accessToken: string;
  refreshToken: string;
  refreshTokenMaxAgeMs: number;
}

export async function refreshTokens(rawRefreshToken: string | undefined): Promise<RefreshResult> {
  if (!rawRefreshToken) {
    throw new UnauthorizedError("Missing refresh token");
  }

  try {
    verifyRefreshToken(rawRefreshToken);
  } catch {
    throw new UnauthorizedError("Invalid or expired refresh token");
  }

  const tokenHash = hashOpaqueToken(rawRefreshToken);
  const existing = await authRepository.findRefreshToken(tokenHash);
  if (!existing) {
    throw new UnauthorizedError("Invalid or expired refresh token");
  }

  // Rotation: revoke the presented token, issue a brand new pair.
  await authRepository.revokeRefreshToken(existing.id);

  if (existing.user.status === "suspended" || existing.user.status === "banned") {
    throw new AppError("This account has been suspended", 403, "ACCOUNT_SUSPENDED");
  }

  const accessToken = signAccessToken(existing.user);
  const refreshToken = signRefreshToken(existing.user.id);
  const refreshTokenMaxAgeMs = getRefreshTtlMs();

  await authRepository.createRefreshToken({
    user: { connect: { id: existing.user.id } },
    tokenHash: hashOpaqueToken(refreshToken),
    expiresAt: new Date(Date.now() + refreshTokenMaxAgeMs),
  });

  return { accessToken, refreshToken, refreshTokenMaxAgeMs };
}

export async function logout(rawRefreshToken: string | undefined): Promise<void> {
  if (!rawRefreshToken) return;
  const tokenHash = hashOpaqueToken(rawRefreshToken);
  const existing = await authRepository.findRefreshToken(tokenHash);
  if (existing) {
    await authRepository.revokeRefreshToken(existing.id);
  }
}

export async function forgotPassword(email: string): Promise<ForgotPasswordResponse> {
  const user = await userRepository.findByEmail(email.toLowerCase());
  // Always return { sent: true } regardless of whether the account exists —
  // API_CONTRACT.md §1 requires this endpoint to never reveal account
  // existence.
  if (user) {
    const token = signPurposeToken(user.id, "password_reset", PASSWORD_RESET_TTL, {
      pwh: fingerprintPasswordHash(user.passwordHash),
    });
    try {
      await emailService.sendPasswordResetEmail(user.email, token);
    } catch (err: unknown) {
      logger.error(err, "Failed to send password reset email");
    }
  }
  return { sent: true };
}

export async function resetPassword(
  token: string,
  newPassword: string,
): Promise<ResetPasswordResponse> {
  const payload = verifyPurposeToken(token, "password_reset");
  const user = await userRepository.findById(payload.sub);
  if (!user) {
    // Token's signature/purpose/expiry are all valid (verifyPurposeToken
    // above already passed) but the subject no longer exists or the
    // embedded fingerprint is stale — this is an authentication failure on
    // an otherwise well-formed request, not a malformed request, so 401
    // (matches the identical reasoning used for refresh-token reuse above).
    throw new UnauthorizedError("Invalid or expired reset token");
  }

  const currentFingerprint = fingerprintPasswordHash(user.passwordHash);
  if (payload.pwh !== currentFingerprint) {
    // Token was already used (or the password already changed since) — the
    // embedded fingerprint no longer matches, so it's treated as invalid.
    throw new UnauthorizedError("Invalid or expired reset token");
  }

  const passwordHash = await hashPassword(newPassword);
  await userRepository.update(user.id, { passwordHash });

  // Resetting the password invalidates all existing sessions.
  await authRepository.revokeAllUserRefreshTokens(user.id);

  return { reset: true };
}

export function createEmailVerificationToken(userId: string): string {
  return signPurposeToken(userId, "email_verification", EMAIL_VERIFICATION_TTL);
}

export function createPasswordResetToken(userId: string, passwordHash: string): string {
  return signPurposeToken(userId, "password_reset", PASSWORD_RESET_TTL, {
    pwh: fingerprintPasswordHash(passwordHash),
  });
}

export const authService = {
  signup,
  verifyEmail,
  login,
  refreshTokens,
  logout,
  forgotPassword,
  resetPassword,
  createEmailVerificationToken,
  createPasswordResetToken,
};

export type { RequestedRole };
