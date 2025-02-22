/**
 * @typedef {import('@vercel/node').VercelRequest} VercelRequest
 * @typedef {import('@vercel/node').VercelResponse} VercelResponse
 */

import { RateLimiterMemory } from "rate-limiter-flexible";
import OpenAI from "openai";

// Cria limitadores de requisição
const rateLimiterMinute = new RateLimiterMemory({ points: 10, duration: 60 }); // 10 req/min
const rateLimiterDay = new RateLimiterMemory({ points: 50, duration: 86400 }); // 50 req/dia

let concurrentRequests = 0;
const maxConcurrentRequests = 2;

/**
 * @param {VercelRequest} req
 * @param {VercelResponse} res
 */
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método não permitido" });
  }

/** @type {string} */
const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress || "";

  try {
    // Aplica limite de requisições
    await rateLimiterMinute.consume(ip);
    await rateLimiterDay.consume(ip);

    // Verifica requisições concorrentes
    if (concurrentRequests >= maxConcurrentRequests) {
      return res.status(429).json({ error: "Muitas requisições concorrentes. Tente novamente." });
    }
    concurrentRequests++;

    // Recebe os dados da requisição
    const { sessionStats } = req.body;
    const { wrongQuestions = [], correctQuestions = [] } = sessionStats;

    // Monta o prompt para IA, incluindo detalhes das estatísticas e questões
    const prompt = `Você é um Coach de questões de residência médica. Aqui estão as estatísticas da sessão:
Total de questões: ${sessionStats.totalQuestions}
Acertos: ${sessionStats.correct}
Erros: ${sessionStats.incorrect}
Tempo total: ${sessionStats.totalTime} segundos

Detalhes das questões corretas:
${correctQuestions.join("\n")}

Detalhes das questões erradas:
${wrongQuestions.join("\n")}

Forneça um comentário construtivo para a sessão.`;

    // Inicializa OpenAI
    const token = process.env.GITHUB_TOKEN;
    if (!token) {
      throw new Error("Token não configurado");
    }
    const client = new OpenAI({ baseURL: "https://models.inference.ai.azure.com", apiKey: token });

    // Envia requisição para OpenAI
    const response = await client.chat.completions.create({
      messages: [
        { role: "system", content: "Você é um Coach de questões de residência médica." },
        { role: "user", content: prompt },
      ],
      model: "gpt-4o",
      temperature: 1,
      max_tokens: 4000,
      top_p: 1,
    });

    return res.status(200).json({ commentary: response.choices[0].message.content });
  } catch (error) {
    console.error("Erro na API de comentário:", error);
    return res.status(500).json({ error: error.message });
  } finally {
    concurrentRequests = Math.max(0, concurrentRequests - 1);
  }
}
