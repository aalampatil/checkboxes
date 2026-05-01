// server.js
import { configDotenv } from "dotenv";
configDotenv({ path: "./.env" });
import http from "node:http";
import path from "node:path";
import express from "express";
import cookieParser from "cookie-parser";
import { Server } from "socket.io";
import { publisher, subscriber, redis } from "../redis-connection.js";

const checkbox_size = 1000;
const checkbox_state_key = "checkbox-state:v2";

const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI; // http://localhost:8000/callback
const OIDC_BASE = process.env.OIDC_BASE;       // http://localhost:3000

console.table([CLIENT_ID, CLIENT_SECRET, REDIRECT_URI, OIDC_BASE])
// https://m-checkboxes.onrender.com/callback?code=0ea269a08587601c594be29615733445e9d6a001ae1fb8b9

// ── helpers ──────────────────────────────────────────────────────────────────

const setCheckBoxState = async (state) =>
  await redis.set(checkbox_state_key, JSON.stringify(state));

const getCheckBoxState = async () => {
  const data = await redis.get(checkbox_state_key);
  return data ? JSON.parse(data) : null;
};

const getOrCreateState = async () => {
  let state = await getCheckBoxState();
  if (!state) {
    state = new Array(checkbox_size).fill(false);
    await setCheckBoxState(state);
  }
  return state;
};

// Store user info in Redis keyed by session token
const getUserFromSession = async (token) => {
  if (!token) return null;
  const data = await redis.get(`session:${token}`);
  return data ? JSON.parse(data) : null;
};

// ── app ───────────────────────────────────────────────────────────────────────

async function createApp() {
  const port = process.env.PORT;
  const app = express();
  const server = http.createServer(app);
  const io = new Server(server);

  app.use(cookieParser());
  app.use(express.json());

  // ── Auth middleware ───────────────────────────────────────────────────────

  const requireAuth = async (req, res, next) => {
    const token = req.cookies?.session;
    const user = await getUserFromSession(token);
    if (!user) return res.redirect("/login.html");
    req.user = user;
    next();
  };

  // ── OIDC Callback ─────────────────────────────────────────────────────────

  app.get("/callback", async (req, res) => {
    const { code } = req.query;
    if (!code) return res.redirect("/login.html");

    // Exchange code for tokens
    const tokenRes = await fetch(`${OIDC_BASE}/o/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        grant_type: "authorization_code",
        code,
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        redirect_uri: REDIRECT_URI,
      }),
    });

    const tokens = await tokenRes.json();
    if (!tokens.access_token) return res.redirect("/login.html");

    // Fetch user info
    const userRes = await fetch(`${OIDC_BASE}/o/userinfo`, {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const user = await userRes.json();

    // Store session in Redis (24hr TTL)
    const sessionToken = crypto.randomUUID();
    await redis.set(`session:${sessionToken}`, JSON.stringify(user), "EX", 86400);

    res.cookie("session", sessionToken, {
      httpOnly: true,
      maxAge: 86400 * 1000,
    });

    return res.redirect("/");
  });

  // ── Logout ────────────────────────────────────────────────────────────────

  app.get("/logout", async (req, res) => {
    const token = req.cookies?.session;
    if (token) await redis.del(`session:${token}`);
    res.clearCookie("session");
    res.redirect("/login.html");
  });

  // ── Protected routes ──────────────────────────────────────────────────────

  app.get("/", requireAuth, (req, res) => {
    res.setHeader("Cache-Control", "no-store")
    res.sendFile(path.join(process.cwd(), "public", "index.html"));
  });

  app.get("/checkboxes-state", async (req, res) => {
    const token = req.cookies?.session;
    const user = await getUserFromSession(token);
    const state = await getOrCreateState();
    // Anonymous users get read-only state, no user info
    return res.json({ checkboxes: state, user: user ?? null });
  });

  app.get("/health", (req, res) => res.send("System Status - GOOD"));

  // Serve login page publicly
  app.use(express.static(path.join(process.cwd(), "public")));

  // ── Redis Pub/Sub ─────────────────────────────────────────────────────────

  await subscriber.subscribe("internal-server:checkbox:change");
  subscriber.on("message", (channel, message) => {
    if (channel === "internal-server:checkbox:change") {
      const parsed = JSON.parse(message);
      io.emit("server:checkbox:change", parsed);
    }
  });

  // ── Socket.io ─────────────────────────────────────────────────────────────

  // Auth middleware for sockets — read session cookie
  io.use(async (socket, next) => {
    const cookie = socket.handshake.headers.cookie ?? "";
    const match = cookie.match(/session=([^;]+)/);
    const token = match?.[1];
    const user = await getUserFromSession(token);
    socket.user = user ?? null; // null = anonymous
    next();
  });

  io.on("connection", (socket) => {
    console.log(`socket connected: ${socket.id} | user: ${socket.user?.email ?? "anonymous"}`);

    socket.on("client:checkbox:change", async (data) => {
      // Anonymous users cannot mutate state
      if (!socket.user) {
        socket.emit("server:error", { error: "You must be logged in to interact." });
        return;
      }

      // Rate limiting per socket in Redis
      const rateLimitKey = `rate-limiting:${socket.id}`;
      const lastTime = await redis.get(rateLimitKey);
      const cooldown = 5500;

      if (lastTime) {
        const timePassed = Date.now() - Number(lastTime);
        if (timePassed < cooldown) {
          socket.emit("server:error", {
            error: `Please wait ${Math.ceil((cooldown - timePassed) / 1000)}s before trying again`,
          });
          return;
        }
      }

      await redis.set(rateLimitKey, Date.now());

      const state = await getOrCreateState();
      state[data.index] = data.checked;
      await setCheckBoxState(state);
      await publisher.publish(
        "internal-server:checkbox:change",
        JSON.stringify({ index: data.index, checked: data.checked, user: socket.user.email })
      );
    });

    socket.on("disconnect", () => {
      console.log(`socket disconnected: ${socket.id}`);
    });
  });

  server.listen(port, () => {
    console.log(`server is listening on http://localhost:${port}`);
  });
}

createApp();