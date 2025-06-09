import express from "express";More actions
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

// Verifica se o JSON tem todos os campos
function pedidoCompleto(texto) {
  return (
    texto.includes('"nome":') &&
    texto.includes('"produto":') &&
    texto.includes('"quantidade":') &&
    texto.includes('"pagamento":') &&
    texto.includes('"endereco":') &&
    texto.includes('"telefone":')
  );
}

app.post("/chat", async (req, res) => {
  const { mensagem } = req.body;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o", // ou "gpt-3.5-turbo"
      messages: [
        {
          role: "system",
          content: `
Você é um atendente virtual da Giulia Pizzaria. Converse com o cliente, e quando o pedido estiver completo, retorne um JSON com:

{
  "nome": "...",
  "produto": "...",
  "quantidade": ...,
  "pagamento": "...",
  "endereco": "...",
  "telefone": "...",
  "observacao": "...",
  "datahora": "{{horário atual no formato ISO}}"
}

Se o nome contiver um número de pedido (ex: "Pedro #7429"), inclua esse número no nome, mas não retorne como campo separado.

Não escreva nada fora do JSON. Nenhuma explicação. Retorne apenas o JSON final.
          `,
        },
        {
          role: "user",
          content: mensagem,
        },
      ],
    });

    const resposta = completion.choices[0].message.content;

    // Se for JSON válido, envia para o Make
    if (pedidoCompleto(resposta)) {
      await axios.post(MAKE_WEBHOOK_URL, JSON.parse(resposta));
      const json = JSON.parse(resposta);

      // Tenta extrair número do pedido do nome, ex: "Pedro #7429"
      const match = json.nome.match(/#(\\d{4})$/);
      const numeroPedido = match ? parseInt(match[1]) : null;

      const jsonFinal = {
        ...json,
        numero_pedido: numeroPedido,
      };

      await axios.post(MAKE_WEBHOOK_URL, jsonFinal);
    }

    res.json({ resposta });
  } catch (erro) {
    console.error("Erro ao chamar GPT ou enviar para Make:", erro.response?.data || erro.message);
    res.status(500).json({ erro: "Erro ao processar pedido" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Servidor rodando na porta ${PORT}`));
