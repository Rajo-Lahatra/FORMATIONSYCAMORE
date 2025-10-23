// api/submit-form.js (CommonJS, compatible Vercel Functions)
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '*';

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function getIp(req) {
  return (
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.headers['x-real-ip'] ||
    req.connection?.remoteAddress ||
    req.socket?.remoteAddress ||
    null
  );
}

// Lecture fiable du corps JSON (req.body peut être undefined)
async function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => { data += chunk; });
    req.on('end', () => {
      try {
        if (!data) return resolve({});
        const ct = req.headers['content-type'] || '';
        if (ct.includes('application/json')) {
          return resolve(JSON.parse(data));
        }
        // Si ce n'est pas du JSON, tente quand même un parse “best effort”
        try { return resolve(JSON.parse(data)); } catch { return resolve({ raw: data }); }
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

const intOrNull = (v, min, max) => {
  if (v === undefined || v === null || v === '') return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  if (min !== undefined && n < min) return null;
  if (max !== undefined && n > max) return null;
  return n;
};

const emptyToNull = (v) => (v === undefined || v === '' ? null : String(v));

let supabase = null;
function getSupabase() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Variables SUPABASE_URL et/ou SUPABASE_SERVICE_ROLE_KEY manquantes.');
  }
  if (!supabase) {
    supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });
  }
  return supabase;
}

module.exports = async (req, res) => {
  try {
    cors(res);

    if (req.method === 'OPTIONS') {
      return res.status(204).end();
    }

    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Méthode non autorisée' });
    }

    // Parse corps JSON de manière fiable
    let data = {};
    try {
      data = await readJsonBody(req);
    } catch (parseErr) {
      console.error('[submit-form] JSON parse error:', parseErr);
      return res.status(400).json({ error: 'Corps de requête invalide (JSON attendu)' });
    }

    // Honeypot
    if (data['bot-field']) {
      return res.status(200).json({ ok: true, bot: true });
    }

    // Champs requis minimum
    const required = ['prenom', 'nom', 'email', 'fonction'];
    for (const k of required) {
      if (!data[k] || String(data[k]).trim() === '') {
        return res.status(400).json({ error: `Le champ requis "${k}" est manquant.` });
      }
    }

    // Prépare la ligne pour insertion
    const row = {
      // Métadonnées
      formation_titre: emptyToNull(data.formation_titre) || 'Fiscalité minière – Sycamore',
      formation_modalite: emptyToNull(data.formation_modalite) || 'En ligne',
      formation_debut: emptyToNull(data.formation_debut) || '2025-10-20',
      formation_fin: emptyToNull(data.formation_fin) || '2025-10-24',

      // Participant
      prenom: String(data.prenom).trim(),
      nom: String(data.nom).trim(),
      email: String(data.email).trim(),
      telephone: emptyToNull(data.telephone),
      fonction: String(data.fonction).trim(),
      autre_fonction: emptyToNull(data.autre_fonction),

      // Organisation & logistique
      org_objectifs: intOrNull(data.org_objectifs, 1, 5),
      org_plateforme: intOrNull(data.org_plateforme, 1, 5),
      org_rythme: intOrNull(data.org_rythme, 1, 5),
      org_outil: intOrNull(data.org_outil, 1, 5),

      // Contenu & pédagogie
      cont_adequation: intOrNull(data.cont_adequation, 1, 5),
      cont_equilibre: intOrNull(data.cont_equilibre, 1, 5),
      cont_supports: intOrNull(data.cont_supports, 1, 5),

      // Thématiques
      t_rts: intOrNull(data.t_rts, 1, 5),
      t_vf: intOrNull(data.t_vf, 1, 5),
      t_tva: intOrNull(data.t_tva, 1, 5),
      t_tva_remb: intOrNull(data.t_tva_remb, 1, 5),
      t_is: intOrNull(data.t_is, 1, 5),
      t_rns: intOrNull(data.t_rns, 1, 5),
      t_pf: intOrNull(data.t_pf, 1, 5),

      // Animation
      anim_maitrise: intOrNull(data.anim_maitrise, 1, 5),
      anim_interaction: intOrNull(data.anim_interaction, 1, 5),

      // Résultats & textes
      res_objectifs: intOrNull(data.res_objectifs, 1, 5),
      competences: emptyToNull(data.competences),
      points_forts: emptyToNull(data.points_forts),
      ameliorations: emptyToNull(data.ameliorations),
      besoins_suivi: emptyToNull(data.besoins_suivi),

      // NPS
      nps: intOrNull(data.nps, 0, 10),

      // Traces
      user_agent: req.headers['user-agent'] || null,
      remote_addr: getIp(req),
    };

    // Vérifie les variables d'env ici (message explicite en cas d'oubli)
    let sb;
    try {
      sb = getSupabase();
    } catch (envErr) {
      console.error('[submit-form] ENV error:', envErr.message);
      return res.status(500).json({ error: 'Configuration serveur incomplète (Supabase)', details: envErr.message });
    }

    // Insertion Supabase
    const { error } = await sb.from('evaluation_responses').insert([row]);
    if (error) {
      console.error('[submit-form] Supabase insert error:', error);
      return res.status(500).json({ error: 'Erreur d’insertion Supabase', details: error.message || String(error) });
    }

    // Redirection “merci”
    res.writeHead(302, { Location: '/thank-you.html' });
    return res.end();
  } catch (e) {
    console.error('[submit-form] Uncaught error:', e);
    return res.status(500).json({ error: 'Erreur serveur', details: e.message });
  }
};
