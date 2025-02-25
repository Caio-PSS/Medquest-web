import { PollyClient, SynthesizeSpeechCommand } from '@aws-sdk/client-polly';
import { Readable } from 'stream';
import { createClient } from 'redis';

// Configuração simplificada do Redis
const redis = createClient({
  url: process.env.REDIS_URL || process.env.STORAGE_URL, // Suporte a ambos
  socket: {
    tls: (process.env.REDIS_URL || process.env.STORAGE_URL)?.startsWith('rediss://'),
    rejectUnauthorized: process.env.NODE_ENV !== 'production'
  }
});

// Conecta ao Redis imediatamente (como no Quickstart)
redis.connect().catch(err => console.error('Erro ao conectar ao Redis:', err));

const GLOBAL_LIMIT = 1000000;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const { text, language = 'pt-BR', voice = 'Camila' } = req.body;

  if (!text || typeof text !== 'string') {
    return res.status(400).json({ error: 'Texto inválido ou não fornecido' });
  }

  try {
    // Verifica e reconecta ao Redis se necessário
    if (!redis.isOpen) await redis.connect();

    const currentTotal = Number(await redis.get('totalCharsUsed')) || 0;
    if (currentTotal + text.length > GLOBAL_LIMIT) {
      return res.status(429).json({
        error: 'Limite global excedido',
        remaining: GLOBAL_LIMIT - currentTotal
      });
    }

    await redis.incrBy('totalCharsUsed', text.length);

    // Cliente Polly simplificado
    const pollyClient = new PollyClient({ region: process.env.AWS_REGION });
    const command = new SynthesizeSpeechCommand({
      Text: text,
      OutputFormat: 'mp3',
      VoiceId: voice,
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
    console.error('Erro na API:', error);

    // Reverte contagem no Redis se houver erro
    if (text && redis.isOpen) {
      await redis.decrBy('totalCharsUsed', text.length).catch(err => console.error('Erro ao reverter:', err));
    }

    const status = error.$metadata?.httpStatusCode || 500;
    res.status(status).json({ error: error.message || 'Erro interno no servidor' });
  }
}