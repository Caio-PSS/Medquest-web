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
  explicacao?: string;
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
  const [questionStartTime, setQuestionStartTime] = useState(Date.now());
  const [sessionStartTime, setSessionStartTime] = useState(Date.now());
  const [tick, setTick] = useState(0);

  const [numQuestions, setNumQuestions] = useState(5);
  const [includeRepeats, setIncludeRepeats] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selections, setSelections] = useState<Selection[]>([]);

  const [currentAudio, setCurrentAudio] = useState<HTMLAudioElement | null>(null);
  const [currentAudioData, setCurrentAudioData] = useState<string | null>(null);
  const [isReading, setIsReading] = useState(false);
  
  const [sessionStats, setSessionStats] = useState({
    totalQuestions: 0,
    correct: 0,
    incorrect: 0,
    totalTime: 0,
    wrongComments: [] as string[],
    correctComments: [] as string[],
  });

  // Estado para controle de leitura automática (desativado por padrão)
  const [autoReadEnabled, setAutoReadEnabled] = useState(false);

  // Atualiza o tick a cada 1 segundo
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

  // Navega para feedback quando as questões terminam
  useEffect(() => {
    if (questions.length > 0 && currentQuestion >= questions.length) {
      navigate('/feedback', { state: sessionStats });
    }
  }, [currentQuestion, questions.length, navigate, sessionStats]);

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
      
      // Reinicia timers e estatísticas
      setQuestionStartTime(Date.now());
      setSessionStartTime(Date.now());
      setCurrentQuestion(0);
      setSessionStats({
        totalQuestions: data.length,
        correct: 0,
        incorrect: 0,
        totalTime: 0,
        wrongComments: [],
        correctComments: [],
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
  
      setSessionStats(prev => ({
        ...prev,
        correct: prev.correct + (isCorrect ? 1 : 0),
        incorrect: prev.incorrect + (isCorrect ? 0 : 1),
        totalTime: prev.totalTime + timeTaken,
        correctComments: isCorrect 
          ? [...prev.correctComments, `Questão ${currentQ.id}: ${currentQ.explicacao}`]
          : prev.correctComments,
        wrongComments: !isCorrect 
          ? [...prev.wrongComments, `Questão ${currentQ.id}: ${currentQ.explicacao}`]
          : prev.wrongComments,
      }));
  
    } catch (err) {
      console.error('Erro ao salvar resposta:', err);
      alert('Erro ao salvar resposta');
    }
  };

  const handleNextQuestion = () => {
    setCurrentQuestion(prev => prev + 1);
    setQuestionStartTime(Date.now());
  };

  const questionElapsed = Math.floor((Date.now() - questionStartTime) / 1000);
  const sessionElapsed = Math.floor((Date.now() - sessionStartTime) / 1000);

  // Função que chama a nossa API serverless para ler o texto
  async function readText(text: string) {
    try {
      // Para qualquer áudio atual
      if (currentAudio) {
        currentAudio.pause();
        setCurrentAudio(null);
      }
  
      setIsReading(true);
      const response = await fetch('/api/readText', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, language: 'pt-BR', voice: 'Ricardo' }),
      });
      
      const data = await response.json();
      if (data.audioContent) {
        const audioUrl = `data:audio/mp3;base64,${data.audioContent}`;
        const audio = new Audio(audioUrl);
        
        // Armazena dados do áudio para repetição
        setCurrentAudioData(audioUrl);
        setCurrentAudio(audio);
        
        audio.play();
        audio.onended = () => setIsReading(false);
      }
    } catch (error) {
      console.error('Erro ao ler o texto:', error);
      setIsReading(false);
    }
  }

  return (
      <div className="p-4 min-h-screen bg-gray-950">
        {questions.length === 0 ? (
          <div className="max-w-6xl mx-auto bg-gray-900 rounded-2xl shadow-xl p-8 mb-8 border border-gray-800">
            <h1 className="text-3xl font-bold mb-8 text-white">
              Configurar Nova Sessão
            </h1>
  
            <div className="grid md:grid-cols-2 gap-8 mb-8">
              <div className="bg-gray-800 p-6 rounded-xl">
                <label className="block mb-3 font-semibold text-gray-200">
                  Número de Questões
                </label>
                <input
                  type="number"
                  min="1"
                  value={numQuestions}
                  onChange={(e) => setNumQuestions(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full p-3 bg-gray-700 text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                />
              </div>
  
              <div className="bg-gray-800 p-6 rounded-xl flex items-center gap-4">
                <input
                  type="checkbox"
                  id="includeRepeats"
                  checked={includeRepeats}
                  onChange={(e) => setIncludeRepeats(e.target.checked)}
                  className="w-6 h-6 rounded bg-gray-700 border-gray-600 text-blue-500 focus:ring-blue-500 transition-all"
                />
                <label htmlFor="includeRepeats" className="font-semibold text-gray-200">
                  Incluir questões já respondidas
                </label>
              </div>
            </div>
  
            <div className="mb-8">
              <h2 className="text-2xl font-bold mb-6 text-white">
                Selecione Categorias e Subtópicos
              </h2>
              <div className="space-y-8">
                {categories.map((category) => {
                  const allSelected = category.subtopics.every(sub =>
                    selections.some(s => s.categoria === category.name && s.subtema === sub)
                  );
  
                  return (
                    <div key={category.name} className="bg-gray-800 rounded-xl p-6">
                      <div className="flex justify-between items-center mb-4">
                        <h3 className="font-bold text-xl text-white">
                          {category.name}
                        </h3>
                        <button
                          onClick={() => handleSelectAllSubtopics(category.name, category.subtopics)}
                          className="flex items-center gap-2 text-blue-400 hover:text-blue-300 transition-colors"
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
                                  ? 'bg-blue-600 text-white shadow-lg hover:bg-blue-500' 
                                  : 'bg-gray-700 hover:bg-gray-600 text-gray-200'
                                }
                              `}
                            >
                              <span className="font-medium">{subtopic}</span>
                              {isSelected && (
                                <CheckCircle className="absolute right-2 top-2 w-4 h-4 text-green-400" />
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
              className="w-full bg-blue-600 text-white py-4 rounded-xl hover:bg-blue-500 
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
            <div className="bg-gray-900 rounded-2xl shadow-xl p-6 mb-6 border border-gray-800">
              <div className="flex justify-between items-center">
                <span className="text-white font-medium">
                  Questão {currentQuestion + 1} de {questions.length}
                </span>
                <div className="flex items-center gap-4">
                  {/* Botão de Repetir (visível apenas quando habilitado) */}
                  {autoReadEnabled && currentAudioData && (
                    <button
                      onClick={() => {
                        if (currentAudioData) {
                          const audio = new Audio(currentAudioData);
                          setCurrentAudio(audio);
                          audio.play();
                        }
                      }}
                      className="p-2 rounded-full bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors"
                      title="Repetir leitura"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="w-6 h-6"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M21.5 2v6h-6M2.5 22v-6h6M19 12a7 7 0 1 1-14 0 7 7 0 0 1 14 0z"/>
                      </svg>
                    </button>
                  )}                  
                  {/* Botão de TTS Estilizado */}
                  <button
                    onClick={() => {
                      if (autoReadEnabled) {
                        currentAudio?.pause();
                        setCurrentAudio(null);
                      }
                      setAutoReadEnabled(!autoReadEnabled);
                    }}
                    className={`p-2 rounded-full transition-colors ${
                      autoReadEnabled 
                        ? 'bg-green-600 hover:bg-green-500 text-white' 
                        : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                    }`}
                    disabled={isReading}
                  >
                    <svg 
                      xmlns="http://www.w3.org/2000/svg" 
                      className="w-6 h-6" 
                      viewBox="0 0 24 24" 
                      fill="none" 
                      stroke="currentColor" 
                      strokeWidth="2" 
                      strokeLinecap="round" 
                      strokeLinejoin="round"
                    >
                      {autoReadEnabled ? (
                        <>
                          <rect x="6" y="4" width="4" height="16" />
                          <rect x="14" y="4" width="4" height="16" />
                        </>
                      ) : (
                        <>
                          <rect x="4" y="2" width="16" height="20" rx="2" ry="2" />
                          <circle cx="12" cy="14" r="4" />
                          <line x1="12" y1="6" x2="12" y2="6" />
                        </>
                      )}
                    </svg>
                    <span className="sr-only">Leitura Automática</span>
                  </button>
  
                  {/* Contadores de Tempo */}
                  <div className="flex gap-4">
                    <div className="flex items-center bg-blue-600 text-white px-3 py-2 rounded-lg shadow-md">
                      <span className="font-semibold">Questão:</span>
                      <span className="ml-2">{questionElapsed}s</span>
                    </div>
                    <div className="flex items-center bg-purple-600 text-white px-3 py-2 rounded-lg shadow-md">
                      <span className="font-semibold">Total:</span>
                      <span className="ml-2">{sessionElapsed}s</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
  
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Bars height="50" width="50" color="#3b82f6" ariaLabel="loading" />
              </div>
            ) : (
              questions[currentQuestion] && (
                <Question 
                  key={currentQuestion}
                  data={questions[currentQuestion]} 
                  onConfirm={handleAnswer}
                  onNext={handleNextQuestion}
                  autoReadEnabled={autoReadEnabled}
                  readText={readText}
                  isReading={isReading}
                  currentAudioData={currentAudioData}
                  onRepeat={() => {
                    if (currentAudioData) {
                      const audio = new Audio(currentAudioData);
                      setCurrentAudio(audio);
                      audio.play();
                    }
                  }}
                />
              )
            )}
          </div>
        )}
     </div>
    );
};

export default Session;