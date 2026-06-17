import { 
  NightSharkConfig,
  AccessCode,
  WebTeamAccount,
  SystemLog,
  DiscordServerMap,
  BlacklistedServer
} from "./types.js";

const getHeaders = (token?: string) => {
  const headers: Record<string, string> = {
    "Content-Type": "application/json"
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
};

export const api = {
  // Authentication
  async login(username: string, password: string) {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({ username, password })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Login fehlgeschlagen.");
    }
    return res.json();
  },

  async verifyCode(code: string, targetBot?: string) {
    const res = await fetch("/api/auth/verify-code", {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({ code, targetBot })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Gibt einen gültigen Schlüssel an.");
    }
    return res.json();
  },

  async checkSession(sessionToken: string, targetBot?: string): Promise<boolean> {
    try {
      const res = await fetch("/api/auth/check-session", {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({ sessionToken, targetBot })
      });
      if (res.ok) {
        const data = await res.json();
        return !!data.valid;
      }
    } catch (e) {
      // Ignored
    }
    return false;
  },

  // Admin access codes
  async getAccessCodes(token: string): Promise<AccessCode[]> {
    const res = await fetch("/api/admin/codes", {
      headers: getHeaders(token)
    });
    if (!res.ok) throw new Error("Kein Admin-Zugriff.");
    const data = await res.json();
    return data.codes;
  },

  async generateAccessCode(token: string, durationHours: number | null, maxUses: number | null, targetBot?: string) {
    const res = await fetch("/api/admin/codes/generate", {
      method: "POST",
      headers: getHeaders(token),
      body: JSON.stringify({ durationHours, maxUses, targetBot })
    });
    if (!res.ok) throw new Error("Generierung gescheitert.");
    return res.json();
  },

  async deleteAccessCode(token: string, id: string) {
    const res = await fetch(`/api/admin/codes/${id}`, {
      method: "DELETE",
      headers: getHeaders(token)
    });
    if (!res.ok) throw new Error("Löschen gescheitert.");
    return res.json();
  },

  // Web Team Admin
  async getTeam(token: string): Promise<WebTeamAccount[]> {
    const res = await fetch("/api/admin/team", {
      headers: getHeaders(token)
    });
    if (!res.ok) throw new Error("Zutritt verweigert.");
    const data = await res.json();
    return data.team;
  },

  async createTeamMember(token: string, username: string, role: string, permissions: string[]) {
    const res = await fetch("/api/admin/team/create", {
      method: "POST",
      headers: getHeaders(token),
      body: JSON.stringify({ username, role, permissions })
    });
    if (!res.ok) throw new Error("Mitgliedserstellung gescheitert.");
    return res.json();
  },

  // Logs and System telemetry
  async getLogs(): Promise<SystemLog[]> {
    const res = await fetch("/api/system/logs");
    const data = await res.json();
    return data.logs;
  },

  async clearLogs(): Promise<boolean> {
    const res = await fetch("/api/system/logs/clear", { method: "POST" });
    return res.ok;
  },

  async getStats() {
    const res = await fetch("/api/system/stats");
    const data = await res.json();
    return data.metrics;
  },

  // NightShark Module Configs
  async getNightSharkConfig(): Promise<NightSharkConfig> {
    const res = await fetch("/api/bot/nightshark/config");
    const data = await res.json();
    return data.config;
  },

  async saveNightSharkConfig(config: NightSharkConfig, serverId?: string, sessionToken?: string) {
    const res = await fetch("/api/bot/nightshark/config", {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({ ...config, serverId, sessionToken })
    });
    return res.json();
  },

  // Discord Architect AI builder
  async generateServerLayout(prompt: string, serverId: string, sessionToken: string) {
    const res = await fetch("/api/bot/architect/generate-ai", {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({ prompt, serverId, sessionToken })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Fehler bei der Synthese.");
    }
    return res.json();
  },

  async getServerLayout(serverId: string) {
    const res = await fetch(`/api/bot/architect/layouts/${serverId}`);
    const data = await res.json();
    return data.layout;
  },

  async buildManualChannel(serverId: string, categoryName: string, channelName: string, channelType: string, sessionToken: string) {
    const res = await fetch("/api/bot/architect/build-manual", {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({ serverId, categoryName, channelName, channelType, sessionToken })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Fehler beim manuellen Erstellen.");
    }
    return res.json();
  },

  async applyServerLayout(serverId: string, sessionToken: string, deleteFirst?: boolean) {
    const res = await fetch("/api/bot/architect/apply-guild", {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({ serverId, sessionToken, deleteFirst })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Fehler beim Aufspielen der Strukturen.");
    }
    return res.json();
  },

  async resetServerLayout(serverId: string, sessionToken: string) {
    const res = await fetch("/api/bot/architect/reset-layout", {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({ serverId, sessionToken })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Fehler beim Zurücksetzen des Layouts.");
    }
    return res.json();
  },

  async saveServerLayout(serverId: string, layout: DiscordServerMap, sessionToken: string) {
    const res = await fetch("/api/bot/architect/save-layout", {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({ serverId, layout, sessionToken })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Fehler beim Speichern des Layouts.");
    }
    return res.json();
  },

  async getBlacklist(token: string): Promise<BlacklistedServer[]> {
    const res = await fetch("/api/admin/blacklist", {
      headers: getHeaders(token)
    });
    if (!res.ok) throw new Error("Keine Berechtigung für Blacklist.");
    const data = await res.json();
    return data.blacklist;
  },

  async blacklistServer(token: string, serverId: string, reason: string): Promise<any> {
    const res = await fetch("/api/admin/blacklist", {
      method: "POST",
      headers: getHeaders(token),
      body: JSON.stringify({ serverId, reason })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Konnte Server nicht auf Blacklist setzen.");
    }
    return res.json();
  },

  async deleteFromBlacklist(token: string, serverId: string): Promise<any> {
    const res = await fetch(`/api/admin/blacklist/${serverId}`, {
      method: "DELETE",
      headers: getHeaders(token)
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Konnte Server nicht von Blacklist entfernen.");
    }
    return res.json();
  },

  async getActiveThreat(serverId: string) {
    const res = await fetch(`/api/antinuke/threats/${serverId}`);
    if (!res.ok) throw new Error("Konnte Bedrohungen nicht abrufen.");
    const data = await res.json();
    return data.activeThreat;
  },

  async simulateThreat(serverId: string, type?: string, sessionToken?: string) {
    const res = await fetch("/api/antinuke/threats/simulate", {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({ serverId, type, sessionToken })
    });
    if (!res.ok) throw new Error("Simulation gescheitert.");
    return res.json();
  },

  async resolveThreat(serverId: string, sessionToken?: string) {
    const res = await fetch(`/api/antinuke/threats/${serverId}/resolve`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({ sessionToken })
    });
    if (!res.ok) throw new Error("Fehler beim Beheben der Bedrohung.");
    return res.json();
  }
};
