import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

const openai = new OpenAI({
    apiKey: process.env.PERPLEXITY_API_KEY,
    baseURL: 'https://api.perplexity.ai',
});

function repairJson(jsonStr: string): string {
    let repaired = jsonStr.trim();

    // Try to close unterminated strings
    const quoteCount = (repaired.match(/"/g) || []).length;
    if (quoteCount % 2 !== 0) {
        repaired += '"';
    }

    // Try to close brackets and braces
    const stack = [];
    for (const char of repaired) {
        if (char === '{' || char === '[') stack.push(char);
        else if (char === '}') {
            if (stack[stack.length - 1] === '{') stack.pop();
        } else if (char === ']') {
            if (stack[stack.length - 1] === '[') stack.pop();
        }
    }

    // Remove trailing commas that break JSON.parse
    repaired = repaired.replace(/,\s*([}\]])/g, '$1');

    while (stack.length > 0) {
        const last = stack.pop();
        if (last === '{') repaired += '}';
        else if (last === '[') repaired += ']';
    }

    return repaired;
}

async function processBatch(batch: any[], allowedCategories: string[], historicalMappings: any[], retryCount = 0): Promise<any[]> {
    const prompt = `
    Você é um assistente financeiro. Abaixo estão extratos brutos de bancos ou faturas (texto ou metadados).
    Extraia todas as transações individuais deste lote.
    Para cada transação, identifique: data, descrição, valor (positivo para entrada, negativo para saída), categoria e o arquivo de origem (source_file).
    Categorias permitidas: ${allowedCategories.join(', ')}.
    ${historicalMappings.length > 0 ? `
    CONTEXTO HISTÓRICO (Use como sugestão de categoria se a descrição for similar):
    ${historicalMappings.map(h => `- ${h.description} -> ${h.category}`).join('\n')}
    ` : ''}
    Retorne APENAS um JSON válido. Não inclua texto explicativo fora do JSON.
    Formato: { "transactions": [ { "date": "YYYY-MM-DD", "description": "...", "amount": 0.00, "category": "...", "type": "entrada/saida", "source_file": "..." } ] }

    Dados Brutos do Lote:
    ${JSON.stringify(batch)}
  `;

    try {
        const response = await openai.chat.completions.create({
            model: 'sonar-pro',
            messages: [
                { role: 'system', content: 'Be a precise financial parser. Return only JSON.' },
                { role: 'user', content: prompt }
            ],
        });

        const content = response.choices[0].message.content;
        if (!content) throw new Error('Falha ao categorizar transações via AI.');

        try {
            const cleanContent = content.replace(/```json\n?|```/g, '').trim();
            const parsed = JSON.parse(cleanContent);
            const txs = parsed.transactions || (Array.isArray(parsed) ? parsed : [parsed]);
            if (txs.length === 0 && retryCount < 2) throw new Error('Lote retornou vazio');
            return txs;
        } catch (e) {
            const jsonMatch = content.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
            if (jsonMatch) {
                const repaired = repairJson(jsonMatch[0]);
                const secondAttempt = JSON.parse(repaired);
                return secondAttempt.transactions || (Array.isArray(secondAttempt) ? secondAttempt : [secondAttempt]);
            }
            throw e;
        }
    } catch (error) {
        console.error(`Erro no lote (tentativa ${retryCount + 1}):`, error);
        if (retryCount < 2) {
            // Wait a bit before retry
            await new Promise(resolve => setTimeout(resolve, 1000));
            return processBatch(batch, allowedCategories, historicalMappings, retryCount + 1);
        }
        // Final fallback: return raw data as "Uncategorized" if AI totally fails
        return batch.map(b => ({
            date: b.date || new Date().toISOString().split('T')[0],
            description: b.description || 'Transação não processada',
            amount: b.amount || 0,
            category: 'Outros',
            type: b.amount < 0 ? 'saida' : 'entrada',
            source_file: b.source_file || 'unknown'
        }));
    }
}

export async function categorizeTransactions(rawInputs: any[], allowedCategories: string[] = ['Alimentação', 'Transporte', 'Moradia', 'Lazer', 'Saúde', 'Educação', 'Compras', 'Outros'], historicalMappings: any[] = []) {
    if (rawInputs.length === 0) return [];

    const BATCH_SIZE = 10; // Safer batch size
    const results = [];

    // Process batches sequentially to avoid rate limiting and ensure order
    for (let i = 0; i < rawInputs.length; i += BATCH_SIZE) {
        const batch = rawInputs.slice(i, i + BATCH_SIZE);
        const batchResults = await processBatch(batch, allowedCategories, historicalMappings);
        results.push(...batchResults);
    }

    return results;
}

export async function analyzeSpending(categorizedData: any[], comparativeContext: string = '') {
    const prompt = `
    Analise os seguintes dados financeiros e forneça insights sobre o consumo e dicas de organização financeira.
    ${comparativeContext ? `
    CONTEXTO COMPARATIVO (Mês anterior):
    ${comparativeContext}
    Compare o desempenho atual com o anterior se identificar tendências relevantes.
    ` : ''}
    Retorne APENAS um JSON no formato: { 
        "consumption": ["insight 1", "insight 2", ...], 
        "tips": ["dica 1", "dica 2", ...] 
    }
    Seja prático e direto.
    Dados do Mês Atual:
    ${JSON.stringify(categorizedData)}
  `;

    const response = await openai.chat.completions.create({
        model: 'sonar-pro',
        messages: [{ role: 'user', content: prompt }],
    });

    const content = response.choices[0].message.content;
    if (!content) return { consumption: [], tips: [] };

    try {
        // Attempt 1: Direct cleaning
        const cleanContent = content.replace(/```json\n?|```/g, '').trim();
        return JSON.parse(cleanContent);
    } catch (e) {
        console.error('Erro no parse inicial de insights:', e);

        // Attempt 2: Regex extraction
        try {
            const jsonMatch = content.match(/(\{[\s\S]*\})/);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]);
            }
        } catch (e2) {
            console.error('Erro na segunda tentativa de parse de insights (regex):', e2);
        }

        console.error('Conteúdo problemático de insights:', content);
        return {
            consumption: ["Não foi possível processar os insights gerados pela IA no momento."],
            tips: ["Tente realizar o upload novamente ou verifique se o formato do arquivo está correto."]
        };
    }
}
