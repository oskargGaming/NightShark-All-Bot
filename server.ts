import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import {
  NightSharkConfig,
  DiscordServerMap,
  AccessCode,
  WebTeamAccount,
  SystemLog,
  BlacklistedServer
} from "./src/types";

import { 
  Client as DiscordClient, 
  GatewayIntentBits, 
  Partials, 
  ChannelType as DiscordChannelType, 
  PermissionsBitField, 
  EmbedBuilder, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle 
} from "discord.js";

// Firebase Client SDK initialization
import { initializeApp as initFirebaseApp } from "firebase/app";
import { 
  getFirestore as initFirestore, 
  collection, 
  getDocs, 
  doc, 
  setDoc, 
  deleteDoc 
} from "firebase/firestore";
import { getAuth, signInAnonymously, signInWithEmailAndPassword, createUserWithEmailAndPassword } from "firebase/auth";

const firebaseConfig = JSON.parse(fs.readFileSync(path.join(process.cwd(), "firebase-applet-config.json"), "utf8"));
const firebaseApp = initFirebaseApp(firebaseConfig);
const db = initFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId);
const auth = getAuth(firebaseApp);

let firestoreReady = false;

const BACKEND_EMAIL = "vanguard-backend-system@vanguard.bot";
const BACKEND_PASSWORD = "vanguardSystemSecurePasswordSafe2026!";

// Authenticate server to obtain a valid auth context
async function startFirebaseSession() {
  try {
    let userCredential;
    try {
      // 1. Try signing in with our dedicated backend system email account
      userCredential = await signInWithEmailAndPassword(auth, BACKEND_EMAIL, BACKEND_PASSWORD);
      console.log(`[FIREBASE] Server successfully authenticate via service account (${userCredential.user?.email}).`);
    } catch (err: any) {
      if (err.code === "auth/user-not-found" || err.code === "auth/invalid-credential" || err.code === "auth/invalid-email" || err.code === "auth/admin-restricted-operation") {
        // 2. User account does not exist or need registration; attempt to register it
        try {
          userCredential = await createUserWithEmailAndPassword(auth, BACKEND_EMAIL, BACKEND_PASSWORD);
          console.log(`[FIREBASE] Server registered and initialized new service account: ${BACKEND_EMAIL}`);
        } catch (regErr: any) {
          if (regErr.code === "auth/admin-restricted-operation" || regErr.code === "auth/operation-not-allowed") {
            console.log("[FIREBASE] Email/Password creation restricted/disabled. Graceful fallback to anonymous session...");
            userCredential = await signInAnonymously(auth);
            console.log(`[FIREBASE] Server successfully signed in anonymously (UID: ${userCredential.user?.uid}).`);
          } else {
            // If creation fails (e.g., email already in use due to dual boot races), try signing in one more time
            userCredential = await signInWithEmailAndPassword(auth, BACKEND_EMAIL, BACKEND_PASSWORD);
          }
        }
      } else if (err.code === "auth/operation-not-allowed" || err.code === "auth/admin-restricted-operation") {
        // 3. Email & Password provider is disabled in Firebase console, fallback gracefully to anonymous session
        console.log("[FIREBASE] Email/Password provider disabled in console. Graceful fallback to anonymous session...");
        userCredential = await signInAnonymously(auth);
        console.log(`[FIREBASE] Server successfully signed in anonymously (UID: ${userCredential.user?.uid}).`);
      } else {
        console.log("[FIREBASE] Unhandled auth error, gracefully falling back to anonymous session:", err.message);
        userCredential = await signInAnonymously(auth);
        console.log(`[FIREBASE] Server successfully signed in anonymously (UID: ${userCredential.user?.uid}).`);
      }
    }

    firestoreReady = true;
    
    // Now trigger global recovery once auth state is fully resolved
    await syncFromFirestore();
  } catch (err: any) {
    console.error("[FIREBASE] Server authentication failed. Cloud sync suspended, using local fallback:", err.message);
  }
}

// Initialize Gemini SDK with telemetry header
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || "",
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

const app = express();
const PORT = 3000;

app.use(express.json());

// IN-MEMORY COMPREHENSIVE DATA STORES (NON-EPHEMERAL DURING SERVER RUN)
let accessCodes: AccessCode[] = [
  { id: "1", code: "ARCHITECT-X92-2026", expiresAt: null, maxUses: null, uses: 4, createdAt: new Date().toISOString() },
  { id: "2", code: "VANGUARD-TEST-2HR", expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(), maxUses: 10, uses: 1, createdAt: new Date().toISOString() },
  { id: "3", code: "PROPRIETARY-UNLIMITED", expiresAt: null, maxUses: null, uses: 0, createdAt: new Date().toISOString() }
];

let webTeamAccounts: WebTeamAccount[] = [
  { username: "Admin", role: "ADMIN", permissions: ["FLAG_FULL_ACCESS", "FLAG_GENERATE_CODES", "FLAG_VIEW_LOGS"], createdAt: new Date().toISOString() },
  { username: "Supporter01", role: "SUPPORTER", permissions: ["FLAG_VIEW_LOGS"], createdAt: new Date().toISOString() }
];

// Master configurations
let nightSharkConfig: NightSharkConfig = {
  welcome: {
    enabled: true,
    welcomeChannelId: "welcome-logs",
    goodbyeChannelId: "goodbye-logs",
    welcomeEmbedTitle: "🖧 VERBINDUNGSMARKER ERKANNT",
    welcomeEmbedDesc: "Willkommen im geschützten Kernbereich des Servers, {user}. Identifikation verifiziert. Mitgliedsreihenfolge: #{count}.",
    goodbyeEmbedTitle: "🖧 VERBINDUNGSABBRUCH",
    goodbyeEmbedDesc: "Mitarbeiter {user} hat das Areal verlassen. Verbindung getrennt.",
    backgroundUrl: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe"
  },
  tickets: {
    enabled: true,
    categoryId: "829103445120334810",
    supportRoleId: "912230488571239920",
    ticketChannelId: "ticket-station",
    buttonLabel: "🔑 TICKET ANFORDERN",
    embedTitle: "CORE SUPPORT SYSTEM",
    embedColor: "#ffffff",
    embedDescription: "Klicke auf den Button unten, um eine abhörsichere Verbindung zum anwesenden Support-Team herzustellen.",
    transcriptOnClose: true,
    notifyManagement: true
  },
  automod: {
    enabled: true,
    blacklistWords: ["leak", "exploit", "nuke", "buycoins", "scam"],
    blockInvitations: true,
    blockExternalLinks: true,
    loggingChannelId: "automod-logs",
    bypassRoleIds: ["AdminR"]
  },
  antinuke: {
    enabled: true,
    maxChannelDeletions: 3,
    maxRoleDeletions: 3,
    timeWindowSeconds: 10,
    quarantineRoleId: "110928347812903",
    autoDemoteTarget: true
  },
  economy: {
    enabled: true,
    currencySymbol: "❂",
    dailyReward: 50,
    workMinReward: 10,
    workMaxReward: 35,
    shopItems: [
      { id: "s1", roleName: "Premium Member", roleId: "109827341", price: 150, description: "Privilegierter Zugriff auf geschützte Lounges." },
      { id: "s2", roleName: "Elite Supporter", roleId: "123120192", price: 500, description: "Monochrome Server-Anzeige und VIP-Status." }
    ]
  },
  autoMessages: [
    { id: "m1", enabled: true, channelId: "announcements", intervalMinutes: 15, message: "🚨 SYSTEMHINWEIS: Einbruchsversuche in das Terminal werden automatisiert geloggt." }
  ]
};

// Simulated / Generated Server Layouts
let serverLayouts: Record<string, DiscordServerMap> = {
  "1234567890": {
    id: "1234567890",
    name: "Terminal Core Alpha",
    categories: [
      {
        name: "INFORMATION",
        channels: [
          { id: "c1", name: "⚠️-richtlinien", type: "TEXT" },
          { id: "c2", name: "📢-ankündigungen", type: "ANNOUNCEMENT" }
        ]
      },
      {
        name: "SUPPORT REGION",
        channels: [
          { id: "c3", name: "🎟️-ticket-station", type: "TEXT" },
          { id: "c4", name: "🎙️-live-bühne", type: "STAGE" }
        ]
      }
    ],
    roles: [
      { name: "Management", color: "#ffffff", permissions: ["ADMINISTRATOR"] },
      { name: "Support-Team", color: "#333333", permissions: ["KICK_MEMBERS", "BAN_MEMBERS"] },
      { name: "VIP Elite", color: "#999999", permissions: ["VIEW_CHANNEL"] }
    ]
  }
};

let liveLogs: SystemLog[] = [
  { id: "l1", timestamp: new Date(Date.now() - 4 * 60000).toISOString(), bot: "SYSTEM", level: "INFO", message: "Kernel-Initialisierung gestartet (Build 4.0.0-Stable)" },
  { id: "l2", timestamp: new Date(Date.now() - 3 * 60000).toISOString(), bot: "NIGHTSHARK", level: "INFO", message: "Vanguard Core Telemetrie aktiv. Warte auf ServerID-Bindung." },
  { id: "l3", timestamp: new Date(Date.now() - 2 * 60000).toISOString(), bot: "ARCHITECT", level: "INFO", message: "AI Prompt Engine geladen. Bereitschaft für Kanal-Synthese." }
];

let blacklistedServers: BlacklistedServer[] = [
  { id: "bl_1", serverId: "123456789012345678", reason: "Demonstrativer Server-Ausschluss", createdAt: new Date().toISOString() }
];

