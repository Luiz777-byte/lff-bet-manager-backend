
import express from "express";
import cors from "cors";
import "dotenv/config";

const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;
const API_KEY = process.env.API_FOOTBALL_KEY;

app.get("/", (req, res) => {
  res.json({
    app: "LFF BET MANAGER",
    status: "Servidor funcionando"
  });
});

app.get("/api/football/status", async (req, res) => {
  try {
    if (!API_KEY) {
      return res.status(500).json({
        error: "Chave da API não configurada"
      });
    }

    const response = await fetch(
      "https://v3.football.api-sports.io/status",
      {
        headers: {
          "x-apisports-key": API_KEY
        }
      }
    );

    const data = await response.json();
    res.status(response.status).json(data);
  } catch (error) {
    res.status(502).json({
      error: "Falha na conexão com API-Football"
    });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log("LFF BET MANAGER iniciado na porta " + PORT);
});
