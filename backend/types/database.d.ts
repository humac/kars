/**
 * Type definitions for database.js
 *
 * These types provide compile-time checking for database method calls.
 * Update this file when adding/removing database methods.
 */

// ============================================================================
// Entity Types
// ============================================================================

export interface Asset {
  id: number;
  employee_first_name: string;
  employee_last_name: string;
  employee_email: string;
  manager_first_name: string | null;
  manager_last_name: string | null;
  manager_email: string | null;
  manager_id: number | null;
  company: string;
  company_id: number | null;
  asset_type: string;
  make: string | null;
  model: string | null;
  serial_number: string | null;
  asset_tag: string | null;
  status: string;
  notes: string | null;
  created_at: string;
  updated_at: string | null;
}

export interface User {
  id: number;
  email: string;
  password_hash: string;
  name: string | null;
  first_name: string | null;
  last_name: string | null;
  role: 'employee' | 'manager' | 'admin' | 'attestation_coordinator';
  manager_first_name: string | null;
  manager_last_name: string | null;
  manager_email: string | null;
  profile_image: string | null;
  mfa_enabled: number;
  mfa_secret: string | null;
  mfa_backup_codes: string | null;
  oidc_sub: string | null;
  profile_complete: number;
  created_at: string;
  last_login: string | null;
}

export interface Company {
  id: number;
  name: string;
  hubspot_id: string | null;
  created_at: string;
}

export interface AuditLog {
  id: number;
  action: string;
  entity_type: string;
  entity_id: string;
  entity_name: string | null;
  details: string | null;
  user_email: string | null;
  created_at: string;
}

export interface Passkey {
  id: number;
  user_id: number;
  name: string;
  credential_id: string;
  public_key: string;
  counter: number;
  transports: string | null;
  created_at: string;
  last_used_at: string | null;
}

export interface PasswordResetToken {
  id: number;
  user_id: number;
  token: string;
  expires_at: string;
  used: number;
  created_at: string;
}

export interface AttestationCampaign {
  id: number;
  name: string;
  description: string | null;
  start_date: string;
  end_date: string;
  status: string;
  reminder_frequency: string | null;
  created_by: number;
  created_at: string;
  updated_at: string | null;
}

export interface AttestationRecord {
  id: number;
  campaign_id: number;
  user_id: number;
  status: string;
  submitted_at: string | null;
  created_at: string;
  updated_at: string | null;
}

export interface AssetType {
  id: number;
  name: string;
  description: string | null;
  icon: string | null;
  is_active: number;
  sort_order: number;
  created_at: string;
  updated_at: string | null;
}

// ============================================================================
// Database Object Interfaces
// ============================================================================

export interface AssetDb {
  init(): Promise<void>;
  create(asset: Partial<Asset>): Promise<{ id: number }>;
  getAll(): Promise<Asset[]>;
  getById(id: number): Promise<Asset | null>;
  search(filters: Record<string, unknown>): Promise<Asset[]>;
  updateStatus(id: number, status: string, notes?: string): Promise<void>;
  update(id: number, asset: Partial<Asset>): Promise<void>;
  delete(id: number): Promise<void>;
  getByEmployeeEmail(email: string): Promise<Asset[]>;
  getByManagerEmail(email: string): Promise<Asset[]>;
  getRegisteredOwnersByCompanyIds(companyIds: number[]): Promise<Asset[]>;
  linkAssetsToUser(employeeEmail: string, managerFirstName: string, managerLastName: string, managerEmail: string): Promise<void>;
  updateManagerForEmployee(employeeEmail: string, managerFirstName: string, managerLastName: string, managerEmail: string): Promise<void>;
  updateManagerIdForOwner(ownerId: number, managerId: number | null): Promise<void>;
  getByIds(ids: number[]): Promise<Asset[]>;
  bulkUpdateStatus(ids: number[], status: string, notes?: string): Promise<void>;
  bulkDelete(ids: number[]): Promise<void>;
  bulkUpdateManager(ids: number[], managerFirstName: string, managerLastName: string, managerEmail: string): Promise<void>;
  getEmployeeEmailsByManager(managerEmail: string): Promise<string[]>;
  getScopedForUser(user: { role: string; email: string }): Promise<Asset[]>;
  getUnregisteredOwners(): Promise<Array<{ employee_email: string; employee_first_name: string; employee_last_name: string }>>;
  getUnregisteredOwnersByCompanyIds(companyIds: number[]): Promise<Array<{ employee_email: string; employee_first_name: string; employee_last_name: string }>>;
}