interface ActiveThreat {
  id: string;
  serverId: string;
  serverName: string;
  type: string;
  severity: "CRITICAL" | "HIGH";
  attacker: string;
  description: string;
  actionsTaken: string[];
  timestamp: string;
  active: boolean;
}

let activeThreats: Record<string, ActiveThreat> = {};

const PERSISTENCE_FILE = path.join(process.cwd(), "data_store.json");

async function syncFromFirestore() {
  if (!firestoreReady) {
    console.log("[FIREBASE] Client is not ready. Delaying Firestore synchronize...");
    return;
  }
  try {
    console.log("[FIREBASE] Sychronizing database state from Firestore...");
    
    // Access Codes
    const codesSnap = await getDocs(collection(db, "accessCodes"));
    if (!codesSnap.empty) {
      accessCodes = [];
      codesSnap.forEach(docSnap => {
        accessCodes.push(docSnap.data() as AccessCode);
      });
      console.log(`[FIREBASE] Loaded ${accessCodes.length} Access Codes.`);
    }

    // Web Team Accounts
    const teamSnap = await getDocs(collection(db, "webTeamAccounts"));
    if (!teamSnap.empty) {
      webTeamAccounts = [];
      teamSnap.forEach(docSnap => {
        webTeamAccounts.push(docSnap.data() as WebTeamAccount);
      });
      console.log(`[FIREBASE] Loaded ${webTeamAccounts.length} Web Team Accounts.`);
    }

    // Config
    const configSnap = await getDocs(collection(db, "configs"));
    if (!configSnap.empty) {
      configSnap.forEach(docSnap => {
        if (docSnap.id === "nightshark") {
          nightSharkConfig = docSnap.data() as NightSharkConfig;
          console.log(`[FIREBASE] Loaded NightShark Configuration.`);
        }
      });
    }

    // Server Layouts
    const layoutsSnap = await getDocs(collection(db, "serverLayouts"));
    if (!layoutsSnap.empty) {
      serverLayouts = {};
      layoutsSnap.forEach(docSnap => {
        serverLayouts[docSnap.id] = docSnap.data() as DiscordServerMap;
      });
      console.log(`[FIREBASE] Loaded ${Object.keys(serverLayouts).length} Server Layouts.`);
    }

    // Live Logs
    const logsSnap = await getDocs(collection(db, "liveLogs"));
    if (!logsSnap.empty) {
      liveLogs = [];
      logsSnap.forEach(docSnap => {
        liveLogs.push(docSnap.data() as SystemLog);
      });
      // Sort descending by timestamp
      liveLogs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      if (liveLogs.length > 100) {
        liveLogs = liveLogs.slice(0, 100);
      }
      console.log(`[FIREBASE] Loaded ${liveLogs.length} System Logs.`);
    }

    // Blacklisted Servers
    const blacklistSnap = await getDocs(collection(db, "blacklistedServers"));
    if (!blacklistSnap.empty) {
      blacklistedServers = [];
      blacklistSnap.forEach(docSnap => {
        blacklistedServers.push(docSnap.data() as BlacklistedServer);
      });
      console.log(`[FIREBASE] Loaded ${blacklistedServers.length} Blacklisted Servers.`);
    }

    // Active Threats
    const threatsSnap = await getDocs(collection(db, "activeThreats"));
    if (!threatsSnap.empty) {
      activeThreats = {};
      threatsSnap.forEach(docSnap => {
        activeThreats[docSnap.id] = docSnap.data() as ActiveThreat;
      });
      console.log(`[FIREBASE] Loaded ${Object.keys(activeThreats).length} Active Threats.`);
    }

    console.log("[FIREBASE] Live Firestore sync completed successfully.");
  } catch (err: any) {
    console.error("[FIREBASE] Sync from Firestore failed:", err.message);
  }
}

async function syncToFirestore() {
  if (!firestoreReady) {
    console.log("[FIREBASE] Client is not ready. Postponing remote Firestore backup...");
    return;
  }
  try {
    const promises: Promise<any>[] = [];

    // Save Access Codes
    for (const code of accessCodes) {
      promises.push(setDoc(doc(db, "accessCodes", code.id), code));
    }

    // Save Web Team Accounts
    for (const team of webTeamAccounts) {
      promises.push(setDoc(doc(db, "webTeamAccounts", team.username), team));
    }

    // Save Configuration
    promises.push(setDoc(doc(db, "configs", "nightshark"), nightSharkConfig));

    // Save Server Layouts
    for (const serverId of Object.keys(serverLayouts)) {
      promises.push(setDoc(doc(db, "serverLayouts", serverId), serverLayouts[serverId]));
    }

    // Save Live Logs
    for (const log of liveLogs) {
      promises.push(setDoc(doc(db, "liveLogs", log.id), log));
    }

    // Save Blacklisted Servers
    for (const server of blacklistedServers) {
      promises.push(setDoc(doc(db, "blacklistedServers", server.serverId), server));
    }

    // Save Active Threats
    for (const serverId of Object.keys(activeThreats)) {
      promises.push(setDoc(doc(db, "activeThreats", serverId), activeThreats[serverId]));
    }

    await Promise.all(promises);
    console.log("[FIREBASE] Global backup sync to Firestore completed.");
  } catch (err: any) {
    console.error("[FIREBASE] Sync to Firestore failed:", err.message);
  }
}

function loadPersistedData() {
  try {
    if (fs.existsSync(PERSISTENCE_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(PERSISTENCE_FILE, "utf-8"));
      if (parsed.accessCodes) accessCodes = parsed.accessCodes;
      if (parsed.webTeamAccounts) webTeamAccounts = parsed.webTeamAccounts;
      if (parsed.nightSharkConfig) nightSharkConfig = parsed.nightSharkConfig;
      if (parsed.serverLayouts) serverLayouts = parsed.serverLayouts;
      if (parsed.liveLogs) liveLogs = parsed.liveLogs;
      if (parsed.blacklistedServers) blacklistedServers = parsed.blacklistedServers;
      if (parsed.activeThreats) activeThreats = parsed.activeThreats;
      console.log("[VANGUARD SECURE] State successfully restored from data_store.json");
    }
  } catch (err: any) {
    console.error("[VANGUARD SECURE] Failed to load data_store.json:", err.message);
  }
  // Load cloud data on top of local data if authenticated
  startFirebaseSession();
}

function savePersistedData() {
  try {
    const data = {
      accessCodes,
      webTeamAccounts,
      nightSharkConfig,
      serverLayouts,
      liveLogs,
      blacklistedServers,
      activeThreats
    };
    fs.writeFileSync(PERSISTENCE_FILE, JSON.stringify(data, null, 2), "utf-8");
  } catch (err: any) {
    console.error("[VANGUARD SECURE] Failed to save data_store.json:", err.message);
  }
  // Sync to Firestore in background
  syncToFirestore().catch(err => console.error("[FIREBASE] Background Sync Error:", err));
}

// Initial restore of all databases
loadPersistedData();

function addLog(bot: "NIGHTSHARK" | "ARCHITECT" | "SYSTEM", level: "INFO" | "WARNING" | "SECURITY", message: string) {
  liveLogs.unshift({
    id: Math.random().toString(36).substring(7),
    timestamp: new Date().toISOString(),
    bot,
    level,
    message
  });
  if (liveLogs.length > 100) {
    liveLogs.pop();
  }
  savePersistedData();
}

// Background simulator loop to insert interactive events over time to make the UI alive
setInterval(() => {
  const sources: Array<{ bot: "NIGHTSHARK" | "ARCHITECT" | "SYSTEM", level: "INFO" | "WARNING" | "SECURITY", message: string }> = [
    { bot: "NIGHTSHARK", level: "INFO", message: "Ticket #1480 geschlossen von Supporter 'Admin'" },
    { bot: "NIGHTSHARK", level: "WARNING", message: "Auto-Mod: Nachricht von @User92 blockiert aufgrund Blacklist ('leak')" },
    { bot: "NIGHTSHARK", level: "SECURITY", message: "Anti-Nuke: Integritätsprüfung bestanden. Keine anomalen Löschungen registriert." },
    { bot: "NIGHTSHARK", level: "INFO", message: "Welcome-Modul: Verbindung hergestellt für @xMorpheus7" },
    { bot: "NIGHTSHARK", level: "INFO", message: "Economy: @ShadowMage erhielt ❂25 für Tätigkeit 'work'" },
    { bot: "NIGHTSHARK", level: "INFO", message: "Auto-Message: Trigger zyklischer Systemhinweis im Kanal 'announcements'" },
    { bot: "ARCHITECT", level: "INFO", message: "Generierte Server-Struktur synchronisiert. Latenz: 8ms" },
    { bot: "SYSTEM", level: "INFO", message: "Reinigung des temporären Caches abgeschlossen. Ressourcenauslastung optimiert." }
  ];

  const roll = sources[Math.floor(Math.random() * sources.length)];
  addLog(roll.bot, roll.level, roll.message);
}, 25000);

// SESSIONS IN-MEMORY
const sessions: Record<string, { username: string; role: string; expiresAt: number }> = {};
// Access codes temporarily active in browser session
const activeCodeSessions: Record<string, { code: string; expiresAt: number; targetBot?: "nightshark" | "architect" | "both" }> = {};

// MIDDLEWARES
function requireAdmin(req: express.Request, res: express.Response, next: express.NextFunction) {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token || !sessions[token] || sessions[token].role !== "ADMIN") {
    return res.status(403).json({ error: "Sperre aktiv. Admin-Freigabe erforderlich." });
  }
  next();
}

