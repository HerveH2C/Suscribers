require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const { apiKeyAuth } = require('./middleware/apiKeyAuth');
const accessRoutes = require('./routes/access');
const adminCrudRoutes = require('./routes/adminCrud');

const app = express();

app.use(helmet());
app.use(express.json());

const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

if (allowedOrigins.length > 0) {
  app.use(cors({ origin: allowedOrigins }));
}

// Limite de débit générale (anti brute-force sur les clés API)
app.use(
  rateLimit({
    windowMs: 60 * 1000,
    max: 120,
    standardHeaders: true,
    legacyHeaders: false,
  })
);

app.get('/health', (req, res) => res.json({ ok: true }));

// Endpoint public (protégé par ACCESS_API_KEY) : vérification d'accès WP
app.use('/api/access', apiKeyAuth('ACCESS_API_KEY'), accessRoutes);

// Endpoints d'administration (protégés par ADMIN_API_KEY) : CRUD complet
app.use('/api/admin', apiKeyAuth('ADMIN_API_KEY'), adminCrudRoutes);

app.use((req, res) => res.status(404).json({ error: 'Route inconnue.' }));

// Gestionnaire d'erreurs générique
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Erreur serveur.' });
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`API H2C Subscribers démarrée sur le port ${port}`);
});
