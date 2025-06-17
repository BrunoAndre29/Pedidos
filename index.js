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
const ENDERECO_ORIGEM = "Rua Paquequer, 360 - Santa Maria, Santo André - SP";

// Verifica se pedido está completo
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

// Gera data/hora atual no formato brasileiro
function gerarDataHoraBrasil() {
  const agora = new Date().toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
  });
  const [data, hora] = agora.split(", ");
  const [dia, mes, ano] = data.split("/");
  return `${hora} - ${dia}/${mes}/${ano.slice(2)}`;
}

// Verifica se pizzaria está aberta (terça a domingo, 17h-00h)
function estaAbertoAgora() {
  const agora = new Date().toLocaleString("en-US", {
    timeZone: "America/Sao_Paulo",
    hour12: false,
  });
  const data = new Date(agora);
  const diaSemana = data.getDay(); // 0 = domingo, 1 = segunda...
  const hora = data.getHours();

  return diaSemana >= 2 && diaSemana <= 7 && hora >= 17 && hora < 24;
}

// Verifica se o pedido é agendado fora do horário
function pedidoAgendadoForaDoHorario(pedido) {
  const fechadoAgora = !estaAbertoAgora();
  const temAgendamento =
    pedido.observacao &&
    pedido.observacao.toLowerCase().includes("agendado para");

  return fechadoAgora && temAgendamento;
}

// Rota principal que o GPT chama
app.post("/chat", async (req, res) => {
  const { mensagem } = req.body;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `
Você é um atendente virtual da Giulia Pizzaria. Converse com o cliente e, quando o pedido estiver completo, retorne apenas um JSON com:

{
  "nome": "...",
  "produto": "...",
  "quantidade": ...,
  "valor": "...",
  "pagamento": "...",
  "endereco": "...",
  "telefone": "...",
  "observacao": "...",
  "datahora": "{{horário atual no formato HH:mm - dd/MM/yy}}"
}

Não inclua explicações ou texto fora do JSON.
          `,
        },
        {
          role: "user",
          content: mensagem,
        },
      ],
    });

    const resposta = completion.choices[0].message.content;

    if (pedidoCompleto(resposta)) {
      const json = JSON.parse(resposta);

      const numeroPedido = json.nome.match(/#(\d{4})$/)?.[1] || null;

      const jsonFinal = {
        ...json,
        numero_pedido: numeroPedido,
        valor: json.valor,
        datahora: gerarDataHoraBrasil(),
      };

      const resp = await axios.post(`${process.env.BASE_URL}/verificar-pedido`, jsonFinal);
      return res.json({ resposta: resp.data });
    }

    res.json({ resposta });
  } catch (erro) {
    console.error("Erro no /chat:", erro.response?.data || erro.message);
    res.status(500).json({ erro: "Erro ao processar o pedido" });
  }
});

// Endpoint de verificação e envio real do pedido
app.post("/verificar-pedido", async (req, res) => {
  const pedido = req.body;
  const { endereco } = pedido;

  try {
    if (!estaAbertoAgora() && !pedidoAgendadoForaDoHorario(pedido)) {
      return res.send(
        `📢 Opa! A Giulia Pizzaria está fechada no momento.\nFuncionamos de terça a domingo, das 17h às 00h.\nSe quiser, posso agendar seu pedido. Para qual dia e horário você gostaria de agendar?`
      );
    }

    const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${encodeURIComponent(
      ENDERECO_ORIGEM
    )}&destinations=${encodeURIComponent(endereco)}&key=${process.env.GOOGLE_MAPS_API_KEY}`;

    const resposta = await axios.get(url);
    const distanciaMetros = resposta.data.rows[0].elements[0].distance.value;
    const distanciaTexto = resposta.data.rows[0].elements[0].distance.text;

    if (distanciaMetros > 10000) {
      return res.send(`😞 Seu endereço está a ${distanciaTexto}, fora da nossa área de entrega (10 km). Que tal retirar no local?`);
    }

    await axios.post(MAKE_WEBHOOK_URL, pedido);

    return res.send("✅ Pedido confirmado com sucesso! Suas pizzas estão a caminho 🍕");
  } catch (erro) {
    console.error("Erro em /verificar-pedido:", erro.response?.data || erro.message);
    return res.status(500).send("Erro ao verificar o endereço. Tente novamente.");
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
});

