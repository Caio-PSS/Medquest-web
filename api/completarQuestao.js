const { GoogleGenerativeAI } = require("@google/generative-ai");
const { RateLimiterMemory } = require("rate-limiter-flexible");

// Configura os limitadores
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
  
  // Função para identificar se o texto está incompleto (ex.: termina com "..." ou com menos de 50 caracteres)
  const isIncomplete = (text) => {
    if (!text) return false;
    const trimmed = text.trim();
    return trimmed.endsWith("...") || trimmed.length < 50;
  };

  let prompt = "Complete os seguintes campos da questão se estiverem incompletos:\n";
  if (isIncomplete(enunciado)) prompt += `Enunciado: ${enunciado}\n`;
  if (isIncomplete(alternativa_a)) prompt += `Alternativa A: ${alternativa_a}\n`;
  if (isIncomplete(alternativa_b)) prompt += `Alternativa B: ${alternativa_b}\n`;
  if (alternativa_c && isIncomplete(alternativa_c)) prompt += `Alternativa C: ${alternativa_c}\n`;
  if (alternativa_d && isIncomplete(alternativa_d)) prompt += `Alternativa D: ${alternativa_d}\n`;
  prompt += `Resposta correta: ${resposta}\n`;
  prompt += `Explicação: ${explicacao}\n`;
  prompt += "Complete apenas o final dos textos que parecem estar cortados.";

  try {
    // Inicia uma sessão de chat com o Gemini e envia o prompt
    const chatSession = model.startChat({
      generationConfig,
      history: [],
    });
    const result = await chatSession.sendMessage(prompt);
    const completedText = result.response.text();

    // Supomos que o retorno seja um texto formatado linha a linha, por exemplo:
    // "Enunciado: texto completo\nAlternativa A: texto completo\n..."
    // A seguir, fazemos um parsing simples para extrair os campos.
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