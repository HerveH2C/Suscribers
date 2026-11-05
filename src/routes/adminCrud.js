const express = require('express');
const { supabase } = require('../lib/supabase');

const router = express.Router();

// Tables administrables et, pour chacune, la ou les colonnes utilisées
// pour la recherche texte libre (paramètre ?q=) depuis le panneau wp-admin.
const TABLES = {
  abonnes: { searchColumns: ['nom', 'prenom', 'email', 'code_client_legacy', 'societe'] },
  collecteurs: { searchColumns: ['nom_collecteur'] },
  abonnements: { searchColumns: ['offre', 'numero_commande_reference_tiers'] },
  paiements: { searchColumns: ['numero_virement_ou_cheque', 'contact_facturation'] },
  facturation_collecteur: { searchColumns: [] },
  blocages_compte: { searchColumns: ['type_blocage'] },
  relances: { searchColumns: ['commentaire'] },
};

function assertKnownTable(req, res, next) {
  const { table } = req.params;
  if (!TABLES[table]) {
    return res.status(404).json({ error: `Table inconnue: ${table}` });
  }
  next();
}

/**
 * GET /api/admin/:table?page=1&pageSize=25&q=texte&sort=nom&order=asc
 * Liste paginée, avec recherche texte libre optionnelle sur les colonnes
 * déclarées dans TABLES[table].searchColumns.
 */
router.get('/:table', assertKnownTable, async (req, res) => {
  const { table } = req.params;
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const pageSize = Math.min(Math.max(parseInt(req.query.pageSize, 10) || 25, 1), 200);
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase.from(table).select('*', { count: 'exact' });

  const { q } = req.query;
  const { searchColumns } = TABLES[table];
  if (q && searchColumns.length > 0) {
    const orClause = searchColumns.map((col) => `${col}.ilike.%${q}%`).join(',');
    query = query.or(orClause);
  }

  if (req.query.sort) {
    query = query.order(req.query.sort, { ascending: req.query.order !== 'desc' });
  } else {
    query = query.order('created_at', { ascending: false });
  }

  const { data, error, count } = await query.range(from, to);

  if (error) {
    console.error(error);
    return res.status(400).json({ error: error.message });
  }

  res.json({ data, page, pageSize, total: count });
});

/** GET /api/admin/:table/:id */
router.get('/:table/:id', assertKnownTable, async (req, res) => {
  const { table, id } = req.params;
  const { data, error } = await supabase.from(table).select('*').eq('id', id).maybeSingle();
  if (error) return res.status(400).json({ error: error.message });
  if (!data) return res.status(404).json({ error: 'Introuvable.' });
  res.json({ data });
});

/** POST /api/admin/:table  — création */
router.post('/:table', assertKnownTable, async (req, res) => {
  const { table } = req.params;
  const { data, error } = await supabase.from(table).insert(req.body).select().single();
  if (error) return res.status(400).json({ error: error.message });
  res.status(201).json({ data });
});

/** PUT /api/admin/:table/:id — mise à jour partielle */
router.put('/:table/:id', assertKnownTable, async (req, res) => {
  const { table, id } = req.params;
  const { data, error } = await supabase.from(table).update(req.body).eq('id', id).select().maybeSingle();
  if (error) return res.status(400).json({ error: error.message });
  if (!data) return res.status(404).json({ error: 'Introuvable.' });
  res.json({ data });
});

/** DELETE /api/admin/:table/:id */
router.delete('/:table/:id', assertKnownTable, async (req, res) => {
  const { table, id } = req.params;
  const { error } = await supabase.from(table).delete().eq('id', id);
  if (error) return res.status(400).json({ error: error.message });
  res.status(204).send();
});

module.exports = router;
