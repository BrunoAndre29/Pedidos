export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { nome, endereco, telefone, pedido, forma_pagamento, observacoes } = req.body;

  if (!nome || !endereco || !telefone || !pedido || !forma_pagamento) {
    return res.status(400).json({ error: 'Dados incompletos.' });
  }

  const webhookUrl = process.env.MAKE_WEBHOOK_URL;
  if (!webhookUrl) {
    return res.status(500).json({ error: 'MAKE_WEBHOOK_URL não configurada.' });
  }

  try {
    const resposta = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome, endereco, telefone, pedido, forma_pagamento, observacoes })
    });

    if (!resposta.ok) {
      throw new Error('Erro ao enviar para o Make.com');
    }

    res.status(200).json({ status: 'Pedido enviado com sucesso' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}