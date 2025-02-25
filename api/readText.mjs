import axios from 'axios';
import { createClient } from 'redis';

const redisConfig = {
  url: process.env.REDIS_URL,
  password: process.env.REDIS_PASSWORD,
  socket: {
    tls: true,
    rejectUnauthorized: false
  }
};

let redisClient = null;

async function getRedisClient() {
  if (!redisClient) {
    redisClient = createClient(redisConfig);
    await redisClient.connect();
  }
  return redisClient;
}

const GLOBAL_LIMIT = 1000000;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return sendError(res, 405, 'Método não permitido');
  }

  const { text, language = 'pt-BR', voice = 'pt-BR-Neural2' } = req.body;

  if (!text || typeof text !== 'string') {
    return sendError(res, 400, 'Texto inválido ou não fornecido');
  }

  try {
    const client = await getRedisClient();
    
    if (!client.isOpen) {
      await client.connect();
    }

    const currentTotal = Number(await client.get('totalCharsUsed')) || 0;

    if (currentTotal + text.length > GLOBAL_LIMIT) {
      return sendError(res, 429, 'Limite global excedido', {
        remaining: GLOBAL_LIMIT - currentTotal
      });
    }

    await client.incrBy('totalCharsUsed', text.length);

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
    await handleError(error, res, text);
  }
}

// Funções auxiliares
function sendError(res, code, message, extras = {}) {
  return res.status(code).json({ error: message, ...extras });
}

async function handleError(error, res, text) {
  if (text && redisClient?.isOpen) {
    await redisClient.decrBy('totalCharsUsed', text.length);
  }

  const errorInfo = {
    message: 'Erro interno no servidor',
    status: 500,
    details: null
  };

  if (axios.isAxiosError(error)) {
    errorInfo.message = error.response?.data?.error?.message || error.message;
    errorInfo.status = error.response?.status || 500;
    errorInfo.details = error.response?.data;
  } else if (error instanceof Error) {
    errorInfo.message = error.message;
  }

  console.error(`Erro na API: ${errorInfo.message}`, error.stack);

  if (process.env.NODE_ENV === 'development') {
    errorInfo.details = {
      stack: error.stack,
      raw: error.toString()
    };
  }

  return res.status(errorInfo.status).json({
    error: errorInfo.message,
    ...(errorInfo.details && { details: errorInfo.details })
  });
}