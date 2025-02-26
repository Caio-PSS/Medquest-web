const { GoogleGenerativeAI } = require("@google/generative-ai");
const { RateLimiterMemory } = require("rate-limiter-flexible");

// Cria os limitadores de requisição
const rateLimiterMinute = new RateLimiterMemory({ points: 30, duration: 60 }); // 30 req por 60 segundos
const rateLimiterDay = new RateLimiterMemory({ points: 1500, duration: 86400 }); // 1500 req por dia (86400 segundos)

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
  // Obtém o IP do cliente (ajuste conforme necessário)
  const ip = req.headers['x-real-ip'] || req.headers['x-forwarded-for'] || req.connection.remoteAddress;
  try {
    await rateLimiterMinute.consume(ip);
    await rateLimiterDay.consume(ip);
  } catch (rlRes) {
    return res.status(429).json({ error: "Too Many Requests" });
  }
  
  const { user_id, start_date, end_date } = req.body;
  if (!user_id || !start_date || !end_date) {
    return res.status(400).json({ error: "Parâmetros ausentes" });
  }

  try {
    // 1. Buscar os feedbacks via API de feedback (ajuste a URL conforme sua configuração)
    const feedbackApiUrl = process.env.FEEDBACK_API_URL || "https://medquest-floral-log-224.fly.dev/api/feedbacks";
    const feedbackResponse = await fetch(
      `${feedbackApiUrl}?user_id=${user_id}&start_date=${start_date}&end_date=${end_date}`
    );

    if (!feedbackResponse.ok) {
        console.error("Feedback API retornou status:", feedbackResponse.status);
        const errorBody = await feedbackResponse.text();
        console.error("Corpo da resposta:", errorBody);
        throw new Error("Erro ao buscar feedbacks");
      }
      
    const feedbackData = await feedbackResponse.json();
    // Supõe que a resposta esteja no formato: { feedbacks: [ { feedback_text: "..." }, ... ] }
    const feedbackTexts = feedbackData.feedbacks
      .map((f) => f.feedback_text)
      .join("\n");

    // 2. Compor o prompt para o Gemini com os feedbacks obtidos
    const prompt = `Você é um consultor educacional especialista em criar planos de estudos personalizados. Baseado nos feedbacks de desempenho detalhados abaixo – que contêm informações sobre erros, acertos, pontos fortes, estatísticas e oportunidades de melhoria – crie um plano de estudos completo e organizado. O plano deve:

1. Incluir uma introdução motivacional que reconheça os pontos positivos do estudante e incentive a melhoria nas áreas críticas.
2. Estar estruturado em seções com títulos claros, como:
   - **Áreas de Melhoria:** Identificando os principais desafios.
   - **Pontos Fortes:** Destacando acertos e habilidades.
   - **Estratégias de Estudo:** Métodos e técnicas para abordar as áreas críticas.
   - **Recursos Recomendados:** Sugestões de vídeos, artigos, exercícios e outras ferramentas.
   - **Plano de Ação:** Um cronograma ou passos práticos para acompanhamento do progresso.
3. Fornecer orientações práticas, detalhadas e personalizadas que ajudem o estudante a organizar seus estudos e melhorar seu desempenho.
4. Integrar de forma coerente as informações variadas presentes nos feedbacks – não apenas os erros, mas também estatísticas e pontos positivos.

Feedbacks de desempenho:
${feedbackTexts}

Crie o plano de estudos seguindo as diretrizes acima.`;

    // 3. Iniciar uma sessão de chat e enviar o prompt para o Gemini
    const chatSession = model.startChat({
      generationConfig,
      history: [],
    });
    const result = await chatSession.sendMessage(prompt);
    const studyPlan = result.response.text();

    res.status(200).json({ studyPlan });
  } catch (error) {
    console.error("Erro ao gerar plano de estudos:", error);
    res.status(500).json({ error: "Erro ao gerar plano de estudos", details: error.message });
  }
}