export interface UserDb {
  create(user: Partial<User>): Promise<{ id: number }>;
  getByEmail(email: string): Promise<User | null>;
  getById(id: number): Promise<User | null>;
  getAll(): Promise<User[]>;
  getByManagerEmail(managerEmail: string): Promise<User[]>;
  updateRole(id: number, role: string): Promise<void>;
  updateLastLogin(id: number): Promise<void>;
  delete(id: number): Promise<void>;
  updateProfile(id: number, profile: {
    name?: string;
    first_name?: string | null;
    last_name?: string | null;
    manager_first_name?: string | null;
    manager_last_name?: string | null;
    manager_email?: string | null;
    profile_image?: string | null;
  }): Promise<void>;
  updatePassword(id: number, passwordHash: string): Promise<void>;
  getByOIDCSub(oidcSub: string): Promise<User | null>;
  createFromOIDC(userData: Partial<User> & { oidcSub: string }): Promise<{ id: number }>;
  linkOIDC(userId: number, oidcSub: string): Promise<void>;
  enableMFA(userId: number, secret: string, backupCodes: string[]): Promise<void>;
  disableMFA(userId: number): Promise<void>;
  getMFAStatus(userId: number): Promise<{ mfa_enabled: number; mfa_secret: string | null; mfa_backup_codes: string | null } | null>;
  completeProfile(userId: number, managerData: { manager_first_name: string; manager_last_name: string; manager_email: string }): Promise<void>;
  useBackupCode(userId: number, code: string): Promise<boolean>;
  getByEmails(emails: string[]): Promise<User[]>;
  getByRole(role: string): Promise<User[]>;
}

export interface CompanyDb {
  create(company: { name: string }): Promise<{ id: number }>;
  createWithHubSpotId(company: { name: string; hubspot_id: string }): Promise<{ id: number }>;
  getAll(): Promise<Company[]>;
  getById(id: number): Promise<Company | null>;
  getByName(name: string): Promise<Company | null>;
  getByHubSpotId(hubspotId: string): Promise<Company | null>;
  update(id: number, company: Partial<Company>): Promise<void>;
  updateByHubSpotId(hubspotId: string, company: Partial<Company>): Promise<void>;
  setHubSpotId(id: number, hubspotId: string): Promise<void>;
  delete(id: number): Promise<void>;
  hasAssets(companyId: number): Promise<boolean>;
  getAssetCount(companyId: number): Promise<number>;
}

export interface AuditDb {
  log(action: string, entityType: string, entityId: string | number, entityName: string | null, details: unknown, userEmail?: string | null): Promise<void>;
  getAll(options?: { limit?: number; offset?: number; action?: string; entityType?: string }): Promise<AuditLog[]>;
  getByEntity(entityType: string, entityId: string | number): Promise<AuditLog[]>;
  getRecent(limit?: number): Promise<AuditLog[]>;
  getStats(startDate?: string | null, endDate?: string | null): Promise<Record<string, number>>;
}

export interface PasskeyDb {
  listByUser(userId: number): Promise<Passkey[]>;
  getByCredentialId(credentialId: string): Promise<Passkey | null>;
  getById(id: number): Promise<Passkey | null>;
  create(passkey: { userId: number; name: string; credentialId: string; publicKey: string; counter: number; transports?: string }): Promise<{ id: number }>;
  delete(id: number): Promise<void>;
  updateCounter(id: number, counter: number): Promise<void>;
}

export interface PasswordResetTokenDb {
  create(userId: number, token: string, expiresAt: string): Promise<{ id: number }>;
  findByToken(token: string): Promise<PasswordResetToken | null>;
  markAsUsed(tokenId: number): Promise<void>;
  deleteExpired(): Promise<void>;
  deleteByUserId(userId: number): Promise<void>;
}

export interface OidcSettingsDb {
  get(): Promise<Record<string, unknown> | null>;
  update(settings: Record<string, unknown>, userEmail?: string): Promise<void>;
}

export interface BrandingSettingsDb {
  get(): Promise<Record<string, unknown> | null>;
  update(settings: Record<string, unknown>, userEmail?: string): Promise<void>;
  delete(): Promise<void>;
}

export interface PasskeySettingsDb {
  get(): Promise<Record<string, unknown> | null>;
  update(settings: Record<string, unknown>, userEmail?: string): Promise<void>;
}

export interface HubspotSettingsDb {
  get(): Promise<Record<string, unknown> | null>;
  getAccessToken(): Promise<string | null>;
  update(settings: Record<string, unknown>): Promise<void>;
  updateSyncStatus(status: string, companiesSynced: number): Promise<void>;
}

export interface HubspotSyncLogDb {
  log(syncData: Record<string, unknown>): Promise<void>;
  getHistory(limit?: number): Promise<Array<Record<string, unknown>>>;
}

export interface SmtpSettingsDb {
  get(): Promise<Record<string, unknown> | null>;
  getPassword(): Promise<string | null>;
  update(settings: Record<string, unknown>): Promise<void>;
}

