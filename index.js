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

// Verifica se a string recebida é um JSON válido
function isValidJSON(str) {
  try {
    JSON.parse(str);
    return true;
  } catch (e) {
    return false;
  }
}

app.post("/chat", async (req, res) => {
  const { mensagem } = req.body;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `Você é um atendente virtual da Giulia Pizzaria... [restante do prompt]`,
        },
        {
          role: "user",
          content: mensagem,
        },
      ],
    });

    let resposta = completion.choices[0].message.content.trim();

    // Se vier um JSON válido do GPT, parse e envia para o Make
    if (isValidJSON(resposta)) {
      const json = JSON.parse(resposta);
      await axios.post(MAKE_WEBHOOK_URL, json);
    } else {
      // Caso o GPT envie só o endereço em texto
      // Ex: "ENDERECO: Rua X, 123"
      let endereco = "";
      // Padrão para identificar e extrair o endereço
      if (/endereco[:\-]/i.test(resposta)) {
        endereco = resposta.split(/endereco[:\-]/i)[1]?.trim();
      } else {
        endereco = resposta.trim();
      }
      if (endereco.length > 0) {
        await axios.post(MAKE_WEBHOOK_URL, { endereco });
      }
    }

    res.json({ resposta });
  } catch (erro) {
    console.error("Erro ao chamar GPT ou enviar para Make:", erro.response?.data || erro.message);
    res.status(500).json({ erro: "Erro ao processar pedido" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Servidor rodando na porta ${PORT}`));