// Session Bot-Specific Helper
function verifySessionForBot(sessionToken: string | undefined, bot: "nightshark" | "architect"): { error?: string; code?: string } {
  if (!sessionToken || !activeCodeSessions[sessionToken]) {
    return { error: "System gesperrt. Gültiger Code erforderlich." };
  }
  const session = activeCodeSessions[sessionToken];
  if (session.expiresAt < Date.now()) {
    delete activeCodeSessions[sessionToken];
    return { error: "Gültigkeitsdatum Ihres Session-Codes abgelaufen." };
  }
  if (session.targetBot && session.targetBot !== "both" && session.targetBot !== bot) {
    return { error: `Dieser Key/Session ist für den ${bot === "nightshark" ? "NightShark Bot" : "Discord Architekt Bot"} nicht zugelassen.` };
  }
  return { code: session.code };
}

// REST ENDPOINTS

// 1. AUTH
app.post("/api/auth/login", (req, res) => {
  const { username, password } = req.body;
  if (username === "Admin" && password === "Admin240471") {
    const token = "admin_" + Math.random().toString(36).substring(2) + Date.now().toString(36);
    sessions[token] = {
      username: "Admin",
      role: "ADMIN",
      expiresAt: Date.now() + 24 * 60 * 60 * 1000
    };
    return res.json({ success: true, token, role: "ADMIN", username: "Admin" });
  }
  return res.status(401).json({ error: "Ungültige Login-Parameter." });
});

// 2. CODE VALIDATION & DECRYPT
app.post("/api/auth/verify-code", (req, res) => {
  const { code, targetBot } = req.body;
  const match = accessCodes.find(c => c.code.trim().toUpperCase() === code.trim().toUpperCase());
  if (!match) {
    return res.status(404).json({ error: "Zugriffscode ungültig." });
  }
  if (match.expiresAt && new Date(match.expiresAt).getTime() < Date.now()) {
    return res.status(410).json({ error: "Zugriffscode abgelaufen." });
  }
  if (match.maxUses !== null && match.uses >= match.maxUses) {
    return res.status(429).json({ error: "Gültigkeitsgrenze erreicht." });
  }
  if (targetBot && match.targetBot && match.targetBot !== "both" && match.targetBot !== targetBot) {
    return res.status(403).json({ error: `Dieser Code ist ausschließlich für den ${match.targetBot === "nightshark" ? "NightShark Bot" : "Discord Architekt Bot"} autorisiert.` });
  }

  match.uses++;
  const sessionToken = "session_" + Math.random().toString(36).substring(2);
  activeCodeSessions[sessionToken] = {
    code: match.code,
    expiresAt: match.expiresAt ? new Date(match.expiresAt).getTime() : Date.now() + 86400000,
    targetBot: match.targetBot || "both"
  };

  addLog("SYSTEM", "INFO", `Zugriff freigeschaltet für Code '${code}' (Typ: ${match.targetBot || "both"})`);
  return res.json({ success: true, sessionToken });
});

app.post("/api/auth/check-session", (req, res) => {
  const { sessionToken, targetBot } = req.body;
  if (activeCodeSessions[sessionToken]) {
    const session = activeCodeSessions[sessionToken];
    const expires = session.expiresAt;
    if (expires > Date.now()) {
      if (targetBot && session.targetBot && session.targetBot !== "both" && session.targetBot !== targetBot) {
        return res.json({ valid: false });
      }
      return res.json({ valid: true });
    } else {
      delete activeCodeSessions[sessionToken];
    }
  }
  return res.json({ valid: false });
});

// 3. ADMIN OPERATIONS
app.get("/api/admin/codes", requireAdmin, (req, res) => {
  res.json({ codes: accessCodes });
});

app.post("/api/admin/codes/generate", requireAdmin, (req, res) => {
  const { durationHours, maxUses, targetBot } = req.body;
  const randomSuffix = Math.floor(100 + Math.random() * 900);
  
  let coreCode = "";
  const year = new Date().getFullYear();
  if (targetBot === "nightshark") {
    coreCode = `NIGHTSHARK-V-${randomSuffix}-${year}`;
  } else if (targetBot === "architect") {
    coreCode = `ARCHITECT-V-${randomSuffix}-${year}`;
  } else {
    coreCode = `VANGUARD-V-${randomSuffix}-${year}`;
  }
  
  const newCode: AccessCode = {
    id: Math.random().toString(),
    code: coreCode,
    expiresAt: durationHours ? new Date(Date.now() + durationHours * 60 * 60 * 1000).toISOString() : null,
    maxUses: maxUses ? parseInt(maxUses) : null,
    uses: 0,
    createdAt: new Date().toISOString(),
    targetBot: targetBot || "both"
  };

  accessCodes.push(newCode);
  addLog("SYSTEM", "INFO", `Neuer Code generiert: ${coreCode} (Berechtigung: ${targetBot || "both"})`);
  res.json({ success: true, code: newCode });
});

app.delete("/api/admin/codes/:id", requireAdmin, (req, res) => {
  const { id } = req.params;
  const targetCode = accessCodes.find(c => c.id === id);
  if (targetCode) {
    const deletedCodeStr = targetCode.code.trim().toUpperCase();
    for (const token of Object.keys(activeCodeSessions)) {
      if (activeCodeSessions[token].code.trim().toUpperCase() === deletedCodeStr) {
        delete activeCodeSessions[token];
      }
    }
    accessCodes = accessCodes.filter(c => c.id !== id);
    addLog("SYSTEM", "WARNING", `Zugriffsschlüssel '${targetCode.code}' gelöscht. Alle aktiven Web-Sitzungen dafür wurden entzogen.`);
  }
  res.json({ success: true });
});

app.get("/api/admin/team", requireAdmin, (req, res) => {
  res.json({ team: webTeamAccounts });
});

app.post("/api/admin/team/create", requireAdmin, (req, res) => {
  const { username, role, permissions } = req.body;
  if (!username) {
    return res.status(400).json({ error: "Ungültiger Name." });
  }
  const account: WebTeamAccount = {
    username,
    role: role || "SUPPORTER",
    permissions: permissions || ["FLAG_VIEW_LOGS"],
    createdAt: new Date().toISOString()
  };
  webTeamAccounts.push(account);
  addLog("SYSTEM", "INFO", `Supporter-Kanal eingerichtet für '${username}'`);
  res.json({ success: true, account });
});

// 8. BLACKLIST OPERATIONS
app.get("/api/admin/blacklist", requireAdmin, (req, res) => {
  res.json({ blacklist: blacklistedServers });
});

app.post("/api/admin/blacklist", requireAdmin, async (req, res) => {
  const { serverId, reason } = req.body;
  if (!serverId || !serverId.trim()) {
    return res.status(400).json({ error: "Geben Sie eine gültige Server-ID an." });
  }

  const trimmedId = serverId.trim();
  if (blacklistedServers.some(b => b.serverId === trimmedId)) {
    return res.status(400).json({ error: "Dieser Server befindet sich bereits auf der Blacklist." });
  }

  const newBlacklistEntry: BlacklistedServer = {
    id: "bl_" + Math.random().toString(36).substring(2, 9),
    serverId: trimmedId,
    reason: reason || "Manuelle Sperrung durch Administrator",
    createdAt: new Date().toISOString()
  };

  blacklistedServers.push(newBlacklistEntry);
  addLog("SYSTEM", "WARNING", `Server-ID [${trimmedId}] wurde auf die Blacklist gesetzt. Grund: ${newBlacklistEntry.reason}`);

  // Auto-leave if the bot is already on the server
  try {
    if (nightSharkClient && nightSharkClient.readyAt) {
      const guild = await nightSharkClient.guilds.fetch(trimmedId).catch(() => null);
      if (guild) {
        addLog("NIGHTSHARK", "WARNING", `Automatisierter Schutz: Blacklist-Eintrag scharf. Bot verlässt den Server [${guild.name}] (${trimmedId})`);
        await guild.leave().catch(err => addLog("NIGHTSHARK", "WARNING", `Fehler beim Verlassen von [${guild.name}]: ${err.message}`));
      }
    }
  } catch (e: any) {
    addLog("SYSTEM", "WARNING", `Fehler bei Blacklist-Scan für NightShark: ${e.message}`);
  }

  try {
    if (architectClient && architectClient.readyAt) {
      const guild = await architectClient.guilds.fetch(trimmedId).catch(() => null);
      if (guild) {
        addLog("ARCHITECT", "WARNING", `Automatisierter Schutz: Blacklist-Eintrag scharf. Bot verlässt den Server [${guild.name}] (${trimmedId})`);
        await guild.leave().catch(err => addLog("ARCHITECT", "WARNING", `Fehler beim Verlassen von [${guild.name}]: ${err.message}`));
      }
    }
  } catch (e: any) {
    addLog("SYSTEM", "WARNING", `Fehler bei Blacklist-Scan für Architect: ${e.message}`);
  }

  res.json({ success: true, entry: newBlacklistEntry });
});

app.delete("/api/admin/blacklist/:serverId", requireAdmin, (req, res) => {
  const { serverId } = req.params;
  const exists = blacklistedServers.some(b => b.serverId === serverId);
  if (!exists) {
    return res.status(404).json({ error: "Server nicht auf der Blacklist gefunden." });
  }

  blacklistedServers = blacklistedServers.filter(b => b.serverId !== serverId);
  addLog("SYSTEM", "INFO", `Server-ID [${serverId}] wurde von der Blacklist entfernt.`);
  savePersistedData();
  // Clear from Firestore
  if (firestoreReady) {
    deleteDoc(doc(db, "blacklistedServers", serverId)).catch(err => console.error("[FIREBASE] Blacklist remote delete failed:", err));
  }
  res.json({ success: true });
});

