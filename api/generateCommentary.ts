import { RateLimiterMemory } from "rate-limiter-flexible";
import OpenAI from "openai";
import type { VercelRequest, VercelResponse } from "@vercel/node";

// Cria limitadores de requisição
const rateLimiterMinute = new RateLimiterMemory({ points: 10, duration: 60 }); // 10 req/min
const rateLimiterDay = new RateLimiterMemory({ points: 50, duration: 86400 }); // 50 req/dia

let concurrentRequests = 0;
const maxConcurrentRequests = 2;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método não permitido" });
  }

  const ip = (req.headers["x-forwarded-for"] || req.socket.remoteAddress) as string;

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
    const { sessionStats, wrongQuestions, correctQuestions } = req.body;

    // Monta o prompt para IA
    const prompt = `Você é um Coach de questões de residência médica...`;

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
    return res.status(429).json({ error: "Erro interno ou limite de requisições excedido." });
  } finally {
    concurrentRequests = Math.max(0, concurrentRequests - 1);
  }
}
