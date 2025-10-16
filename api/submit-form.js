import { createClient } from '@supabase/supabase-js';

// Initialiser le client Supabase avec les variables d'environnement
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    return response.status(405).json({ message: 'Méthode non autorisée' });
  }

  try {
    const formData = request.body;

    // Insérer les données dans la table Supabase
    const { data, error } = await supabase
      .from('reponses_formation')
      .insert([
        {
          prenom: formData.prenom,
          nom: formData.nom,
          telephone: formData.telephone,
          email: formData.email,
          fonction: formData.fonction,
          autre_fonction: formData['autre-fonction'], // Notez la syntaxe pour le tiret
          niveau_connaissance: formData.niveau,
          attentes: formData.attentes,
          questions: formData.questions
        }
      ]);

    if (error) {
      throw error;
    }

    // Si tout va bien, renvoyer une réponse de succès
    return response.status(200).json({ message: 'Données enregistrées avec succès !' });

  } catch (error) {
    console.error('Erreur Supabase:', error);
    return response.status(500).json({ message: 'Erreur lors de l\'enregistrement des données.' });
  }
}