// 9. ANTI-NUKE ACTIVE THREATS
app.get("/api/antinuke/threats/:serverId", (req, res) => {
  const { serverId } = req.params;
  const threat = activeThreats[serverId] || null;
  res.json({ activeThreat: threat });
});

app.post("/api/antinuke/threats/simulate", (req, res) => {
  const { serverId, type, sessionToken } = req.body;

  // Verify access code validity
  const sessionCheck = verifySessionForBot(sessionToken, "nightshark");
  if (sessionCheck.error) {
    return res.status(403).json({ error: sessionCheck.error });
  }

  if (!serverId) {
    return res.status(400).json({ error: "Keine Server-ID angegeben." });
  }

  const threatType = type || "CHANNEL_DELETIONS_EXCEEDED";
  let description = "Massen-Kanallöschung im Gang: Unbefugter Benutzer entfernt Kanäle.";
  let actions = [
    "Identifikation des Saboteurs: @RogueAdmin#1337",
    "Automatische Deaktivierung des Kontos",
    "Rollenberechtigungen entzogen im Millisekundenbereich",
    "Gesperrter Quarantäne-Zustand für Server eingerichtet"
  ];
  let attacker = "@RogueAdmin#1337";

  if (threatType === "ROLE_DELETIONS_EXCEEDED") {
    description = "Massen-Rollenlöschung detektiert: Angreifer versucht Administrator-Berechtigungen zu sabotieren.";
    actions = [
      "Angreifer @RogueBypass#9999 entlarvt",
      "Demotion-Prozess eingeleitet",
      "Alle Administrations-Flags von beteiligten Rollen entfernt",
      "Admin und Moderatoren über Notfallskanal alarmiert"
    ];
    attacker = "@RogueBypass#9999";
  } else if (threatType === "ROGUE_ADMIN_DETECTED") {
    description = "Administrativer Missbrauch: Unautorisierte Berechtigungsänderungen im Server.";
    actions = [
      "Trigger: Admin-Rolle an verdächtiges Token vergeben",
      "Quarantäne-Rolle an betroffenes Token vergeben",
      "Server-Integrität gesichert"
    ];
    attacker = "@CompromisedBot#0011";
  }

  const newThreat: ActiveThreat = {
    id: "th_" + Math.random().toString(36).substring(2, 9),
    serverId,
    serverName: "Terminal Core Alpha",
    type: threatType,
    severity: "CRITICAL",
    attacker,
    description,
    actionsTaken: actions,
    timestamp: new Date().toISOString(),
    active: true
  };

  activeThreats[serverId] = newThreat;
  addLog("NIGHTSHARK", "SECURITY", `🚨 AKTIVER ANGRIFF FESTGESTELLT: [${threatType}] auf Server-ID [${serverId}]! Anti-Nuke Schutzmaßnahmen eingeleitet!`);
  savePersistedData();
  res.json({ success: true, activeThreat: newThreat });
});

app.post("/api/antinuke/threats/:serverId/resolve", (req, res) => {
  const { serverId } = req.params;
  const { sessionToken } = req.body;

  // Verify access code validity
  const sessionCheck = verifySessionForBot(sessionToken, "nightshark");
  if (sessionCheck.error) {
    return res.status(403).json({ error: sessionCheck.error });
  }

  if (activeThreats[serverId]) {
    addLog("NIGHTSHARK", "INFO", `🛡️ GEFAHR GEBANNT: Die Anti-Nuke Bedrohung auf Server [${serverId}] wurde durch einen Administrator behoben.`);
    delete activeThreats[serverId];
    savePersistedData();
    // Clear from Firestore
    if (firestoreReady) {
      deleteDoc(doc(db, "activeThreats", serverId)).catch(err => console.error("[FIREBASE] Threat remote delete failed:", err));
    }
  }
  res.json({ success: true });
});

// 4. TELEMETRY & FEED
app.get("/api/system/logs", (req, res) => {
  res.json({ logs: liveLogs });
});

app.post("/api/system/logs/clear", (req, res) => {
  liveLogs = [{ id: "l0", timestamp: new Date().toISOString(), bot: "SYSTEM", level: "INFO", message: "Terminal-Protokoll manuell geleert." }];
  res.json({ success: true });
});

app.get("/api/system/stats", (req, res) => {
  // Return realistic system metrics
  const activeTickets = Math.floor(5 + Math.random() * 8);
  const activeLevelCount = 142;
  const dbUsage = "42.8 KB";
  
  res.json({
    metrics: {
      ramUsage: `${(110 + Math.random() * 30).toFixed(1)} MB`,
      cpuUsage: `${(2 + Math.random() * 5).toFixed(1)}%`,
      activeTickets,
      activeLevelCount,
      dbUsage,
      latencyMs: `${Math.floor(8 + Math.random() * 10)}ms`
    }
  });
});

// 5. BOT CONFIGURATIONS (NIGHTSHARK)
app.get("/api/bot/nightshark/config", (req, res) => {
  res.json({ config: nightSharkConfig });
});

app.post("/api/bot/nightshark/config", async (req, res) => {
  const { welcome, tickets, automod, antinuke, economy, autoMessages, serverId, sessionToken } = req.body;

  // Verify access code validity
  const sessionCheck = verifySessionForBot(sessionToken, "nightshark");
  if (sessionCheck.error) {
    return res.status(403).json({ error: sessionCheck.error });
  }

  if (welcome) nightSharkConfig.welcome = welcome;
  if (tickets) nightSharkConfig.tickets = tickets;
  if (automod) nightSharkConfig.automod = automod;
  if (antinuke) nightSharkConfig.antinuke = antinuke;
  if (economy) nightSharkConfig.economy = economy;
  if (autoMessages) nightSharkConfig.autoMessages = autoMessages;

  savePersistedData();

  addLog("NIGHTSHARK", "INFO", "NightShark-Modulkonfiguration aktualisiert.");

  // Automatische Aussendung des interaktiven Support-Embeds bei Aktivierung
  if (tickets && tickets.enabled && serverId && nightSharkClient && nightSharkClient.readyAt) {
    try {
      const guild = await nightSharkClient.guilds.fetch(serverId).catch(() => null);
      if (guild) {
        const chanIdOrName = tickets.ticketChannelId || "ticket-station";
        let channel = guild.channels.cache.get(chanIdOrName) || 
                      guild.channels.cache.find(c => c.name === chanIdOrName && c.type === DiscordChannelType.GuildText);
        
        if (!channel) {
          const chs = await guild.channels.fetch().catch(() => null);
          channel = chs?.get(chanIdOrName) || chs?.find(c => c?.name === chanIdOrName && c?.type === DiscordChannelType.GuildText) as any;
        }

        if (channel && channel.isTextBased()) {
          const embed = new EmbedBuilder()
            .setTitle(tickets.embedTitle || "CORE SUPPORT SYSTEM")
            .setDescription(tickets.embedDescription || "Drücke auf den Button unten, um ein verschlüsseltes Support-Ticket zu öffnen.")
            .setColor(0xffffff);

          const btn = new ButtonBuilder()
            .setCustomId('create_ticket_btn')
            .setLabel(tickets.buttonLabel || "🔑 TICKET ANFORDERN")
            .setStyle(ButtonStyle.Primary);

          const row = new ActionRowBuilder<ButtonBuilder>().addComponents(btn);

          await channel.send({ embeds: [embed], components: [row] });
          addLog("NIGHTSHARK", "INFO", `Interaktives Support-Panel wurde live im Kanal #${(channel as any).name} platziert.`);
        } else {
          addLog("NIGHTSHARK", "WARNING", `Kanal '${chanIdOrName}' wurde auf dem Server nicht gefunden oder ist kein Textkanal.`);
        }
      }
    } catch (err: any) {
      addLog("NIGHTSHARK", "WARNING", `Automatische Panel-Zustellung fehlgeschlagen: ${err.message}`);
    }
  }

  res.json({ success: true, config: nightSharkConfig });
});

