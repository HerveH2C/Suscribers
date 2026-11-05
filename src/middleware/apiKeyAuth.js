/**
 * Crée un middleware qui vérifie la présence d'une clé API valide dans le
 * header `X-API-Key`, comparée à la valeur d'environnement passée en
 * paramètre. Utilisé pour séparer :
 *   - la clé "access" (lecture seule, utilisée par le front WordPress)
 *   - la clé "admin"  (CRUD complet, utilisée par le panneau wp-admin)
 */
function apiKeyAuth(envVarName) {
  return function (req, res, next) {
    const expected = process.env[envVarName];
    const provided = req.header('X-API-Key');

    if (!expected) {
      return res.status(500).json({ error: `${envVarName} non configurée côté serveur.` });
    }
    if (!provided || provided !== expected) {
      return res.status(401).json({ error: 'Clé API manquante ou invalide.' });
    }
    next();
  };
}

module.exports = { apiKeyAuth };
