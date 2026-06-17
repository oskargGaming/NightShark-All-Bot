import { useState, useEffect } from "react";
import { api } from "../api";
import { AccessCode, WebTeamAccount, BlacklistedServer } from "../types";
import { Shield, Key, Clock, Trash2, Plus, Users, UserCheck, Ban } from "lucide-react";

interface AdminPanelProps {
  adminToken: string;
  onLogout: () => void;
}

export default function AdminPanel({ adminToken, onLogout }: AdminPanelProps) {
  const [codes, setCodes] = useState<AccessCode[]>([]);
  const [team, setTeam] = useState<WebTeamAccount[]>([]);
  const [blacklist, setBlacklist] = useState<BlacklistedServer[]>([]);
  const [durationHours, setDurationHours] = useState<number>(24);
  const [maxUses, setMaxUses] = useState<number>(0); // 0 = unlimited
  const [targetBot, setTargetBot] = useState<"nightshark" | "architect" | "both">("both");
  const [newMemberName, setNewMemberName] = useState("");
  const [newMemberRole, setNewMemberRole] = useState("SUPPORTER");
  const [newPermissions, setNewPermissions] = useState<string[]>(["FLAG_VIEW_LOGS"]);
  const [newBlacklistServerId, setNewBlacklistServerId] = useState("");
  const [newBlacklistReason, setNewBlacklistReason] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const loadData = async () => {
    try {
      const liveCodes = await api.getAccessCodes(adminToken);
      setCodes(liveCodes);

      const liveTeam = await api.getTeam(adminToken);
      setTeam(liveTeam);

      const liveBlacklist = await api.getBlacklist(adminToken);
      setBlacklist(liveBlacklist);
    } catch (err: any) {
      setErrorMsg("Schnittstellenverlust: " + err.message);
    }
  };

  useEffect(() => {
    loadData();
  }, [adminToken]);

  const handleGenerateCode = async () => {
    setErrorMsg("");
    setSuccessMsg("");
    try {
      const hours = durationHours === 0 ? null : durationHours;
      const uses = maxUses === 0 ? null : maxUses;
      await api.generateAccessCode(adminToken, hours, uses, targetBot);
      setSuccessMsg("System-Sicherheitsschlüssel erfolgreich injiziert.");
      loadData();
    } catch (err: any) {
      setErrorMsg("Fehler beim Generieren: " + err.message);
    }
  };

  const handleDeleteCode = async (id: string) => {
    setErrorMsg("");
    setSuccessMsg("");
    try {
      await api.deleteAccessCode(adminToken, id);
      setSuccessMsg("Sicherheitsschlüssel deaktiviert.");
      loadData();
    } catch (err: any) {
      setErrorMsg("Fehler: " + err.message);
    }
  };

  const handleAddMember = async () => {
    setErrorMsg("");
    setSuccessMsg("");
    if (!newMemberName.trim()) {
      setErrorMsg("Name ist erforderlich.");
      return;
    }
    try {
      await api.createTeamMember(adminToken, newMemberName, newMemberRole, newPermissions);
      setSuccessMsg(`Web-Teammitglied '${newMemberName}' registriert.`);
      setNewMemberName("");
      loadData();
    } catch (err: any) {
      setErrorMsg("Fehler: " + err.message);
    }
  };

  const togglePermission = (perm: string) => {
    if (newPermissions.includes(perm)) {
      setNewPermissions(newPermissions.filter(p => p !== perm));
    } else {
      setNewPermissions([...newPermissions, perm]);
    }
  };

  const handleAddBlacklist = async () => {
    setErrorMsg("");
    setSuccessMsg("");
    if (!newBlacklistServerId.trim()) {
      setErrorMsg("Eine gültige Discord Server-ID ist erforderlich.");
      return;
    }
    try {
      await api.blacklistServer(adminToken, newBlacklistServerId.trim(), newBlacklistReason);
      setSuccessMsg(`Server ${newBlacklistServerId} wurde auf die Blacklist gesetzt.`);
      setNewBlacklistServerId("");
      setNewBlacklistReason("");
      loadData();
    } catch (err: any) {
      setErrorMsg("Fehler beim Hinzufügen: " + err.message);
    }
  };

  const handleRemoveFromBlacklist = async (serverId: string) => {
    setErrorMsg("");
    setSuccessMsg("");
    try {
      await api.deleteFromBlacklist(adminToken, serverId);
      setSuccessMsg(`Server-ID '${serverId}' wurde von der Blacklist entfernt.`);
      loadData();
    } catch (err: any) {
      setErrorMsg("Fehler beim Löschen: " + err.message);
    }
  };

  return (
    <div className="space-y-8 animate-fade-in" id="admin-panel">
      {/* Header and alerts */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-[#333333] pb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tighter uppercase flex items-center gap-3">
            <Shield className="w-6 h-6 text-white" />
            ADMIN-CENTRAL STATION
          </h1>
          <p className="text-xs text-[#999999] uppercase tracking-widest font-mono mt-1">
            Systemoperator: MASTER ADMIN // Session Authenticated
          </p>
        </div>
        <button
          onClick={onLogout}
          className="px-4 py-2 border border-[#ff3b30] text-[#ff3b30] hover:bg-[#ff3b30] hover:text-white transition-all text-xs uppercase tracking-widest font-bold self-start sm:self-auto cursor-pointer"
        >
          Logout Admin Terminal
        </button>
      </div>

      {errorMsg && (
        <div className="p-4 bg-black border border-[#ff3b30] text-[#ff3b30] text-xs font-mono uppercase tracking-wider">
          ⚠️ ALARM: {errorMsg}
        </div>
      )}

      {successMsg && (
        <div className="p-4 bg-black border border-white text-white text-xs font-mono uppercase tracking-wider">
          ✓ SYSTEM: {successMsg}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* ACCESS CODE GENERATOR */}
        <div className="bg-[#121212] border border-[#333333] p-6 space-y-6">
          <div className="flex items-center gap-2 border-b border-[#222222] pb-3">
            <Key className="w-5 h-5 text-white" />
            <h2 className="text-sm font-bold uppercase tracking-wider">Schlüsselerzeugung (Access Codes)</h2>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-[10px] uppercase tracking-widest text-[#666666] block mb-2">
                Ablaufzeit des Schlüssels: <span className="text-white font-mono font-bold">{durationHours === 0 ? "UNENDLICH" : `${durationHours} Stunden`}</span>
              </label>
              <input
                type="range"
                min="0"
                max="168"
                step="2"
                value={durationHours}
                onChange={(e) => setDurationHours(parseInt(e.target.value))}
                className="w-full h-1 bg-[#222222] rounded-lg appearance-none cursor-pointer accent-white"
              />
              <div className="flex justify-between text-[9px] text-[#666666] font-mono mt-1">
                <span>0h (Infinity)</span>
                <span>24h</span>
                <span>7 Tage (168h)</span>
              </div>
            </div>

            <div>
              <label className="text-[10px] uppercase tracking-widest text-[#666666] block mb-1">
                Zulässiger Bot (Schlüssel-Gültigkeit):
              </label>
              <select
                value={targetBot}
                onChange={(e) => setTargetBot(e.target.value as any)}
                className="w-full bg-black border border-[#333333] p-3 text-xs text-white font-mono focus:border-white outline-none"
              >
                <option value="both">Sowohl Discord Architekt als auch NightShark</option>
                <option value="architect">Ausschließlich Discord Architekt Bot</option>
                <option value="nightshark">Ausschließlich NightShark Guard Bot</option>
              </select>
            </div>

            <div>
              <label className="text-[10px] uppercase tracking-widest text-[#666666] block mb-1">
                Maximale Nutzungen: <span className="text-white font-mono font-bold">{maxUses === 0 ? "UNLIMITIERT" : `${maxUses} Verwendungen`}</span>
              </label>
              <input
                type="number"
                min="0"
                value={maxUses}
                onChange={(e) => setMaxUses(Math.max(0, parseInt(e.target.value) || 0))}
                className="w-full bg-black border border-[#333333] p-3 text-xs text-white font-mono focus:border-white outline-none"
                placeholder="0 für unbegrenzt"
              />
            </div>

            <button
              onClick={handleGenerateCode}
              className="w-full py-3 bg-white text-black hover:bg-black hover:text-white hover:border-white border border-transparent transition-all text-xs font-bold uppercase tracking-widest cursor-pointer"
            >
              Systemschlüssel Injizieren
            </button>
          </div>

          {/* CODES LIST */}
          <div className="pt-4 border-t border-[#222222] space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#999999] mb-2">Aktive Schlüsselregister</h3>
            <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
              {codes.length === 0 ? (
                <p className="text-xs text-[#555555] italic font-mono uppercase">Keine Generatoren registriert.</p>
              ) : (
                codes.map((c) => (
                  <div key={c.id} className="bg-black border border-[#222222] p-3 flex justify-between items-center text-xs font-mono">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-white font-bold tracking-tight select-all">{c.code}</span>
                        <span className={`text-[9px] px-1.5 py-0.2 rounded font-sans font-bold uppercase ${
                          c.targetBot === "architect" 
                            ? "bg-[#112211] text-[#71F271] border border-[#1b3f1b]" 
                            : c.targetBot === "nightshark" 
                            ? "bg-[#221111] text-[#F27171] border border-[#3f1b1b]" 
                            : "bg-[#222222] text-[#cccccc] border border-[#444444]"
                        }`}>
                          {c.targetBot === "architect" ? "Architect" : c.targetBot === "nightshark" ? "NightShark" : "Beide"}
                        </span>
                      </div>
                      <div className="text-[9px] text-[#666666] flex flex-wrap gap-x-3">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {c.expiresAt ? new Date(c.expiresAt).toLocaleString() : "unbegrenzt"}
                        </span>
                        <span>Uses: {c.uses}/{c.maxUses || "∞"}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteCode(c.id)}
                      className="p-1 hover:text-[#ff3b30] text-[#555555] transition-colors cursor-pointer"
                      title="Schlüssel löschen"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* WEB-TEAM MANAGEMENT */}
        <div className="bg-[#121212] border border-[#333333] p-6 space-y-6">
          <div className="flex items-center gap-2 border-b border-[#222222] pb-3">
            <Users className="w-5 h-5 text-white" />
            <h2 className="text-sm font-bold uppercase tracking-wider">Web-Team-Verwaltung (Multi-Account)</h2>
          </div>

          {/* ADD TEAM FORM */}
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] uppercase tracking-widest text-[#666666] block mb-1">Benutzername (Web-Login)</label>
                <input
                  type="text"
                  value={newMemberName}
                  onChange={(e) => setNewMemberName(e.target.value)}
                  className="w-full bg-black border border-[#333333] p-3 text-xs text-white font-mono focus:border-white outline-none"
                  placeholder="z.B. Supporter02"
                />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-widest text-[#666666] block mb-1">Dienstgrad (Rolle)</label>
                <select
                  value={newMemberRole}
                  onChange={(e) => setNewMemberRole(e.target.value)}
                  className="w-full bg-black border border-[#333333] p-3 text-xs text-white font-mono focus:border-white outline-none"
                >
                  <option value="SUPPORTER">Supporter (Standard)</option>
                  <option value="SUB_ADMIN">Sub-Admin (Erweitert)</option>
                  <option value="ADMIN">Master-Admin (Vollmachten)</option>
                </select>
              </div>
            </div>

            {/* Permissions flags */}
            <div>
              <span className="text-[10px] uppercase tracking-widest text-[#666666] block mb-2">Berechtigungs-Flags</span>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { key: "FLAG_VIEW_LOGS", label: "View Telemetry Logs" },
                  { key: "FLAG_GENERATE_CODES", label: "Generate Keys" },
                  { key: "FLAG_FULL_ACCESS", label: "Full Settings Override" }
                ].map((perm) => (
                  <label key={perm.key} className="flex items-center space-x-2 p-2 border border-[#222222] bg-black text-xs text-stone-300 capitalize select-none cursor-pointer hover:border-[#444444]">
                    <input
                      type="checkbox"
                      checked={newPermissions.includes(perm.key)}
                      onChange={() => togglePermission(perm.key)}
                      className="accent-white cursor-pointer"
                    />
                    <span>{perm.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <button
              onClick={handleAddMember}
              className="w-full py-3 bg-white text-black hover:bg-black hover:text-white border border-transparent transition-all text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2 cursor-pointer"
            >
              <Plus className="w-4 h-4" /> Teammitglied Autorisieren
            </button>
          </div>

          {/* ACTIVE ACCOUNTS LIST */}
          <div className="pt-4 border-t border-[#222222] space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#999999] mb-2 font-mono">Registrierte Webmitarbeiter</h3>
            <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
              {team.map((t, idx) => (
                <div key={idx} className="bg-black border border-[#222222] p-3 flex justify-between items-center text-xs font-mono">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <UserCheck className="w-3.5 h-3.5 text-white" />
                      <span className="text-white font-bold">{t.username}</span>
                      <span className="text-[9px] bg-[#222222] border border-[#333333] px-1.5 py-0.5 text-[#aaaaaa] font-sans font-bold uppercase">{t.role}</span>
                    </div>
                    <div className="text-[9px] text-[#666666] flex flex-wrap gap-1.5">
                      {t.permissions.map((p, pIdx) => (
                        <span key={pIdx} className="border border-[#222222] bg-[#0c0c0c] px-1 py-0.2 text-[#888888] font-mono">
                          {p.toLowerCase()}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>

      </div>

      {/* DISCORD SERVER BLACKLIST SECTION */}
      <div className="bg-[#121212] border border-[#333333] p-6 space-y-6">
        <div className="flex items-center gap-2 border-b border-[#222222] pb-3">
          <Ban className="w-5 h-5 text-[#ff3b30]" />
          <h2 className="text-sm font-bold uppercase tracking-wider text-white">Discord Server Blacklist</h2>
        </div>

        <p className="text-xs text-stone-400 font-sans leading-relaxed">
          Verwalte die Server-Blacklist. Wenn ein Bot (NightShark oder Architect) zu einem Server eingeladen wird, der sich auf dieser Liste befindet, verlässt er ihn sofort. Falls sich der Bot bereits auf dem Server befindet, verlässt er ihn unmittelbar nach dem Hinzufügen zur Blacklist.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <div className="md:col-span-1">
            <label className="text-[10px] uppercase tracking-widest text-[#666666] block mb-1">Server ID (Guild ID)</label>
            <input
              type="text"
              value={newBlacklistServerId}
              onChange={(e) => setNewBlacklistServerId(e.target.value)}
              className="w-full bg-black border border-[#333333] p-3 text-xs text-white font-mono focus:border-white outline-none"
              placeholder="z.B. 123456789012345678"
            />
          </div>
          <div className="md:col-span-1">
            <label className="text-[10px] uppercase tracking-widest text-[#666666] block mb-1">Grund (Optional)</label>
            <input
              type="text"
              value={newBlacklistReason}
              onChange={(e) => setNewBlacklistReason(e.target.value)}
              className="w-full bg-black border border-[#333333] p-3 text-xs text-white font-mono focus:border-white outline-none"
              placeholder="z.B. Toxische Community / Spam / Scam"
            />
          </div>
          <div className="md:col-span-1">
            <button
              onClick={handleAddBlacklist}
              className="w-full py-3 bg-[#ff3b30] hover:bg-black hover:text-[#ff3b30] hover:border-[#ff3b30] text-white transition-all text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2 cursor-pointer border border-transparent"
            >
              <Ban className="w-4 h-4" /> Server sperren (Blacklist)
            </button>
          </div>
        </div>

        {/* BLACKLIST TABLE/LIST */}
        <div className="pt-4 border-t border-[#222222] space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#999999] font-mono">Gesperrte Server-Register</h3>
          
          <div className="overflow-x-auto">
            {blacklist.length === 0 ? (
              <p className="text-xs text-[#555555] italic font-mono uppercase">Keine Server auf der Blacklist registriert.</p>
            ) : (
              <table className="w-full border-collapse text-left text-xs font-mono">
                <thead>
                  <tr className="border-b border-[#222222] text-[#666666]">
                    <th className="py-2 px-3 uppercase text-[9px] tracking-widest font-bold">Server ID</th>
                    <th className="py-2 px-3 uppercase text-[9px] tracking-widest font-bold">Grund</th>
                    <th className="py-2 px-3 uppercase text-[9px] tracking-widest font-bold">Sperrdatum</th>
                    <th className="py-2 px-3 text-right uppercase text-[9px] tracking-widest font-bold">Aktion</th>
                  </tr>
                </thead>
                <tbody>
                  {blacklist.map((item) => (
                    <tr key={item.id} className="border-b border-[#181818] hover:bg-[#151515] transition-colors">
                      <td className="py-3 px-3 text-white font-bold select-all">{item.serverId}</td>
                      <td className="py-3 px-3 text-stone-300">{item.reason}</td>
                      <td className="py-3 px-3 text-[#666666]">{new Date(item.createdAt).toLocaleString()}</td>
                      <td className="py-3 px-3 text-right">
                        <button
                          onClick={() => handleRemoveFromBlacklist(item.serverId)}
                          className="px-2.5 py-1 text-[10px] uppercase border border-[#333333] text-[#aaaaaa] hover:border-[#ff3b30] hover:text-[#ff3b30] transition-all font-bold tracking-wider cursor-pointer font-sans"
                        >
                          Entsperren
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

    </div>
  );
}
