import { useState, useEffect, useRef } from 'react';
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
  const [currentAudioType, setCurrentAudioType] = useState<"question" | "explanation" | null>(null);
  const [questionAudioData, setQuestionAudioData] = useState<string | null>(null);
  const [explanationAudioData, setExplanationAudioData] = useState<string | null>(null);
  const [preloadedQuestionAudio, setPreloadedQuestionAudio] = useState<string | null>(null);
  const [isReading, setIsReading] = useState(false);
  const [audioLoading, setAudioLoading] = useState(false);

  const [sessionStats, setSessionStats] = useState({
    totalQuestions: 0,
    correct: 0,
    incorrect: 0,
    totalTime: 0,
    wrongComments: [] as string[],
    correctComments: [] as string[],
  });

  // "Leitura auto" desativada inicialmente
  const [autoReadEnabled, setAutoReadEnabled] = useState(false);

  // Cache para evitar múltiplas requisições para o mesmo texto
  const audioCache = useRef<{ [key: string]: string }>({});

  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const res = await fetch(
          `https://medquest-floral-log-224.fly.dev/api/questions/categories-subtopics`,
          { headers: { Authorization: `Bearer ${authToken}` } }
        );
        if (!res.ok) {
          console.error('Erro na resposta:', res.status);
          return;
        }
        const data = await res.json();
        const formatted = Object.entries(data).map(([name, subtopics]) => ({
          name,
          subtopics: subtopics as string[],
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
        : [...otherCategories, ...subtopics.map(sub => ({ categoria: category, subtema: sub }))];
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
        userId: authUser?.id?.toString() || '',
      });
      const res = await fetch(
        `https://medquest-floral-log-224.fly.dev/api/questions?${params}`,
        { headers: { Authorization: `Bearer ${authToken}` } }
      );
      if (!res.ok) throw new Error('Erro ao buscar questões');
      const data = await res.json();
      setQuestions(data);
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
      setQuestionAudioData(null);
      setExplanationAudioData(null);
      if (currentAudio) {
        currentAudio.pause();
        setCurrentAudio(null);
      }
      setIsReading(false);
      setCurrentAudioType(null);
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
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          id_questao: currentQ.id,
          resposta_usuario: answer,
          resposta_correta: currentQ.resposta,
          resultado: isCorrect ? 'Correta' : 'Incorreta',
          tempo_resposta: timeTaken,
          user_id: authUser?.id,
        }),
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

  // Função para pré-carregar o áudio da próxima questão
  const preloadNextQuestionAudio = async () => {
    if (currentQuestion + 1 < questions.length) {
      const nextQ = questions[currentQuestion + 1];
      let fullText = nextQ.enunciado;
      const alternatives = [];
      if (nextQ.alternativa_a) alternatives.push(`Alternativa A: ${nextQ.alternativa_a}`);
      if (nextQ.alternativa_b) alternatives.push(`Alternativa B: ${nextQ.alternativa_b}`);
      if (nextQ.alternativa_c) alternatives.push(`Alternativa C: ${nextQ.alternativa_c}`);
      if (nextQ.alternativa_d) alternatives.push(`Alternativa D: ${nextQ.alternativa_d}`);
      fullText += ". " + alternatives.join(". ");

      try {
        const response = await fetch('/api/readText', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: fullText, language: 'pt-BR', voice: 'pt-BR-Neural2-B' }),
        });
        const data = await response.json();
        if (data.audioContent) {
          const audioUrl = `data:audio/mp3;base64,${data.audioContent}`;
          setPreloadedQuestionAudio(audioUrl);
        }
      } catch (error) {
        console.error("Erro ao pré-carregar áudio da próxima questão:", error);
      }
    }
  };

  const handleNextQuestion = () => {
    setCurrentQuestion(prev => prev + 1);
    setQuestionStartTime(Date.now());
    if (preloadedQuestionAudio) {
      setQuestionAudioData(preloadedQuestionAudio);
      setPreloadedQuestionAudio(null);
    } else {
      setQuestionAudioData(null);
    }
    setExplanationAudioData(null);
    if (currentAudio) {
      currentAudio.pause();
      setCurrentAudio(null);
    }
    setIsReading(false);
    setCurrentAudioType(null);
  };

  // Função de leitura com cache para evitar múltiplas requisições para o mesmo texto
  async function readText(
    text: string,
    type: "question" | "explanation",
    preload?: boolean
  ) {
    try {
      const cacheKey = type + '|' + text;
      if (audioCache.current[cacheKey]) {
        if (preload) {
          if (type === "question" && !questionAudioData) {
            setQuestionAudioData(audioCache.current[cacheKey]);
          } else if (type === "explanation" && !explanationAudioData) {
            setExplanationAudioData(audioCache.current[cacheKey]);
          }
          return;
        }
        if (type === "question" && !questionAudioData) {
          setQuestionAudioData(audioCache.current[cacheKey]);
        } else if (type === "explanation" && !explanationAudioData) {
          setExplanationAudioData(audioCache.current[cacheKey]);
        }
      }
      if (!preload && currentAudio) {
        currentAudio.pause();
        setCurrentAudio(null);
        setCurrentAudioType(null);
      }
      if (!preload) {
        setIsReading(true);
        setAudioLoading(true);
      }
      let audioUrl = "";
      if (type === "question" && questionAudioData) {
        audioUrl = questionAudioData;
      } else if (type === "explanation" && explanationAudioData) {
        audioUrl = explanationAudioData;
      } else {
        const response = await fetch('/api/readText', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text, language: 'pt-BR', voice: 'pt-BR-Neural2-B' }),
        });
        const data = await response.json();
        if (data.audioContent) {
          audioUrl = `data:audio/mp3;base64,${data.audioContent}`;
          audioCache.current[cacheKey] = audioUrl;
          if (type === "question") {
            setQuestionAudioData(audioUrl);
          } else {
            setExplanationAudioData(audioUrl);
          }
        }
      }
      if (!audioUrl) {
        if (!preload) {
          setIsReading(false);
          setAudioLoading(false);
        }
        return;
      }
      if (preload) {
        return;
      }
      const audio = new Audio(audioUrl);
      setCurrentAudio(audio);
      setCurrentAudioType(type);
      audio.play();
      setAudioLoading(false);
      audio.onended = () => {
        // Não reinicia automaticamente; apenas finaliza a leitura
        setIsReading(false);
        setCurrentAudio(null);
        setCurrentAudioType(null);
      };
    } catch (error) {
      console.error('Erro ao ler o texto:', error);
      if (!preload) {
        setIsReading(false);
        setAudioLoading(false);
      }
    }
  }

  // Ao clicar manualmente, se o áudio já estiver carregado, usa-o sem nova requisição
  const toggleQuestionAudio = () => {
    if (currentAudio && currentAudioType === "question") {
      if (!currentAudio.paused) {
        currentAudio.pause();
      } else {
        currentAudio.play();
      }
    } else {
      if (questionAudioData) {
        const audio = new Audio(questionAudioData);
        setCurrentAudio(audio);
        setCurrentAudioType("question");
        audio.preservesPitch = true; // Garante que o pitch seja mantido
        audio.playbackRate = 1.5;    // Aumenta a velocidade em 50%
        audio.play();
        audio.onended = () => {
          setIsReading(false);
          setCurrentAudio(null);
          setCurrentAudioType(null);
        };
      } else {
        const q = questions[currentQuestion];
        if (!q) return;
        let fullText = q.enunciado;
        const alternatives = [];
        if (q.alternativa_a) alternatives.push(`Alternativa A: ${q.alternativa_a}`);
        if (q.alternativa_b) alternatives.push(`Alternativa B: ${q.alternativa_b}`);
        if (q.alternativa_c) alternatives.push(`Alternativa C: ${q.alternativa_c}`);
        if (q.alternativa_d) alternatives.push(`Alternativa D: ${q.alternativa_d}`);
        fullText += ". " + alternatives.join(". ");
        readText(fullText, "question");
      }
    }
  };

  const replayQuestionAudio = () => {
    if (currentAudio) {
      currentAudio.pause();
      setCurrentAudio(null);
    }
    if (questionAudioData) {
      const audio = new Audio(questionAudioData);
      setCurrentAudio(audio);
      setCurrentAudioType("question");
      audio.preservesPitch = true; // Garante que o pitch seja mantido
      audio.playbackRate = 1.5;    // Aumenta a velocidade em 50%
      audio.play();
      audio.onended = () => {
        setIsReading(false);
        setCurrentAudio(null);
        setCurrentAudioType(null);
      };
    } else {
      const q = questions[currentQuestion];
      if (!q) return;
      let fullText = q.enunciado;
      const alternatives = [];
      if (q.alternativa_a) alternatives.push(`Alternativa A: ${q.alternativa_a}`);
      if (q.alternativa_b) alternatives.push(`Alternativa B: ${q.alternativa_b}`);
      if (q.alternativa_c) alternatives.push(`Alternativa C: ${q.alternativa_c}`);
      if (q.alternativa_d) alternatives.push(`Alternativa D: ${q.alternativa_d}`);
      fullText += ". " + alternatives.join(". ");
      readText(fullText, "question");
    }
  };

  const toggleExplanationAudio = () => {
    if (currentAudio && currentAudioType === "explanation") {
      if (!currentAudio.paused) {
        currentAudio.pause();
      } else {
        currentAudio.play();
      }
    } else {
      const q = questions[currentQuestion];
      if (q && q.explicacao) {
        readText(q.explicacao, "explanation");
      }
    }
  };

  const replayExplanationAudio = () => {
    if (currentAudio) {
      currentAudio.pause();
      setCurrentAudio(null);
    }
    const q = questions[currentQuestion];
    if (q && q.explicacao) {
      readText(q.explicacao, "explanation");
    }
  };

  const questionAudioPlaying = currentAudio && currentAudioType === "question" && !currentAudio.paused;
  const explanationAudioPlaying = currentAudio && currentAudioType === "explanation" && !currentAudio.paused;

  return (
    <div className="p-4 min-h-screen bg-gray-950">
      {questions.length === 0 ? (
        <div className="max-w-6xl mx-auto bg-gray-900 rounded-2xl shadow-xl p-8 mb-8 border border-gray-800">
          <h1 className="text-3xl font-bold mb-8 text-white">Configurar Nova Sessão</h1>
          <div className="grid md:grid-cols-2 gap-8 mb-8">
            <div className="bg-gray-800 p-6 rounded-xl">
              <label className="block mb-3 font-semibold text-gray-200">Número de Questões</label>
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
            <h2 className="text-2xl font-bold mb-6 text-white">Selecione Categorias e Subtópicos</h2>
            <div className="space-y-8">
              {categories.map((category) => {
                const allSelected = category.subtopics.every(sub =>
                  selections.some(s => s.categoria === category.name && s.subtema === sub)
                );
                return (
                  <div key={category.name} className="bg-gray-800 rounded-xl p-6">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="font-bold text-xl text-white">{category.name}</h3>
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
                                : 'bg-gray-700 hover:bg-gray-600 text-gray-200'}
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
            className="w-full bg-blue-600 text-white py-4 rounded-xl hover:bg-blue-500 disabled:opacity-50 transition-all duration-200 text-lg font-medium shadow-lg hover:shadow-xl flex items-center justify-center gap-2"
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
                <button
                  onClick={() => {
                    // Se o autoRead estiver ativo, ao clicar novamente, pausa e desativa
                    if (autoReadEnabled && currentAudio) {
                      currentAudio.pause();
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
                  Leitura auto
                </button>
                <div className="flex gap-4">
                  <div className="flex items-center bg-blue-600 text-white px-3 py-2 rounded-lg shadow-md">
                    <span className="font-semibold">Questão:</span>
                    <span className="ml-2">{Math.floor((Date.now() - questionStartTime) / 1000)}s</span>
                  </div>
                  <div className="flex items-center bg-purple-600 text-white px-3 py-2 rounded-lg shadow-md">
                    <span className="font-semibold">Total:</span>
                    <span className="ml-2">{Math.floor((Date.now() - sessionStartTime) / 1000)}s</span>
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
                  toggleQuestionAudio={toggleQuestionAudio}
                  replayQuestionAudio={replayQuestionAudio}
                  toggleExplanationAudio={toggleExplanationAudio}
                  replayExplanationAudio={replayExplanationAudio}
                  questionAudioPlaying={!!questionAudioPlaying}
                  explanationAudioPlaying={!!explanationAudioPlaying}
                  audioLoading={audioLoading}
                  onExplanationDisplayed={preloadNextQuestionAudio}
                />
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Session;