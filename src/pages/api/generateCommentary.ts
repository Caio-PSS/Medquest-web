import { NextApiRequest, NextApiResponse } from 'next';
import { RateLimiterMemory } from 'rate-limiter-flexible';
import OpenAI from 'openai';

// Cria limitadores para requisições por minuto e por dia
const rateLimiterMinute = new RateLimiterMemory({
  points: 10, // 10 requisições
  duration: 60, // por 60 segundos
});

const rateLimiterDay = new RateLimiterMemory({
  points: 50, // 50 requisições
  duration: 86400, // por 24 horas
});

// Para limitar requisições concorrentes, usamos uma variável simples
let concurrentRequests = 0;
const maxConcurrentRequests = 2;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Método não permitido' });
    return;
  }

  // Obtém o IP do usuário (ou um identificador equivalente)
  const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress) as string;
  
  try {
    // Consome os pontos dos limitadores
    await rateLimiterMinute.consume(ip);
    await rateLimiterDay.consume(ip);

    // Verifica o limite de requisições concorrentes
    if (concurrentRequests >= maxConcurrentRequests) {
      res.status(429).json({ error: 'Muitas requisições concorrentes. Tente novamente mais tarde.' });
      return;
    }
    concurrentRequests++;

    // Recebe os dados enviados na requisição
    const { sessionStats, wrongQuestions, correctQuestions } = req.body;
    
    // Monta o prompt para o modelo com os dados da sessão
    const prompt = `Você é um Coach de questões de residência médica. Analise as seguintes estatísticas da sessão:
- Total de Questões: ${sessionStats.totalQuestions}
- Acertos: ${sessionStats.correct}
- Erros: ${sessionStats.incorrect}
- Tempo Total: ${sessionStats.totalTime} segundos
- Tempo Médio de Resposta: ${sessionStats.totalQuestions > 0 ? (sessionStats.totalTime / sessionStats.totalQuestions).toFixed(2) : '0'} segundos

Detalhes das questões que o aluno errou:
${(wrongQuestions && wrongQuestions.length > 0) ? wrongQuestions.join("\n") : "Nenhuma questão errada."}

Detalhes das questões que o aluno acertou:
${(correctQuestions && correctQuestions.length > 0) ? correctQuestions.join("\n") : "Nenhuma questão correta detalhada."}

Forneça um comentário detalhado com sugestões de estudo para as questões erradas e pontos positivos para as acertas. Seja claro, objetivo e motivador.`;

    // Cria o cliente OpenAI utilizando a chave armazenada em variáveis de ambiente
    const token = process.env.GITHUB_TOKEN;
    if (!token) {
      throw new Error("Token não configurado");
    }
    const client = new OpenAI({
      baseURL: "https://models.inference.ai.azure.com",
      apiKey: token,
    });

    const response = await client.chat.completions.create({
      messages: [
        { role: "system", content: "Você é um Coach de questões de residência médica." },
        { role: "user", content: prompt }
      ],
      model: "gpt-4o",
      temperature: 1,
      max_tokens: 4000, // limite de tokens de saída
      top_p: 1,
    });

    res.status(200).json({ commentary: response.choices[0].message.content });
    
  } catch (error) {
    console.error("Erro na API de comentário:", error);
    res.status(429).json({ error: "Limite de requisições excedido ou erro interno. Tente novamente mais tarde." });
  } finally {
    // Libera o slot concorrente
    concurrentRequests = Math.max(0, concurrentRequests - 1);
  }
}
