import axios from "axios";

export default async function pedido(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ erro: "Método não permitido" });
  }

  const data = req.body;
  const webhookURL = process.env.MAKE_WEBHOOK_URL;

  if (!webhookURL) {
    return res.status(500).json({ erro: "Webhook não configurado" });
  }

  try {
    await axios.post(webhookURL, data);
    res.status(200).json({ status: "Pedido enviado com sucesso" });
  } catch (erro) {
    res.status(500).json({ erro: "Erro ao enviar para o Make", detalhe: erro.message });
  }
}