export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método não permitido" });
  }

  const { nome, endereco, telefone, pedido, forma_pagamento, observacoes } = req.body;

  if (!nome || !endereco || !telefone || !pedido || !forma_pagamento) {
    return res.status(400).json({ error: "Dados incompletos no pedido." });
  }

  const pedidoFormatado = {
    nome,
    endereco,
    telefone,
    pedido,
    forma_pagamento,
    observacoes: observacoes || ""
  };

  return res.status(200).json({ sucesso: true, pedido: pedidoFormatado });
}
