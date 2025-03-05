const { GoogleGenerativeAI } = require("@google/generative-ai");
const { RateLimiterMemory } = require("rate-limiter-flexible");

// Configura os limitadores de requisição
const rateLimiterMinute = new RateLimiterMemory({ points: 10, duration: 60 });
const rateLimiterDay = new RateLimiterMemory({ points: 1500, duration: 86400 });

// Configura o client Gemini com a API Key
const apiKey = process.env.GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(apiKey);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-thinking-exp-01-21" });

const generationConfig = {
  temperature: 1,
  topP: 0.95,
  topK: 40,
  maxOutputTokens: 8192,
  responseMimeType: "text/plain",
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método não permitido" });
  }
  
  // Aplica os limitadores de requisição
  const ip =
    req.headers["x-real-ip"] ||
    req.headers["x-forwarded-for"] ||
    req.connection.remoteAddress;
  try {
    await rateLimiterMinute.consume(ip);
    await rateLimiterDay.consume(ip);
  } catch (rlRes) {
    return res.status(429).json({ error: "Too Many Requests" });
  }
  
  const {
    enunciado,
    alternativa_a,
    alternativa_b,
    alternativa_c,
    alternativa_d,
    resposta,
    explicacao,
  } = req.body;
  
  // Novo prompt para delegar a análise e complementação dos campos ao Gemini.
  // O prompt solicita que o modelo retorne um objeto JSON com os campos:
  // enunciado, alternativa_a, alternativa_b, alternativa_c, alternativa_d.
  // Apenas os campos que parecerem truncados ou incompletos devem ser completados.
  const prompt = `
Você é um editor de textos e especialista em questões de múltipla escolha. Sua tarefa é analisar os campos de uma questão e determinar se algum deles está truncado ou incompleto. Para cada campo, se o texto estiver completo, retorne-o inalterado; se estiver incompleto, complete somente o final do texto, mantendo o mesmo estilo e coerência.

Por favor, analise os seguintes dados e retorne apenas um objeto JSON contendo as chaves "enunciado", "alternativa_a", "alternativa_b", "alternativa_c" e "alternativa_d". Os campos "Resposta correta" e "Explicação" servem apenas como contexto e não devem ser alterados.

Dados da questão:
Enunciado: ${enunciado}
Alternativa A: ${alternativa_a}
Alternativa B: ${alternativa_b}
${alternativa_c ? `Alternativa C: ${alternativa_c}` : ""}
${alternativa_d ? `Alternativa D: ${alternativa_d}` : ""}

Resposta correta: ${resposta}
Explicação: ${explicacao}

Atenção: Retorne SOMENTE um objeto JSON válido sem explicações adicionais.
`;

  try {
    // Inicia uma sessão de chat com o Gemini e envia o prompt
    const chatSession = model.startChat({
      generationConfig,
      history: [],
    });
    const result = await chatSession.sendMessage(prompt);
    const rawOutput = result.response.text().trim();

    // Tenta extrair o objeto JSON do resultado.
    // Se o modelo retornar o JSON dentro de um bloco de código, removemos as marcações.
    const jsonMatch = rawOutput.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    const jsonString = jsonMatch ? jsonMatch[1] : rawOutput;
    
    let responseObj;
    try {
      responseObj = JSON.parse(jsonString);
    } catch (parseError) {
      console.error("Erro ao parsear JSON:", parseError, "Raw output:", rawOutput);
      return res.status(500).json({ error: "Erro ao interpretar a resposta do Gemini." });
    }
    
    return res.status(200).json(responseObj);
  } catch (error) {
    console.error("Erro ao completar a questão:", error);
    return res.status(500).json({ error: "Erro ao completar a questão." });
  }
}