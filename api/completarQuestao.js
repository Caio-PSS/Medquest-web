const { GoogleGenerativeAI } = require("@google/generative-ai");
const { RateLimiterMemory } = require("rate-limiter-flexible");

// Configura os limitadores de requisição
const rateLimiterMinute = new RateLimiterMemory({ points: 30, duration: 60 });
const rateLimiterDay = new RateLimiterMemory({ points: 1500, duration: 86400 });

// Configura o client Gemini com a API Key
const apiKey = process.env.GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(apiKey);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-lite" });

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
  const ip = req.headers['x-real-ip'] || req.headers['x-forwarded-for'] || req.connection.remoteAddress;
  try {
    await rateLimiterMinute.consume(ip);
    await rateLimiterDay.consume(ip);
  } catch (rlRes) {
    return res.status(429).json({ error: "Too Many Requests" });
  }
  
  const { enunciado, alternativa_a, alternativa_b, alternativa_c, alternativa_d, resposta, explicacao } = req.body;
  
  // Nova engenharia de prompt:
  // Em vez de usar uma função local para determinar se o texto está incompleto,
  // enviaremos todos os campos (quando disponíveis) ao Gemini, que julgará se o campo
  // está truncado ou precisa de complementação.
  let prompt = 
`Você é um editor de textos e especialista em questões de múltipla escolha. Analise os seguintes campos da questão e verifique se o texto está incompleto ou foi cortado abruptamente. Para cada campo, se o texto parecer completo, retorne-o inalterado; se parecer truncado ou incompleto, complete apenas o final do texto, mantendo o mesmo estilo, contexto e coerência. Responda utilizando o seguinte formato, em que cada linha representa um campo:
Campo: texto completo

Dados da questão:
Enunciado: ${enunciado}
Alternativa A: ${alternativa_a}
Alternativa B: ${alternativa_b}
${alternativa_c ? `Alternativa C: ${alternativa_c}` : ""}
${alternativa_d ? `Alternativa D: ${alternativa_d}` : ""}
Resposta correta: ${resposta}
Explicação: ${explicacao}

Atenção: Complete somente os campos que estiverem truncados ou incompletos, deixando os que estiverem completos inalterados.`;
  
  try {
    // Inicia uma sessão de chat com o Gemini e envia o prompt
    const chatSession = model.startChat({
      generationConfig,
      history: [],
    });
    const result = await chatSession.sendMessage(prompt);
    const completedText = result.response.text();

    // Supomos que o retorno seja um texto com cada campo em uma linha, no formato:
    // "Enunciado: texto completo\nAlternativa A: texto completo\n..."
    // Realizamos um parsing simples para extrair os campos:
    const lines = completedText.split("\n");
    const resultObj = {};
    lines.forEach(line => {
      const [key, ...rest] = line.split(":");
      if (key && rest.length > 0) {
        resultObj[key.trim().toLowerCase()] = rest.join(":").trim();
      }
    });

    // Mapeia os campos para os nomes usados na questão
    const responseObj = {};
    if (resultObj["enunciado"]) responseObj.enunciado = resultObj["enunciado"];
    if (resultObj["alternativa a"]) responseObj.alternativa_a = resultObj["alternativa a"];
    if (resultObj["alternativa b"]) responseObj.alternativa_b = resultObj["alternativa b"];
    if (resultObj["alternativa c"]) responseObj.alternativa_c = resultObj["alternativa c"];
    if (resultObj["alternativa d"]) responseObj.alternativa_d = resultObj["alternativa d"];

    return res.status(200).json(responseObj);
  } catch (error) {
    console.error("Erro ao completar a questão:", error);
    return res.status(500).json({ error: "Erro ao completar a questão." });
  }
}