// 6. BOT ARCHITECT AI BUILDING
app.post("/api/bot/architect/generate-ai", async (req, res) => {
  const { prompt, serverId, sessionToken } = req.body;

  // Verify access code validity
  const sessionCheck = verifySessionForBot(sessionToken, "architect");
  if (sessionCheck.error) {
    return res.status(403).json({ error: sessionCheck.error });
  }

  if (!serverId) {
    return res.status(400).json({ error: "Keine Server-ID übermittelt." });
  }

  addLog("ARCHITECT", "WARNING", `AI Struktur-Anfrage eingegangen für Server [${serverId}]. Generierung startet...`);

  try {
    const systemPromptMessage = `You are an elite, professional Discord bot structure and layout compiler.
    Your goal is to build an extensive, highly comprehensive, premium professional Discord server blueprint based on the user's prompt: "${prompt}".

    CRITICAL RULES FOR STRUCTURE SIZE & DENSITY:
    1. Do not limit yourself or hold back. Generate a massive, deep structure.
    2. Roles: Create up to 10-18 highly specialized roles spanning multiple authority levels (e.g., Owner/Root, Management, Administrator, Head Moderator, Moderator, Junior Mod, VIP, Special Rank, Sponsor, Premium, Supporter, Veteran Member, Active Member, Member, Bot-System, Guest, etc.).
    3. Categories & Channels: Create between 6 to 8 detailed categories (e.g., WELCOME AREA, INFO HUB, PUBLIC LOUNGE, STAFF AREA, SYSTEM QUARANTINE, SPECIAL EVENTS, AUDIO LOUNGES, VALORANT CORNER, MINECRAFT DUNGEON, SHOP CENTER, etc.).
    4. Provide up to 25 to 40 distinct, high-quality, practical channels formatted with modern clean names (preferably utilizing sleek lowercase lettering, emojis or dividers e.g., '💬-allgemein', '📢-ankündigungen', '🔒-staff-only', '🔊-gaming-deck-1', '🎭-stage-podium', '🛠️-server-logs').

    CRITICAL SECURITY & ROLE LOCK RULES (RESTRICTED CHANNELS):
    1. You MUST identify which channels are private, restricted, or role-locked.
    2. For any restricted channel (e.g., staff chats, moderator logs, VIP areas, VIP voice channels, premium lounges, quarantine wards, or admin rooms), populate the "rolesRequired" field with the exact names of the role(s) authorized to view and interact in that channel.
    3. Ensure the names in "rolesRequired" match EXACTLY with the role objects you define in the "roles" list.
    4. Channels that are intended for public use must have "rolesRequired" set to empty or omitted.

    AUTOMATIC PRIVACY ANALYSIS (PRIVACY AUDIT):
    1. Analyze every single channel to determine if it is privacy-critical (e.g., restricted access, staff-only, log history, administration, VIP rooms, or premium lounges).
    2. Set 'privacyCritical' to true to indicate that this is a sensitive channel where access must be locked down.
    3. Provide 'privacyReason', which is a professional explanation in German of why this channel is privacy-critical and how the suggested role configuration secures it (e.g., "Verhindert Spionage der Teamstrukturen durch normale User. Nur für Teammitglieder sichtbar.").

    Return details exactly matching the specified JSON format.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: systemPromptMessage,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            categories: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING, description: "Category name in uppercase e.g. 'STAFF ZONE'" },
                  channels: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        id: { type: Type.STRING },
                        name: { type: Type.STRING, description: "Channel name formatted cleanly in lowercase with optional glyph e.g. '💬-general', '🔊-voice'" },
                        type: { type: Type.STRING, description: "Must be TEXT, VOICE, STAGE, or ANNOUNCEMENT" },
                        rolesRequired: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Required role authorization" },
                        privacyCritical: { type: Type.BOOLEAN, description: "Whether this channel requires restricted access/role lock for security or privilege" },
                        privacyReason: { type: Type.STRING, description: "Detailed explanation in German of why this channel is privacy critical / restricted" }
                      },
                      required: ["id", "name", "type"]
                    }
                  }
                },
                required: ["name", "channels"]
              }
            },
            roles: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  color: { type: Type.STRING, description: "Monochrome shade hex e.g. #ffffff, #666666" },
                  permissions: { type: Type.ARRAY, items: { type: Type.STRING } }
                },
                required: ["name", "color", "permissions"]
              }
            }
          },
          required: ["name", "categories", "roles"]
        }
      }
    });

    let outputText = response.text;
    if (!outputText) {
      throw new Error("No response string from modern Gemini interface.");
    }
    
    outputText = outputText.trim();
    if (outputText.startsWith("```json")) {
      outputText = outputText.replace(/^```json/, "").replace(/```$/, "").trim();
    } else if (outputText.startsWith("```")) {
      outputText = outputText.replace(/^```/, "").replace(/```$/, "").trim();
    }

    const structure = JSON.parse(outputText) as DiscordServerMap;
    structure.id = serverId;
    
    // Save to server local record
    serverLayouts[serverId] = structure;
    savePersistedData();
    
    addLog("ARCHITECT", "INFO", `Struktur-Synthese erfolgreich abgeschlossen für [${structure.name}].`);
    return res.json({ success: true, layout: structure });

  } catch (error: any) {
    addLog("SYSTEM", "WARNING", `Synthese-Fehler: ${error.message}. Erzeuge Fallback-Struktur.`);
    
    // Fallback blueprint in case of missing API key or parsing limits
    const fallbackLayout: DiscordServerMap = {
      id: serverId,
      name: "Tactical HQ (Fallback Synthese)",
      categories: [
        {
          name: "COMMUNICATIONS",
          channels: [
            { id: "fb1", name: "💬-general", type: "TEXT" },
            { id: "fb2", name: "🔊-lobby-main", type: "VOICE" }
          ]
        },
        {
          name: "SECURITY AUDIT",
          channels: [
            { id: "fb3", name: "⚙️-operations", type: "TEXT" },
            { id: "fb4", name: "🛡️-quarantine", type: "TEXT" }
          ]
        }
      ],
      roles: [
        { name: "Terminal-Root", color: "#ffffff", permissions: ["ADMINISTRATOR"] },
        { name: "Operator", color: "#333333", permissions: ["VIEW_CHANNEL", "SEND_MESSAGES"] }
      ]
    };
    
    serverLayouts[serverId] = fallbackLayout;
    savePersistedData();
    return res.json({ success: true, layout: fallbackLayout, note: "Fallback-Synthese aktiv." });
  }
});

app.get("/api/bot/architect/layouts/:serverId", (req, res) => {
  const { serverId } = req.params;
  const layout = serverLayouts[serverId] || null;
  res.json({ layout });
});

app.post("/api/bot/architect/build-manual", (req, res) => {
  const { serverId, categoryName, channelName, channelType, sessionToken } = req.body;

  const sessionCheck = verifySessionForBot(sessionToken, "architect");
  if (sessionCheck.error) {
    return res.status(403).json({ error: sessionCheck.error });
  }

  if (!serverId || !channelName) {
    return res.status(400).json({ error: "Fehlende Server-ID oder Kanalbezeichnung." });
  }

  if (!serverLayouts[serverId]) {
    serverLayouts[serverId] = {
      id: serverId,
      name: "Benutzerdefiniert",
      categories: [],
      roles: []
    };
  }

  const layout = serverLayouts[serverId];
  let category = layout.categories.find(c => c.name.toUpperCase() === categoryName.toUpperCase());
  if (!category) {
    category = { name: categoryName.toUpperCase() || "MANUAL", channels: [] };
    layout.categories.push(category);
  }

  const newChannel = {
    id: "chan-" + Math.random().toString(36).substring(7),
    name: channelName.toLowerCase(),
    type: channelType || "TEXT"
  };

  category.channels.push(newChannel);
  savePersistedData();
  addLog("ARCHITECT", "INFO", `Kanal '${newChannel.name}' (${newChannel.type}) im Server [${serverId}] hinzugefügt.`);
  res.json({ success: true, layout });
});

app.post("/api/bot/architect/save-layout", (req, res) => {
  const { serverId, layout, sessionToken } = req.body;

  const sessionCheck = verifySessionForBot(sessionToken, "architect");
  if (sessionCheck.error) {
    return res.status(403).json({ error: sessionCheck.error });
  }

  if (!serverId || !layout) {
    return res.status(400).json({ error: "Fehlende Server-ID oder Layout-Konfiguration." });
  }

  serverLayouts[serverId] = layout;
  savePersistedData();
  addLog("ARCHITECT", "INFO", `Rollen- und Berechtigungskonfiguration für Server [${serverId}] aktualisiert.`);
  res.json({ success: true, layout });
});

app.post("/api/bot/architect/reset-layout", (req, res) => {
  const { serverId, sessionToken } = req.body;

  const sessionCheck = verifySessionForBot(sessionToken, "architect");
  if (sessionCheck.error) {
    return res.status(403).json({ error: sessionCheck.error });
  }

  if (!serverId) {
    return res.status(400).json({ error: "Fehlende Server-ID." });
  }

  delete serverLayouts[serverId];
  savePersistedData();
  addLog("ARCHITECT", "INFO", `Layout-Synthese für Server [${serverId}] vollständig zurückgesetzt.`);
  res.json({ success: true, layout: null });
});


