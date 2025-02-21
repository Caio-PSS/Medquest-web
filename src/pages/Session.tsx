import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import Question from '../components/Question';
import { useNavigate } from 'react-router-dom';
import { Bars } from 'react-loader-spinner';
import { CheckCircle, Circle, Timer, Clock } from 'lucide-react';

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
  const [timeStarted, setTimeStarted] = useState(Date.now());
  const [sessionStartTime, setSessionStartTime] = useState(Date.now());
  const [numQuestions, setNumQuestions] = useState(20);
  const [includeRepeats, setIncludeRepeats] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selections, setSelections] = useState<Selection[]>([]);
  const [tick, setTick] = useState(0); // Estado para forçar re-render a cada segundo

  // Atualiza o componente a cada 1 segundo
  useEffect(() => {
    const interval = setInterval(() => {
      setTick(prev => prev + 1);
    }, 1000);
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
      navigate('/stats');
    }
  }, [currentQuestion, questions.length, navigate]);

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
      setTimeStarted(Date.now());       // Reinicia timer da questão
      setSessionStartTime(Date.now());    // Inicia timer da sessão
      setCurrentQuestion(0);
    } catch (err) {
      console.error(err);
      alert('Erro ao carregar questões');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAnswer = async (answer: string, isCorrect: boolean) => {
    const timeTaken = (Date.now() - timeStarted) / 1000;
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
  
    } catch (err) {
      console.error('Erro ao salvar resposta:', err);
      alert('Erro ao salvar resposta');
    }
  };

  // Reinicia o timer da questão a cada nova questão
  const handleNextQuestion = () => {
    if (currentQuestion + 1 < questions.length) {
      setCurrentQuestion(prev => prev + 1);
      setTimeStarted(Date.now()); // Reinicia timer da questão
    } else {
      navigate('/stats');
    }
  };

  return (
    <div className="p-4 min-h-screen bg-gray-950">
      {questions.length === 0 ? (
        <div className="max-w-6xl mx-auto bg-gray-900 rounded-2xl shadow-xl p-8 mb-8 border border-gray-800">
          <h1 className="text-3xl font-bold mb-8 text-gray-800">
            Configurar Nova Sessão
          </h1>
          {/* Formulário de configuração e seleção de categorias/subtópicos */}
          {/* ... */}
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
          <div className="bg-gray-900 rounded-2xl shadow-xl p-6 mb-6 border border-gray-800 flex justify-between items-center">
            <span className="text-white font-medium">
              Questão {currentQuestion + 1} de {questions.length}
            </span>
            <div className="flex gap-4">
              <div className="flex items-center bg-gradient-to-r from-blue-500 to-blue-700 px-4 py-2 rounded-md shadow-md">
                <Timer className="w-5 h-5 text-white mr-2" />
                <span className="text-white text-sm">
                  Questão: {Math.floor((Date.now() - timeStarted) / 1000)} s
                </span>
              </div>
              <div className="flex items-center bg-gradient-to-r from-green-500 to-green-700 px-4 py-2 rounded-md shadow-md">
                <Clock className="w-5 h-5 text-white mr-2" />
                <span className="text-white text-sm">
                  Sessão: {Math.floor((Date.now() - sessionStartTime) / 1000)} s
                </span>
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
