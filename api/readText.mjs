import fetch from 'node-fetch';
import { createClient } from 'redis';

// Função auxiliar para logs com timestamp
const log = (message, data = '') => {
  console.log(
    `[${new Date().toISOString()}] ${message}${
      data ? `: ${JSON.stringify(data)}` : ''
    }`
  );
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

const GLOBAL_LIMIT = 1000000; // limite global de caracteres

export default async function handler(req, res) {
  log('Início da requisição');

  if (req.method !== 'POST') {
    log('Método não permitido', req.method);
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const { text, language = 'pt-BR', voice = 'pt-BR-Neural2-B' } = req.body;
  log('Dados recebidos', {
    text: text.slice(0, 50) + (text.length > 50 ? '...' : ''),
    language,
    voice
  });

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
    log('totalCharsUsed obtido', {
      currentTotal,
      duration: `${Date.now() - startRedisGet}ms`
    });

    if (currentTotal + text.length > GLOBAL_LIMIT) {
      log('Limite global excedido', {
        currentTotal,
        textLength: text.length,
        remaining: GLOBAL_LIMIT - currentTotal
      });
      return res.status(429).json({
        error: 'Limite global excedido',
        remaining: GLOBAL_LIMIT - currentTotal
      });
    }

    log('Incrementando totalCharsUsed no Redis');
    const startRedisIncr = Date.now();
    await redis.incrBy('totalCharsUsed', text.length);
    log('totalCharsUsed incrementado', {
      duration: `${Date.now() - startRedisIncr}ms`
    });

    // Verifica se as credenciais do Google estão configuradas
    const googleAccessToken = process.env.GOOGLE_ACCESS_TOKEN;
    const googleProjectId = process.env.GOOGLE_PROJECT_ID;
    if (!googleAccessToken || !googleProjectId) {
      throw new Error('Credenciais do Google não configuradas');
    }

    // Monta o payload conforme a documentação do Google TTS
    const payload = {
      input: {
        text
      },
      voice: {
        languageCode: language,
        name: voice
      },
      // Usando LINEAR16 conforme exemplo; se preferir MP3, altere para "MP3"
      audioConfig: {
        audioEncoding: "LINEAR16"
      }
    };

    log('Enviando requisição para Google TTS');
    const startGoogle = Date.now();
    const googleResponse = await fetch("https://texttospeech.googleapis.com/v1/text:synthesize", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-User-Project": "ankicollab-media-acess-443012",
        "Authorization": `Bearer ${googleAccessToken}`
      },
      body: JSON.stringify(payload)
    });
    log('Resposta do Google TTS recebida', { duration: `${Date.now() - startGoogle}ms` });

    if (!googleResponse.ok) {
      const errorData = await googleResponse.json();
      throw new Error(errorData.error?.message || 'Erro ao sintetizar áudio com Google TTS');
    }

    const data = await googleResponse.json();
    if (!data.audioContent) {
      throw new Error('Nenhum áudio retornado pelo Google TTS');
    }

    log('Processamento concluído com sucesso');
    res.status(200).json({
      audioContent: data.audioContent,
      charsUsed: text.length,
      totalUsed: currentTotal + text.length
    });
  } catch (error) {
    log('Erro na API', { message: error.message, stack: error.stack });

    if (text && redis.isOpen) {
      log('Revertendo totalCharsUsed no Redis devido a erro');
      const startRedisDecr = Date.now();
      await redis.decrBy('totalCharsUsed', text.length).catch(err =>
        log('Erro ao reverter totalCharsUsed', err.message)
      );
      log('totalCharsUsed revertido', { duration: `${Date.now() - startRedisDecr}ms` });
    }

    const status = error.$metadata?.httpStatusCode || 500;
    log('Respondendo com erro', { status, error: error.message });
    res.status(status).json({ error: error.message || 'Erro interno no servidor' });
  }
}
