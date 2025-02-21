// frontend/src/pages/SessionStats.tsx
import { useLocation, useNavigate } from 'react-router-dom';

const SessionStats = () => {
  const { state } = useLocation();
  const navigate = useNavigate();

  // Espera receber os dados da sessão via state (caso contrário, usa valores padrão)
  const sessionStats = state || { totalQuestions: 0, correct: 0, incorrect: 0, totalTime: 0 };
  const { totalQuestions, correct, incorrect, totalTime } = sessionStats;
  const percentualAcertos = totalQuestions > 0 ? ((correct / totalQuestions) * 100).toFixed(2) : '0';
  const tempoMedioResposta = totalQuestions > 0 ? (totalTime / totalQuestions).toFixed(2) : '0';

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Estatísticas da Sessão</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
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
      <div className="mt-8">
        <button 
          onClick={() => navigate('/dashboard')}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Voltar ao Dashboard
        </button>
      </div>
    </div>
  );
};

export default SessionStats;
