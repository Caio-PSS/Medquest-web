import { PollyClient, SynthesizeSpeechCommand } from '@aws-sdk/client-polly';
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

const voiceMap = {
  'pt-BR-Neural2': 'Camila',
  // Adicione mais mapeamentos conforme necessário
};

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

    const pollyClient = new PollyClient({ region: process.env.AWS_REGION });

    const pollyVoice = 'Ricardo'; // Voz padrão se não houver mapeamento

    const command = new SynthesizeSpeechCommand({
      Text: text,
      OutputFormat: 'mp3',
      VoiceId: pollyVoice,
      LanguageCode: language
    });

    const ttsResponse = await pollyClient.send(command);

    const audioStream = ttsResponse.AudioStream;
    const chunks = [];
    for await (const chunk of audioStream) {
      chunks.push(chunk);
    }
    const audioBuffer = Buffer.concat(chunks);
    const audioContent = audioBuffer.toString('base64');

    res.status(200).json({
      audioContent,
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

  if (error.name === 'PollyServiceException') {
    errorInfo.message = error.message;
    errorInfo.status = error.$metadata.httpStatusCode || 500;
    errorInfo.details = error.$response;
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