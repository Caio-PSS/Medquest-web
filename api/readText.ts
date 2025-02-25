import { VercelRequest, VercelResponse } from '@vercel/node';
import axios from 'axios';
import { createClient } from 'redis';

// Configuração Redis
const redisConfig = {
  url: process.env.REDIS_URL,
  password: process.env.REDIS_PASSWORD,
  socket: {
    tls: true,
    rejectUnauthorized: false
  }
};

let redisClient: ReturnType<typeof createClient> | null = null;

const getRedisClient = async () => {
  if (!redisClient) {
    redisClient = createClient(redisConfig);
    await redisClient.connect();
  }
  return redisClient;
};

const GLOBAL_LIMIT = 1000000;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Método não permitido' });
    return;
  }

  const { text, language = 'pt-BR', voice = 'pt-BR-Neural2' } = req.body;
  
  if (!text || typeof text !== 'string') {
    res.status(400).json({ error: 'Texto inválido ou não fornecido' });
    return;
  }

  try {
    const client = await getRedisClient();
    
    // Verifica conexão ativa
    if (!client.isOpen) {
      await client.connect();
    }

    // Operação atômica
    const currentTotal = Number(await client.get('totalCharsUsed')) || 0;
    
    if (currentTotal + text.length > GLOBAL_LIMIT) {
      res.status(429).json({ 
        error: 'Limite global excedido',
        remaining: GLOBAL_LIMIT - currentTotal
      });
      return;
    }

    // Atualiza o contador
    await client.incrBy('totalCharsUsed', text.length);

    // Chamada à API do Google
    const ttsResponse = await axios.post(
      'https://texttospeech.googleapis.com/v1/text:synthesize',
      {
        input: { text },
        voice: { languageCode: language, name: voice },
        audioConfig: { audioEncoding: 'MP3' }
      },
      {
        params: { key: process.env.GOOGLE_API_KEY },
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000
      }
    );

    res.status(200).json({ 
      audioContent: ttsResponse.data.audioContent,
      charsUsed: text.length,
      totalUsed: currentTotal + text.length
    });

  } catch (error) {
    // Rollback em caso de erro
    if (text && redisClient?.isOpen) {
      await redisClient.decrBy('totalCharsUsed', text.length);
    }

    // Tratamento de erros detalhado
    let errorMessage = 'Erro interno no servidor';
    let statusCode = 500;

    if (axios.isAxiosError(error)) {
      errorMessage = error.response?.data?.error?.message || error.message;
      statusCode = error.response?.status || 500;
    } else if (error instanceof Error) {
      errorMessage = error.message;
    }

    console.error(`Erro na API: ${errorMessage}`, error);
    
    res.status(statusCode).json({
      error: errorMessage,
      details: process.env.NODE_ENV === 'development' ? error : undefined
    });
  }
};