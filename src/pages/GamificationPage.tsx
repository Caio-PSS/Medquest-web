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
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authToken) return;

    const fetchData = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Verificar progresso primeiro
        await fetch('https://medquest-floral-log-224.fly.dev/api/gamification/check-progress', {
          method: 'POST',
          headers: { Authorization: `Bearer ${authToken}` }
        });

        // Buscar dados atualizados
        const [challengesRes, achievementsRes] = await Promise.all([
          fetch('https://medquest-floral-log-224.fly.dev/api/gamification/challenges', {
            headers: { Authorization: `Bearer ${authToken}` }
          }),
          fetch('https://medquest-floral-log-224.fly.dev/api/gamification/achievements', {
            headers: { Authorization: `Bearer ${authToken}` }
          })
        ]);

        // Tratar erros de resposta
        if (!challengesRes.ok) throw new Error('Erro ao carregar desafios');
        if (!achievementsRes.ok) throw new Error('Erro ao carregar conquistas');

        const [challengesData, achievementsData] = await Promise.all([
          challengesRes.json(),
          achievementsRes.json()
        ]);

        setChallenges(challengesData);
        setAchievements(achievementsData);

      } catch (err) {
        console.error('Erro:', err);
        setError(err instanceof Error ? err.message : 'Erro desconhecido');
      } finally {
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

  if (error) {
    return (
      <div className="min-h-screen bg-gray-100 p-6 flex flex-col items-center justify-center">
        <div className="bg-red-100 p-4 rounded-lg max-w-md text-center">
          <h2 className="text-red-600 font-bold mb-2">Erro ao carregar dados</h2>
          <p className="text-red-500">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 transition-colors"
          >
            Tentar novamente
          </button>
        </div>
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
            ← Voltar
          </button>
          <h1 className="text-3xl font-bold ml-auto">Desafios e Conquistas</h1>
        </div>

        {/* Seção de Desafios */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold mb-4">Desafios Ativos</h2>
          {challenges.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {challenges.map((challenge) => (
                <div key={challenge.id} className="bg-white p-4 rounded-lg shadow">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-semibold text-lg">{challenge.nome}</h3>
                      <p className="text-gray-600 text-sm mt-1">{challenge.descricao}</p>
                    </div>
                    <span className={`px-2 py-1 text-sm rounded ${
                      challenge.status === 'concluido' 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-blue-100 text-blue-800'
                    }`}>
                      {challenge.status || 'Em andamento'}
                    </span>
                  </div>

                  {challenge.meta && (
                    <div className="mt-3">
                      {challenge.tipo === 'desempenho' && (
                        <p className="text-sm">
                          <span className="font-medium">Categoria:</span> {challenge.meta.categoria}
                        </p>
                      )}
                      <p className="text-sm">
                        <span className="font-medium">Meta:</span> {
                          challenge.meta.percentual 
                            ? `${challenge.meta.percentual}% de acerto` 
                            : `${challenge.meta.quantidade} questões`
                        }
                      </p>
                    </div>
                  )}

                  <div className="mt-4">
                    <div className="flex justify-between text-sm mb-1">
                      <span>Progresso</span>
                      <span>{challenge.progresso_atual.toFixed(1)}%</span>
                    </div>
                    <div className="h-2 bg-gray-200 rounded-full">
                      <div
                        className="h-full bg-blue-500 rounded-full transition-all"
                        style={{ width: `${Math.min(challenge.progresso_atual, 100)}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-gray-500 mt-2">
                      <span>Início: {formatDate(challenge.data_inicio)}</span>
                      <span>Fim: {formatDate(challenge.data_fim)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6 bg-white rounded-lg">
              <p className="text-gray-500">Nenhum desafio ativo no momento</p>
              <p className="text-sm text-gray-400 mt-1">
                Novos desafios são liberados toda segunda-feira
              </p>
            </div>
          )}
        </section>

        {/* Seção de Conquistas */}
        <section>
          <h2 className="text-2xl font-bold mb-4">Conquistas</h2>
          {achievements.length > 0 ? (
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
          ) : (
            <div className="text-center py-6 bg-white rounded-lg">
              <p className="text-gray-500">Nenhuma conquista encontrada</p>
              <p className="text-sm text-gray-400 mt-1">
                Complete desafios para desbloquear conquistas
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default GamificationPage;