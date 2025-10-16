import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

// --- CONFIGURATION : VARIABLES D'ENVIRONNEMENT ---

// Supabase
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SUPABASE_TABLE_NAME = 'attentes_formation'; // Assurez-vous que c'est le nom de votre table

// Resend
const RESEND_API_KEY = process.env.RESEND_API_KEY; 
const NOTIFICATION_RECIPIENT = process.env.NOTIFICATION_RECIPIENT;

// Adresse e-mail de l'expéditeur. DOIT être une adresse/domaine vérifié(e) dans Resend.
// Si vous n'avez pas de domaine vérifié, utilisez 'onboarding@resend.dev'
const SENDER_EMAIL = 'onboarding@resend.dev'; 

// --- INITIALISATION ---

// 1. Initialisation du client Supabase
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error('Erreur: Les clés Supabase ne sont pas configurées.');
}
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// 2. Initialisation du client Resend
if (!RESEND_API_KEY) {
    console.error('Erreur: La clé API Resend n\'est pas configurée.');
}
const resend = new Resend(RESEND_API_KEY);

// --- FONCTION PRINCIPALE ---

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Méthode non autorisée. Seul POST est accepté.' });
  }

  try {
    const data = req.body;
    
    // 1. Validation du Honeypot (bot-field)
    if (data['bot-field']) {
        console.log("Détection de bot, soumission ignorée.");
        // Répond 200 OK pour ne pas donner d'indice aux bots
        return res.status(200).json({ message: 'Soumission ignorée (bot).' });
    }

    // Préparation des données pour l'insertion
    const { 'bot-field': _, ...submissionData } = data;
    
    // Gérer le champ 'Autre' pour la fonction
    if (submissionData.fonction === 'Autre' && submissionData['autre-fonction']) {
      submissionData.fonction = submissionData['autre-fonction'];
    }
    // On retire le champ "autre-fonction" car il n'est pas nécessaire dans la BDD si la valeur est déjà dans "fonction"
    delete submissionData['autre-fonction'];

    // 2. Insertion des données dans Supabase
    const { error: supabaseError } = await supabase
      .from(SUPABASE_TABLE_NAME)
      .insert([submissionData]);

    if (supabaseError) {
      console.error('Erreur Supabase lors de l\'insertion:', supabaseError.message);
      return res.status(500).json({ error: 'Erreur lors de l\'enregistrement dans la base de données.' });
    }

    // 3. Envoi de l'e-mail de notification via Resend
    
    // Formatage HTML du corps de l'e-mail
    const emailBody = Object.entries(submissionData)
      .map(([key, value]) => `<strong>${key.charAt(0).toUpperCase() + key.slice(1)}</strong>: ${value}`)
      .join('<br>');

    try {
        await resend.emails.send({
            from: `Formulaire Fiscalité <${SENDER_EMAIL}>`, // Expéditeur vérifié
            to: NOTIFICATION_RECIPIENT, // Votre adresse de réception
            subject: `[Formulaire] Nouvelle attente de formation de ${submissionData.prenom} ${submissionData.nom}`,
            html: `
                <p>Une nouvelle soumission a été enregistrée pour la formation en fiscalité minière :</p>
                <hr>
                ${emailBody}
                <hr>
                <p>Date de soumission : ${new Date().toLocaleString('fr-FR')}</p>
            `,
        });
    } catch (emailError) {
        console.error('Erreur Resend (l\'e-mail n\'a pas pu être envoyé):', emailError);
        // On continue le processus (200 OK) car l'enregistrement BDD a réussi, mais on logue l'erreur d'e-mail.
    }

    // 4. Succès
    return res.status(200).json({ message: 'Soumission réussie.' });

  } catch (e) {
    console.error('Erreur interne du serveur:', e);
    return res.status(500).json({ error: 'Erreur interne du serveur.' });
  }
}