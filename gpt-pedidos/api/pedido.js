export default async function handler(req, res) {
    if (req.method !== "POST") {
        return res.status(405).json({ error: "Método não permitido" });
    }

    try {
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

        await fetch(process.env.MAKE_WEBHOOK_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(pedidoFormatado)
        });

        return res.status(200).json({ mensagem: "Pedido enviado com sucesso!" });
    } catch (error) {
        console.error("Erro ao enviar pedido:", error);
        return res.status(500).json({ error: "Erro interno ao processar o pedido." });
    }
}