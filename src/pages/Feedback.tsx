import { useLocation, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import ReactMarkdown from 'react-markdown';


const Feedback = () => {
  const { state } = useLocation();
  const navigate = useNavigate();
  const { authUser } = useAuth();

  const sessionStats = state || { 
    totalQuestions: 0, 
    correct: 0, 
    incorrect: 0, 
    totalTime: 0,
    wrongComments: [],
    correctComments: []
  };

  const { totalQuestions, correct, incorrect, totalTime, wrongComments, correctComments } = sessionStats;
  const percentualAcertos = totalQuestions > 0 ? ((correct / totalQuestions) * 100).toFixed(2) : '0';
  const tempoMedioResposta = totalQuestions > 0 ? (totalTime / totalQuestions).toFixed(2) : '0';

  const [commentary, setCommentary] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    generateCommentary();
  }, []);

    const generateCommentary = async () => {
    setIsGenerating(true);
    try {
      const response = await fetch('/api/generateCommentary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionStats, user_id: authUser?.id }),
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
    <div className="p-6 max-w-7xl mx-auto min-h-screen">
      <h1 className="text-3xl font-bold mb-8 text-gray-800">Análise Detalhada da Sessão</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-12">
        <div className="bg-indigo-50 p-4 rounded-xl shadow-sm">
          <div className="text-indigo-600 font-semibold">Total Questões</div>
          <div className="text-3xl font-bold text-gray-800">{totalQuestions}</div>
        </div>
        <div className="bg-green-50 p-4 rounded-xl shadow-sm">
          <div className="text-green-600 font-semibold">Acertos</div>
          <div className="text-3xl font-bold text-gray-800">{correct}</div>
        </div>
        <div className="bg-red-50 p-4 rounded-xl shadow-sm">
          <div className="text-red-600 font-semibold">Erros</div>
          <div className="text-3xl font-bold text-gray-800">{incorrect}</div>
        </div>
        <div className="bg-purple-50 p-4 rounded-xl shadow-sm">
          <div className="text-purple-600 font-semibold">% Acertos</div>
          <div className="text-3xl font-bold text-gray-800">{percentualAcertos}%</div>
        </div>
        <div className="bg-amber-50 p-4 rounded-xl shadow-sm">
          <div className="text-amber-600 font-semibold">Tempo Médio</div>
          <div className="text-3xl font-bold text-gray-800">{tempoMedioResposta}s</div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm p-6 mb-8">
        <h2 className="text-2xl font-bold text-gray-800 mb-6">Análise do Desempenho</h2>
        
        {isGenerating ? (
          <div className="flex items-center justify-center p-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          commentary && (
            <div className="space-y-4 prose max-w-none">
              <ReactMarkdown>{commentary}</ReactMarkdown>
            </div>
          )
        )}
      </div>

      <div className="flex justify-end mt-8">
        <button 
          onClick={() => navigate('/')}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold shadow-md"
        >
          Voltar ao Dashboard
        </button>
      </div>
    </div>
  );
};

export default Feedback;