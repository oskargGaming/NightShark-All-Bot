import { useState, useEffect } from "react";
import { api } from "../api";
import { DiscordServerMap } from "../types";
import { 
  Lock, KeyRound, Sparkles, Plus, CheckCircle, 
  Workflow, Database, Cpu, PlusCircle, HelpCircle,
  RotateCcw, Trash2, Shield, Users, CheckSquare, Square, Check
} from "lucide-react";

interface ArchitectDashboardProps {
  serverId: string;
  onSetServerId: (id: string | any) => void;
  sessionToken: string;
  onSessionVerified: (token: string) => void;
}

export default function ArchitectDashboard({
  serverId,
  onSetServerId,
  sessionToken,
  onSessionVerified
}: ArchitectDashboardProps) {
  const [passcode, setPasscode] = useState("");
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [deleteFirst, setDeleteFirst] = useState(false);
  
  // Prompt values
  const [aiPrompt, setAiPrompt] = useState(
    "Erstelle einen hochprofessionellen, düsteren E-Sports-Server für Valorant mit separaten Teambereichen, Turnierecken und passenden Emojis"
  );
  
  // Manual adding values
  const [manualCatName, setManualCatName] = useState("SUPPORT SECTOR");
  const [manualChanName, setManualChanName] = useState("📢-security-announcements");
  const [manualChanType, setManualChanType] = useState("TEXT");
  
  // Loaded Server blueprint
  const [activeLayout, setActiveLayout] = useState<DiscordServerMap | null>(null);

  // Hover/Click detailed permissions states
  const [focusedRole, setFocusedRole] = useState<any | null>(null);
  const [clickedRole, setClickedRole] = useState<any | null>(null);

  // Bulk edit state
  const [selectedBulkRoles, setSelectedBulkRoles] = useState<string[]>([]);
  const [selectedBulkPermissions, setSelectedBulkPermissions] = useState<string[]>([]);
  const [bulkIsApplying, setBulkIsApplying] = useState(false);

  const COMMON_DISCORD_PERMISSIONS = [
    "VIEW_CHANNEL",
    "SEND_MESSAGES",
    "READ_MESSAGE_HISTORY",
    "ATTACH_FILES",
    "MANAGE_CHANNELS",
    "MANAGE_ROLES",
    "KICK_MEMBERS",
    "BAN_MEMBERS",
    "ADMINISTRATOR"
  ];

  const presets = {
    "Read-only": ["VIEW_CHANNEL", "READ_MESSAGE_HISTORY"],
    "Standard Member": ["VIEW_CHANNEL", "SEND_MESSAGES", "READ_MESSAGE_HISTORY", "CONNECT", "SPEAK", "ATTACH_FILES"],
    "Moderator": ["VIEW_CHANNEL", "SEND_MESSAGES", "READ_MESSAGE_HISTORY", "CONNECT", "SPEAK", "ATTACH_FILES", "KICK_MEMBERS", "BAN_MEMBERS", "MANAGE_CHANNELS"]
  };

  const toggleSelectRole = (roleName: string) => {
    setSelectedBulkRoles(prev => 
      prev.includes(roleName) 
        ? prev.filter(r => r !== roleName) 
        : [...prev, roleName]
    );
  };

  const selectAllRoles = () => {
    if (!activeLayout) return;
    setSelectedBulkRoles(activeLayout.roles.map(r => r.name));
  };

  const deselectAllRoles = () => {
    setSelectedBulkRoles([]);
  };

  const toggleSelectPermission = (perm: string) => {
    setSelectedBulkPermissions(prev => 
      prev.includes(perm) 
        ? prev.filter(p => p !== perm) 
        : [...prev, perm]
    );
  };

  const handleApplyBulkPreset = async (presetName: string, permissions: string[]) => {
    if (selectedBulkRoles.length === 0) {
      setErrorMsg("Bitte wähle mindestens eine Rolle aus, auf die das Preset angewendet werden soll.");
      return;
    }
    if (!activeLayout || !serverId) {
      setErrorMsg("Kein aktives Layout geladen oder Server-ID nicht verknüpft.");
      return;
    }

    try {
      setBulkIsApplying(true);
      setErrorMsg("");
      setSuccessMsg("");

      const updatedRoles = activeLayout.roles.map(role => {
        if (selectedBulkRoles.includes(role.name)) {
          return {
            ...role,
            permissions: [...permissions]
          };
        }
        return role;
      });

      const nextLayout = {
        ...activeLayout,
        roles: updatedRoles
      };

      await api.saveServerLayout(serverId, nextLayout, sessionToken);
      setActiveLayout(nextLayout);
      setSuccessMsg(`Preset '${presetName}' erfolgreich auf ${selectedBulkRoles.length} Rolle(n) übertragen und synchronisiert!`);
    } catch (e: any) {
      handleApiError(e, "Fehler beim Anwenden des Presets.");
    } finally {
      setBulkIsApplying(false);
    }
  };

  const handleIncrementalBulkUpdate = async (action: "ADD" | "REMOVE") => {
    if (selectedBulkRoles.length === 0) {
      setErrorMsg("Bitte wähle mindestens eine Rolle aus.");
      return;
    }
    if (selectedBulkPermissions.length === 0) {
      setErrorMsg("Bitte wähle mindestens eine Berechtigung aus.");
      return;
    }
    if (!activeLayout || !serverId) {
      setErrorMsg("Kein aktives Layout geladen.");
      return;
    }

    try {
      setBulkIsApplying(true);
      setErrorMsg("");
      setSuccessMsg("");

      const updatedRoles = activeLayout.roles.map(role => {
        if (selectedBulkRoles.includes(role.name)) {
          let newPermissions = [...role.permissions];
          if (action === "ADD") {
            selectedBulkPermissions.forEach(p => {
              if (!newPermissions.includes(p)) {
                newPermissions.push(p);
              }
            });
          } else {
            newPermissions = newPermissions.filter(p => !selectedBulkPermissions.includes(p));
          }
          return {
            ...role,
            permissions: newPermissions
          };
        }
        return role;
      });

      const nextLayout = {
        ...activeLayout,
        roles: updatedRoles
      };

      await api.saveServerLayout(serverId, nextLayout, sessionToken);
      setActiveLayout(nextLayout);
      setSuccessMsg(`Änderung erfolgreich! Ausgewählte Rechte wurden bei ${selectedBulkRoles.length} Rolle(n) ${action === "ADD" ? "hinzugefügt" : "entfernt"}.`);
    } catch (e: any) {
      handleApiError(e, "Fehler bei der Massenaktualisierung.");
    } finally {
      setBulkIsApplying(false);
    }
  };

  const handleResetLayout = async () => {
    if (window.confirm("Möchtest du das aktuelle Layout wirklich zurücksetzen und ein neues Server-Design starten?")) {
      try {
        if (serverId) {
          await api.resetServerLayout(serverId, sessionToken);
        }
        setActiveLayout(null);
        setSuccessMsg("Layout erfolgreich zurückgesetzt. Starte eine frische Synthese!");
        setErrorMsg("");
        setFocusedRole(null);
        setClickedRole(null);
        setSelectedBulkRoles([]);
        setSelectedBulkPermissions([]);
      } catch (err: any) {
        handleApiError(err, "Fehler beim Zurücksetzen des Layouts.");
      }
    }
  };

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

  // Validate session token on mount & verify periodically in the background
  useEffect(() => {
    const checkExistingSession = async () => {
      if (sessionToken) {
        const valid = await api.checkSession(sessionToken, "architect");
        if (valid) {
          setIsUnlocked(true);
          loadLayout();
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
        const valid = await api.checkSession(sessionToken, "architect");
        if (!valid) {
          setIsUnlocked(false);
          onSessionVerified("");
          setErrorMsg("Sitzung beendet: Der verwendete Zugriffscode wurde gelöscht oder deaktivert.");
        }
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [sessionToken, serverId, isUnlocked]);

  const loadLayout = async () => {
    if (!serverId) return;
    try {
      const layout = await api.getServerLayout(serverId);
      if (layout) {
        setActiveLayout(layout);
      } else {
        setActiveLayout(null);
      }
    } catch (e) {
      // Ignore
    }
  };

  const handleApplyLayout = async () => {
    setErrorMsg("");
    setSuccessMsg("");
    if (!serverId) {
      setErrorMsg("Bitte verknüpfe zuerst deine Server-ID im rechten Steuerungsfeld.");
      return;
    }

    const confirmMessage = deleteFirst
      ? "Sicherheitshinweis: Möchtest du wirklich zuerst ALLE vorhandenen Kanäle und Rollen auf dem echten Server löschen und dann das neue Layout aufspielen?"
      : "Möchtest du dieses Layout wirklich auf deinen realen Discord-Server aufspielen?";

    if (!window.confirm(confirmMessage)) {
      return;
    }

    try {
      setIsApplying(true);
      const res = await api.applyServerLayout(serverId, sessionToken, deleteFirst);
      if (res.success) {
        setSuccessMsg(
          deleteFirst 
            ? "Server-Strukturen wurden erfolgreich gereinigt und neue Kanäle & Rollen wurden in Echtzeit aufgespielt!"
            : "Strukturen wurden erfolgreich und in Echtzeit auf deinen echten Discord-Server aufgespielt!"
        );
      }
    } catch (err: any) {
      handleApiError(err, "Fehler beim Aufspielen/Bereinigen der Serverstrukturen.");
    } finally {
      setIsApplying(false);
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
      const res = await api.verifyCode(passcode, "architect");
      if (res.success && res.sessionToken) {
        onSessionVerified(res.sessionToken);
        setIsUnlocked(true);
        setSuccessMsg("Sitzungsauthentifizierung erfolgreich abgeschlossen.");
      }
    } catch (err: any) {
      setErrorMsg("Zugriffsschranke gesperrt: " + err.message);
    }
  };

  const handleAIGenerate = async () => {
    setErrorMsg("");
    setSuccessMsg("");
    if (!serverId) {
      setErrorMsg("Bitte verknüpfe zuerst deine Server-ID im rechten Steuerungsfeld.");
      return;
    }
    if (!aiPrompt.trim()) {
      setErrorMsg("Ein Prompt ist für den KI-Modus erforderlich.");
      return;
    }

    try {
      setIsGenerating(true);
      const res = await api.generateServerLayout(aiPrompt, serverId, sessionToken);
      if (res.success && res.layout) {
        setActiveLayout(res.layout);
        setSuccessMsg("Generative Synthese durch KI-Inferenz perfekt abgeschlossen!");
      }
    } catch (err: any) {
      handleApiError(err, "Synthesat-Fehler beim Aufbau der Strukturen.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleManualBuild = async () => {
    setErrorMsg("");
    setSuccessMsg("");
    if (!serverId) {
      setErrorMsg("Bitte verknüpfe zuerst deine Server-ID im rechten Steuerungsfeld.");
      return;
    }
    if (!manualChanName.trim()) {
      setErrorMsg("Ein Kanalname ist erforderlich.");
      return;
    }

    try {
      const res = await api.buildManualChannel(
        serverId,
        manualCatName,
        manualChanName,
        manualChanType,
        sessionToken
      );
      if (res.success && res.layout) {
        setActiveLayout(res.layout);
        setSuccessMsg(`Manueller Kanal '${manualChanName}' erfolgreich auf dem Server injiziert.`);
        setManualChanName("");
      }
    } catch (err: any) {
      handleApiError(err, "Manual Builder gesperrt.");
    }
  };

  // 1. LOCKED VIEW
  if (!isUnlocked) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-4 text-center max-w-md mx-auto animate-fade-in" id="locked-architect">
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

  // 2. UNLOCKED VIEW
  return (
    <div className="space-y-8 animate-fade-in" id="architect-workspace">
      
      {/* HEADER SECTION */}
      <div className="border-b border-[#333333] pb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tighter uppercase flex items-center gap-3">
            <Workflow className="w-6 h-6 text-white" />
            DISCORD ARCHITECT WORKSTATION
          </h1>
          <p className="text-xs text-[#999999] uppercase tracking-widest font-mono mt-1">
            Core AI Engine: active // Role overwrite matrices enabled
          </p>
        </div>

        {/* INVITE BUTTON FOR BOT */}
        <a
          href="https://discord.com/oauth2/authorize?client_id=1489398255824404530"
          target="_blank"
          referrerPolicy="no-referrer"
          className="px-4 py-2 border border-white text-white hover:bg-white hover:text-black transition-all text-xs uppercase tracking-widest font-bold text-center"
        >
          ➕ Architekt Bot Einladen
        </a>
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

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
        
        {/* LEFT COMPILER PANEL (AI AND MANUAL PROMPTING) */}
        <div className="lg:col-span-3 space-y-8">
          
          {/* AI MODE */}
          <div className="bg-[#121212] border border-[#333333] p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-[#222222] pb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-white" />
                <h2 className="text-sm font-bold uppercase tracking-wider text-white">Synthesizer (KI-Modus)</h2>
              </div>
              <span className="text-[9px] bg-[#222222] text-[#999999] px-2 py-0.5 font-mono uppercase tracking-widest">GEMINI 3.5 FLASH</span>
            </div>

            <p className="text-xs text-[#999999] leading-relaxed">
              Formuliere einen detaillierten Text-Entwurf deines Wunschservers. Unser neuronales Sprachmodell errechnet und kompiliert daraus Kategorien, Textkanäle, Bühnen und das komplette Berechtigungsgefüge.
            </p>

            <div className="space-y-2">
              <textarea
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                disabled={isGenerating}
                placeholder="z.B. Erstelle einen hochprofessionellen, düsteren E-Sports-Server für Valorant..."
                className="w-full h-24 bg-black border border-[#222222] p-4 text-xs text-stone-200 focus:border-white outline-none resize-none placeholder-stone-800 leading-relaxed"
              />
            </div>

            <button
              onClick={handleAIGenerate}
              disabled={isGenerating}
              className={`w-full py-3 bg-white text-black hover:bg-black hover:text-white hover:border-white border border-transparent transition-all text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2 cursor-pointer ${
                isGenerating ? "opacity-50 cursor-not-allowed" : ""
              }`}
            >
              {isGenerating ? (
                <>
                  <Cpu className="w-4 h-4 animate-spin" /> Synthetisiere Server-Strukturen...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" /> KI-Generierung Starten
                </>
              )}
            </button>
          </div>

          {/* MANUAL MODUS */}
          <div className="bg-[#121212] border border-[#333333] p-6 space-y-4">
            <div className="flex items-center gap-2 border-b border-[#222222] pb-3">
              <PlusCircle className="w-4 h-4 text-white" />
              <h2 className="text-sm font-bold uppercase tracking-wider text-white">Injektor (Manueller Modus)</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] uppercase tracking-widest text-[#666666]">Kategorie Name</label>
                <input
                  type="text"
                  value={manualCatName}
                  onChange={(e) => setManualCatName(e.target.value)}
                  className="w-full bg-black border border-[#222222] p-2.5 text-xs text-stone-200 uppercase font-mono focus:border-white outline-none"
                  placeholder="STAFF ARTEFACTS"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] uppercase tracking-widest text-[#666666]">Kanal Name</label>
                <input
                  type="text"
                  value={manualChanName}
                  onChange={(e) => setManualChanName(e.target.value)}
                  className="w-full bg-black border border-[#222222] p-2.5 text-xs text-stone-200 font-mono focus:border-white outline-none"
                  placeholder="💬-security-level-one"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] uppercase tracking-widest text-[#666666]">Kanal-Typus</label>
                <select
                  value={manualChanType}
                  onChange={(e) => setManualChanType(e.target.value)}
                  className="w-full bg-black border border-[#222222] p-2.5 text-xs text-stone-200 font-mono focus:border-white outline-none"
                >
                  <option value="TEXT">TEXT (Standard)</option>
                  <option value="VOICE">VOICE (Audio)</option>
                  <option value="STAGE">STAGE (Bühne)</option>
                  <option value="ANNOUNCEMENT">ANNOUNCEMENT (News)</option>
                </select>
              </div>
            </div>

            <button
              onClick={handleManualBuild}
              className="w-full py-3 bg-black text-white hover:bg-white hover:text-black hover:border-black border border-[#333333] transition-all text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2 cursor-pointer"
            >
              Kanal Direkt Hinzufügen (M-Inject)
            </button>
          </div>

          {/* MASSEN-ROLLEN-EDITOR */}
          <div className="bg-[#121212] border border-[#333333] p-6 space-y-5">
            <div className="flex items-center gap-2 border-b border-[#222222] pb-3">
              <Shield className="w-4 h-4 text-white" />
              <h2 className="text-sm font-bold uppercase tracking-wider text-white">Massen-Rollen-Editor (Bulk Setup)</h2>
            </div>

            {!activeLayout ? (
              <div className="bg-black border border-dashed border-[#222222] p-6 text-center text-[10px] text-stone-500 uppercase tracking-widest font-mono">
                💡 Kein aktives Layout geladen. Generiere zuerst ein Server-Layout mit dem KI-Synthesizer oder verknüpfe den Bot, um Rollen anzupassen.
              </div>
            ) : (
              <div className="space-y-4 animate-fade-in text-left">
                <p className="text-xs text-[#999999] leading-relaxed">
                  Passe Berechtigungen für mehrere Server-Rollen gleichzeitig an. Erteile vordefinierte Rechtepakete oder schalte Rechte für ausgewählte Rollen gezielt frei/stumm.
                </p>

                {/* 1. SELECTION ROLES */}
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <span className="text-[10px] uppercase tracking-widest text-[#666666] font-semibold block">Rollen auswählen ({selectedBulkRoles.length} markiert)</span>
                    <div className="flex gap-2">
                      <button
                        onClick={selectAllRoles}
                        className="text-[9px] text-[#999999] hover:text-white uppercase font-mono tracking-wider bg-transparent border-0 cursor-pointer"
                      >
                        [Alle]
                      </button>
                      <button
                        onClick={deselectAllRoles}
                        className="text-[9px] text-[#999999] hover:text-[#ff3b30] uppercase font-mono tracking-wider bg-transparent border-0 cursor-pointer"
                      >
                        [Aufheben]
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-1.5 max-h-[140px] overflow-y-auto border border-[#222222] p-2 bg-black">
                    {activeLayout.roles.map((role) => {
                      const isChecked = selectedBulkRoles.includes(role.name);
                      return (
                        <label
                          key={role.name}
                          className={`flex items-center gap-2 p-1.5 cursor-pointer text-[10px] font-mono select-none transition-all border ${
                            isChecked 
                              ? "bg-[#161616] border-[#444444] text-white" 
                              : "border-transparent text-stone-400 hover:bg-[#0c0c0c] hover:text-white"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleSelectRole(role.name)}
                            className="hidden"
                          />
                          <div className="w-3.5 h-3.5 border border-[#333333] flex items-center justify-center bg-black shrink-0">
                            {isChecked && <Check className="w-2.5 h-2.5 text-white" />}
                          </div>
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: role.color }} />
                          <span className="truncate">{role.name}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                {/* 2. APPLY PRESETS */}
                <div className="space-y-2 border-t border-[#222222] pt-3.5">
                  <span className="text-[10px] uppercase tracking-widest text-[#666666] font-semibold block">Quick-Presets (Überschreiben)</span>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      disabled={bulkIsApplying || selectedBulkRoles.length === 0}
                      onClick={() => handleApplyBulkPreset("Read-only / Nur-Lesen", presets["Read-only"])}
                      className="p-2 border border-[#222222] hover:border-white bg-[#151515] hover:bg-black transition-all text-left font-mono cursor-pointer disabled:opacity-30 disabled:hover:border-[#222222] disabled:hover:bg-[#151515]"
                    >
                      <p className="font-bold text-xs text-white">Nur-Lesen</p>
                      <span className="text-[8px] text-[#666666] uppercase block mt-0.5">VIEW, READ_HIST</span>
                    </button>
                    <button
                      disabled={bulkIsApplying || selectedBulkRoles.length === 0}
                      onClick={() => handleApplyBulkPreset("Standard Member / Mitglied", presets["Standard Member"])}
                      className="p-2 border border-[#222222] hover:border-white bg-[#151515] hover:bg-black transition-all text-left font-mono cursor-pointer disabled:opacity-30 disabled:hover:border-[#222222] disabled:hover:bg-[#151515]"
                    >
                      <p className="font-bold text-xs text-white">Mitglied</p>
                      <span className="text-[8px] text-[#666666] uppercase block mt-0.5">+SEND, SPEAK</span>
                    </button>
                    <button
                      disabled={bulkIsApplying || selectedBulkRoles.length === 0}
                      onClick={() => handleApplyBulkPreset("Moderator", presets["Moderator"])}
                      className="p-2 border border-[#222222] hover:border-white bg-[#151515] hover:bg-black transition-all text-left font-mono cursor-pointer disabled:opacity-30 disabled:hover:border-[#222222] disabled:hover:bg-[#151515]"
                    >
                      <p className="font-bold text-xs text-white">Moderator</p>
                      <span className="text-[8px] text-[#666666] uppercase block mt-0.5">+BAN, KICK</span>
                    </button>
                  </div>
                </div>

                {/* 3. INCREMENTAL EDITING */}
                <div className="space-y-2 border-t border-[#222222] pt-3.5">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[10px] uppercase tracking-widest text-[#666666] font-semibold block">Inkrementelle Feineinstellung ({selectedBulkPermissions.length} gewählt)</span>
                    {selectedBulkPermissions.length > 0 && (
                      <button
                        onClick={() => setSelectedBulkPermissions([])}
                        className="text-[9px] text-[#ff3b30] hover:text-white uppercase font-mono tracking-tight bg-transparent border-0 cursor-pointer"
                      >
                        [Leeren]
                      </button>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-3 gap-1.5 p-2 bg-black border border-[#222222] max-h-[120px] overflow-y-auto">
                    {COMMON_DISCORD_PERMISSIONS.map((perm) => {
                      const isChecked = selectedBulkPermissions.includes(perm);
                      return (
                        <label
                          key={perm}
                          className={`flex items-start gap-1 p-1 cursor-pointer text-[9px] font-mono select-none transition-all border ${
                            isChecked 
                              ? "bg-[#111111] border-[#333333] text-white" 
                              : "border-transparent text-stone-500 hover:text-white hover:bg-[#080808]"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleSelectPermission(perm)}
                            className="hidden"
                          />
                          <span className="w-2.5 h-2.5 mt-0.5 border border-[#333333] flex items-center justify-center bg-black shrink-0">
                            {isChecked && <Check className="w-2 h-2 text-white" />}
                          </span>
                          <span className="truncate leading-none block">{perm}</span>
                        </label>
                      );
                    })}
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <button
                      disabled={bulkIsApplying || selectedBulkRoles.length === 0 || selectedBulkPermissions.length === 0}
                      onClick={() => handleIncrementalBulkUpdate("ADD")}
                      className="py-2.5 bg-white text-black hover:bg-black hover:text-white border border-transparent hover:border-white transition-all text-[10px] font-mono uppercase font-bold tracking-widest cursor-pointer disabled:opacity-30 disabled:hover:bg-white disabled:hover:text-black disabled:hover:border-transparent flex items-center justify-center gap-1.5"
                    >
                      <Plus className="w-3 h-3" /> Massen-Add (+)
                    </button>
                    <button
                      disabled={bulkIsApplying || selectedBulkRoles.length === 0 || selectedBulkPermissions.length === 0}
                      onClick={() => handleIncrementalBulkUpdate("REMOVE")}
                      className="py-2.5 bg-black text-rose-500 hover:bg-rose-950 hover:text-white border border-[#333333] hover:border-rose-500 transition-all text-[10px] font-mono uppercase font-bold tracking-widest cursor-pointer disabled:opacity-30 disabled:hover:bg-black disabled:hover:text-rose-500 disabled:hover:border-[#333333] flex items-center justify-center gap-1.5"
                    >
                      <Trash2 className="w-3 h-3" /> Massen-Drop (-)
                    </button>
                  </div>
                </div>

              </div>
            )}
          </div>

        </div>

        {/* RIGHT PREVIEW PANEL (REAL-TIME SERVER BLUEPRINT STRUCTURE) */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-[#121212] border border-[#333333] p-5 h-full flex flex-col justify-between min-h-[500px]">
            <div>
              <div className="border-b border-[#222222] pb-3 mb-4 flex justify-between items-center">
                <span className="text-xs uppercase font-bold text-white tracking-widest font-mono">Server-Layout Preview</span>
                <span className="text-[9px] text-[#666666] uppercase font-mono tracking-widest">
                  ID: {serverId ? serverId : "KEINE KOPPLUNG"}
                </span>
              </div>

              {activeLayout ? (
                <div className="space-y-6 select-text animate-fade-in text-stone-300">
                  {/* SERVER NAME */}
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-[9px] uppercase tracking-widest text-[#666666]">Strukturbezeichnung</span>
                      <h3 className="text-md font-bold text-white uppercase mt-0.5 tracking-tight font-mono">{activeLayout.name}</h3>
                    </div>
                    <button
                      onClick={handleResetLayout}
                      className="px-2.5 py-1 border border-[#333333] hover:border-[#ff3b30] text-[#888888] hover:text-[#ff3b30] bg-[#161616] tracking-wider transition-all duration-200 text-[9px] font-mono font-bold uppercase flex items-center gap-1.5 cursor-pointer"
                    >
                      <RotateCcw className="w-3 h-3" /> Reset
                    </button>
                  </div>

                  {/* CATEGORIES & CHANNELS TREE MAP */}
                  <div className="space-y-4 max-h-[300px] overflow-y-auto pr-1">
                    {activeLayout.categories.map((cat, catIdx) => (
                      <div key={catIdx} className="space-y-1.5 pl-2 border-l border-[#333333]">
                        <div className="text-[10px] font-bold text-white font-mono uppercase tracking-widest bg-[#1c1c1c] py-1 px-2">
                          📁 {cat.name}
                        </div>
                        <div className="pl-4 space-y-1 font-mono text-xs">
                          {cat.channels.map((chan, chanIdx) => (
                            <div key={chanIdx} className="flex justify-between items-center py-0.5 border-b border-[#181818] text-[#999999] hover:text-white">
                              <span className="flex items-center gap-1.5 flex-wrap">
                                <span className="truncate">
                                  {chan.type === "VOICE" ? "🔊 " : chan.type === "STAGE" ? "🎭 " : chan.type === "ANNOUNCEMENT" ? "📢 " : "💬 "}
                                  {chan.name}
                                </span>
                                {chan.rolesRequired && chan.rolesRequired.length > 0 && (
                                  <span 
                                    className="text-[7.5px] tracking-tight bg-red-950/40 border border-red-500/30 text-red-400 px-1 py-0.5 rounded-sm inline-flex items-center gap-0.5 leading-none shrink-0 font-sans"
                                    title={`Exklusiver Zugriff: ${chan.rolesRequired.join(", ")}`}
                                  >
                                    🔒 {chan.rolesRequired.join(", ")}
                                  </span>
                                )}
                                {chan.privacyCritical && (
                                  <span 
                                    className="text-[7.5px] tracking-tight bg-amber-950/40 border border-amber-500/30 text-amber-400 px-1 py-0.5 rounded-sm inline-flex items-center gap-0.5 leading-none shrink-0 font-sans cursor-help"
                                    title={`AI-Privatsphären-Audit: ${chan.privacyReason || "Sicherheitskritischer Raum"}`}
                                  >
                                    🛡️ Audit Pass
                                  </span>
                                )}
                              </span>
                              <span className="text-[8px] bg-[#222222] px-1 text-[#666666] uppercase">{chan.type}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* AI PRIVACY AUDIT & ROLE LOCK DISCOVERY */}
                  {activeLayout.categories.some(cat => cat.channels.some(ch => ch.privacyCritical)) && (
                    <div className="pt-3 border-t border-[#222222]">
                      <span className="text-[9px] uppercase tracking-widest text-[#ffcc00] font-bold flex items-center gap-1.5 font-mono">
                        <Shield className="w-3.5 h-3.5 text-amber-500 animate-pulse" /> AI-Privatsphären-Audit & Empfohlene Sperren
                      </span>
                      <p className="text-[8px] text-stone-500 uppercase tracking-tight mt-0.5 font-mono">
                        Automatisierte Identifikation von sicherheitskritischen Daten- und Diskursräumen.
                      </p>
                      
                      <div className="mt-2 space-y-1.5 max-h-[140px] overflow-y-auto pr-1">
                        {activeLayout.categories.flatMap(cat => 
                          cat.channels.filter(ch => ch.privacyCritical)
                        ).map((chan, sIdx) => {
                          const hasLocks = chan.rolesRequired && chan.rolesRequired.length > 0;
                          return (
                            <div key={sIdx} className="bg-black border border-[#1a1a1a] p-2 text-[10px] font-mono leading-relaxed flex flex-col gap-1 transition-colors hover:border-[#333333]">
                              <div className="flex justify-between items-center bg-[#090909] p-1 border-b border-[#121212]">
                                <span className="text-white font-bold flex items-center gap-1">
                                  {chan.type === "VOICE" ? "🔊 " : chan.type === "STAGE" ? "🎭 " : chan.type === "ANNOUNCEMENT" ? "📢 " : "💬 "}
                                  {chan.name}
                                </span>
                                <span className={`text-[7.5px] px-1 font-sans ${hasLocks ? "bg-red-950/40 text-red-400 border border-red-500/20" : "bg-amber-950/40 text-amber-400 border border-amber-500/20"}`}>
                                  {hasLocks ? `Locked: ${chan.rolesRequired?.join(", ")}` : "Recommended Lock"}
                                </span>
                              </div>
                              <p className="text-[9px] text-[#888888]">
                                {chan.privacyReason || "Dieser Kanal wurde als potenziell geschützter Raum identifiziert, um sensible Zugriffe zu regulieren."}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* AUTO-GENERATED ROLE ROSTER */}
                  <div className="pt-2 border-t border-[#222222]">
                    <span className="text-[9px] uppercase tracking-widest text-[#666666]">Autoritätshierarchie (Rollen & Rechte)</span>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 mt-2 select-all">
                      {activeLayout.roles.map((role, rIdx) => {
                        const isHovered = focusedRole?.name === role.name;
                        const isClicked = clickedRole?.name === role.name;
                        return (
                          <div 
                            key={rIdx} 
                            onMouseEnter={() => setFocusedRole(role)}
                            onMouseLeave={() => setFocusedRole(null)}
                            onClick={() => setClickedRole(isClicked ? null : role)}
                            className={`bg-black border p-1.5 text-[9px] font-mono transition-all duration-150 cursor-pointer text-left rounded-sm flex items-center justify-between gap-1.5 ${
                              isClicked 
                                ? "border-white bg-[#161616] shadow-[0_0_8px_rgba(255,255,255,0.1)] scale-[1.01]" 
                                : isHovered 
                                  ? "border-stone-400 bg-[#080808]" 
                                  : "border-[#222222]"
                            }`}
                          >
                            <div className="flex items-center gap-1.5 truncate">
                              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: role.color }} />
                              <span className="text-stone-300 font-medium truncate" title={role.name}>{role.name}</span>
                            </div>
                            <span className="text-[7.5px] text-stone-500 shrink-0 uppercase font-mono">
                              ({role.permissions.length})
                            </span>
                          </div>
                        );
                      })}
                    </div>

                    {/* PERMISSIONS PREVIEW CARD */}
                    <div className="mt-3">
                      {clickedRole || focusedRole ? (
                        (() => {
                          const active = clickedRole || focusedRole;
                          return (
                            <div className="bg-[#111111] border border-[#333333] p-3 text-xs font-mono animate-fade-in relative">
                              <div className="absolute right-2 top-2">
                                {clickedRole && (
                                  <button 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setClickedRole(null);
                                    }}
                                    className="text-[9px] text-[#ff3b30] hover:text-white uppercase font-sans tracking-tight cursor-pointer"
                                  >
                                    Clear Lock ❌
                                  </button>
                                )}
                              </div>
                              <div className="flex items-center gap-1.5 font-bold border-b border-[#222222] pb-1.5 mb-2">
                                <span className="w-2.5 h-2.5 rounded-full animate-pulse" style={{ backgroundColor: active.color }} />
                                <span className="text-white uppercase tracking-wider">{active.name}</span>
                                <span className="text-[8px] text-[#666666] font-normal uppercase">({clickedRole ? "Locked" : "Hovered"})</span>
                              </div>
                              <div className="space-y-1.5 max-h-[160px] overflow-y-auto pr-1">
                                {active.permissions.map((p: string, pIdx: number) => {
                                  let description = "Zuweisung allgemeiner Interaktionsbefugnisse des Discord Clients.";
                                  const upperP = p.toUpperCase();
                                  if (upperP.includes("ADMINISTRATOR")) {
                                    description = "Absolute Serverkontrolle. Erteilt alle Berechtigungsstufen des Systems.";
                                  } else if (upperP.includes("MANAGE_CHANNELS")) {
                                    description = "Erlaubt das Löschen, Bearbeiten und Erstellen neuer Diskurs-Kanäle.";
                                  } else if (upperP.includes("MANAGE_ROLES")) {
                                    description = "Hierarchische Verwaltung aller untergeordneten Serverrollen.";
                                  } else if (upperP.includes("BAN_MEMBERS") || upperP.includes("KICK_MEMBERS")) {
                                    description = "Sanktionsvollmacht: Permanenter Ausschluss oder Entlassung von Usern.";
                                  } else if (upperP.includes("VIEW_CHANNEL")) {
                                    description = "Erlaubt das Einsehen geschützter, thematischer Kanalsegmente.";
                                  } else if (upperP.includes("SEND_MESSAGES")) {
                                    description = "Erlaubt die aktive Sendung von Textbeiträgen in Schreibkanälen.";
                                  } else if (upperP.includes("CONNECT") || upperP.includes("SPEAK")) {
                                    description = "Sprachkanalrechte: Betreten und Audio-Übertragungen in Sprachräumen.";
                                  } else if (upperP.includes("MENTION_EVERYONE")) {
                                    description = "Erlaubt das Versenden globaler Benachrichtigungspings an alle User.";
                                  } else if (upperP.includes("READ_MESSAGE_HISTORY")) {
                                    description = "Gewährt Zugriff auf zurückliegende Textverläufe.";
                                  } else if (upperP.includes("ATTACH_FILES")) {
                                    description = "Upload-Berechtigung für Bild-, Ton- und Dokument-Anhänge.";
                                  }
                                  return (
                                    <div key={pIdx} className="text-[10px] pb-1 border-b border-[#181818] last:border-0">
                                      <span className="text-white font-semibold">• {p}</span>
                                      <p className="text-[9px] text-[#666666] leading-normal">{description}</p>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })()
                      ) : (
                        <div className="bg-black border border-dashed border-[#222222] p-3 text-center text-[10px] text-[#555555] uppercase tracking-wider font-mono">
                          💡 Klicken oder Hovern einer Rolle enthüllt Discord-Rechteerklärungen
                        </div>
                      )}
                    </div>
                  </div>

                  {/* REAL SERVER DEPLOYMENT TRIGGER */}
                  <div className="pt-4 border-t border-[#222222] space-y-3">
                    <label className="flex items-center gap-2.5 p-2 bg-black border border-[#222222] hover:border-white/20 transition-all cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={deleteFirst}
                        onChange={(e) => setDeleteFirst(e.target.checked)}
                        className="hidden"
                      />
                      <div className="w-4 h-4 border border-[#444444] rounded-sm flex items-center justify-center bg-black shrink-0 transition-colors">
                        {deleteFirst && <div className="w-2 h-2 bg-white rounded-sm" />}
                      </div>
                      <div className="text-left">
                        <span className="text-[10px] font-bold uppercase tracking-wide text-white block">Server vor dem Aufbau bereinigen</span>
                        <span className="text-[8px] text-[#888888] font-mono block uppercase">Erst alle Kanäle & custom Rollen vom Server löschen</span>
                      </div>
                    </label>

                    <button
                      onClick={handleApplyLayout}
                      disabled={isApplying}
                      className={`w-full py-3 bg-white text-black hover:bg-black hover:text-white hover:border-white border border-transparent transition-all text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2 cursor-pointer ${
                        isApplying ? "opacity-50 cursor-not-allowed" : ""
                      }`}
                    >
                      {isApplying ? (
                        <>
                          <Cpu className="w-4 h-4 animate-spin" /> Baue echten Server auf...
                        </>
                      ) : (
                        <>
                          <Workflow className="w-4 h-4" /> Auf echten Server aufspielen (LIVE)
                        </>
                      )}
                    </button>
                    <p className="text-[8px] text-[#666666] uppercase tracking-wide font-mono mt-1.5 text-center">
                      Hinweis: Der Discord Architekt Bot muss Administratorrechte besitzen.
                    </p>
                  </div>

                </div>
              ) : (
                <div className="flex flex-col items-center justify-center text-center py-20 uppercase font-mono text-stone-500 text-xs">
                  <Database className="w-8 h-8 text-[#333333] mb-4" />
                  <span>Keine Layout-Synthese geladen.</span>
                  <span className="text-[9px] mt-1 text-[#444444]">Nutze den KI-Synthesizer oben oder verknüpfe deine Server-ID im Terminal.</span>
                </div>
              )}
            </div>

            {/* SYNC DISCORD TERMINAL TRIGGER */}
            <div className="pt-4 border-t border-[#222222]">
              <div className="flex items-center gap-2 text-[9px] font-mono text-[#666666]">
                <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                <span>Synchronisation mit Bot-Instanz aktiv.</span>
              </div>
            </div>

          </div>
        </div>

      </div>

    </div>
  );
}
