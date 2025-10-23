// api/submit-form.js (ESM)
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '*';

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS, GET');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

async function readJsonBody(req) {
  // Lecture robuste du corps en Node runtime (Vercel Serverless)
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => { data += chunk; });
    req.on('end', () => {
      try { resolve(data ? JSON.parse(data) : {}); }
      catch (e) { reject(e); }
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

export default async function handler(req, res) {
  try {
    cors(res);

    // GET: petite route de santé pour diagnostic rapide
    if (req.method === 'GET') {
      return res.status(200).json({
        ok: true,
        runtime: 'ESM',
        hasSupabaseUrl: Boolean(SUPABASE_URL),
        hasServiceRole: Boolean(SUPABASE_SERVICE_ROLE_KEY)
      });
    }

    if (req.method === 'OPTIONS') return res.status(204).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Méthode non autorisée' });

    // Parse JSON
    let data = {};
    try { data = await readJsonBody(req); }
    catch (e) {
  return res.status(400).json({ error: 'Corps JSON invalide', details: String(e) });
}

    // Honeypot
    if (data['bot-field']) return res.status(200).json({ ok: true, bot: true });

    // Champs requis
    const required = ['prenom', 'nom', 'email', 'fonction'];
const missing = required.filter(k => !data[k] || String(data[k]).trim() === '');
if (missing.length) {
  return res.status(400).json({
    error: 'Champs requis manquants',
    missingFields: missing,
    receivedKeys: Object.keys(data)   // visibilité sur ce qui a vraiment été reçu
  });
}

    // Env
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return res.status(500).json({ error: 'Variables SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY manquantes.' });
    }

    if (!supabase) {
      supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
    }

    // Normalisation
    const row = {
      formation_titre: emptyToNull(data.formation_titre) || 'Fiscalité minière – Sycamore',
      formation_modalite: emptyToNull(data.formation_modalite) || 'En ligne',
      formation_debut: emptyToNull(data.formation_debut) || '2025-10-20',
      formation_fin: emptyToNull(data.formation_fin) || '2025-10-24',

      prenom: String(data.prenom).trim(),
      nom: String(data.nom).trim(),
      email: String(data.email).trim(),
      telephone: emptyToNull(data.telephone),
      fonction: String(data.fonction).trim(),
      autre_fonction: emptyToNull(data.autre_fonction),

      org_objectifs: intOrNull(data.org_objectifs, 1, 5),
      org_plateforme: intOrNull(data.org_plateforme, 1, 5),
      org_rythme: intOrNull(data.org_rythme, 1, 5),
      org_outil: intOrNull(data.org_outil, 1, 5),

      cont_adequation: intOrNull(data.cont_adequation, 1, 5),
      cont_equilibre: intOrNull(data.cont_equilibre, 1, 5),
      cont_supports: intOrNull(data.cont_supports, 1, 5),

      t_rts: intOrNull(data.t_rts, 1, 5),
      t_vf: intOrNull(data.t_vf, 1, 5),
      t_tva: intOrNull(data.t_tva, 1, 5),
      t_tva_remb: intOrNull(data.t_tva_remb, 1, 5),
      t_is: intOrNull(data.t_is, 1, 5),
      t_rns: intOrNull(data.t_rns, 1, 5),
      t_pf: intOrNull(data.t_pf, 1, 5),

      anim_maitrise: intOrNull(data.anim_maitrise, 1, 5),
      anim_interaction: intOrNull(data.anim_interaction, 1, 5),

      res_objectifs: intOrNull(data.res_objectifs, 1, 5),

      competences: emptyToNull(data.competences),
      points_forts: emptyToNull(data.points_forts),
      ameliorations: emptyToNull(data.ameliorations),
      besoins_suivi: emptyToNull(data.besoins_suivi),

      nps: intOrNull(data.nps, 0, 10)
    };

    // Insertion
    const { error } = await supabase.from('evaluation_responses').insert([row]);
    if (error) {
      console.error('[submit-form] Supabase insert error:', error);
      return res.status(500).json({ error: 'Erreur d’insertion Supabase', details: error.message || String(error) });
    }

    // Redirection « merci »
    res.writeHead(302, { Location: '/thank-you.html' });
    return res.end();
  } catch (e) {
    console.error('[submit-form] Uncaught error:', e);
    return res.status(500).json({ error: 'Erreur serveur', details: e.message });
  }
}