export interface SystemSettingsDb {
  get(): Promise<Record<string, unknown> | null>;
  update(settings: Record<string, unknown>, userEmail?: string): Promise<void>;
  clear(field: string, userEmail?: string): Promise<void>;
}

export interface AssetTypeDb {
  getAll(): Promise<AssetType[]>;
  getActive(): Promise<AssetType[]>;
  getById(id: number): Promise<AssetType | null>;
  getByName(name: string): Promise<AssetType | null>;
  create(assetType: Partial<AssetType>): Promise<{ id: number }>;
  update(id: number, assetType: Partial<AssetType>): Promise<void>;
  delete(id: number): Promise<void>;
  getUsageCount(id: number): Promise<number>;
  reorder(orderedIds: number[]): Promise<void>;
}

export interface EmailTemplateDb {
  getAll(): Promise<Array<Record<string, unknown>>>;
  getByKey(key: string): Promise<Record<string, unknown> | null>;
  update(key: string, data: Record<string, unknown>, updatedBy?: string | null): Promise<void>;
  reset(key: string): Promise<void>;
}

export interface AttestationCampaignDb {
  create(campaign: Partial<AttestationCampaign>): Promise<{ id: number }>;
  getAll(): Promise<AttestationCampaign[]>;
  getById(id: number): Promise<AttestationCampaign | null>;
  update(id: number, updates: Partial<AttestationCampaign>): Promise<void>;
  delete(id: number): Promise<void>;
}

export interface AttestationRecordDb {
  create(record: Partial<AttestationRecord>): Promise<{ id: number }>;
  getByCampaignId(campaignId: number): Promise<AttestationRecord[]>;
  getById(id: number): Promise<AttestationRecord | null>;
  getByUserAndCampaign(userId: number, campaignId: number): Promise<AttestationRecord | null>;
  getByUserId(userId: number): Promise<AttestationRecord[]>;
  update(id: number, updates: Partial<AttestationRecord>): Promise<void>;
}

export interface AttestationAssetDb {
  create(asset: Record<string, unknown>): Promise<{ id: number }>;
  getByRecordId(recordId: number): Promise<Array<Record<string, unknown>>>;
  update(id: number, updates: Record<string, unknown>): Promise<void>;
}

export interface AttestationNewAssetDb {
  create(asset: Record<string, unknown>): Promise<{ id: number }>;
  getByRecordId(recordId: number): Promise<Array<Record<string, unknown>>>;
}

export interface AttestationPendingInviteDb {
  create(invite: Record<string, unknown>): Promise<{ id: number }>;
  getById(id: number): Promise<Record<string, unknown> | null>;
  getByToken(token: string): Promise<Record<string, unknown> | null>;
  getByEmail(email: string): Promise<Array<Record<string, unknown>>>;
  getByCampaignId(campaignId: number): Promise<Array<Record<string, unknown>>>;
  getActiveByEmail(email: string): Promise<Array<Record<string, unknown>>>;
  update(id: number, updates: Record<string, unknown>): Promise<void>;
  delete(id: number): Promise<void>;
}

// ============================================================================
// Exported Database Objects
// ============================================================================

export const assetDb: AssetDb;
export const userDb: UserDb;
export const companyDb: CompanyDb;
export const auditDb: AuditDb;
export const passkeyDb: PasskeyDb;
export const passwordResetTokenDb: PasswordResetTokenDb;
export const oidcSettingsDb: OidcSettingsDb;
export const brandingSettingsDb: BrandingSettingsDb;
export const passkeySettingsDb: PasskeySettingsDb;
export const hubspotSettingsDb: HubspotSettingsDb;
export const hubspotSyncLogDb: HubspotSyncLogDb;
export const smtpSettingsDb: SmtpSettingsDb;
export const systemSettingsDb: SystemSettingsDb;
export const assetTypeDb: AssetTypeDb;
export const emailTemplateDb: EmailTemplateDb;
export const attestationCampaignDb: AttestationCampaignDb;
export const attestationRecordDb: AttestationRecordDb;
export const attestationAssetDb: AttestationAssetDb;
export const attestationNewAssetDb: AttestationNewAssetDb;
export const attestationPendingInviteDb: AttestationPendingInviteDb;

// ============================================================================
// Utility Exports
// ============================================================================

export const databaseEngine: string;
export const databaseSettings: {
  engine: string;
  postgresUrl: string;
  get(): { engine: string; postgresUrl: string };
  update(settings: { engine?: string; postgresUrl?: string }): Promise<void>;
};

export function syncAssetOwnership(email: string): Promise<void>;
export function importSqliteDatabase(filePath: string): Promise<{ success: boolean; error?: string }>;
