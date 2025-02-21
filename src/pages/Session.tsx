import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import Question from '../components/Question';
import { useNavigate } from 'react-router-dom';
import { Bars } from 'react-loader-spinner';
import { CheckCircle, Circle } from 'lucide-react';

type QuestionType = {
  id: number;
  enunciado: string;
  alternativa_a: string;
  alternativa_b: string;
  alternativa_c?: string;
  alternativa_d?: string;
  categoria: string;
  subtema: string;
  image_url?: string;
  resposta: string;
};

type Category = {
  name: string;
  subtopics: string[];
};

type Selection = {
  categoria: string;
  subtema: string;
};

const Session = () => {
  const { authToken, authUser } = useAuth();
  const navigate = useNavigate();
  
  const [categories, setCategories] = useState<Category[]>([]);
  const [questions, setQuestions] = useState<QuestionType[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  // Timer da questão: reinicia a cada nova questão
  const [questionStartTime, setQuestionStartTime] = useState(Date.now());
  // Timer da sessão inteira: iniciado ao carregar as questões
  const [sessionStartTime, setSessionStartTime] = useState(Date.now());
  // Estado "tick" para forçar atualização a cada segundo
  const [tick, setTick] = useState(0);
  
  const [numQuestions, setNumQuestions] = useState(5);
  const [includeRepeats, setIncludeRepeats] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selections, setSelections] = useState<Selection[]>([]);
  
  // Estado para armazenar estatísticas da sessão
  const [SessionStats, setSessionStats] = useState({
    totalQuestions: 0,
    correct: 0,
    incorrect: 0,
    totalTime: 0,
  });

  // Atualiza o tick a cada 1 segundo para atualizar os timers na tela
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  // Buscar categorias e subtemas
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const res = await fetch(
          `https://medquest-floral-log-224.fly.dev/api/questions/categories-subtopics`,
          {
            headers: { 
              Authorization: `Bearer ${authToken}`
            }
          }
        );
        
        if (!res.ok) {
          console.error('Erro na resposta:', res.status);
          return;
        }
        
        const data = await res.json();
        const formatted = Object.entries(data).map(([name, subtopics]) => ({
          name,
          subtopics: subtopics as string[]
        }));
        
        setCategories(formatted);
      } catch (err) {
        console.error('Erro ao buscar categorias:', err);
      }
    };
    
    if (authToken) fetchCategories();
  }, [authToken]);

  useEffect(() => {
    if (questions.length > 0 && currentQuestion >= questions.length) {
      navigate('/feedback', { state: SessionStats })
    }
  }, [currentQuestion, questions.length, navigate, SessionStats]);

  const handleSubtopicSelect = (category: string, subtopic: string) => {
    setSelections(prev => {
      const exists = prev.some(s => s.categoria === category && s.subtema === subtopic);
      return exists 
        ? prev.filter(s => !(s.categoria === category && s.subtema === subtopic))
        : [...prev, { categoria: category, subtema: subtopic }];
    });
  };

  const handleSelectAllSubtopics = (category: string, subtopics: string[]) => {
    setSelections(prev => {
      const otherCategories = prev.filter(s => s.categoria !== category);
      const allSelected = subtopics.every(sub => 
        prev.some(s => s.categoria === category && s.subtema === sub)
      );
      
      return allSelected 
        ? otherCategories
        : [...otherCategories, ...subtopics.map(sub => ({
            categoria: category,
            subtema: sub
          }))];
    });
  };

  const loadQuestions = async () => {
    if (selections.length === 0) {
      alert('Selecione pelo menos um subtema!');
      return;
    }

    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        selections: JSON.stringify(selections),
        numQuestions: numQuestions.toString(),
        includeRepeats: includeRepeats.toString(),
        userId: authUser?.id?.toString() || ''
      });

      const res = await fetch(
        `https://medquest-floral-log-224.fly.dev/api/questions?${params}`,
        { headers: { Authorization: `Bearer ${authToken}` } }
      );

      if (!res.ok) throw new Error('Erro ao buscar questões');
      
      const data = await res.json();
      setQuestions(data);
      
      // Reinicia ambos os timers e as estatísticas da sessão ao iniciar
      setQuestionStartTime(Date.now());
      setSessionStartTime(Date.now());
      setCurrentQuestion(0);
      setSessionStats({
        totalQuestions: data.length,
        correct: 0,
        incorrect: 0,
        totalTime: 0,
      });
    } catch (err) {
      console.error(err);
      alert('Erro ao carregar questões');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAnswer = async (answer: string, isCorrect: boolean) => {
    const timeTaken = (Date.now() - questionStartTime) / 1000;
    const currentQ = questions[currentQuestion];
    
    try {
      await fetch(`https://medquest-floral-log-224.fly.dev/api/respostas`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`
        },
        body: JSON.stringify({
          id_questao: currentQ.id,
          resposta_usuario: answer,
          resposta_correta: currentQ.resposta,
          resultado: isCorrect ? 'Correta' : 'Incorreta',
          tempo_resposta: timeTaken,
          user_id: authUser?.id
        })
      });
  
      // Atualiza as estatísticas da sessão
      setSessionStats(prev => ({
        ...prev,
        correct: prev.correct + (isCorrect ? 1 : 0),
        incorrect: prev.incorrect + (isCorrect ? 0 : 1),
        totalTime: prev.totalTime + timeTaken,
      }));
  
    } catch (err) {
      console.error('Erro ao salvar resposta:', err);
      alert('Erro ao salvar resposta');
    }
  };

  // Ao avançar para a próxima questão, reinicia o timer da questão
    const handleNextQuestion = () => {
      setCurrentQuestion(prev => prev + 1);
      setQuestionStartTime(Date.now());
    };

  // Cálculo dos tempos (em segundos)
  const questionElapsed = Math.floor((Date.now() - questionStartTime) / 1000);
  const sessionElapsed = Math.floor((Date.now() - sessionStartTime) / 1000);

  return (
    <div className="p-4 min-h-screen bg-gray-950">
      {questions.length === 0 ? (
        <div className="max-w-6xl mx-auto bg-gray-900 rounded-2xl shadow-xl p-8 mb-8 border border-gray-800">
          <h1 className="text-3xl font-bold mb-8 text-gray-800">
            Configurar Nova Sessão
          </h1>

          <div className="grid md:grid-cols-2 gap-8 mb-8">
            <div className="bg-gray-50 p-6 rounded-xl">
              <label className="block mb-3 font-semibold text-gray-700">
                Número de Questões
              </label>
              <input
                type="number"
                min="1"
                value={numQuestions}
                onChange={(e) => setNumQuestions(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              />
            </div>

            <div className="bg-gray-50 p-6 rounded-xl flex items-center gap-4">
              <input
                type="checkbox"
                id="includeRepeats"
                checked={includeRepeats}
                onChange={(e) => setIncludeRepeats(e.target.checked)}
                className="w-6 h-6 rounded border-gray-300 text-blue-600 focus:ring-blue-500 transition-all"
              />
              <label htmlFor="includeRepeats" className="font-semibold text-gray-700">
                Incluir questões já respondidas
              </label>
            </div>
          </div>

          <div className="mb-8">
            <h2 className="text-2xl font-bold mb-6 text-gray-800">
              Selecione Categorias e Subtópicos
            </h2>
            <div className="space-y-8">
              {categories.map((category) => {
                const allSelected = category.subtopics.every(sub =>
                  selections.some(s => s.categoria === category.name && s.subtema === sub)
                );

                return (
                  <div key={category.name} className="bg-gray-50 rounded-xl p-6">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="font-bold text-xl text-gray-800">
                        {category.name}
                      </h3>
                      <button
                        onClick={() => handleSelectAllSubtopics(category.name, category.subtopics)}
                        className="flex items-center gap-2 text-blue-600 hover:text-blue-700 transition-colors"
                      >
                        {allSelected ? (
                          <CheckCircle className="w-5 h-5" />
                        ) : (
                          <Circle className="w-5 h-5" />
                        )}
                        <span className="font-medium">Selecionar Todos</span>
                      </button>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                      {category.subtopics.map((subtopic) => {
                        const isSelected = selections.some(
                          s => s.categoria === category.name && s.subtema === subtopic
                        );

                        return (
                          <button
                            key={`${category.name}-${subtopic}`}
                            onClick={() => handleSubtopicSelect(category.name, subtopic)}
                            className={`
                              group relative p-4 rounded-lg text-sm transition-all duration-200
                              ${isSelected 
                                ? 'bg-blue-600 text-white shadow-lg hover:bg-blue-700' 
                                : 'bg-white hover:bg-gray-100 border border-gray-200 hover:border-blue-300'
                              }
                            `}
                          >
                            <span className="font-medium">{subtopic}</span>
                            {isSelected && (
                              <CheckCircle className="absolute right-2 top-2 w-4 h-4" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <button
            onClick={loadQuestions}
            disabled={isLoading}
            className="w-full bg-blue-600 text-white py-4 rounded-xl hover:bg-blue-700 
                      disabled:opacity-50 transition-all duration-200 text-lg font-medium
                      shadow-lg hover:shadow-xl flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <Bars height="24" width="24" color="#ffffff" />
                <span>Carregando...</span>
              </>
            ) : (
              'Iniciar Sessão'
            )}
          </button>
        </div>
      ) : (
        <div className="max-w-6xl mx-auto">
          {/* Cabeçalho com os timers (questão e sessão) */}
          <div className="bg-gray-900 rounded-2xl shadow-xl p-6 mb-6 border border-gray-800">
            <div className="flex justify-between items-center">
              <span className="text-white font-medium">
                Questão {currentQuestion + 1} de {questions.length}
              </span>
              <div className="flex gap-4">
                <div className="flex items-center bg-blue-600 text-white px-3 py-2 rounded-lg shadow-md">
                  <span className="font-semibold">Tempo Questão:</span>
                  <span className="ml-2">{questionElapsed}s</span>
                </div>
                <div className="flex items-center bg-green-600 text-white px-3 py-2 rounded-lg shadow-md">
                  <span className="font-semibold">Tempo Sessão:</span>
                  <span className="ml-2">{sessionElapsed}s</span>
                </div>
              </div>
            </div>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-8">
              <Bars
                height="50"
                width="50"
                color="#3b82f6"
                ariaLabel="loading"
              />
            </div>
          ) : (
            <Question 
              key={currentQuestion}
              data={questions[currentQuestion]} 
              onConfirm={handleAnswer}
              onNext={handleNextQuestion}
            />
          )}
        </div>
      )}
    </div>
  );
};

export default Session;