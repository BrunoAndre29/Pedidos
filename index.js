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

// Função para checar se o texto contém todos os campos do pedido
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

// Gera data e hora no formato desejado (HH:mm - dd/MM/yy) no fuso de São Paulo
function gerarDataHoraBrasil() {
  const agora = new Date().toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
  });
  const [data, hora] = agora.split(", ");
  const [dia, mes, ano] = data.split("/");
  return `${hora} - ${dia}/${mes}/${ano.slice(2)}`;
}

// Função para verificar se a pizzaria está aberta agora
function estaAbertoAgora() {
  const agora = new Date().toLocaleString("en-US", {
    timeZone: "America/Sao_Paulo",
    hour12: false,
  });
  const data = new Date(agora);
  const diaSemana = data.getDay(); // 0 = domingo, 1 = segunda, ..., 6 = sábado
  const hora = data.getHours();

  const abertoHoje = diaSemana >= 2 && diaSemana <= 7; // terça a domingo
  const dentroHorario = hora >= 17 && hora < 24;

  return abertoHoje && dentroHorario;
}

// Endpoint principal chamado pelo GPT
app.post("/chat", async (req, res) => {
  const { mensagem } = req.body;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `
Você é um atendente virtual da Giulia Pizzaria. Converse com o cliente, e quando o pedido estiver completo, retorne um JSON com:

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

    if (pedidoCompleto(resposta)) {
      const json = JSON.parse(resposta);

      const match = json.nome.match(/#(\d{4})$/);
      const numeroPedido = match ? parseInt(match[1]) : null;

      const jsonFinal = {
        ...json,
        numero_pedido: numeroPedido,
        valor: json.valor,
        datahora: gerarDataHoraBrasil(),
      };

      const respostaVerificacao = await axios.post("https://pedidos-wlsk.onrender.com/verificar-pedido", jsonFinal);

      return res.json({ resposta: respostaVerificacao.data });
    }

    res.json({ resposta });
  } catch (erro) {
    console.error("Erro ao chamar GPT ou processar pedido:", erro.response?.data || erro.message);
    res.status(500).json({ erro: "Erro ao processar pedido" });
  }
});

// Verifica se o pedido está fora do horário e é agendado
function pedidoAgendadoForaDoHorario(pedido) {
  const fechadoAgora = !estaAbertoAgora();
  const temAgendamento =
    pedido.observacao &&
    pedido.observacao.toLowerCase().includes("agendado para");

  return fechadoAgora && temAgendamento;
}

// Endpoint que valida a distância e decide se o pedido pode ser enviado
app.post("/verificar-pedido", async (req, res) => {
  const pedido = req.body;
  const { endereco } = pedido;

  try {
    // Se estiver fechado e não for agendamento, recusar
    if (!estaAbertoAgora() && !pedidoAgendadoForaDoHorario(pedido)) {
      return res.send(
        `📢 Opa! A Giulia Pizzaria está fechada no momento.\nFuncionamos de terça a domingo, das 17h às 00h.\nSe quiser, posso agendar seu pedido. Para qual dia e horário você gostaria de agendar?`
      );
    }

    const googleApiKey = process.env.GOOGLE_MAPS_API_KEY;
    const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${encodeURIComponent(
      ENDERECO_ORIGEM
    )}&destinations=${encodeURIComponent(endereco)}&key=${googleApiKey}`;

    const resposta = await axios.get(url);
    const distanciaMetros = resposta.data.rows[0].elements[0].distance.value;
    const distanciaTexto = resposta.data.rows[0].elements[0].distance.text;

    if (distanciaMetros > 10000) {
      return res.send(
        `😞 Infelizmente seu endereço está a ${distanciaTexto}, fora da nossa área de entrega (limite: 10 km). Que tal retirar no local?`
      );
    }

    await axios.post(MAKE_WEBHOOK_URL, pedido);

    return res.send("✅ Pedido confirmado com sucesso! Suas pizzas estão a caminho 🍕");
  } catch (erro) {
    console.error("Erro ao verificar distância ou enviar pedido:", erro.response?.data || erro.message);
    return res.status(500).send("Erro ao verificar o endereço. Tente novamente em instantes.");
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Servidor rodando na porta ${PORT}`));