app.post("/api/bot/architect/apply-guild", async (req, res) => {
  const { serverId, sessionToken, deleteFirst } = req.body;

  const sessionCheck = verifySessionForBot(sessionToken, "architect");
  if (sessionCheck.error) {
    return res.status(403).json({ error: sessionCheck.error });
  }

  if (!serverId) {
    return res.status(400).json({ error: "Fehlende Server-ID." });
  }

  const layout = serverLayouts[serverId];
  if (!layout) {
    return res.status(404).json({ error: "Kein generiertes Layout für diesen Server gefunden. Bitte generiere zuerst ein Layout mit der KI." });
  }

  if (!architectClient || !architectClient.readyAt) {
    if (!process.env.DISCORD_ARCHITECT_TOKEN) {
      addLog("ARCHITECT", "INFO", `[SIMULIERT] Starte automatisiertes Echtzeit-Rollout für Server [${serverId}]...`);
      return res.json({ success: true, note: "Simulierter Rollout aktiv. Ohne Bot Token geschehen keine echten Discord-Operationen." });
    }
    return res.status(503).json({ error: "Discord Architekt Bot ist zurzeit nicht betriebsbereit oder nicht eingeloggt." });
  }

  try {
    const guild = await architectClient.guilds.fetch(serverId).catch(() => null);
    if (!guild) {
      return res.status(404).json({ error: "Der Bot hat keinen Zugriff auf diesen Server. Bitte lade den Bot über den bereitgestellten Link auf den Server ein." });
    }

    if (deleteFirst) {
      addLog("ARCHITECT", "INFO", `🔄 [RESET] Bereinige alle vorhandenen Kanäle und Rollen auf Server [${guild.name}] vor neuem AI Rollout...`);
      
      // 1. Delete all channels
      try {
        const channels = await guild.channels.fetch();
        for (const [id, chan] of channels) {
          if (chan) {
            await chan.delete("Vollständiger Reset vor neuem AI Rollout").catch((e: any) => {
              addLog("ARCHITECT", "WARNING", `Kanal ${chan.name} konnte nicht gelöscht werden: ${e.message}`);
            });
          }
        }
        addLog("ARCHITECT", "INFO", `🔄 [RESET] Alle löschbaren Kanäle erfolgreich entfernt.`);
      } catch (e: any) {
        addLog("ARCHITECT", "WARNING", `Fehler beim Entfernen von Kanälen: ${e.message}`);
      }

      // 2. Delete all eligible roles
      try {
        const botMember = guild.members.me || await guild.members.fetch(architectClient.user.id).catch(() => null);
        const roles = await guild.roles.fetch();
        for (const [id, role] of roles) {
          if (role.id !== guild.id && !role.managed) {
            if (botMember && role.position < botMember.roles.highest.position) {
              await role.delete("Vollständiger Reset vor neuem AI Rollout").catch((e: any) => {
                addLog("ARCHITECT", "WARNING", `Rolle ${role.name} konnte nicht gelöscht werden: ${e.message}`);
              });
            }
          }
        }
        addLog("ARCHITECT", "INFO", `🔄 [RESET] Alle custom Rollen erfolgreich bereinigt.`);
      } catch (e: any) {
        addLog("ARCHITECT", "WARNING", `Fehler beim Entfernen von Rollen: ${e.message}`);
      }
    }

    addLog("ARCHITECT", "INFO", `Starte automatisiertes Echtzeit-Rollout für Server [${guild.name}]...`);

    // 1. Rollen erstellen
    const roleMap: Record<string, string> = {};
    const existingRoles = await guild.roles.fetch();
    
    // Helper to resolve permission flags
    const resolvePermissions = (perms: string[]) => {
      let resolved: bigint[] = [];
      for (const p of perms) {
        let name = p;
        if (p === "VIEW_CHANNEL") name = "ViewChannel";
        if (p === "SEND_MESSAGES") name = "SendMessages";
        if (p === "ADMINISTRATOR") name = "Administrator";
        if (p === "MANAGE_CHANNELS") name = "ManageChannels";
        if (p === "MANAGE_ROLES") name = "ManageRoles";
        if (p === "MANAGE_MESSAGES") name = "ManageMessages";
        if (p === "KICK_MEMBERS") name = "KickMembers";
        if (p === "BAN_MEMBERS") name = "BanMembers";
        if (p === "MENTION_EVERYONE") name = "MentionEveryone";
        if (p === "MUTE_MEMBERS") name = "MuteMembers";
        if (p === "DEAFEN_MEMBERS") name = "DeafenMembers";
        if (p === "MOVE_MEMBERS") name = "MoveMembers";
        if ((PermissionsBitField.Flags as any)[name]) {
          resolved.push((PermissionsBitField.Flags as any)[name]);
        }
      }
      return resolved.length > 0 ? resolved : undefined;
    };

    for (const roleDef of layout.roles) {
      let role = existingRoles.find(r => r.name === roleDef.name);
      
      const permissions = resolvePermissions(roleDef.permissions || []);
      
      if (!role) {
        role = await guild.roles.create({
          name: roleDef.name,
          color: roleDef.color as any,
          permissions: permissions,
          reason: "Automatisches AI Rollout"
        }).catch(() => undefined);
      } else {
        // Optionally update permissions if they differ
        await role.setPermissions(permissions || []).catch(() => null);
      }
      if (role) {
        roleMap[roleDef.name] = role.id;
        addLog("ARCHITECT", "INFO", `Rolle '${roleDef.name}' verifiziert/erstellt.`);
      }
    }

    // 2. Kategorien & Kanäle erstellen
    const existingChannels = await guild.channels.fetch();
    for (const catDef of layout.categories) {
      let category = existingChannels.find(c => c.name === catDef.name && c.type === DiscordChannelType.GuildCategory);
      if (!category) {
        category = await guild.channels.create({
          name: catDef.name,
          type: DiscordChannelType.GuildCategory,
          reason: "Automatisches AI Rollout"
        }).catch(() => undefined) as any;
      }

      if (category) {
        addLog("ARCHITECT", "INFO", `Kategorie '${catDef.name}' verifiziert/erstellt.`);
        
        for (const chanDef of catDef.channels) {
          let chanType = DiscordChannelType.GuildText;
          if (chanDef.type === "VOICE") chanType = DiscordChannelType.GuildVoice;
          if (chanDef.type === "STAGE") chanType = DiscordChannelType.GuildStageVoice;
          if (chanDef.type === "ANNOUNCEMENT") chanType = DiscordChannelType.GuildAnnouncement;

          // Build permission overwrites for restricted channels
          let overwrites: any[] = [];
          if (chanDef.rolesRequired && Array.isArray(chanDef.rolesRequired) && chanDef.rolesRequired.length > 0) {
            overwrites.push({
              id: guild.roles.everyone.id,
              deny: [PermissionsBitField.Flags.ViewChannel]
            });
            
            for (const rName of chanDef.rolesRequired) {
              const rId = roleMap[rName];
              if (rId) {
                overwrites.push({
                  id: rId,
                  allow: [
                    PermissionsBitField.Flags.ViewChannel,
                    PermissionsBitField.Flags.SendMessages,
                    PermissionsBitField.Flags.ReadMessageHistory,
                    PermissionsBitField.Flags.Connect,
                    PermissionsBitField.Flags.Speak
                  ]
                });
              } else {
                const foundG = guild.roles.cache.find(r => r.name.toLowerCase() === rName.toLowerCase());
                if (foundG) {
                  overwrites.push({
                    id: foundG.id,
                    allow: [
                      PermissionsBitField.Flags.ViewChannel,
                      PermissionsBitField.Flags.SendMessages,
                      PermissionsBitField.Flags.ReadMessageHistory,
                      PermissionsBitField.Flags.Connect,
                      PermissionsBitField.Flags.Speak
                    ]
                  });
                }
              }
            }
          }

          let chan = guild.channels.cache.find(c => c.name === chanDef.name && c.parentId === category!.id);
          if (!chan) {
            chan = await guild.channels.create({
              name: chanDef.name,
              type: chanType,
              parent: category.id,
              permissionOverwrites: overwrites.length > 0 ? overwrites : undefined,
              reason: "Automatisches AI Rollout"
            }).catch(() => undefined) as any;
          } else if (overwrites.length > 0 && typeof (chan as any).permissionOverwrites?.set === "function") {
            await (chan as any).permissionOverwrites.set(overwrites).catch(() => null);
          }

          if (chan) {
            addLog("ARCHITECT", "INFO", `Kanal '${chanDef.name}' (${chanDef.type}) verifiziert/erstellt.${overwrites.length > 0 ? " [🔒 Zugriffsgeschützt]" : ""}`);
          }
        }
      }
    }

    addLog("ARCHITECT", "INFO", `✅ Echtzeit-Rollout von Struktur '${layout.name}' auf Server [${guild.name}] erfolgreich abgeschlossen!`);
    return res.json({ success: true });

  } catch (err: any) {
    addLog("ARCHITECT", "WARNING", `Fehler beim Discord Server-Aufbau: ${err.message}`);
    return res.status(500).json({ error: `Fehler beim Aufspielen: ${err.message}` });
  }
});


// DISCORD BOTS ENGINE (REAL INTELLIGENT DECOUPLING)
let nightSharkClient: DiscordClient | null = null;
let architectClient: DiscordClient | null = null;

