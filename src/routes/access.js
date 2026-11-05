const express = require('express');
const { supabase } = require('../lib/supabase');

const router = express.Router();

/**
 * POST /api/access/check
 * Body: { "email": "claire@exemple.fr" }
 *   ou  { "code_client_legacy": "30061" }
 *   ou  { "shopify_customer_id": "gid://shopify/Customer/123" }
 *
 * Appelée par le plugin WordPress (PHP, côté serveur) pour savoir si un
 * utilisateur connecté doit avoir accès à l'espace réservé.
 *
 * Règle d'accès : l'abonné a AU MOINS UN abonnement dont
 *   - statut_abonnement = 'Actif'
 *   - ET aucun blocage_compte actif rattaché à cet abonnement
 *
 * Réponse :
 * {
 *   "hasAccess": true,
 *   "abonne": { "id": "...", "nom": "...", "prenom": "..." },
 *   "abonnements": [
 *     { "id": "...", "offre": "...", "statut_abonnement": "Actif",
 *       "date_fin_abonnement": "2027-01-14", "a_un_blocage_actif": false }
 *   ]
 * }
 */
router.post('/check', async (req, res) => {
  const { email, code_client_legacy, shopify_customer_id } = req.body || {};

  if (!email && !code_client_legacy && !shopify_customer_id) {
    return res.status(400).json({
      error: 'Fournir au moins un identifiant : email, code_client_legacy ou shopify_customer_id.',
    });
  }

  // 1. Retrouver l'abonné
  let query = supabase.from('abonnes').select('id, nom, prenom, email, code_client_legacy, shopify_customer_id');
  if (email) query = query.ilike('email', email.trim());
  else if (code_client_legacy) query = query.eq('code_client_legacy', code_client_legacy.trim());
  else query = query.eq('shopify_customer_id', shopify_customer_id.trim());

  const { data: abonnes, error: abonneErr } = await query.limit(1);

  if (abonneErr) {
    console.error(abonneErr);
    return res.status(500).json({ error: 'Erreur base de données.' });
  }
  if (!abonnes || abonnes.length === 0) {
    return res.json({ hasAccess: false, reason: 'ABONNE_INCONNU' });
  }
  const abonne = abonnes[0];

  // 2. Récupérer ses abonnements + leur éventuel blocage actif via la vue
  const { data: acces, error: accesErr } = await supabase
    .from('v_acces_abonne')
    .select('abonnement_id, statut_abonnement, date_debut_abonnement, date_fin_abonnement, a_un_blocage_actif')
    .eq('abonne_id', abonne.id);

  if (accesErr) {
    console.error(accesErr);
    return res.status(500).json({ error: 'Erreur base de données.' });
  }

  const abonnementsValides = (acces || []).filter(
    (a) => a.statut_abonnement === 'Actif' && !a.a_un_blocage_actif
  );

  return res.json({
    hasAccess: abonnementsValides.length > 0,
    reason: abonnementsValides.length > 0 ? null : 'AUCUN_ABONNEMENT_ACTIF_SANS_BLOCAGE',
    abonne: { id: abonne.id, nom: abonne.nom, prenom: abonne.prenom },
    abonnements: acces || [],
  });
});

module.exports = router;
