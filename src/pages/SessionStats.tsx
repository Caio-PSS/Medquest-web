import { useLocation, useNavigate } from 'react-router-dom';
import { useState } from 'react';

const SessionStats = () => {
  const { state } = useLocation();
  const navigate = useNavigate();

  // Dados da sessão enviados via state (incluindo arrays de questões erradas e corretas)
  const sessionStats = state || { 
    totalQuestions: 0, 
    correct: 0, 
    incorrect: 0, 
    totalTime: 0,
    wrongQuestions: [], // Ex: ["Questão 3: Conteúdo...", "Questão 7: Conteúdo..."]
    correctQuestions: [] // Ex: ["Questão 1: Conteúdo...", "Questão 2: Conteúdo..."]
  };
  
  const { totalQuestions, correct, incorrect, totalTime, wrongQuestions, correctQuestions } = sessionStats;
  const percentualAcertos = totalQuestions > 0 ? ((correct / totalQuestions) * 100).toFixed(2) : '0';
  const tempoMedioResposta = totalQuestions > 0 ? (totalTime / totalQuestions).toFixed(2) : '0';

  const [commentary, setCommentary] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  const generateCommentary = async () => {
    setIsGenerating(true);
    try {
      const response = await fetch('/api/commentary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionStats: { totalQuestions, correct, incorrect, totalTime },
          wrongQuestions, // array de strings com os detalhes das questões erradas
          correctQuestions, // array de strings com os detalhes das questões corretas
        }),
      });
      const data = await response.json();
      if (response.ok) {
        setCommentary(data.commentary);
      } else {
        setCommentary(data.error || "Erro ao gerar comentário.");
      }
    } catch (err) {
      console.error(err);
      setCommentary("Ocorreu um erro ao gerar o comentário. Tente novamente mais tarde.");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Estatísticas da Sessão</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Cartões com dados da sessão */}
        <div className="p-6 bg-white rounded-lg shadow hover:shadow-lg transition-shadow">
          <div className="flex items-center gap-2">
            <span className="text-2xl">📚</span>
            <div>
              <p className="text-sm text-gray-600">Total de Questões Respondidas</p>
              <p className="text-xl font-semibold">{totalQuestions}</p>
            </div>
          </div>
        </div>
        <div className="p-6 bg-white rounded-lg shadow hover:shadow-lg transition-shadow">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🎯</span>
            <div>
              <p className="text-sm text-gray-600">Total de Acertos</p>
              <p className="text-xl font-semibold">{correct}</p>
            </div>
          </div>
        </div>
        <div className="p-6 bg-white rounded-lg shadow hover:shadow-lg transition-shadow">
          <div className="flex items-center gap-2">
            <span className="text-2xl">❌</span>
            <div>
              <p className="text-sm text-gray-600">Total de Erros</p>
              <p className="text-xl font-semibold">{incorrect}</p>
            </div>
          </div>
        </div>
        <div className="p-6 bg-white rounded-lg shadow hover:shadow-lg transition-shadow">
          <div className="flex items-center gap-2">
            <span className="text-2xl">📈</span>
            <div>
              <p className="text-sm text-gray-600">Percentual de Acertos</p>
              <p className="text-xl font-semibold">{percentualAcertos}%</p>
            </div>
          </div>
        </div>
        <div className="p-6 bg-white rounded-lg shadow hover:shadow-lg transition-shadow">
          <div className="flex items-center gap-2">
            <span className="text-2xl">⏱️</span>
            <div>
              <p className="text-sm text-gray-600">Tempo Médio de Resposta</p>
              <p className="text-xl font-semibold">{tempoMedioResposta}s</p>
            </div>
          </div>
        </div>
      </div>
      
      <div className="mt-8 flex flex-col gap-4">
        <button 
          onClick={() => navigate('/dashboard')}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Voltar ao Dashboard
        </button>
        <button 
          onClick={generateCommentary}
          disabled={isGenerating}
          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
        >
          {isGenerating ? 'Gerando Comentário...' : 'Gerar Comentário'}
        </button>
      </div>

      {commentary && (
        <div className="mt-8 p-6 bg-gray-100 rounded-lg shadow-md">
          <h2 className="text-2xl font-semibold mb-4">Comentário do Coach</h2>
          <p className="text-gray-700 whitespace-pre-line">{commentary}</p>
        </div>
      )}
    </div>
  );
};

export default SessionStats;
