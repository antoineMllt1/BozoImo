const express = require('express');
const router = express.Router();

router.post('/improve-synthesis', async (req, res) => {
  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';
  const { analystNotes, propertyContext } = req.body;

  if (!ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'Clé API Claude non configurée sur le serveur.' });
  }

  const systemPrompt = `Tu es un expert immobilier rédacteur de rapports d'estimation professionnels en France.
Tu dois améliorer et structurer la synthèse d'un analyste immobilier pour un rapport client.
Tes améliorations doivent :
- Rester factuelles et professionnelles
- Utiliser des bullet points (commençant par • ) pour chaque point important du bien
- Inclure des éléments de valorisation/dévalorisation avec chiffres si mentionnés
- Être en français impeccable
- Expliquer clairement pourquoi le prix est justifié
- Ne PAS inventer d'informations non mentionnées par l'analyste

RÈGLES DE FORMATAGE STRICTES :
- N'utilise JAMAIS de titres (pas de # ni de ## ni de ###)
- N'utilise JAMAIS de texte en gras (pas de **)
- N'utilise JAMAIS de lignes vides contenant seulement "--"
- Commence par 1 ou 2 phrases de synthèse globale, puis les bullet points
- Chaque bullet commence par "• " (sans astérisques, sans tirets)
Retourne uniquement le texte de synthèse, sans mise en forme markdown.`;

  const userPrompt = `Contexte du bien :
${propertyContext}

Notes brutes de l'analyste :
${analystNotes || 'Aucune note fournie.'}

Améliore ces notes en une synthèse professionnelle avec des bullet points pour chaque caractéristique notable du bien.`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(502).json({ error: data.error?.message || 'Erreur API Claude.' });
    }

    const text = data.content?.[0]?.text || '';
    res.json({ synthesis: text });
  } catch (err) {
    console.error('Erreur Claude API:', err);
    res.status(500).json({ error: err.message || 'Erreur réseau Claude.' });
  }
});

module.exports = router;
