import { PollyClient, SynthesizeSpeechCommand } from '@aws-sdk/client-polly';
import { Readable } from 'stream';
import { createClient } from 'redis';

// Função auxiliar para logs com timestamp
const log = (message, data = '') => {
  console.log(`[${new Date().toISOString()}] ${message}${data ? `: ${JSON.stringify(data)}` : ''}`);
};

const redis = createClient({
  url: process.env.REDIS_URL || process.env.STORAGE_URL,
  socket: {
    tls: (process.env.REDIS_URL || process.env.STORAGE_URL)?.startsWith('rediss://'),
    rejectUnauthorized: process.env.NODE_ENV !== 'production'
  }
});

log('Iniciando conexão com Redis');
redis.connect().catch(err => log('Erro ao conectar ao Redis', err.message));

const GLOBAL_LIMIT = 1000000;

const voiceMap = {
  'pt-BR-Neural2': 'Camila',
  'pt-BR-Standard': 'Vitoria',
};

export default async function handler(req, res) {
  log('Início da requisição');

  if (req.method !== 'POST') {
    log('Método não permitido', req.method);
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const { text, language = 'pt-BR', voice = 'Camila' } = req.body;
  log('Dados recebidos', { text: text.slice(0, 50) + (text.length > 50 ? '...' : ''), language, voice });

  if (!text || typeof text !== 'string') {
    log('Texto inválido ou não fornecido');
    return res.status(400).json({ error: 'Texto inválido ou não fornecido' });
  }

  try {
    log('Verificando conexão com Redis');
    if (!redis.isOpen) {
      log('Redis desconectado, tentando reconectar');
      await redis.connect();
      log('Redis reconectado com sucesso');
    }

    log('Obtendo totalCharsUsed do Redis');
    const startRedisGet = Date.now();
    const currentTotal = Number(await redis.get('totalCharsUsed')) || 0;
    log('totalCharsUsed obtido', { currentTotal, duration: `${Date.now() - startRedisGet}ms` });

    if (currentTotal + text.length > GLOBAL_LIMIT) {
      log('Limite global excedido', { currentTotal, textLength: text.length, remaining: GLOBAL_LIMIT - currentTotal });
      return res.status(429).json({
        error: 'Limite global excedido',
        remaining: GLOBAL_LIMIT - currentTotal
      });
    }

    log('Incrementando totalCharsUsed no Redis');
    const startRedisIncr = Date.now();
    await redis.incrBy('totalCharsUsed', text.length);
    log('totalCharsUsed incrementado', { duration: `${Date.now() - startRedisIncr}ms` });

    log('Inicializando cliente Polly');
    const pollyClient = new PollyClient({ region: process.env.AWS_REGION });

    const pollyVoice = voiceMap[voice] || voice || 'Camila';
    log('Voz selecionada para Polly', { originalVoice: voice, pollyVoice });

    const command = new SynthesizeSpeechCommand({
      Text: text,
      OutputFormat: 'mp3',
      VoiceId: pollyVoice,
      LanguageCode: language
    });

    log('Enviando comando para Polly');
    const startPolly = Date.now();
    const ttsResponse = await pollyClient.send(command);
    log('Resposta recebida do Polly', { duration: `${Date.now() - startPolly}ms` });

    log('Processando AudioStream');
    const startStream = Date.now();
    const audioStream = ttsResponse.AudioStream;
    const chunks = [];
    for await (const chunk of audioStream) {
      chunks.push(chunk);
    }
    const audioBuffer = Buffer.concat(chunks);
    const audioContent = audioBuffer.toString('base64');
    log('AudioStream processado', { duration: `${Date.now() - startStream}ms`, audioSize: audioContent.length });

    log('Enviando resposta ao cliente');
    res.status(200).json({
      audioContent,
      charsUsed: text.length,
      totalUsed: currentTotal + text.length
    });
  } catch (error) {
    log('Erro na API', { message: error.message, stack: error.stack });

    if (text && redis.isOpen) {
      log('Revertendo totalCharsUsed no Redis devido a erro');
      const startRedisDecr = Date.now();
      await redis.decrBy('totalCharsUsed', text.length).catch(err => log('Erro ao reverter totalCharsUsed', err.message));
      log('totalCharsUsed revertido', { duration: `${Date.now() - startRedisDecr}ms` });
    }

    const status = error.$metadata?.httpStatusCode || 500;
    log('Respondendo com erro', { status, error: error.message });
    res.status(status).json({ error: error.message || 'Erro interno no servidor' });
  }
}