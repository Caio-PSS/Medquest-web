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

    // Recebe os dados da requisição (agora incluindo user_id)
    const { sessionStats, user_id } = req.body;
    if (!sessionStats || !user_id) {
      return res.status(400).json({ error: "Parâmetros ausentes" });
    }
    const { wrongComments = [], correctComments = [] } = sessionStats;

    // Monta o prompt para IA, incluindo detalhes das estatísticas e questões
    const prompt = `**Atue como um tutor especialista em provas de residência médica** 🔍

1. **Análise Geral** (1-2 linhas no máximo):
   - "${sessionStats.correct} acertos vs ${sessionStats.incorrect} erros: [Destaque principal performance]."
   
2. **Raio-X dos Erros** (foco nos ${sessionStats.incorrect} erros):
   ${wrongComments.join("\n\n")}
   ▸ Identifique os principais padrões nas questões que o estudante errou acima:
   - **Padrão**: [Tema] + Motivo (ex: "Confundiu mecanismos fisiopatológicos? Interpretou exame incorretamente?")
   - **Correção**: Ação específica (ex: "Revisar fluxograma de diagnóstico para X")
   - **Impacto**: Como esse erro prejudica na prática clínica real?
   
3. **Plano de Revisão** (baseado nos erros por tópicos, indica quais os assuntos estudar por ordem de prioridade):

Dados-chave:  
⏳ Tempo médio: ${(sessionStats.totalTime / sessionStats.totalQuestions).toFixed(1)}s/q  
📊 Taxa de acerto: ${((sessionStats.correct / sessionStats.totalQuestions) * 100).toFixed(1)}%  
🔴 Maior erro: [Área com mais erros]`;

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

    const commentary = response.choices[0].message.content;

    // Envia o comentário gerado para a API de feedbacks para armazenar no banco
    const feedbackApiUrl =
      process.env.FEEDBACK_API_URL ||
      "https://medquest-floral-log-224.fly.dev/api/feedbacks";
    const feedbackPayload = {
      feedback_text: commentary,
      feedback_date: new Date().toISOString(),
      user_id: user_id,
    };
    const feedbackPostResponse = await fetch(feedbackApiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(feedbackPayload),
    });

    if (!feedbackPostResponse.ok) {
      console.warn("Falha ao enviar feedback para o banco de dados");
    }

    return res.status(200).json({ commentary });
  } catch (error) {
    console.error("Erro na API de comentário:", error);
    return res.status(500).json({ error: error.message });
  } finally {
    concurrentRequests = Math.max(0, concurrentRequests - 1);
  }
}
