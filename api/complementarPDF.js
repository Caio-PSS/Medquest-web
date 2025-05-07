import { GoogleGenerativeAI } from "@google/generative-ai";

// Inicializar a API do Gemini com sua chave
const genAI = new GoogleGenerativeAI(process.env.REACT_APP_GEMINI_API_KEY);

/**
 * Identifica quais questões precisam de complementação em uma única requisição
 * @param {Array} questions - Array de todas as questões
 * @returns {Promise<Array>} - Array com os IDs das questões que precisam de complementação
 */
async function identificarQuestoesIncompletas(questions) {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });
    
    // Preparar resumo das questões para análise
    const resumos = questions.map(q => ({
      id: q.id,
      indice: questions.indexOf(q),  // Manter o índice original
      resumo: `ID: ${q.id} - "${q.enunciado.substring(0, 150)}..." | Alternativa A: "${q.alternativa_a.substring(0, 50)}..." | Menciona imagem: ${q.enunciado.toLowerCase().includes('imagem') || q.enunciado.toLowerCase().includes('figura') ? 'SIM' : 'NÃO'} | Tem imagem: ${q.image_url ? 'SIM' : 'NÃO'}`
    }));
    
    // Construir o prompt para identificação rápida
    const prompt = `
Analise este conjunto de questões médicas e identifique APENAS os IDs daquelas que parecem incompletas ou com problemas:

${resumos.map(r => r.resumo).join('\n\n')}

Identifique questões com estes problemas:
1. Enunciados incompletos (frases cortadas, contexto faltando)
2. Alternativas incompletas (frases sem sentido)
3. Questões que mencionam figura/imagem mas não têm imagem

Responda APENAS com um JSON contendo um array de IDs e índices das questões problemáticas:
{
  "questoesIncompletas": [
    {"id": 123, "indice": 0, "motivo": "breve descrição do problema"},
    {"id": 456, "indice": 2, "motivo": "breve descrição do problema"}
  ]
}`;

    // Obter resposta do Gemini
    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text();
    
    // Extrair o JSON da resposta
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error(`Erro ao analisar questões: formato de resposta inválido`);
      return [];
    }
    
    const analise = JSON.parse(jsonMatch[0]);
    return analise.questoesIncompletas || [];
    
  } catch (error) {
    console.error("Erro ao identificar questões incompletas:", error);
    return [];
  }
}

/**
 * Analisa uma questão específica para identificar problemas e corrigi-los
 * @param {Object} question - Questão a ser analisada em detalhe
 * @returns {Promise<Object>} - Questão complementada, se necessário
 */
