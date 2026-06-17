import { useState, useEffect } from "react";
import { api } from "../api";
import { NightSharkConfig, RoleProduct, AutoMessageConfig } from "../types";
import { 
  Settings, Save, Ticket, UserPlus, ShieldAlert, BadgeCent, 
  MessageSquare, Sliders, Play, Plus, Trash2, CheckCircle2,
  Lock, KeyRound
} from "lucide-react";

interface NightSharkDashboardProps {
  serverId: string;
  sessionToken: string;
  onSessionVerified: (token: string) => void;
}

export default function NightSharkDashboard({ 
  serverId,
  sessionToken,
  onSessionVerified 
}: NightSharkDashboardProps) {
  const [activeSubTab, setActiveSubTab] = useState<"tickets" | "welcome" | "automod" | "antinuke" | "economy" | "automessages">("tickets");
  const [passcode, setPasscode] = useState("");
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [config, setConfig] = useState<NightSharkConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Temp state for additions
  const [newWord, setNewWord] = useState("");
  const [newShopRoleName, setNewShopRoleName] = useState("");
  const [newShopRoleId, setNewShopRoleId] = useState("");
  const [newShopPrice, setNewShopPrice] = useState(100);
  const [newShopDesc, setNewShopDesc] = useState("");

  const [newMsgChannel, setNewMsgChannel] = useState("announcements");
  const [newMsgInterval, setNewMsgInterval] = useState(15);
  const [newMsgContent, setNewMsgContent] = useState("");

  const [activeThreat, setActiveThreat] = useState<any>(null);

  const handleApiError = (err: any, fallback: string) => {
    const msg = err.message || fallback;
    const lower = msg.toLowerCase();
    if (
      lower.includes("gesperrt") || 
      lower.includes("gültiger code") || 
      lower.includes("session") || 
      lower.includes("abgelaufen") || 
      lower.includes("sperre") || 
      lower.includes("schlüssel")
    ) {
      setIsUnlocked(false);
      onSessionVerified("");
      setErrorMsg(`Zugriff gesperrt: ${msg}`);
    } else {
      setErrorMsg(msg);
    }
  };

  const handleVerifyPasscode = async () => {
    setErrorMsg("");
    setSuccessMsg("");
    if (!passcode.trim()) {
      setErrorMsg("Ein Sicherheitsschlüssel ist zwingend erforderlich.");
      return;
    }
    try {
      const res = await api.verifyCode(passcode, "nightshark");
      if (res.success && res.sessionToken) {
        onSessionVerified(res.sessionToken);
        setIsUnlocked(true);
        setSuccessMsg("Sitzungsauthentifizierung erfolgreich abgeschlossen.");
      }
    } catch (err: any) {
      setErrorMsg("Zugriffsschranke gesperrt: " + err.message);
    }
  };

  // Validate session token on mount & verify periodically in the background
  useEffect(() => {
    const checkExistingSession = async () => {
      if (sessionToken) {
        const valid = await api.checkSession(sessionToken, "nightshark");
        if (valid) {
          setIsUnlocked(true);
        } else {
          setIsUnlocked(false);
          onSessionVerified("");
        }
      } else {
        setIsUnlocked(false);
      }
    };
    checkExistingSession();

    const interval = setInterval(async () => {
      if (sessionToken && isUnlocked) {
        const valid = await api.checkSession(sessionToken, "nightshark");
        if (!valid) {
          setIsUnlocked(false);
          onSessionVerified("");
          setErrorMsg("Sitzung beendet: Der verwendete Zugriffscode wurde gelöscht oder deaktivert.");
        }
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [sessionToken, serverId, isUnlocked]);

  useEffect(() => {
    if (!isUnlocked) return;
    const fetchConfig = async () => {
      try {
        setLoading(true);
        const data = await api.getNightSharkConfig();
        setConfig(data);
      } catch (err: any) {
        setErrorMsg("Laden der Bot-Konfiguration fehlgeschlagen: " + err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchConfig();
  }, [serverId, isUnlocked]);

  useEffect(() => {
    if (!isUnlocked) return;
    if (activeSubTab !== "antinuke") return;

    const checkThreat = async () => {
      try {
        const threat = await api.getActiveThreat(serverId);
        setActiveThreat(threat);
      } catch (err) {
        // fail silently
      }
    };

    checkThreat();
    const interval = setInterval(checkThreat, 4000);
    return () => clearInterval(interval);
  }, [activeSubTab, serverId, isUnlocked]);

  const handleSimulateThreat = async (type: string) => {
    setErrorMsg("");
    setSuccessMsg("");
    try {
      const res = await api.simulateThreat(serverId, type, sessionToken);
      if (res.success) {
        setActiveThreat(res.activeThreat);
        setSuccessMsg("🚨 Einbruchssimulation erfolgreich scharf geschaltet!");
        setTimeout(() => setSuccessMsg(""), 4000);
      }
    } catch (err: any) {
      handleApiError(err, "Konnte Simulation nicht starten.");
    }
  };

  const handleResolveThreat = async () => {
    setErrorMsg("");
    setSuccessMsg("");
    try {
      await api.resolveThreat(serverId, sessionToken);
      setActiveThreat(null);
      setSuccessMsg("🛡️ Server-Bedrohungszustand manuell aufgehoben (System beruhigt).");
      setTimeout(() => setSuccessMsg(""), 4000);
    } catch (err: any) {
      handleApiError(err, "Konnte Bedrohungszustand nicht aufheben.");
    }
  };

  const handleSave = async (updatedConfig: NightSharkConfig) => {
    setErrorMsg("");
    setSuccessMsg("");
    try {
      const res = await api.saveNightSharkConfig(updatedConfig, serverId, sessionToken);
      if (res.success) {
        setConfig(res.config);
        setSuccessMsg("Modulkonfiguration erfolgreich verschlüsselt und synchronisiert.");
        setTimeout(() => setSuccessMsg(""), 3000);
      }
    } catch (err: any) {
      handleApiError(err, "Synchronisationsfehler.");
    }
  };

  // 1. LOCKED VIEW
  if (!isUnlocked) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-4 text-center max-w-md mx-auto animate-fade-in" id="locked-nightshark">
        <div className="w-16 h-16 rounded-full border border-[#333333] flex items-center justify-center bg-[#070707] mb-6">
          <Lock className="w-6 h-6 text-[#999999]" />
        </div>
        <h2 className="text-lg font-bold uppercase tracking-widest text-white mb-2">Sie haben keinen Zugriff</h2>
        <p className="text-xs text-[#666666] uppercase tracking-wide mb-6">Bitte fragen Sie nach dem Zugriff.</p>
        
        {errorMsg && (
          <div className="w-full p-3 bg-black border border-[#ff3b30] text-[#ff3b30] text-[10px] font-mono uppercase tracking-wider mb-4 text-left">
            ⚠️ ALARM: {errorMsg}
          </div>
        )}

        {successMsg && (
          <div className="w-full p-3 bg-black border border-white text-white text-[10px] font-mono uppercase tracking-wider mb-4 text-left">
            {successMsg}
          </div>
        )}

        <div className="w-full flex">
          <input
            type="password"
            value={passcode}
            onChange={(e) => setPasscode(e.target.value)}
            className="flex-1 bg-black border border-[#333333] p-3 text-xs text-center text-white font-mono focus:border-white outline-none placeholder-stone-700"
            placeholder="ACCESS-KEY EINGEBEN"
            onKeyDown={(e) => e.key === "Enter" && handleVerifyPasscode()}
          />
          <button
            onClick={handleVerifyPasscode}
            className="px-4 bg-white text-black hover:bg-black hover:text-white border border-transparent hover:border-white transition-all text-xs font-bold uppercase tracking-widest cursor-pointer"
          >
            Sperre Lösen
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-12 text-center text-xs text-[#666666] font-mono uppercase tracking-widest animate-pulse">
        Lese verschlüsselte Parameter ein...
      </div>
    );
  }

  if (!config) {
    return (
      <div className="p-8 text-center text-xs text-[#ff3b30] font-mono uppercase border border-[#ff3b30]">
        Fehler: Systemkonfiguration nicht initialisiert.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-6 animate-fade-in" id="nightshark-root">
      
      {/* SIDE CONTROL METRICS */}
      <div className="md:col-span-1 flex flex-col gap-1">
        <div className="text-[10px] uppercase tracking-[0.25em] text-[#666666] mb-3 pl-2">System Module / Nodes</div>
        
        <button
          onClick={() => setActiveSubTab("tickets")}
          className={`flex items-center space-x-3 w-full p-3 border text-left transition-all select-none cursor-pointer ${
            activeSubTab === "tickets" 
              ? "bg-[#121212] border-white text-white opacity-100" 
              : "bg-transparent border-transparent hover:bg-[#121212] text-[#999999] hover:text-white opacity-70 hover:opacity-100"
          }`}
        >
          <Ticket className="w-4 h-4 shrink-0" />
          <span className="text-xs uppercase tracking-wider font-sans font-medium">Ticket System</span>
        </button>

        <button
          onClick={() => setActiveSubTab("welcome")}
          className={`flex items-center space-x-3 w-full p-3 border text-left transition-all select-none cursor-pointer ${
            activeSubTab === "welcome" 
              ? "bg-[#121212] border-white text-white opacity-100" 
              : "bg-transparent border-transparent hover:bg-[#121212] text-[#999999] hover:text-white opacity-70 hover:opacity-100"
          }`}
        >
          <UserPlus className="w-4 h-4 shrink-0" />
          <span className="text-xs uppercase tracking-wider font-sans font-medium">Welcome/Goodbye</span>
        </button>

        <button
          onClick={() => setActiveSubTab("automod")}
          className={`flex items-center space-x-3 w-full p-3 border text-left transition-all select-none cursor-pointer ${
            activeSubTab === "automod" 
              ? "bg-[#121212] border-white text-white opacity-100" 
              : "bg-transparent border-transparent hover:bg-[#121212] text-[#999999] hover:text-white opacity-70 hover:opacity-100"
          }`}
        >
          <ShieldAlert className="w-4 h-4 shrink-0" />
          <span className="text-xs uppercase tracking-wider font-sans font-medium">Auto-Moderator</span>
        </button>

        <button
          onClick={() => setActiveSubTab("antinuke")}
          className={`flex items-center space-x-3 w-full p-3 border text-left transition-all select-none cursor-pointer ${
            activeSubTab === "antinuke" 
              ? "bg-[#121212] border-white text-white opacity-100" 
              : "bg-transparent border-transparent hover:bg-[#121212] text-[#999999] hover:text-white opacity-70 hover:opacity-100"
          }`}
        >
          <ShieldAlert className="w-4 h-4 shrink-0" />
          <span className="text-xs uppercase tracking-wider font-sans font-medium">Anti-Nuke Security</span>
        </button>

        <button
          onClick={() => setActiveSubTab("economy")}
          className={`flex items-center space-x-3 w-full p-3 border text-left transition-all select-none cursor-pointer ${
            activeSubTab === "economy" 
              ? "bg-[#121212] border-white text-white opacity-100" 
              : "bg-transparent border-transparent hover:bg-[#121212] text-[#999999] hover:text-white opacity-70 hover:opacity-100"
          }`}
        >
          <BadgeCent className="w-4 h-4 shrink-0" />
          <span className="text-xs uppercase tracking-wider font-sans font-medium">Economy & Shop</span>
        </button>

        <button
          onClick={() => setActiveSubTab("automessages")}
          className={`flex items-center space-x-3 w-full p-3 border text-left transition-all select-none cursor-pointer ${
            activeSubTab === "automessages" 
              ? "bg-[#121212] border-white text-white opacity-100" 
              : "bg-transparent border-transparent hover:bg-[#121212] text-[#999999] hover:text-white opacity-70 hover:opacity-100"
          }`}
        >
          <MessageSquare className="w-4 h-4 shrink-0" />
          <span className="text-xs uppercase tracking-wider font-sans font-medium">Auto-Messages</span>
        </button>
      </div>

      {/* CORE CONFIGURATION AREA */}
      <div className="md:col-span-3 bg-[#121212] border border-[#333333] flex flex-col">
        
        {/* Alerts inside config sheet */}
        {errorMsg && (
          <div className="p-3 bg-black border-b border-[#ff3b30] text-[#ff3b30] text-[10px] font-mono uppercase tracking-widest text-center">
            ⚠️ Alarmsystem: {errorMsg}
          </div>
        )}
        {successMsg && (
          <div className="p-3 bg-black border-b border-white text-white text-[10px] font-mono uppercase tracking-widest text-center flex items-center justify-center gap-2">
            <CheckCircle2 className="w-3.5 h-3.5" /> {successMsg}
          </div>
        )}

        {/* TICKET SYSTEM PANEL */}
        {activeSubTab === "tickets" && (
          <div className="p-6 space-y-6">
            <div className="flex justify-between items-center border-b border-[#222222] pb-4">
              <div>
                <h2 className="text-lg font-bold tracking-tight uppercase flex items-center gap-2">Ticket Pipeline</h2>
                <p className="text-[10px] text-[#666666] font-mono uppercase">Node ID: TICKETS-NS-01</p>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-[10px] uppercase tracking-wider text-[#999999]">Aktiv</span>
                <input
                  type="checkbox"
                  checked={config.tickets.enabled}
                  onChange={(e) => {
                    const next = { ...config, tickets: { ...config.tickets, enabled: e.target.checked } };
                    setConfig(next);
                    handleSave(next);
                  }}
                  className="accent-white cursor-pointer w-4 h-4"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] uppercase tracking-widest text-[#666666] block">Ziel-Kanal ID / Name für Ticket-Erstellungsbutton</label>
                <input
                  type="text"
                  value={config.tickets.ticketChannelId || ""}
                  onChange={(e) => setConfig({ ...config, tickets: { ...config.tickets, ticketChannelId: e.target.value } })}
                  placeholder="e.g. ticket-station or 1234567890"
                  className="w-full bg-black border border-[#222222] p-3 text-xs text-stone-200 font-mono focus:border-white outline-none"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] uppercase tracking-widest text-[#666666] block">Ziel-Kategorie ID (Discord Category)</label>
                <input
                  type="text"
                  value={config.tickets.categoryId}
                  onChange={(e) => setConfig({ ...config, tickets: { ...config.tickets, categoryId: e.target.value } })}
                  className="w-full bg-black border border-[#222222] p-3 text-xs text-stone-200 font-mono focus:border-white outline-none"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] uppercase tracking-widest text-[#666666] block">Support-Rolle ID (Befugte Ersteller)</label>
                <input
                  type="text"
                  value={config.tickets.supportRoleId}
                  onChange={(e) => setConfig({ ...config, tickets: { ...config.tickets, supportRoleId: e.target.value } })}
                  className="w-full bg-black border border-[#222222] p-3 text-xs text-stone-200 font-mono focus:border-white outline-none"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] uppercase tracking-widest text-[#666666] block">Interaktiver Button-Text</label>
                <input
                  type="text"
                  value={config.tickets.buttonLabel}
                  onChange={(e) => setConfig({ ...config, tickets: { ...config.tickets, buttonLabel: e.target.value } })}
                  className="w-full bg-black border border-[#222222] p-3 text-xs text-stone-200 font-sans focus:border-white outline-none"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] uppercase tracking-widest text-[#666666] block">Embed-Titel</label>
                <input
                  type="text"
                  value={config.tickets.embedTitle}
                  onChange={(e) => setConfig({ ...config, tickets: { ...config.tickets, embedTitle: e.target.value } })}
                  className="w-full bg-black border border-[#222222] p-3 text-xs text-stone-200 font-sans focus:border-white outline-none"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] uppercase tracking-widest text-[#666666] block">Embed-Beschreibungstext (Support-Information)</label>
              <textarea
                value={config.tickets.embedDescription}
                onChange={(e) => setConfig({ ...config, tickets: { ...config.tickets, embedDescription: e.target.value } })}
                className="w-full h-24 bg-black border border-[#222222] p-3 text-xs text-stone-300 font-sans focus:border-white outline-none resize-none"
              />
            </div>

            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between p-3 border border-[#222222] bg-black">
                <span className="text-[11px] uppercase tracking-wide text-stone-300">Transkript-Dokumentation beim Schließen</span>
                <input
                  type="checkbox"
                  checked={config.tickets.transcriptOnClose}
                  onChange={(e) => setConfig({ ...config, tickets: { ...config.tickets, transcriptOnClose: e.target.checked } })}
                  className="accent-white cursor-pointer w-4 h-4"
                />
              </div>
              <div className="flex items-center justify-between p-3 border border-[#222222] bg-black">
                <span className="text-[11px] uppercase tracking-wide text-stone-300">Management-Alarmierung bei Verzögerungen</span>
                <input
                  type="checkbox"
                  checked={config.tickets.notifyManagement}
                  onChange={(e) => setConfig({ ...config, tickets: { ...config.tickets, notifyManagement: e.target.checked } })}
                  className="accent-white cursor-pointer w-4 h-4"
                />
              </div>
            </div>

            <button
              onClick={() => handleSave(config)}
              className="px-6 py-2.5 bg-white text-black hover:bg-black hover:text-white border border-transparent hover:border-white transition-all text-xs font-bold uppercase tracking-widest cursor-pointer self-end"
            >
              Speichere Ticketmodul
            </button>
          </div>
        )}

        {/* WELCOME / GOODBYE PANEL */}
        {activeSubTab === "welcome" && (
          <div className="p-6 space-y-6">
            <div className="flex justify-between items-center border-b border-[#222222] pb-4">
              <div>
                <h2 className="text-lg font-bold tracking-tight uppercase flex items-center gap-2">Eintrittsmelder & Verlassensmeldungen</h2>
                <p className="text-[10px] text-[#666666] font-mono uppercase">Node ID: WELCOME-NS-02</p>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-[10px] uppercase tracking-wider text-[#999999]">Aktiv</span>
                <input
                  type="checkbox"
                  checked={config.welcome.enabled}
                  onChange={(e) => {
                    const next = { ...config, welcome: { ...config.welcome, enabled: e.target.checked } };
                    setConfig(next);
                    handleSave(next);
                  }}
                  className="accent-white cursor-pointer w-4 h-4"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] uppercase tracking-widest text-[#666666] block">Zuweisungsverbindung Willkommens-Kanal</label>
                <input
                  type="text"
                  value={config.welcome.welcomeChannelId}
                  onChange={(e) => setConfig({ ...config, welcome: { ...config.welcome, welcomeChannelId: e.target.value } })}
                  className="w-full bg-black border border-[#222222] p-3 text-xs text-stone-200 font-mono focus:border-white outline-none"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] uppercase tracking-widest text-[#666666] block">Zuweisungsverbindung Abschieds-Kanal</label>
                <input
                  type="text"
                  value={config.welcome.goodbyeChannelId}
                  onChange={(e) => setConfig({ ...config, welcome: { ...config.welcome, goodbyeChannelId: e.target.value } })}
                  className="w-full bg-black border border-[#222222] p-3 text-xs text-stone-200 font-mono focus:border-white outline-none"
                />
              </div>
            </div>

            <div className="p-4 border border-[#222222] bg-black space-y-4">
              <h3 className="text-xs font-bold uppercase text-white font-mono">Willkommenskarte Config</h3>
              
              <div className="space-y-2">
                <label className="text-[10px] uppercase tracking-widest text-[#666666] block">Hintergrundbild URL (Welcomer)</label>
                <input
                  type="text"
                  value={config.welcome.backgroundUrl}
                  onChange={(e) => setConfig({ ...config, welcome: { ...config.welcome, backgroundUrl: e.target.value } })}
                  className="w-full bg-black border border-[#222222] p-2 text-xs text-stone-200 font-sans focus:border-white outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] uppercase tracking-widest text-[#666666] block">Willkommen Embed Titel</label>
                  <input
                    type="text"
                    value={config.welcome.welcomeEmbedTitle}
                    onChange={(e) => setConfig({ ...config, welcome: { ...config.welcome, welcomeEmbedTitle: e.target.value } })}
                    className="w-full bg-black border border-[#222222] p-2.5 text-xs text-stone-200 focus:border-white outline-none"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] uppercase tracking-widest text-[#666666] block">Abschied Embed Titel</label>
                  <input
                    type="text"
                    value={config.welcome.goodbyeEmbedTitle}
                    onChange={(e) => setConfig({ ...config, welcome: { ...config.welcome, goodbyeEmbedTitle: e.target.value } })}
                    className="w-full bg-black border border-[#222222] p-2.5 text-xs text-stone-200 focus:border-white outline-none"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] uppercase tracking-widest text-[#666666] block">Willkommen Beschreibungstext (Erlaubte Variablen: {"{user}"}, {"{count}"})</label>
                <textarea
                  value={config.welcome.welcomeEmbedDesc}
                  onChange={(e) => setConfig({ ...config, welcome: { ...config.welcome, welcomeEmbedDesc: e.target.value } })}
                  className="w-full h-16 bg-black border border-[#222222] p-3 text-xs text-stone-300 font-sans focus:border-white outline-none resize-none"
                />
              </div>
            </div>

            <button
              onClick={() => handleSave(config)}
              className="px-6 py-2.5 bg-white text-black hover:bg-black hover:text-white border border-transparent hover:border-white transition-all text-xs font-bold uppercase tracking-widest cursor-pointer self-end"
            >
              Speichere Welcome Settings
            </button>
          </div>
        )}

        {/* AUTO-MOD PANEL */}
        {activeSubTab === "automod" && (
          <div className="p-6 space-y-6">
            <div className="flex justify-between items-center border-b border-[#222222] pb-4">
              <div>
                <h2 className="text-lg font-bold tracking-tight uppercase flex items-center gap-2 font-mono">Integrierte Filter & Wortzensur</h2>
                <p className="text-[10px] text-[#666666] font-mono uppercase">Node ID: AUTOMOD-NS-03</p>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-[10px] uppercase tracking-wider text-[#999999]">Aktiv</span>
                <input
                  type="checkbox"
                  checked={config.automod.enabled}
                  onChange={(e) => {
                    const next = { ...config, automod: { ...config.automod, enabled: e.target.checked } };
                    setConfig(next);
                    handleSave(next);
                  }}
                  className="accent-white cursor-pointer w-4 h-4"
                />
              </div>
            </div>

            <div className="space-y-4">
              <span className="text-[10px] uppercase tracking-widest text-[#666666] block">Zensurmaßnahmen (Word Blacklist)</span>
              
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newWord}
                  onChange={(e) => setNewWord(e.target.value)}
                  className="flex-1 bg-black border border-[#222222] p-3 text-xs text-stone-200 font-mono focus:border-white outline-none"
                  placeholder="Verbotenes Wort hinzufügen..."
                />
                <button
                  type="button"
                  onClick={() => {
                    if (newWord.trim() && config && !config.automod.blacklistWords.includes(newWord.trim())) {
                      const updatedWords = [...config.automod.blacklistWords, newWord.trim()];
                      setConfig({ ...config, automod: { ...config.automod, blacklistWords: updatedWords } });
                      setNewWord("");
                    }
                  }}
                  className="px-4 bg-white text-black hover:bg-black hover:text-white border border-transparent hover:border-[#333333] transition-colors text-xs font-bold uppercase tracking-widest cursor-pointer"
                >
                  Hinzufügen
                </button>
              </div>

              <div className="flex flex-wrap gap-2 p-4 border border-[#222222] bg-black min-h-[40px]">
                {config.automod.blacklistWords.map((word, idx) => (
                  <span key={idx} className="bg-[#1c1c1c] border border-[#333333] px-2.5 py-1 text-xs text-stone-200 font-mono flex items-center gap-1.5 uppercase tracking-wide">
                    {word}
                    <button
                      type="button"
                      onClick={() => {
                        const nextWords = config.automod.blacklistWords.filter(w => w !== word);
                        setConfig({ ...config, automod: { ...config.automod, blacklistWords: nextWords } });
                      }}
                      className="text-[#ff3b30] hover:text-white font-bold cursor-pointer font-sans"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </div>

            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between p-3 border border-[#222222] bg-black">
                <div className="flex flex-col">
                  <span className="text-xs uppercase font-bold text-stone-300">Invite-Filter</span>
                  <p className="text-[10px] text-[#666666] font-mono">Verhindert Posten von externen Discord Einladungslinks.</p>
                </div>
                <input
                  type="checkbox"
                  checked={config.automod.blockInvitations}
                  onChange={(e) => setConfig({ ...config, automod: { ...config.automod, blockInvitations: e.target.checked } })}
                  className="accent-white cursor-pointer w-4 h-4"
                />
              </div>

              <div className="flex items-center justify-between p-3 border border-[#222222] bg-black">
                <div className="flex flex-col">
                  <span className="text-xs uppercase font-bold text-stone-300">Link-Filter (Anti-External-Links)</span>
                  <p className="text-[10px] text-[#666666] font-mono">Bruchsichere Sperre gegen alle unautorisierten URLs.</p>
                </div>
                <input
                  type="checkbox"
                  checked={config.automod.blockExternalLinks}
                  onChange={(e) => setConfig({ ...config, automod: { ...config.automod, blockExternalLinks: e.target.checked } })}
                  className="accent-white cursor-pointer w-4 h-4"
                />
              </div>
            </div>

            <button
              onClick={() => handleSave(config)}
              className="px-6 py-2.5 bg-white text-black hover:bg-black hover:text-white border border-transparent hover:border-white transition-all text-xs font-bold uppercase tracking-widest cursor-pointer self-end"
            >
              Speichere Auto-Mod
            </button>
          </div>
        )}

        {/* ANTI-NUKE PANEL */}
        {activeSubTab === "antinuke" && (
          <div className="p-6 space-y-6">
            <div className="flex justify-between items-center border-b border-[#222222] pb-4">
              <div>
                <h2 className="text-lg font-bold tracking-tight uppercase flex items-center gap-2 text-[#ff3b30]">Anti-Nuke Sicherheitszentrale</h2>
                <p className="text-[10px] text-[#666666] font-mono uppercase">Node ID: ANTINUKE-NS-04</p>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-[10px] uppercase tracking-wider text-[#999999]">Aktiv</span>
                <input
                  type="checkbox"
                  checked={config.antinuke.enabled}
                  onChange={(e) => {
                    const next = { ...config, antinuke: { ...config.antinuke, enabled: e.target.checked } };
                    setConfig(next);
                    handleSave(next);
                  }}
                  className="accent-white cursor-pointer w-4 h-4"
                />
              </div>
            </div>

            {/* VISUAL ACTIVE THREAT SYSTEM CARD */}
            {activeThreat ? (
              <div className="border border-red-600 bg-red-950/20 p-5 space-y-4 animate-pulse-subtle">
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping flex shrink-0" />
                    <div>
                      <h3 className="text-sm font-black uppercase text-red-500 tracking-wider">🚨 STRATEGENT-WARNUNG: AKTIVE SABOTAGE REMEDIATION IM GANG</h3>
                      <p className="text-[10px] text-gray-400 font-mono mt-0.5">Angreifer: {activeThreat.attacker} | Typ: {activeThreat.type}</p>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 border border-red-500 text-red-500 text-[8px] uppercase tracking-widest font-black">
                    {activeThreat.severity}
                  </span>
                </div>

                <div className="text-xs text-gray-300 font-mono bg-black/40 p-3 border border-red-900/40">
                  <span className="text-red-400 font-bold block mb-1">AUTOMATISCH REGISTRIERTER ANGRIFFSVEKTOR:</span>
                  {activeThreat.description}
                </div>

                <div className="space-y-1.5 pl-2">
                  <span className="text-[10px] text-gray-400 uppercase tracking-widest block font-bold mb-2">Ausgeführte Abwehrmaßnahmen (Vanguard Intervention):</span>
                  {activeThreat.actionsTaken && activeThreat.actionsTaken.map((action: string, idx: number) => (
                    <div key={idx} className="flex items-center space-x-2 text-xs text-green-400 font-mono">
                      <span className="text-green-500">✔</span>
                      <span className="opacity-95">{action}</span>
                    </div>
                  ))}
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    onClick={handleResolveThreat}
                    className="px-4 py-2 bg-red-600 hover:bg-black hover:text-red-500 border border-transparent hover:border-red-500 transition-all text-[11px] font-bold uppercase tracking-wider cursor-pointer font-sans"
                  >
                    🔒 Bedrohungszustand bestätigen & System normalisieren
                  </button>
                </div>
              </div>
            ) : (
              <div className="border border-green-700 bg-green-950/10 p-4 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
                  <div>
                    <h3 className="text-xs font-bold uppercase text-green-500 tracking-widest">SERVERSTATUS: SECURED / HARMONIERT</h3>
                    <p className="text-[9px] text-[#666666] font-mono uppercase mt-0.5">Keine aktiven Löschungs- oder Sabotageereignisse aufgefunden</p>
                  </div>
                </div>
                <span className="text-[9px] text-green-600 font-mono uppercase tracking-widest font-bold">VANGUARD SECURE</span>
              </div>
            )}

            <div className="p-4 border border-[#ff3b30] bg-[#1a0a09]/30 rounded-none space-y-4">
              <span className="text-[11px] uppercase tracking-widest text-[#ff3b30] font-bold block">Aggressive Schutzparameter (Sabotage-Sperren)</span>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] uppercase tracking-widest text-[#666666] block">Zulässige Kanallöschungen / Zeitfenster</label>
                  <input
                    type="number"
                    value={config.antinuke.maxChannelDeletions}
                    onChange={(e) => setConfig({ ...config, antinuke: { ...config.antinuke, maxChannelDeletions: parseInt(e.target.value) || 3 } })}
                    className="w-full bg-black border border-[#222222] p-3 text-xs text-stone-200 font-mono focus:border-[#ff3b30] outline-none"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] uppercase tracking-widest text-[#666666] block">Zulässige Rollenlöschungen / Zeitfenster</label>
                  <input
                    type="number"
                    value={config.antinuke.maxRoleDeletions}
                    onChange={(e) => setConfig({ ...config, antinuke: { ...config.antinuke, maxRoleDeletions: parseInt(e.target.value) || 3 } })}
                    className="w-full bg-black border border-[#222222] p-3 text-xs text-stone-200 font-mono focus:border-[#ff3b30] outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] uppercase tracking-widest text-[#666666] block">Zeitfenster-Überwachung (Sekunden)</label>
                  <input
                    type="number"
                    value={config.antinuke.timeWindowSeconds}
                    onChange={(e) => setConfig({ ...config, antinuke: { ...config.antinuke, timeWindowSeconds: parseInt(e.target.value) || 10 } })}
                    className="w-full bg-black border border-[#222222] p-3 text-xs text-stone-200 font-mono focus:border-[#ff3b30] outline-none"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] uppercase tracking-widest text-[#666666] block">Isolations-Rolle ID (Quarantäne)</label>
                  <input
                    type="text"
                    value={config.antinuke.quarantineRoleId}
                    onChange={(e) => setConfig({ ...config, antinuke: { ...config.antinuke, quarantineRoleId: e.target.value } })}
                    className="w-full bg-black border border-[#222222] p-3 text-xs text-stone-200 font-mono focus:border-[#ff3b30] outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between p-3 border border-[#ff3b30]/30 bg-black">
                <div className="flex flex-col">
                  <span className="text-xs uppercase font-bold text-stone-300">Automatischer Entzug der administrativen Rechte</span>
                  <p className="text-[9px] text-[#666666] font-mono">Enthauptet alle Rollen des Angreifers im Millisekundenbereich.</p>
                </div>
                <input
                  type="checkbox"
                  checked={config.antinuke.autoDemoteTarget}
                  onChange={(e) => setConfig({ ...config, antinuke: { ...config.antinuke, autoDemoteTarget: e.target.checked } })}
                  className="accent-[#ff3b30] cursor-pointer w-4 h-4"
                />
              </div>
            </div>

            {/* PENETRATION STRESSTEST SIMULATOR UNIT */}
            <div className="p-4 border border-[#222222] bg-stone-950/20 rounded-none space-y-4">
              <div>
                <h3 className="text-xs font-bold uppercase text-stone-200 tracking-wider flex items-center gap-2">
                  <span>🛡️ VANGUARD STRESSTEST & PENETRATION ENGINE</span>
                </h3>
                <p className="text-[10px] text-[#666666] font-mono mt-0.5">Dient der Simulation künstlicher Massen-Sabotageszenarien zur Echtzeit-Validierung der Eskalierungsschritte im Dashboard und Terminal.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <button
                  onClick={() => handleSimulateThreat("CHANNEL_DELETIONS_EXCEEDED")}
                  className="px-3 py-2 border border-[#333333] hover:border-[#ff3b30] hover:bg-red-950/10 transition-all text-stone-400 hover:text-[#ff3b30] cursor-pointer text-[10px] uppercase font-bold tracking-widest font-mono text-left"
                >
                  💣 KANALLÖSCH-WELLE
                </button>
                <button
                  onClick={() => handleSimulateThreat("ROLE_DELETIONS_EXCEEDED")}
                  className="px-3 py-2 border border-[#333333] hover:border-[#ff3b30] hover:bg-red-950/10 transition-all text-stone-400 hover:text-[#ff3b30] cursor-pointer text-[10px] uppercase font-bold tracking-widest font-mono text-left"
                >
                  💣 ROLLENSABOTAGE
                </button>
                <button
                  onClick={() => handleSimulateThreat("ROGUE_ADMIN_DETECTED")}
                  className="px-3 py-2 border border-[#333333] hover:border-[#ff3b30] hover:bg-red-950/10 transition-all text-stone-400 hover:text-[#ff3b30] cursor-pointer text-[10px] uppercase font-bold tracking-widest font-mono text-left"
                >
                  💣 ROGUE ADMIN-SABOTAGE
                </button>
              </div>
            </div>

            <button
              onClick={() => handleSave(config)}
              className="px-6 py-2.5 bg-[#ff3b30] text-white hover:bg-black border border-transparent hover:border-[#ff3b30] transition-all text-xs font-bold uppercase tracking-widest cursor-pointer self-end"
            >
              Speichere Anti-Nuke Parameter
            </button>
          </div>
        )}

        {/* ECONOMY PANEL */}
        {activeSubTab === "economy" && (
          <div className="p-6 space-y-6">
            <div className="flex justify-between items-center border-b border-[#222222] pb-4">
              <div>
                <h2 className="text-lg font-bold tracking-tight uppercase flex items-center gap-2">Virtual Economy & Server Shop</h2>
                <p className="text-[10px] text-[#666666] font-mono uppercase">Node ID: ECONOMY-NS-05</p>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-[10px] uppercase tracking-wider text-[#999999]">Aktiv</span>
                <input
                  type="checkbox"
                  checked={config.economy.enabled}
                  onChange={(e) => {
                    const next = { ...config, economy: { ...config.economy, enabled: e.target.checked } };
                    setConfig(next);
                    handleSave(next);
                  }}
                  className="accent-white cursor-pointer w-4 h-4"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="text-[10px] uppercase tracking-widest text-[#666666] block mb-1">Währungssymbol / Token</label>
                <input
                  type="text"
                  value={config.economy.currencySymbol}
                  onChange={(e) => setConfig({ ...config, economy: { ...config.economy, currencySymbol: e.target.value } })}
                  className="w-full bg-black border border-[#222222] p-2.5 text-xs text-stone-200 font-mono focus:border-white outline-none"
                />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-widest text-[#666666] block mb-1">Tägliche Ernte (/daily)</label>
                <input
                  type="number"
                  value={config.economy.dailyReward}
                  onChange={(e) => setConfig({ ...config, economy: { ...config.economy, dailyReward: parseInt(e.target.value) || 50 } })}
                  className="w-full bg-black border border-[#222222] p-2.5 text-xs text-stone-200 font-mono focus:border-white outline-none"
                />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-widest text-[#666666] block mb-1">Lohnspanne (/work)</label>
                <div className="flex gap-1.5 items-center">
                  <input
                    type="number"
                    placeholder="Min"
                    value={config.economy.workMinReward}
                    onChange={(e) => setConfig({ ...config, economy: { ...config.economy, workMinReward: parseInt(e.target.value) || 10 } })}
                    className="w-full bg-black border border-[#222222] p-2.5 text-xs text-stone-200 font-mono focus:border-white outline-none text-center animate-none"
                  />
                  <span className="text-[#666666] text-xs font-mono">-</span>
                  <input
                    type="number"
                    placeholder="Max"
                    value={config.economy.workMaxReward}
                    onChange={(e) => setConfig({ ...config, economy: { ...config.economy, workMaxReward: parseInt(e.target.value) || 35 } })}
                    className="w-full bg-black border border-[#222222] p-2.5 text-xs text-stone-200 font-mono focus:border-white outline-none text-center animate-none"
                  />
                </div>
              </div>
            </div>

            {/* SHOP ITEMS DEFINITION */}
            <div className="pt-2">
              <span className="text-[10px] uppercase tracking-widest text-[#666666] block mb-2">Server Shop Integration (Rollenkauf per Münzen)</span>
              
              <div className="p-4 border border-[#222222] bg-black grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 mb-3">
                <input
                  type="text"
                  placeholder="Rollen Anzeigename"
                  value={newShopRoleName}
                  onChange={(e) => setNewShopRoleName(e.target.value)}
                  className="bg-[#121212] border border-[#222222] p-2 text-xs text-stone-200 outline-none"
                />
                <input
                  type="text"
                  placeholder="Discord Rolle ID"
                  value={newShopRoleId}
                  onChange={(e) => setNewShopRoleId(e.target.value)}
                  className="bg-[#121212] border border-[#222222] p-2 text-xs text-stone-200 font-mono outline-none"
                />
                <input
                  type="number"
                  placeholder="Preis"
                  value={newShopPrice}
                  onChange={(e) => setNewShopPrice(parseInt(e.target.value) || 0)}
                  className="bg-[#121212] border border-[#222222] p-2 text-xs text-stone-200 font-mono outline-none"
                />
                <button
                  onClick={() => {
                    if (newShopRoleName && newShopRoleId && config) {
                      const item: RoleProduct = {
                        id: Math.random().toString(),
                        roleName: newShopRoleName,
                        roleId: newShopRoleId,
                        price: newShopPrice,
                        description: newShopDesc || "Keine separate Beschreibung."
                      };
                      setConfig({ ...config, economy: { ...config.economy, shopItems: [...config.economy.shopItems, item] } });
                      setNewShopRoleName("");
                      setNewShopRoleId("");
                      setNewShopPrice(100);
                      setNewShopDesc("");
                    }
                  }}
                  className="bg-white text-black text-[10px] uppercase font-bold py-2 hover:bg-black hover:text-white border border-transparent hover:border-[#333333] transition-colors cursor-pointer"
                >
                  Produkt hinzufügen
                </button>
              </div>

              <div className="space-y-2">
                {config.economy.shopItems.map((item) => (
                  <div key={item.id} className="bg-black border border-[#222222] p-3 flex justify-between items-center text-xs font-mono">
                    <div className="space-y-0.5">
                      <div className="text-white font-bold">{item.roleName}</div>
                      <div className="text-[10px] text-[#666666]">
                        Rollen-ID: {item.roleId} // Preis: <span className="text-white font-bold">{config.economy.currencySymbol}{item.price}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        const items = config.economy.shopItems.filter(i => i.id !== item.id);
                        setConfig({ ...config, economy: { ...config.economy, shopItems: items } });
                      }}
                      className="text-[#ff3b30] p-1.5 hover:bg-[#1a0c0a] transition-all cursor-pointer font-sans"
                    >
                      Entfernen
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <button
              onClick={() => handleSave(config)}
              className="px-6 py-2.5 bg-white text-black hover:bg-black hover:text-white border border-transparent hover:border-white transition-all text-xs font-bold uppercase tracking-widest cursor-pointer self-end"
            >
              Speichere Economy Module
            </button>
          </div>
        )}

        {/* AUTO MESSAGES TIMER PANEL */}
        {activeSubTab === "automessages" && (
          <div className="p-6 space-y-6">
            <div className="flex justify-between items-center border-b border-[#222222] pb-4">
              <div>
                <h2 className="text-lg font-bold tracking-tight uppercase flex items-center gap-2">Zyklische Sendeschleifen (Auto-Timer-Messages)</h2>
                <p className="text-[10px] text-[#666666] font-mono uppercase">Node ID: TIMER-MSG-NS-06</p>
              </div>
            </div>

            {/* ADD AUTO MESSAGE BLOCK */}
            <div className="p-4 border border-[#222222] bg-black space-y-4">
              <span className="text-[11px] uppercase tracking-widest text-[#999999] font-bold block">Neue Sendeschleife einrichten</span>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] uppercase tracking-widest text-[#666666] block">Ziel-Textkanal ID</label>
                  <input
                    type="text"
                    value={newMsgChannel}
                    onChange={(e) => setNewMsgChannel(e.target.value)}
                    className="w-full bg-[#121212] border border-[#222222] p-2.5 text-xs text-stone-200 font-mono focus:border-white outline-none"
                    placeholder="announcements-logs"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] uppercase tracking-widest text-[#666666] block">Sendeintervall (Minuten)</label>
                  <input
                    type="number"
                    min="1"
                    value={newMsgInterval}
                    onChange={(e) => setNewMsgInterval(parseInt(e.target.value) || 15)}
                    className="w-full bg-[#121212] border border-[#222222] p-2.5 text-xs text-stone-200 font-mono focus:border-white outline-none"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] uppercase tracking-widest text-[#666666] block">Nachrichteninhalt</label>
                <textarea
                  value={newMsgContent}
                  onChange={(e) => setNewMsgContent(e.target.value)}
                  className="w-full h-16 bg-[#121212] border border-[#222222] p-3 text-xs text-stone-300 focus:border-white outline-none resize-none"
                  placeholder="Gebe hier den zyklisch zu postenden Text ein..."
                />
              </div>

              <button
                onClick={() => {
                  if (newMsgContent && config) {
                    const item: AutoMessageConfig = {
                      id: "msg-" + Math.random().toString(36).substring(7),
                      enabled: true,
                      channelId: newMsgChannel,
                      intervalMinutes: newMsgInterval,
                      message: newMsgContent
                    };
                    setConfig({ ...config, autoMessages: [...config.autoMessages, item] });
                    setNewMsgContent("");
                    setNewMsgChannel("announcements");
                    setNewMsgInterval(15);
                  }
                }}
                className="px-5 py-2 bg-white text-black hover:bg-black hover:text-white border border-transparent hover:border-white transition-all text-xs font-bold uppercase tracking-widest cursor-pointer"
              >
                Timer injizieren
              </button>
            </div>

            {/* LIST ACTIVE MESSAGES */}
            <div className="space-y-3 pt-2">
              <span className="text-[10px] uppercase tracking-widest text-[#666666] block">Aktive Sendeschleifen Registrierungen</span>
              
              {config.autoMessages.map((msg) => (
                <div key={msg.id} className="bg-black border border-[#222222] p-4 flex justify-between items-start text-xs font-mono">
                  <div className="space-y-2 flex-1 pr-6">
                    <div className="flex items-center gap-2">
                      <span className="text-[#a4a4a4]">Kanal:</span>
                      <span className="text-white font-bold">{msg.channelId}</span>
                      <span className="text-[#666666]">//</span>
                      <span className="text-[#a4a4a4]">Inkrement:</span>
                      <span className="text-white font-bold">{msg.intervalMinutes}m</span>
                    </div>
                    <p className="text-stone-300 font-sans border-l-2 border-stone-500 pl-3.5 italic text-xs">
                      {msg.message}
                    </p>
                  </div>

                  <div className="flex items-center gap-4">
                    <input
                      type="checkbox"
                      checked={msg.enabled}
                      onChange={(e) => {
                        const targetList = config.autoMessages.map(m => {
                          if (m.id === msg.id) return { ...m, enabled: e.target.checked };
                          return m;
                        });
                        setConfig({ ...config, autoMessages: targetList });
                      }}
                      className="accent-white cursor-pointer w-4 h-4"
                    />
                    <button
                      onClick={() => {
                        const items = config.autoMessages.filter(m => m.id !== msg.id);
                        setConfig({ ...config, autoMessages: items });
                      }}
                      className="text-[#ff3b30] hover:bg-[#1a0a09] p-2 transition-colors cursor-pointer font-sans"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={() => handleSave(config)}
              className="px-6 py-2.5 bg-white text-black hover:bg-black hover:text-white border border-transparent hover:border-white transition-all text-xs font-bold uppercase tracking-widest cursor-pointer self-end"
            >
              Speichere Sendeschleifen
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