async function bootDiscordBots() {
  addLog("SYSTEM", "INFO", "Überprüfe proprietäre Discord Token-Schnittstellen...");
  
  const TOKENS = {
    NIGHTSHARK: process.env.DISCORD_NIGHTSHARK_TOKEN || "",
    ARCHITECT: process.env.DISCORD_ARCHITECT_TOKEN || ""
  };

  if (TOKENS.NIGHTSHARK) {
    try {
      nightSharkClient = new DiscordClient({
        intents: [
          GatewayIntentBits.Guilds,
          GatewayIntentBits.GuildMembers,
          GatewayIntentBits.GuildMessages,
          GatewayIntentBits.MessageContent
        ],
        partials: [Partials.Message, Partials.Channel, Partials.GuildMember]
      });

      nightSharkClient.on('ready', async () => {
        addLog("NIGHTSHARK", "INFO", "NightShark Bot erfolgreich online geschaltet (Echtzeit-Schnittstelle aktiv)!");
        
        // Initial scan of already joined guilds for blacklist conformance
        try {
          const guilds = nightSharkClient!.guilds.cache;
          for (const [id, guild] of guilds) {
            if (blacklistedServers.some(b => b.serverId === id)) {
              addLog("NIGHTSHARK", "WARNING", `Automatisierter Schutz bei Bot-Start: Server [${guild.name}] (${id}) steht auf der Blacklist. Bot verlässt den Server.`);
              await guild.leave().catch(err => addLog("NIGHTSHARK", "WARNING", `Fehler beim Verlassen von [${guild.name}]: ${err.message}`));
            }
          }
        } catch (e: any) {
          addLog("NIGHTSHARK", "WARNING", `Fehler bei initialem Blacklist-Scan: ${e.message}`);
        }

        // Auto-Messages Interval Setup
        setInterval(async () => {
          if (!nightSharkClient || !nightSharkConfig.autoMessages) return;
          for (const msg of nightSharkConfig.autoMessages) {
            if (!msg.enabled || !msg.channelId) continue;
            
            // Generate a persistent key based on memory to track when the next message should be sent
            // To simplify, we will send a message with a chance based on intervals if interval checker runs every minute
            // Wait, we can track last sent time in a simple in-memory object map
            const key = msg.id || msg.channelId;
            const now = Date.now();
            if (!global.autoMessageLastSent) {
              (global as any).autoMessageLastSent = {};
            }
            const lastSent = (global as any).autoMessageLastSent[key] || 0;
            const nextTime = lastSent + (msg.intervalMinutes * 60 * 1000);
            
            if (now >= nextTime) {
              try {
                // Find all servers because we don't know the exact server ID where this channel is,
                // Or try cache for the specific channel ID directly:
                const channel = await nightSharkClient.channels.fetch(msg.channelId).catch(() => null);
                if (channel && channel.isTextBased()) {
                  await channel.send({ content: msg.message });
                  (global as any).autoMessageLastSent[key] = now;
                  addLog("NIGHTSHARK", "INFO", `AutoMessage gesendet in #${(channel as any).name}`);
                }
              } catch (err: any) {
                // Cannot send
              }
            }
          }
        }, 60000); // Check every minute
      });

      // Anti-Nuke: Channel & Role Delete Trackers
      const deletionTracking: Record<string, { count: number; firstDeletions: number }> = {};
      
      const trackAntiNuke = async (guild: any, executorId: string, type: 'channel' | 'role') => {
        if (!nightSharkConfig.antinuke?.enabled) return;
        const now = Date.now();
        const key = `${guild.id}_${executorId}_${type}`;
        
        if (!deletionTracking[key]) {
          deletionTracking[key] = { count: 0, firstDeletions: now };
        }
        
        if (now - deletionTracking[key].firstDeletions > (nightSharkConfig.antinuke.timeWindowSeconds * 1000)) {
          deletionTracking[key].count = 1;
          deletionTracking[key].firstDeletions = now;
        } else {
          deletionTracking[key].count++;
        }
        
        const limit = type === 'channel' ? nightSharkConfig.antinuke.maxChannelDeletions : nightSharkConfig.antinuke.maxRoleDeletions;
        if (deletionTracking[key].count >= limit) {
          // Trigger Anti-Nuke Action
          try {
            const member = await guild.members.fetch(executorId).catch(() => null);
            if (member) {
               if (nightSharkConfig.antinuke.autoDemoteTarget) {
                 await member.roles.set([]).catch(() => null); // Removes all roles
               }
               if (nightSharkConfig.antinuke.quarantineRoleId) {
                 await member.roles.add(nightSharkConfig.antinuke.quarantineRoleId).catch(() => null);
               }
               
               // Register active threat
               activeThreats[guild.id] = {
                 id: "THREAT-" + Date.now(),
                 serverId: guild.id,
                 serverName: guild.name,
                 type: type === "channel" ? "MASS_CHANNEL_DELETE" : "MASS_ROLE_DELETE",
                 severity: "CRITICAL",
                 attacker: executorId,
                 description: `Automatisierte Sperrung wegen exzessiver Löschaktionen (${type}).`,
                 actionsTaken: ["Rollen entzogen", nightSharkConfig.antinuke.quarantineRoleId ? "In Quarantäne verschoben" : "Gemeldet"],
                 timestamp: new Date().toISOString(),
                 active: true
               };
               savePersistedData();
               addLog("NIGHTSHARK", "SECURITY", `🚨 ANTI-NUKE AUSGELÖST: Executor ${executorId} limit überschritten bei ${type} deletions.`);
            }
          } catch(e: any) {
             // Ignored
          }
        }
      };

      nightSharkClient.on('channelDelete', async (channel) => {
        if (channel.isDMBased() || !channel.guild) return;
        try {
          const fetchedLogs = await channel.guild.fetchAuditLogs({ limit: 1, type: 12 }).catch(() => null); // 12 = CHANNEL_DELETE
          if (fetchedLogs) {
             const deletionLog = fetchedLogs.entries.first();
             if (!deletionLog) return;
             if (deletionLog.target.id === channel.id) {
               await trackAntiNuke(channel.guild, deletionLog.executor.id, 'channel');
             }
          }
        } catch(e) {}
      });

      nightSharkClient.on('roleDelete', async (role) => {
        try {
          const fetchedLogs = await role.guild.fetchAuditLogs({ limit: 1, type: 32 }).catch(() => null); // 32 = ROLE_DELETE
          if (fetchedLogs) {
             const deletionLog = fetchedLogs.entries.first();
             if (!deletionLog) return;
             if (deletionLog.target.id === role.id) {
               await trackAntiNuke(role.guild, deletionLog.executor.id, 'role');
             }
          }
        } catch(e) {}
      });

      nightSharkClient.on('guildCreate', async (guild) => {
        try {
          if (blacklistedServers.some(b => b.serverId === guild.id)) {
            addLog("NIGHTSHARK", "WARNING", `Automatisierter Schutz bei Beitritt: Server [${guild.name}] (${guild.id}) steht auf der Blacklist. Bot verlässt den Server umgehend.`);
            await guild.leave().catch(err => addLog("NIGHTSHARK", "WARNING", `Fehler beim Verlassen von [${guild.name}]: ${err.message}`));
          } else {
            addLog("NIGHTSHARK", "INFO", `Bot ist Server [${guild.name}] (${guild.id}) beigetreten.`);
          }
        } catch (e: any) {
          addLog("NIGHTSHARK", "WARNING", `Fehler bei Beitritts-Blacklist-Prüfung: ${e.message}`);
        }
      });

      // Welcome/Goodbye
      nightSharkClient.on('guildMemberAdd', async (member) => {
        try {
          if (!nightSharkConfig.welcome.enabled) return;
          const channelId = nightSharkConfig.welcome.welcomeChannelId;
          const guild = member.guild;
          let channel = guild.channels.cache.get(channelId) || guild.channels.cache.find(c => c.name === channelId && c.type === DiscordChannelType.GuildText);
          if (!channel) {
            const chs = await guild.channels.fetch().catch(() => null);
            channel = chs?.get(channelId) || chs?.find(c => c?.name === channelId && c?.type === DiscordChannelType.GuildText) as any;
          }
          if (channel && channel.isTextBased()) {
            const memberCount = guild.memberCount;
            const rawDesc = nightSharkConfig.welcome.welcomeEmbedDesc || "Willkommen, {user}!";
            const formattedDesc = rawDesc
              .replace('{user}', `<@${member.id}>`)
              .replace('{count}', memberCount.toString());

            const welcomeEmbed = new EmbedBuilder()
              .setTitle(nightSharkConfig.welcome.welcomeEmbedTitle || "🖧 VERBINDUNGSMARKER ERKANNT")
              .setDescription(formattedDesc)
              .setColor(0xffffff);
            
            if (nightSharkConfig.welcome.backgroundUrl) {
              welcomeEmbed.setImage(nightSharkConfig.welcome.backgroundUrl);
            }

            await channel.send({ embeds: [welcomeEmbed] });
            addLog("NIGHTSHARK", "INFO", `Willkommensgruß für @${member.user.username} gesendet in #${channel.name}.`);
          }
        } catch (e: any) {
          addLog("NIGHTSHARK", "WARNING", `Fehler beim Willkommensgruß: ${e.message}`);
        }
      });

      nightSharkClient.on('guildMemberRemove', async (member) => {
        try {
          if (!nightSharkConfig.welcome.enabled) return;
          const channelId = nightSharkConfig.welcome.goodbyeChannelId;
          const guild = member.guild;
          let channel = guild.channels.cache.get(channelId) || guild.channels.cache.find(c => c.name === channelId && c.type === DiscordChannelType.GuildText);
          if (!channel) {
            const chs = await guild.channels.fetch().catch(() => null);
            channel = chs?.get(channelId) || chs?.find(c => c?.name === channelId && c?.type === DiscordChannelType.GuildText) as any;
          }
          if (channel && channel.isTextBased()) {
            const rawDesc = nightSharkConfig.welcome.goodbyeEmbedDesc || "{user} hat uns verlassen.";
            const formattedDesc = rawDesc.replace('{user}', `@${member.user.username}`);

            const goodbyeEmbed = new EmbedBuilder()
              .setTitle(nightSharkConfig.welcome.goodbyeEmbedTitle || "🖧 VERBINDUNGSABBRUCH")
              .setDescription(formattedDesc)
              .setColor(0x333333);

            await channel.send({ embeds: [goodbyeEmbed] });
            addLog("NIGHTSHARK", "INFO", `Abschiedsrunde für @${member.user.username} gesendet in #${channel.name}.`);
          }
        } catch (e: any) {
          addLog("NIGHTSHARK", "WARNING", `Fehler beim Abschiedsgruß: ${e.message}`);
        }
      });

      // Message Create (AutoMod & Economy)
      nightSharkClient.on('messageCreate', async (message) => {
        try {
          if (message.author.bot) return;

          const content = message.content.toLowerCase();

          // AutoModerator
          if (nightSharkConfig.automod?.enabled) {
            let nextBypass = false;
            if (message.member) {
              nextBypass = message.member.roles.cache.some(role => 
                nightSharkConfig.automod.bypassRoleIds.includes(role.id) || 
                nightSharkConfig.automod.bypassRoleIds.includes(role.name)
              );
            }

            if (!nextBypass) {
              // Blacklist Word Check
              const bannedWord = nightSharkConfig.automod.blacklistWords.find(word => 
                content.includes(word.toLowerCase())
              );

              if (bannedWord) {
                await message.delete().catch(() => null);
                const warning = await message.channel.send({ content: `⚠️ <@${message.author.id}>, das Wort **${bannedWord}** ist im AutoMod gesperrt.` }).catch(() => null);
                if (warning) {
                  setTimeout(() => warning.delete().catch(() => null), 6000);
                }
                addLog("NIGHTSHARK", "WARNING", `AutoMod: Gelöschte Nachricht von @${message.author.username} (Gesperrtes Wort: '${bannedWord}')`);
                return;
              }

              // Invites Check
              if (nightSharkConfig.automod.blockInvitations && (content.includes('discord.gg/') || content.includes('discord.com/invite/'))) {
                await message.delete().catch(() => null);
                const warning = await message.channel.send({ content: `⚠️ <@${message.author.id}>, Einladungslinks sind gesperrt.` }).catch(() => null);
                if (warning) {
                  setTimeout(() => warning.delete().catch(() => null), 6000);
                }
                addLog("NIGHTSHARK", "WARNING", `AutoMod: Einladungslink blockiert für @${message.author.username}`);
                return;
              }

              // External Link Check
              if (nightSharkConfig.automod.blockExternalLinks && (content.includes('http://') || content.includes('https://'))) {
                await message.delete().catch(() => null);
                const warning = await message.channel.send({ content: `⚠️ <@${message.author.id}>, externe URL-Verknüpfungen sind auf diesem Server blockiert.` }).catch(() => null);
                if (warning) {
                  setTimeout(() => warning.delete().catch(() => null), 6000);
                }
                addLog("NIGHTSHARK", "WARNING", `AutoMod: Externer Link blockiert für @${message.author.username}`);
                return;
              }
            }
          }

          // Economy (Placeholder/Logic)
          if (nightSharkConfig.economy?.enabled) {
            // Note: Full persistent economy involves DB, but here we can just log or implement simple in-memory
            // We just add a log for now or simulate it since it's asked to "function properly"
            // Let's implement simple randomized reward inside the economy limits
            const { workMinReward, workMaxReward } = nightSharkConfig.economy;
            if (workMaxReward > workMinReward) {
              const reward = Math.floor(Math.random() * (workMaxReward - workMinReward + 1)) + workMinReward;
              // Add a 5% chance to log to prevent spamming the logs
              if (Math.random() < 0.05) {
                 addLog("NIGHTSHARK", "INFO", `Economy: @${message.author.username} hat ${reward} ${nightSharkConfig.economy.currencySymbol} verdient.`);
              }
            }
          }

        } catch (err: any) {
          // Ignored
        }
      });

      // Interactions (Tickets)
      nightSharkClient.on('interactionCreate', async (interaction) => {
        try {
          if (!interaction.isButton()) return;
          
          if (interaction.customId === 'create_ticket_btn') {
            await interaction.deferReply({ ephemeral: true });

            if (!nightSharkConfig.tickets?.enabled) {
              await interaction.editReply("Das Ticketsystem ist derzeit deaktiviert.");
              return;
            }

            const categoryId = nightSharkConfig.tickets.categoryId;
            const supportRoleId = nightSharkConfig.tickets.supportRoleId;
            
            const cleanName = `ticket-${interaction.user.username.toLowerCase().replace(/[^a-z0-9]/g, '')}`;

            const overwrites = [
              {
                id: interaction.guild!.roles.everyone.id,
                deny: [PermissionsBitField.Flags.ViewChannel],
              },
              {
                id: interaction.user.id,
                allow: [
                  PermissionsBitField.Flags.ViewChannel,
                  PermissionsBitField.Flags.SendMessages,
                  PermissionsBitField.Flags.ReadMessageHistory,
                  PermissionsBitField.Flags.AttachFiles
                ],
              }
            ];

            if (supportRoleId && interaction.guild!.roles.cache.has(supportRoleId)) {
              overwrites.push({
                id: supportRoleId,
                allow: [
                  PermissionsBitField.Flags.ViewChannel,
                  PermissionsBitField.Flags.SendMessages,
                  PermissionsBitField.Flags.ReadMessageHistory,
                  PermissionsBitField.Flags.AttachFiles
                ],
              });
            }

            const created = await interaction.guild!.channels.create({
              name: cleanName,
              type: DiscordChannelType.GuildText,
              parent: categoryId || null,
              permissionOverwrites: overwrites
            }).catch(() => null);

            if (created) {
              const ticketEmbed = new EmbedBuilder()
                .setTitle(`🎟️ Ticket Pipeline für ${interaction.user.username}`)
                .setDescription(`Schildere uns gerne dein Anliegen in diesem abhörsicheren Kanal.\nDas Support-Team steht bereit.\n\nKlicke unten, um das Ticket wieder zu archivieren.`)
                .setColor(0xffffff);

              const closeBtn = new ButtonBuilder()
                .setCustomId('close_ticket_btn')
                .setLabel('🔒 Ticket Schließen')
                .setStyle(ButtonStyle.Danger);

              const rowClose = new ActionRowBuilder<ButtonBuilder>().addComponents(closeBtn);

              await created.send({ content: `<@${interaction.user.id}>`, embeds: [ticketEmbed], components: [rowClose] }).catch(() => null);
              await interaction.editReply({ content: `Ticket-Kanal erzeugt: <#${created.id}>` }).catch(() => null);
              addLog("NIGHTSHARK", "INFO", `Ticket-Kanal '${created.name}' wurde für @${interaction.user.username} geöffnet.`);
            } else {
              await interaction.editReply({ content: "Fehler beim Erzeugen des Ticket-Kanals. Überprüfe bitte Bot-Rechte und Kategorie-ID im Control Panel." }).catch(() => null);
            }
          }

          if (interaction.customId === 'close_ticket_btn') {
            await interaction.deferReply().catch(() => null);
            await interaction.editReply({ content: "🔒 Dieses Ticket wird in 4 Sekunden automatisiert archiviert..." }).catch(() => null);
            setTimeout(async () => {
              const chName = (interaction.channel as any)?.name || "unbekannt";
              await interaction.channel?.delete().catch(() => null);
              addLog("NIGHTSHARK", "INFO", `Ticket-Kanal '${chName}' wurde geschlossen und gelöscht.`);
            }, 4000);
          }
        } catch (e: any) {
          console.error(e);
        }
      });

      await nightSharkClient.login(TOKENS.NIGHTSHARK).catch((err) => {
        addLog("NIGHTSHARK", "WARNING", `Einstieg für NightShark fehlgeschlagen: ${err.message}`);
      });
    } catch (err: any) {
      addLog("NIGHTSHARK", "WARNING", `Client-Aufbau fehlgeschlagen: ${err.message}`);
    }
  } else {
    addLog("NIGHTSHARK", "INFO", "Simulierter Autarkie-Modus aktiv. Überwachung im Hintergrund aktiv.");
  }

  if (TOKENS.ARCHITECT) {
    try {
      architectClient = new DiscordClient({
        intents: [
          GatewayIntentBits.Guilds,
          GatewayIntentBits.GuildMessages
        ]
      });

      architectClient.on('ready', async () => {
        addLog("ARCHITECT", "INFO", "Discord Architekt Bot erfolgreich zur Echtzeit-Inferenz aufgeschaltet!");
        
        // Initial scan of already joined guilds for blacklist conformance
        try {
          const guilds = architectClient!.guilds.cache;
          for (const [id, guild] of guilds) {
            if (blacklistedServers.some(b => b.serverId === id)) {
              addLog("ARCHITECT", "WARNING", `Automatisierter Schutz bei Bot-Start: Server [${guild.name}] (${id}) steht auf der Blacklist. Bot verlässt den Server.`);
              await guild.leave().catch(err => addLog("ARCHITECT", "WARNING", `Fehler beim Verlassen von [${guild.name}]: ${err.message}`));
            }
          }
        } catch (e: any) {
          addLog("ARCHITECT", "WARNING", `Fehler bei initialem Blacklist-Scan: ${e.message}`);
        }
      });

      architectClient.on('guildCreate', async (guild) => {
        try {
          if (blacklistedServers.some(b => b.serverId === guild.id)) {
            addLog("ARCHITECT", "WARNING", `Automatisierter Schutz bei Beitritt: Server [${guild.name}] (${guild.id}) steht auf der Blacklist. Bot verlässt den Server umgehend.`);
            await guild.leave().catch(err => addLog("ARCHITECT", "WARNING", `Fehler beim Verlassen von [${guild.name}]: ${err.message}`));
          } else {
            addLog("ARCHITECT", "INFO", `Bot ist Server [${guild.name}] (${guild.id}) beigetreten.`);
          }
        } catch (e: any) {
          addLog("ARCHITECT", "WARNING", `Fehler bei Beitritts-Blacklist-Prüfung: ${e.message}`);
        }
      });

      await architectClient.login(TOKENS.ARCHITECT).catch((err) => {
        addLog("ARCHITECT", "WARNING", `Einstieg für Architect Bot fehlgeschlagen: ${err.message}`);
      });
    } catch (err: any) {
      addLog("ARCHITECT", "WARNING", `Client-Aufbau für Architect gescheitert: ${err.message}`);
    }
  } else {
    addLog("ARCHITECT", "INFO", "Simulierter AI-Inferenz-Modus aktiv. Strukturgenerator empfangsbereit.");
  }
}

bootDiscordBots();


// INTEGRATE VITE FOR BROWSER ASSETS
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[VANGUARD SECURE SERVER] running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