export async function analisarQuestao(question) {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });
    
    // Construir o prompt para o Gemini - igual ao original
    const prompt = `
Analise esta questão médica e identifique APENAS se há elementos incompletos ou ausentes:

ID: ${question.id}
Categoria: ${question.categoria}
Subtema: ${question.subtema}
Enunciado: "${question.enunciado}"
Alternativa A: "${question.alternativa_a}"
Alternativa B: "${question.alternativa_b}"
Alternativa C: "${question.alternativa_c || 'Não fornecida'}"
Alternativa D: "${question.alternativa_d || 'Não fornecida'}"
Resposta correta: ${question.resposta}
Explicação: "${question.explicacao || 'Não fornecida'}"
Imagem: ${question.image_url ? "Presente" : "Ausente"}

Verifique SOMENTE estes problemas:
1. Enunciado incompleto (frases cortadas, referências ausentes, contexto faltando)
2. Alternativas incompletas (frases cortadas, opções sem sentido)
3. Se o texto menciona figura, imagem, radiografia, etc. mas não há image_url

NÃO MELHORE o conteúdo que já está completo. Apenas complete o que está claramente incompleto.

Responda em formato JSON:
{
  "precisaComplemento": true/false,
  "enunciadoCorrigido": "apenas se o enunciado estiver incompleto, caso contrário mantenha o original",
  "alternativasCorrigidas": {
    "A": "apenas se a alternativa A estiver incompleta",
    "B": "apenas se a alternativa B estiver incompleta",
    "C": "apenas se a alternativa C estiver incompleta",
    "D": "apenas se a alternativa D estiver incompleta"
  },
  "precisaImagem": true/false,
  "descricaoImagem": "se a questão menciona uma imagem que não existe, descreva como seria esta imagem",
  "comentario": "breve explicação das correções feitas ou 'Nenhuma correção necessária' se a questão estiver completa"
}`;

    // Resto igual ao original
    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text();
    
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error(`Erro ao analisar questão ${question.id}: formato de resposta inválido`);
      return question;
    }
    
    const analise = JSON.parse(jsonMatch[0]);
    
    if (!analise.precisaComplemento && !analise.precisaImagem) {
      return question;
    }
    
    const questaoCorrigida = { ...question };
    
    if (analise.enunciadoCorrigido && analise.enunciadoCorrigido !== question.enunciado) {
      questaoCorrigida.enunciado = analise.enunciadoCorrigido;
    }
    
    if (analise.alternativasCorrigidas) {
      if (analise.alternativasCorrigidas.A && 
          analise.alternativasCorrigidas.A !== question.alternativa_a &&
          analise.alternativasCorrigidas.A !== "Não fornecida") {
        questaoCorrigida.alternativa_a = analise.alternativasCorrigidas.A;
      }
      
      if (analise.alternativasCorrigidas.B && 
          analise.alternativasCorrigidas.B !== question.alternativa_b &&
          analise.alternativasCorrigidas.B !== "Não fornecida") {
        questaoCorrigida.alternativa_b = analise.alternativasCorrigidas.B;
      }
      
      if (analise.alternativasCorrigidas.C && 
          analise.alternativasCorrigidas.C !== question.alternativa_c &&
          analise.alternativasCorrigidas.C !== "Não fornecida") {
        questaoCorrigida.alternativa_c = analise.alternativasCorrigidas.C;
      }
      
      if (analise.alternativasCorrigidas.D && 
          analise.alternativasCorrigidas.D !== question.alternativa_d &&
          analise.alternativasCorrigidas.D !== "Não fornecida") {
        questaoCorrigida.alternativa_d = analise.alternativasCorrigidas.D;
      }
    }
    
    if (analise.precisaImagem && analise.descricaoImagem && !question.image_url) {
      questaoCorrigida.enunciado = `${questaoCorrigida.enunciado}\n\n[NOTA: Esta questão faz referência a uma imagem que mostraria: ${analise.descricaoImagem}]`;
    }
    
    console.log(`Questão ${question.id} complementada: ${analise.comentario}`);
    return questaoCorrigida;
    
  } catch (error) {
    console.error(`Erro ao analisar questão ${question.id}:`, error);
    return question;
  }
}

/**
 * Nova versão otimizada: Analisa e complementa questões em lote com uma única requisição inicial
 * @param {Array} questions - Array de questões para análise
 * @param {Function} atualizarProgresso - Função opcional para atualizar o progresso
 * @returns {Promise<Array>} - Questões complementadas
 */
export async function complementarQuestoes(questions, atualizarProgresso = null) {
  // Criar cópia do array original
  const questoesResultantes = [...questions];
  const total = questions.length;
  
  console.log(`Iniciando análise preliminar de ${total} questões...`);
  
  // ETAPA 1: Identificar em uma única requisição quais questões parecem problemáticas
  if (atualizarProgresso) atualizarProgresso(5); // Indicar início
  
  const questoesIncompletas = await identificarQuestoesIncompletas(questions);
  
  if (atualizarProgresso) atualizarProgresso(10); // Identificação inicial concluída
  
  console.log(`Análise preliminar: ${questoesIncompletas.length} questões podem precisar de complementação`);
  
  if (questoesIncompletas.length === 0) {
    console.log("Nenhuma questão parece precisar de complementação.");
    if (atualizarProgresso) atualizarProgresso(100);
    return questoesResultantes;
  }
  
  // ETAPA 2: Analisar detalhadamente apenas as questões identificadas como problemáticas
  const totalIncompletas = questoesIncompletas.length;
  let questoesProcessadas = 0;
  
  for (const item of questoesIncompletas) {
    console.log(`Analisando em detalhe: questão ${item.id} - ${item.motivo}`);
    
    // Pegar a questão pelo índice no array original
    const questao = questions[item.indice];
    if (!questao) {
      console.error(`Questão com índice ${item.indice} não encontrada`);
      continue;
    }
    
    // Analisar e complementar a questão
    const questaoComplementada = await analisarQuestao(questao);
    
    // Atualizar no array final
    questoesResultantes[item.indice] = questaoComplementada;
    
    // Atualizar progresso
    questoesProcessadas++;
    if (atualizarProgresso) {
      // Calcular progresso: 10% inicial + até 90% restante
      const percentual = Math.round(10 + (questoesProcessadas / totalIncompletas) * 90);
      atualizarProgresso(percentual);
    }
    
    // Pequena pausa para evitar limitações de taxa na API
    if (questoesProcessadas < totalIncompletas) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  
  console.log(`Análise concluída. ${questoesProcessadas} questões foram complementadas.`);
  return questoesResultantes;
}