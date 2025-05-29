import express from "express";
import dotenv from "dotenv";
import axios from "axios";
import { Configuration, OpenAIApi } from "openai";

dotenv.config();
const app = express();
app.use(express.json());

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

// Webhook do Make
const MAKE_WEBHOOK_URL = "https://hook.us2.make.com/bqj9bo2noa3iony1t5i7ed6mnq5cejws";

// Verifica se todos os campos do pedido foram preenchidos
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
    const completion = await openai.createChatCompletion({
      model: "gpt-4o", // ou "gpt-3.5-turbo"
      messages: [
        {
          role: "system",
          content: `
Você é um atendente da Giulia Pizzaria. Sempre que o cliente fornecer um pedido completo, responda com um JSON estruturado contendo:
- nome
- produto
- quantidade
- pagamento
- endereco
- telefone
- observacao (opcional)
- datahora (formato ISO)

Exemplo de resposta:
{
  "nome": "João",
  "produto": "Pizza calabresa",
  "quantidade": 1,
  "pagamento": "Pix",
  "endereco": "Rua X, 123",
  "telefone": "11999999999",
  "observacao": "Sem cebola",
  "datahora": "2025-05-29T20:00:00"
}

Não adicione explicações. Retorne apenas o JSON se o pedido estiver completo.
`,
        },
        {
          role: "user",
          content: mensagem,
        },
      ],
    });

    const resposta = completion.data.choices[0].message.content;

    // Se a resposta tiver todos os campos, envia pro Make
    if (pedidoCompleto(resposta)) {
      await axios.post(MAKE_WEBHOOK_URL, JSON.parse(resposta));
    }

    res.json({ resposta });
  } catch (erro) {
    console.error("Erro:", erro.response?.data || erro.message);
    res.status(500).json({ erro: "Erro ao processar pedido" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
