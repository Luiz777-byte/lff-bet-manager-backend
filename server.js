import express from "express";
import cors from "cors";
import "dotenv/config";

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;
const API_KEY = process.env.API_FOOTBALL_KEY;
const API_BASE = "https://v3.football.api-sports.io";
const TIMEZONE = "America/Sao_Paulo";
const cache = new Map();

app.get("/", (_req, res) => {
  res.json({
    app: "LFF BET MANAGER",
    status: "Servidor funcionando",
    footballApiConfigured: Boolean(API_KEY)
  });
});

async function apiFootball(path, cacheSeconds) {
  if (!API_KEY) {
    const error = new Error("A chave API_FOOTBALL_KEY não está configurada no Render.");
    error.status = 503;
    throw error;
  }

  const cached = cache.get(path);
  if (cached && cached.expiresAt > Date.now()) return cached.data;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(`${API_BASE}${path}`, {
      method: "GET",
      headers: {
        "x-apisports-key": API_KEY,
        "Accept": "application/json"
      },
      signal: controller.signal
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(data?.message || `API-Football respondeu HTTP ${response.status}`);
      error.status = response.status === 429 ? 429 : 502;
      error.details = data;
      throw error;
    }
    if (data?.errors && Object.keys(data.errors).length) {
      const error = new Error("A API-Football retornou um erro na consulta.");
      error.status = 502;
      error.details = data.errors;
      throw error;
    }

    cache.set(path, { data, expiresAt: Date.now() + cacheSeconds * 1000 });
    return data;
  } catch (error) {
    if (error.name === "AbortError") {
      const timeoutError = new Error("Tempo limite ao consultar a API-Football.");
      timeoutError.status = 504;
      throw timeoutError;
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

app.get("/api/football/status", async (_req, res) => {
  try {
    const data = await apiFootball("/status", 30);
    res.json(data);
  } catch (error) {
    res.status(error.status || 502).json({
      error: error.message,
      details: error.details || undefined
    });
  }
});

app.get("/api/football/fixtures", async (req, res) => {
  try {
    const { live, date, next } = req.query;
    let query;

    if (live === "all") {
      query = new URLSearchParams({ live: "all", timezone: TIMEZONE });
    } else if (date) {
      if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return res.status(400).json({ error: "Informe a data no formato AAAA-MM-DD." });
      }
      const parsed = new Date(`${date}T12:00:00Z`);
      if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) {
        return res.status(400).json({ error: "Data inválida." });
      }
      query = new URLSearchParams({ date, timezone: TIMEZONE });
    } else if (next !== undefined) {
      const count = Number(next);
      if (!Number.isInteger(count) || count < 1 || count > 100) {
        return res.status(400).json({ error: "O parâmetro next deve ser um número entre 1 e 100." });
      }
      query = new URLSearchParams({ next: String(count), timezone: TIMEZONE });
    } else {
      return res.status(400).json({ error: "Use live=all, date=AAAA-MM-DD ou next=50." });
    }

    const isLive = live === "all";
    const data = await apiFootball(`/fixtures?${query.toString()}`, isLive ? 25 : 120);
    res.set("Cache-Control", isLive ? "public, max-age=20" : "public, max-age=90");
    res.json(data);
  } catch (error) {
    res.status(error.status || 502).json({
      error: error.message || "Falha ao consultar partidas.",
      details: error.details || undefined
    });
  }
});


app.get("/api/football/fixtures/:fixtureId/statistics", async (req, res) => {
  try {
    const fixtureId = Number(req.params.fixtureId);
    if (!Number.isInteger(fixtureId) || fixtureId < 1) {
      return res.status(400).json({ error: "ID da partida inválido." });
    }
    const data = await apiFootball(
      `/fixtures/statistics?fixture=${fixtureId}`,
      60
    );
    res.set("Cache-Control", "public, max-age=45");
    res.json(data);
  } catch (error) {
    res.status(error.status || 502).json({
      error: error.message || "Falha ao consultar estatísticas da partida.",
      details: error.details || undefined
    });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log("LFF BET MANAGER iniciado na porta " + PORT);
});
