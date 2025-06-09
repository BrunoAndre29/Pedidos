import express from "express";
import dotenv from "dotenv";
import axios from "axios";
import OpenAI from "openai";

dotenv.config();
const app = express();
app.use(express.json());

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const MAKE_WEBHOOK_URL = "https://hook.us2.make.com/bqj9bo2noa3iony1t5i7ed6mnq5cejws";

// Não faz mais distinção! Qualquer mensagem recebida já vai para o Make
app.post("/chat", async (req, res) => {
  const { mensagem } = req.body;

  try {
    // Manda para o Make, independente do conteúdo (pedido completo OU endereço)
    await axios.post(MAKE_WEBHOOK_URL, { mensagem });

    res.json({ status: "Mensagem enviada ao Make com sucesso!" });
  } catch (erro) {
    console.error("Erro ao enviar mensagem ao Make:", erro.response?.data || erro.message);
    res.status(500).json({ erro: "Erro ao processar mensagem" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Servidor rodando na porta ${PORT}`));
