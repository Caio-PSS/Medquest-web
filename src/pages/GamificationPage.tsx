import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

interface Challenge {
  id: number;
  nome: string;
  descricao: string;
  tipo: 'desempenho' | 'quantidade';
  meta?: {
    categoria?: string;
    percentual?: number;
    quantidade?: number;
  };
  data_inicio: string;
  data_fim: string;
  status?: string;
  progresso_atual: number;
}

interface Achievement {
  id: number;
  nome: string;
  descricao: string;
  data_conquista: string;
}

const GamificationPage = () => {
  const { authToken } = useAuth();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [achievements, setAchievements] = useState<Achievement[]>([]);

  useEffect(() => {
    if (!authToken) return;

    const fetchData = async () => {
      try {
        const [challengesRes, achievementsRes] = await Promise.all([
          fetch('https://medquest-floral-log-224.fly.dev/api/gamification/challenges', {
            headers: { Authorization: `Bearer ${authToken}` }
          }),
          fetch('https://medquest-floral-log-224.fly.dev/api/gamification/achievements', {
            headers: { Authorization: `Bearer ${authToken}` }
          })
        ]);

        const challengesData = await challengesRes.json();
        const achievementsData = await achievementsRes.json();

        setChallenges(challengesData);
        setAchievements(achievementsData);
        setIsLoading(false);
      } catch (error) {
        console.error('Erro ao carregar dados:', error);
        setIsLoading(false);
      }
    };

    fetchData();
  }, [authToken]);

  const formatDate = (dateString: string) => {
    const options: Intl.DateTimeFormatOptions = { 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric' 
    };
    return new Date(dateString).toLocaleDateString('pt-BR', options);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-100 p-6 flex justify-center items-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center mb-6">
          <button
            onClick={() => navigate('/')}
            className="flex items-center text-blue-500 hover:text-blue-700 transition-colors"
          >
            {/* Ícone de voltar */}
            ← Voltar
          </button>
          <h1 className="text-3xl font-bold ml-auto">Desafios e Conquistas</h1>
        </div>

        {/* Seção de Desafios */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold mb-4">Desafios Ativos</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {challenges.map((challenge) => (
              <div key={challenge.id} className="bg-white p-4 rounded-lg shadow">
                <h3 className="font-semibold text-lg">{challenge.nome}</h3>
                <p className="text-gray-600 text-sm mt-2">{challenge.descricao}</p>
                
                {challenge.meta && (
                  <div className="mt-2">
                    {challenge.tipo === 'desempenho' && (
                      <p className="text-sm">
                        Categoria: {challenge.meta.categoria}
                      </p>
                    )}
                    <p className="text-sm font-medium">
                      Meta: {challenge.meta.percentual ? `${challenge.meta.percentual}%` : 
                            challenge.meta.quantidade ? `${challenge.meta.quantidade} questões` : ''}
                    </p>
                  </div>
                )}

                <div className="mt-4">
                  <div className="h-2 bg-gray-200 rounded-full">
                    <div
                      className="h-full bg-blue-500 rounded-full transition-all"
                      style={{ width: `${Math.min(challenge.progresso_atual, 100)}%` }}
                    ></div>
                  </div>
                  <div className="flex justify-between text-sm mt-1">
                    <span>{challenge.progresso_atual.toFixed(1)}%</span>
                    <span>{formatDate(challenge.data_fim)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Seção de Conquistas */}
        <section>
          <h2 className="text-2xl font-bold mb-4">Conquistas</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {achievements.map((achievement) => (
              <div key={achievement.id} className="bg-white p-4 rounded-lg shadow">
                <div className="text-center">
                  <span className="text-4xl">🏆</span>
                  <h3 className="font-semibold mt-2">{achievement.nome}</h3>
                  <p className="text-gray-600 text-sm mt-1">{achievement.descricao}</p>
                  <p className="text-xs text-gray-500 mt-2">
                    Conquistado em: {formatDate(achievement.data_conquista)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};

export default GamificationPage;