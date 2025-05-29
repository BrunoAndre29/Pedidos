import express from 'express';
import dotenv from 'dotenv';
import bodyParser from 'body-parser';
import pedido from './api/pedido.js';

dotenv.config();
const app = express();
app.use(bodyParser.json());

app.post("/api/pedido", pedido);

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Servidor rodando na porta ${port}`);
});