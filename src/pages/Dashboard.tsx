import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';
import {
  BookOpen,
  CheckCircle,
  PieChart,
  Clock,
  Trophy,
  Brain,
  Target
} from 'lucide-react';
import { StarIcon, CheckBadgeIcon, FireIcon } from '@heroicons/react/24/solid';

type StatsType = {
  total: number;
  acertos: number;
  percentual: string;
  tempoMedio: number;
};

type Challenge = {
  id: number;
  nome: string;
  tipo: 'desempenho' | 'quantidade';
  percentual_meta?: number;
  progresso_atual: number;
  status?: string;
};

type Achievement = {
  id: number;
  level?: number;
};

const achievementStyles = {
  1: { bgColor: 'bg-gray-200', textColor: 'text-gray-800', Icon: StarIcon },
  2: { bgColor: 'bg-blue-200', textColor: 'text-blue-800', Icon: CheckBadgeIcon },
  3: { bgColor: 'bg-yellow-200', textColor: 'text-yellow-800', Icon: FireIcon }
};

const Dashboard = () => {
  const { authToken, isLoading } = useAuth();
  const [stats, setStats] = useState<StatsType | null>(null);
  const [range, setRange] = useState('semestre'); // Valor padrão: semestre
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [achievements, setAchievements] = useState<Achievement[]>([]);

  const rangeOptions = [
    { label: 'Semana', value: 'week' },
    { label: 'Mês', value: 'month' },
    { label: 'Semestre', value: 'semestre' },
    { label: 'Ano', value: 'year' }
  ];

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch(`https://medquest-floral-log-224.fly.dev/api/stats/overview?range=${range}`, {
          headers: { Authorization: `Bearer ${authToken}` }
        });
        const data = await res.json();
        setStats({
          total: data.total_questoes_respondidas,
          acertos: data.total_acertos,
          percentual: data.percentual_acertos,
          tempoMedio: parseFloat(data.tempo_medio_resposta)
        });
      } catch (error) {
        console.error("Error fetching stats:", error);
      }
    };

    if (authToken) {
      fetchStats();
    }
  }, [authToken, range]);

  useEffect(() => {
    const fetchGamificationData = async () => {
      try {
        const [challengesRes, achievementsRes] = await Promise.all([
          fetch('https://medquest-floral-log-224.fly.dev/api/gamification/challenges', {
            headers: { Authorization: `Bearer ${authToken}` }
          }),
          fetch('https://medquest-floral-log-224.fly.dev/api/gamification/achievements', {
            headers: { Authorization: `Bearer ${authToken}` }
          })
        ]);
        
        const [challengesData, achievementsData] = await Promise.all([
          challengesRes.json(),
          achievementsRes.json()
        ]);
        
        setChallenges(challengesData);
        setAchievements(achievementsData);
      } catch (error) {
        console.error("Error fetching gamification data:", error);
      }
    };
  
    if (authToken) {
      fetchGamificationData();
    }
  }, [authToken]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500">
          <div className="sr-only">Carregando...</div>
        </div>
      </div>
    );
  }

  if (!authToken) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-gray-700">Carregando...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-screen-md mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-semibold text-gray-900">Dashboard</h1>
          <Link
            to="/session"
            className="inline-flex items-center gap-2 bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 font-medium transition-all duration-200 shadow-md hover:shadow-lg hover:scale-[1.02]"
          >
            <Brain className="w-4 h-4" />
            Nova Sessão
          </Link>
        </div>

        {/* Seletor de Período */}
        <div className="flex space-x-2">
          {rangeOptions.map(option => (
            <button
              key={option.value}
              onClick={() => setRange(option.value)}
              className={`px-3 py-1 rounded transition-colors ${
                range === option.value
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-200 text-gray-800'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        {/* Cards de Estatísticas */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Total de Questões */}
          <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200 hover:border-blue-300 transition-all duration-200 group">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-2.5 bg-blue-100 rounded-lg group-hover:bg-blue-200 transition-colors">
                <BookOpen className="w-5 h-5 text-blue-500" />
              </div>
              <h3 className="text-gray-600 font-medium text-sm">Total de Questões</h3>
            </div>
            <p className="text-2xl font-bold text-gray-800">{stats?.total || 0}</p>
          </div>

          {/* Acertos */}
          <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200 hover:border-green-300 transition-all duration-200 group">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-2.5 bg-green-100 rounded-lg group-hover:bg-green-200 transition-colors">
                <CheckCircle className="w-5 h-5 text-green-500" />
              </div>
              <h3 className="text-gray-600 font-medium text-sm">Acertos</h3>
            </div>
            <p className="text-2xl font-bold text-gray-800">{stats?.acertos || 0}</p>
          </div>

          {/* Taxa de Acerto */}
          <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200 hover:border-purple-300 transition-all duration-200 group">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-2.5 bg-purple-100 rounded-lg group-hover:bg-purple-200 transition-colors">
                <Target className="w-5 h-5 text-purple-500" />
              </div>
              <h3 className="text-gray-600 font-medium text-sm">Taxa de Acerto</h3>
            </div>
            <p className="text-2xl font-bold text-gray-800">{stats?.percentual || '0%'}</p>
          </div>

          {/* Tempo Médio */}
          <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200 hover:border-yellow-300 transition-all duration-200 group">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-2.5 bg-yellow-100 rounded-lg group-hover:bg-yellow-200 transition-colors">
                <Clock className="w-5 h-5 text-yellow-500" />
              </div>
              <h3 className="text-gray-600 font-medium text-sm">Tempo Médio</h3>
            </div>
            <p className="text-2xl font-bold text-gray-800">
              {(stats?.tempoMedio || 0).toFixed(1)}s
            </p>
          </div>
        </div>

        {/* Ações Rápidas */}
        <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-800 mb-3">Ações Rápidas</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Link
              to="/stats"
              className="flex items-center gap-2.5 p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors group"
            >
              <div className="p-2 bg-purple-100 rounded-lg group-hover:bg-purple-200">
                <PieChart className="w-4 h-4 text-purple-500" />
              </div>
              <div>
                <h3 className="font-medium text-gray-800 text-sm">Estatísticas Detalhadas</h3>
                <p className="text-xs text-gray-500">Visualize seu desempenho completo</p>
              </div>
            </Link>
            <Link
              to="/gamification"
              className="flex items-center gap-2.5 p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors group"
            >
              <div className="p-2 bg-yellow-100 rounded-lg group-hover:bg-yellow-200">
                <Trophy className="w-4 h-4 text-yellow-500" />
              </div>
              <div>
                <h3 className="font-medium text-gray-800 text-sm">Conquistas</h3>
                <p className="text-xs text-gray-500">Veja suas medalhas e progresso</p>
              </div>
            </Link>
          </div>
        </div>
        {/* Prévia de Desafios e Conquistas */}
          <div className="space-y-6">
            {/* Seção de Desafios */}
            <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
              <h2 className="text-lg font-semibold text-gray-800 mb-4">Desafios em Progresso</h2>
              {challenges.length > 0 ? (
                <div className="space-y-4">
                  {challenges.map((challenge) => (
                    <div key={challenge.id} className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="font-medium">{challenge.nome}</span>
                        <span className={`${challenge.status === 'concluido' ? 'text-green-600' : 'text-gray-600'}`}>
                          {challenge.progresso_atual.toFixed(0)}%
                        </span>
                      </div>
                      <div className="h-2 bg-gray-200 rounded-full relative">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${
                            challenge.status === 'concluido' ? 'bg-green-500' : 'bg-blue-500'
                          }`}
                          style={{ width: `${Math.min(challenge.progresso_atual, 100)}%` }}
                        />
                        {challenge.tipo === 'desempenho' && challenge.percentual_meta !== undefined && (
                          <div
                            className="absolute top-0 h-2 w-0.5 bg-red-500"
                            style={{ left: `${challenge.percentual_meta}%` }}
                          />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-center py-2">Nenhum desafio ativo no momento.</p>
              )}
            </div>

            {/* Seção de Troféus */}
            <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
              <h2 className="text-lg font-semibold text-gray-800 mb-4">Troféus Conquistados</h2>
              {achievements.length > 0 ? (
                <div className="grid grid-cols-4 gap-3">
                  {achievements.map((achievement) => {
                    const level = achievement.level || ((achievement.id % 3) + 1);
                    const style = achievementStyles[level as keyof typeof achievementStyles] || achievementStyles[1];
                    const Icon = style.Icon;
                    
                    return (
                      <div
                        key={achievement.id}
                        className={`p-2 rounded-lg ${style.bgColor} flex items-center justify-center`}
                      >
                        <Icon className={`w-6 h-6 ${style.textColor}`} />
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-gray-500 text-center py-2">Nenhum troféu conquistado ainda.</p>
              )}
            </div>
          </div>
      </div>
    </div>
  );
};

export default Dashboard;
