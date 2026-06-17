import React, { useState, useEffect } from "react";
import { api } from "./api";
import { SystemLog, ActiveTab } from "./types";
import NightSharkDashboard from "./components/NightSharkDashboard";
import ArchitectDashboard from "./components/ArchitectDashboard";
import AdminPanel from "./components/AdminPanel";
import { 
  Terminal, ShieldAlert, Cpu, HardDrive, KeyRound, 
  Settings, RefreshCw, Layers, Server, Activity, 
  HelpCircle, Eye, EyeOff, CheckCircle, Flame
} from "lucide-react";

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab | "admin">("home");
  const [serverId, setServerId] = useState(() => localStorage.getItem("vanguard_server_id") || "1234567890");
  const [tempIdInput, setTempIdInput] = useState(serverId);
  
  // Auth state
  const [adminToken, setAdminToken] = useState(() => localStorage.getItem("vanguard_admin_token") || "");
  const [nightsharkSessionToken, setNightsharkSessionToken] = useState(() => localStorage.getItem("vanguard_session_token_nightshark") || "");
  const [architectSessionToken, setArchitectSessionToken] = useState(() => localStorage.getItem("vanguard_session_token_architect") || "");
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState("");

  // Telemetry state
  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [metrics, setMetrics] = useState({
    ramUsage: "118.2 MB",
    cpuUsage: "3.1%",
    activeTickets: 0,
    activeLevelCount: 142,
    dbUsage: "38KB",
    latencyMs: "11ms"
  });

  // Pull Telemetry Logs & Stats on poll
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const liveLogs = await api.getLogs();
        setLogs(liveLogs);
        
        const liveStats = await api.getStats();
        if (liveStats) {
          setMetrics(liveStats);
        }
      } catch (e) {
        // Safe fail
      }
    };

    fetchStats();
    const logsInterval = setInterval(fetchStats, 5000);
    return () => clearInterval(logsInterval);
  }, []);

  const handleSyncServerId = () => {
    const cleanId = tempIdInput.trim();
    setServerId(cleanId);
    localStorage.setItem("vanguard_server_id", cleanId);
    // Mimic log in active server context
    api.getLogs(); // trigger fresh log pull
  };

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    try {
      const res = await api.login(loginUsername, loginPassword);
      if (res.success && res.token) {
        setAdminToken(res.token);
        localStorage.setItem("vanguard_admin_token", res.token);
        setShowLoginModal(false);
        setActiveTab("admin");
        setLoginUsername("");
        setLoginPassword("");
      }
    } catch (err: any) {
      setAuthError(err.message || "Root-Zugangsidentifikation fehlgeschlagen.");
    }
  };

  const handleAdminLogout = () => {
    setAdminToken("");
    localStorage.removeItem("vanguard_admin_token");
    setActiveTab("home");
  };

  const handleNightsharkSessionVerified = (token: string) => {
    setNightsharkSessionToken(token);
    localStorage.setItem("vanguard_session_token_nightshark", token);
  };

  const handleArchitectSessionVerified = (token: string) => {
    setArchitectSessionToken(token);
    localStorage.setItem("vanguard_session_token_architect", token);
  };

  const handleClearLogs = async () => {
    await api.clearLogs();
    const live = await api.getLogs();
    setLogs(live);
  };

  return (
    <div className="min-h-screen bg-[#000000] text-[#ffffff] font-sans flex flex-col antialiased selection:bg-white selection:text-black">
      
      {/* CENTEERED TOP NAVIGATION & ARCHITECTURE HEADER */}
      <header className="h-16 flex items-center justify-center border-b border-[#333333] px-6 sm:px-12 bg-[#000000] z-40 sticky top-0">
        <div className="max-w-7xl w-full flex items-center justify-between">
          
          {/* INVISIBLE SECRET LOGO TRIGGER (No cursor-pointer, no highlight, looks like blank text, but clickable) */}
          <div 
            onClick={() => setShowLoginModal(true)}
            className="w-10 h-10 flex items-center justify-center select-none cursor-default"
            title="System Terminal State"
            id="logo-trigger"
          >
            <div className="w-4 h-4 border border-stone-800 flex items-center justify-center">
              <div className="w-1.5 h-1.5 bg-stone-900 rounded-none" />
            </div>
          </div>

          {/* VISIBLE NAV TABS BAR */}
          <nav className="flex items-center space-x-4 sm:space-x-10">
            <button
              onClick={() => setActiveTab("home")}
              className={`text-[10px] sm:text-xs uppercase tracking-[0.22em] font-semibold transition-all cursor-pointer ${
                activeTab === "home" 
                  ? "border-b border-white pb-1 text-white opacity-100 font-bold" 
                  : "text-[#999999] hover:text-white opacity-60 hover:opacity-100"
              }`}
            >
              Home
            </button>

            <button
              onClick={() => setActiveTab("nightshark")}
              className={`text-[10px] sm:text-xs uppercase tracking-[0.22em] font-semibold transition-all cursor-pointer ${
                activeTab === "nightshark" 
                  ? "border-b border-white pb-1 text-white opacity-100 font-bold" 
                  : "text-[#999999] hover:text-white opacity-60 hover:opacity-100"
              }`}
            >
              NightShark Bot
            </button>

            <button
              onClick={() => setActiveTab("architect")}
              className={`text-[10px] sm:text-xs uppercase tracking-[0.22em] font-semibold transition-all cursor-pointer ${
                activeTab === "architect" 
                  ? "border-b border-white pb-1 text-white opacity-100 font-bold" 
                  : "text-[#999999] hover:text-white opacity-60 hover:opacity-100"
              }`}
            >
              Discord Architekt Bot
            </button>

            {adminToken && (
              <button
                onClick={() => setActiveTab("admin")}
                className={`text-[10px] sm:text-xs uppercase tracking-[0.22em] font-semibold transition-all text-[#ff3b30] hover:text-white cursor-pointer ${
                  activeTab === "admin" 
                    ? "border-b border-[#ff3b30] pb-1 opacity-100 font-bold" 
                    : "opacity-80 hover:opacity-100"
                }`}
              >
                [Admin Panel]
              </button>
            )}
          </nav>

          {/* RIGHT LIVE STATS INDICATOR */}
          <div className="flex items-center space-x-2.5">
            <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></div>
            <span className="text-[9px] uppercase tracking-widest text-[#666666] font-mono hidden sm:inline">Vanguard Live // {metrics.latencyMs}</span>
          </div>

        </div>
      </header>

      {/* MAIN DASHBOARD MATRIX */}
      <main className="flex-grow w-full max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 flex flex-col lg:flex-row gap-6">
        
        {/* CENTER COLUMN: ACTIVE INTERACTIVE WORKSPACE */}
        <div className="flex-grow lg:w-3/4 flex flex-col gap-6">
          
          {/* TAB 1: LANDING PAGE & INTRODUCTION */}
          {activeTab === "home" && (
            <div className="space-y-8 animate-fade-in" id="landing-home">
              
              {/* BRAND CARD */}
              <div className="bg-[#121212] border border-[#333333] p-8 space-y-4">
                <span className="text-[10px] uppercase tracking-[0.3em] text-[#666666] font-mono block">Systemvorstellung</span>
                <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tighter uppercase text-white">
                  WEISSMETALL OPERATIVES TERMINAL
                </h1>
                <p className="text-xs sm:text-sm text-stone-300 leading-relaxed max-w-3xl">
                  Ein exklusiv verschlüsseltes, vollkommen autarkes Steuerungsnetzwerk für das Discord-Ökosystem. Steuere hochkomplexe Ticketpipelines und Auto-Moderations-Kernsperren im NightShark-System oder synthetisiere vollständige Discord-Serverlayouts über die integrierte KI-Inferenz-Schnittstelle.
                </p>
                <div className="pt-2 flex flex-wrap gap-4 text-xs font-mono text-[#888888] uppercase">
                  <div>✓ Keine OAuth2-Pflicht</div>
                  <div>- Abhörsicheres JSON-Protokoll</div>
                  <div>✓ White-Label Engine v4.0.0</div>
                </div>
              </div>

              {/* BENTO STATISTICS GRID */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                
                <div className="bg-[#121212] border border-[#333333] p-4 flex flex-col justify-between h-28">
                  <div className="text-[10px] uppercase tracking-widest text-[#666666] font-mono">Terminal RAM-Auslastung</div>
                  <div className="text-2xl font-bold font-mono tracking-tight text-white">{metrics.ramUsage}</div>
                  <div className="text-[9px] text-[#444444] uppercase font-mono">Dauerbetrieb optimal</div>
                </div>

                <div className="bg-[#121212] border border-[#333333] p-4 flex flex-col justify-between h-28">
                  <div className="text-[10px] uppercase tracking-widest text-[#666666] font-mono">Core-Engine CPU-Weichen</div>
                  <div className="text-2xl font-bold font-mono tracking-tight text-white">{metrics.cpuUsage}</div>
                  <div className="w-full bg-stone-900 h-1">
                    <div className="bg-white h-full" style={{ width: metrics.cpuUsage }} />
                  </div>
                </div>

                <div className="bg-[#121212] border border-[#333333] p-4 flex flex-col justify-between h-28">
                  <div className="text-[10px] uppercase tracking-widest text-[#666666] font-mono">Aktive Ticketpipelines</div>
                  <div className="text-2xl font-bold font-mono tracking-tight text-white">{metrics.activeTickets} Live-Kanäle</div>
                  <div className="text-[9px] text-[#444444] uppercase font-mono">Auto-Zensur: aktiv</div>
                </div>

              </div>

            </div>
          )}

          {/* TAB 2: NIGHTSHARK CONFIGURATOR */}
          {activeTab === "nightshark" && (
            <div className="space-y-4">
              <div className="p-4 bg-[#121212] border border-[#333333] flex flex-col sm:flex-row justify-between items-center gap-3">
                <div>
                  <h2 className="text-sm font-bold uppercase tracking-widest text-[#aaaaaa]">NightShark All-In-One Control</h2>
                  <p className="text-[10px] text-[#666666] font-mono mt-0.5">Sämtliche Konfigurationsänderungen wirken sich live auf Server-ID <span className="text-white font-bold select-all">[{serverId}]</span> aus.</p>
                </div>
                <div className="flex items-center gap-3">
                  <a
                    href="https://discord.com/oauth2/authorize?client_id=1489644812431790171&permissions=8&scope=bot%20applications.commands"
                    target="_blank"
                    referrerPolicy="no-referrer"
                    className="px-3 py-1.5 border border-white text-white hover:bg-white hover:text-black transition-all text-[10px] uppercase font-bold text-center"
                  >
                    ➕ NightShark Bot Einladen
                  </a>
                  <div className="text-[10px] font-mono bg-black px-3 py-1.5 border border-[#222222]">
                    Status: <span className="text-white font-bold animate-pulse">ONLINE (LIVE)</span>
                  </div>
                </div>
              </div>
              <NightSharkDashboard 
                serverId={serverId} 
                sessionToken={nightsharkSessionToken}
                onSessionVerified={handleNightsharkSessionVerified}
              />
            </div>
          )}

          {/* TAB 3: DISCORD ARCHITECT */}
          {activeTab === "architect" && (
            <div className="space-y-4">
              <div className="p-4 bg-[#121212] border border-[#333333] flex flex-col sm:flex-row justify-between items-center gap-3">
                <div>
                  <h2 className="text-sm font-bold uppercase tracking-widest text-[#aaaaaa]">KI Server-Layout Generierung</h2>
                  <p className="text-[10px] text-[#666666] font-mono mt-0.5">Synthetisiere Discord Strukturen für Server-ID <span className="text-white font-bold select-all">[{serverId}]</span>.</p>
                </div>
              </div>
              <ArchitectDashboard 
                serverId={serverId} 
                onSetServerId={setServerId}
                sessionToken={architectSessionToken}
                onSessionVerified={handleArchitectSessionVerified}
              />
            </div>
          )}

          {/* TAB 4: HIDDEN ADMIN PANEL */}
          {activeTab === "admin" && adminToken && (
            <AdminPanel adminToken={adminToken} onLogout={handleAdminLogout} />
          )}

        </div>

        {/* RIGHT COLUMN: SYSTEM INTEGRITY & COUPLING CONTROL */}
        <aside className="lg:w-1/4 flex flex-col gap-6 shrink-0">
          
          {/* SERVER ID COUPLING MATRIX */}
          <div className="bg-[#121212] border border-white p-5 space-y-4">
            <div className="text-[10px] uppercase tracking-[0.25em] font-bold text-white font-mono flex items-center gap-2">
              <Server className="w-3.5 h-3.5" />
              SERVER ID COUPLING
            </div>
            
            <p className="text-[10px] text-[#999999] leading-relaxed uppercase">
              Gib unten die ID deines Ziel-Discordservers ein, um die Live-API-Schnittstellen darauf aufzuschalten.
            </p>

            <input
              type="text"
              value={tempIdInput}
              onChange={(e) => setTempIdInput(e.target.value)}
              placeholder="e.g. 1234567890"
              className="w-full bg-[#000000] border border-[#333333] p-3 text-xs text-center font-mono focus:border-white outline-none text-white selection:bg-white selection:text-black"
            />
            
            <button 
              onClick={handleSyncServerId}
              className="w-full py-2.5 bg-white text-black text-[10px] hover:bg-black hover:text-white border border-transparent hover:border-white transition-all uppercase font-bold tracking-widest cursor-pointer font-sans"
            >
              Sync Interface
            </button>
          </div>



        </aside>

      </main>

      {/* FOOTER BAR */}
      <footer className="bg-[#121212] border-t border-[#333333] py-4 px-6 sm:px-12 flex flex-col sm:flex-row items-center justify-between text-[8px] sm:text-[9px] uppercase tracking-[0.22em] text-[#666666] font-mono gap-3 z-30">
        <div>Proprietary Terminal v4.0.0-Stable</div>
        <div>© {new Date().getFullYear()} Core Architecture Studio</div>
        <div className="flex space-x-6">
          <span>Connection: Encrypted C2S</span>
          <span>Latency: {metrics.latencyMs}</span>
        </div>
      </footer>

      {/* VERSTECKTES LOGIN MODAL FOR ADMIN */}
      {showLoginModal && (
        <div className="fixed inset-0 bg-black bg-opacity-95 flex items-center justify-center p-4 z-50 animate-fade-in" id="login-modal">
          <div className="bg-[#121212] border border-white max-w-sm w-full p-6 space-y-4">
            
            <div className="flex justify-between items-center border-b border-[#222222] pb-2.5">
              <span className="text-xs uppercase font-bold text-white tracking-widest font-mono flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-white" />
                Terminal-Autorisierung
              </span>
              <button 
                onClick={() => {
                  setShowLoginModal(false);
                  setAuthError("");
                }} 
                className="text-stone-500 hover:text-white font-sans text-xs cursor-pointer font-bold"
              >
                ✕
              </button>
            </div>

            <p className="text-[10px] text-stone-400 uppercase leading-relaxed font-mono">
              Diese Konsole gewährt operativen Systemzugriff. Eine unbefugte Authentifizierung wird permanent protokolliert.
            </p>

            {authError && (
              <div className="p-3 bg-black border border-[#ff3b30] text-[#ff3b30] text-[9px] font-mono uppercase tracking-wider">
                ⚠️ ALARM: {authError}
              </div>
            )}

            <form onSubmit={handleAdminLogin} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[9px] uppercase tracking-widest text-[#666666] font-mono block">Operator Kennung</label>
                <input
                  type="text"
                  required
                  value={loginUsername}
                  onChange={(e) => setLoginUsername(e.target.value)}
                  className="w-full bg-black border border-[#333333] p-2.5 text-xs text-stone-200 focus:border-white font-mono outline-none"
                  placeholder="USERNAME"
                  autoFocus
                />
              </div>

              <div className="space-y-1">
                <label className="text-[9px] uppercase tracking-widest text-[#666666] font-mono block">Sicherheits-Passwort</label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    className="w-full bg-black border border-[#333333] p-2.5 text-xs text-stone-200 focus:border-white font-mono outline-none pr-10"
                    placeholder="PASSWORD"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-stone-500 hover:text-white transition-colors cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-white text-black hover:bg-black hover:text-white hover:border-white border border-transparent transition-all text-xs font-bold uppercase tracking-widest cursor-pointer text-center font-sans"
              >
                Sign-In Verify
              </button>
            </form>

          </div>
        </div>
      )}

    </div>
  );
}
