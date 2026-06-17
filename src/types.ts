export interface WelcomeSettings {
  enabled: boolean;
  welcomeChannelId: string;
  goodbyeChannelId: string;
  welcomeEmbedTitle: string;
  welcomeEmbedDesc: string;
  goodbyeEmbedTitle: string;
  goodbyeEmbedDesc: string;
  backgroundUrl: string;
}

export interface TicketSettings {
  enabled: boolean;
  categoryId: string;
  supportRoleId: string;
  ticketChannelId: string;
  buttonLabel: string;
  embedTitle: string;
  embedColor: string;
  embedDescription: string;
  transcriptOnClose: boolean;
  notifyManagement: boolean;
}

export interface AutoModSettings {
  enabled: boolean;
  blacklistWords: string[];
  blockInvitations: boolean;
  blockExternalLinks: boolean;
  loggingChannelId: string;
  bypassRoleIds: string[];
}

export interface AntiNukeSettings {
  enabled: boolean;
  maxChannelDeletions: number;
  maxRoleDeletions: number;
  timeWindowSeconds: number;
  quarantineRoleId: string;
  autoDemoteTarget: boolean;
}

export interface RoleProduct {
  id: string;
  roleName: string;
  roleId: string;
  price: number;
  description: string;
}

export interface EconomySettings {
  enabled: boolean;
  currencySymbol: string;
  dailyReward: number;
  workMinReward: number;
  workMaxReward: number;
  shopItems: RoleProduct[];
}

export interface AutoMessageConfig {
  id: string;
  enabled: boolean;
  channelId: string;
  intervalMinutes: number;
  message: string;
}

export interface SystemLog {
  id: string;
  timestamp: string;
  bot: "NIGHTSHARK" | "ARCHITECT" | "SYSTEM";
  level: "INFO" | "WARNING" | "SECURITY";
  message: string;
}

export interface AccessCode {
  id: string;
  code: string;
  expiresAt: string | null; // ISO string or null for unlimited
  maxUses: number | null; // null for unlimited
  uses: number;
  createdAt: string;
  targetBot?: "nightshark" | "architect" | "both";
}

export interface WebTeamAccount {
  username: string;
  role: "ADMIN" | "SUB_ADMIN" | "SUPPORTER";
  permissions: string[];
  createdAt: string;
}

export interface NightSharkConfig {
  welcome: WelcomeSettings;
  tickets: TicketSettings;
  automod: AutoModSettings;
  antinuke: AntiNukeSettings;
  economy: EconomySettings;
  autoMessages: AutoMessageConfig[];
}

// Struct for Discord Architect's AI and Manual schemas
export interface DiscordChannel {
  id: string;
  name: string;
  type: "TEXT" | "VOICE" | "STAGE" | "ANNOUNCEMENT";
  categoryName?: string;
  rolesRequired?: string[];
  privacyCritical?: boolean;
  privacyReason?: string;
}

export interface DiscordServerMap {
  id: string;
  name: string;
  categories: {
    name: string;
    channels: DiscordChannel[];
  }[];
  roles: {
    name: string;
    color: string;
    permissions: string[];
  }[];
}

export interface GeneratorPromptSubmission {
  prompt: string;
  serverId: string;
}

export interface BlacklistedServer {
  id: string;
  serverId: string;
  reason: string;
  createdAt: string;
}

export type ActiveTab = "home" | "nightshark" | "architect";

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

