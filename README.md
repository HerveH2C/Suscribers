# API H2C Subscribers

Backend Node.js / Express qui expose :

1. **`POST /api/access/check`** — utilisé par le plugin WordPress pour savoir
   si un utilisateur connecté doit avoir accès à l'espace réservé (lecture
   seule, protégé par `ACCESS_API_KEY`).
2. **`/api/admin/:table`** (GET liste, GET :id, POST, PUT, DELETE) — CRUD
   générique sur les 7 tables Supabase, utilisé par le panneau
   d'administration wp-admin (protégé par `ADMIN_API_KEY`).

La clé **`service_role`** de Supabase (qui bypass la Row Level Security)
n'est utilisée que dans ce backend et ne doit **jamais** être exposée dans
WordPress, un navigateur, ou un dépôt public.

## 1. Mise en place de la base Supabase

1. Créer un projet sur [supabase.com](https://supabase.com).
2. Dans l'onglet **SQL Editor**, exécuter le contenu de
   `../supabase/migrations/0001_init_schema.sql`.
3. Récupérer dans **Project Settings → API** :
   - `Project URL` → `SUPABASE_URL`
   - `service_role` key (⚠️ pas la clé `anon`) → `SUPABASE_SERVICE_ROLE_KEY`

## 2. Configuration

```bash
cp .env.example .env
```

Renseigner :

| Variable | Description |
|---|---|
| `SUPABASE_URL` | URL du projet Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Clé service_role (secrète) |
| `ACCESS_API_KEY` | Clé pour l'endpoint `/api/access/check` (à mettre dans les réglages du plugin WP) |
| `ADMIN_API_KEY` | Clé pour les endpoints `/api/admin/*` (à mettre dans les réglages du plugin WP) |
| `PORT` | Port d'écoute (défaut 3000) |
| `ALLOWED_ORIGINS` | Laisser vide : les appels PHP se font serveur-à-serveur, pas de CORS nécessaire |

Générer des clés aléatoires solides :

```bash
openssl rand -hex 32
```

## 3. Installation et lancement

```bash
npm install
npm start          # production
npm run dev         # avec rechargement automatique
```

Test rapide :

```bash
curl http://localhost:3000/health

curl -X POST http://localhost:3000/api/access/check \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $ACCESS_API_KEY" \
  -d '{"email":"claire@exemple.fr"}'

curl http://localhost:3000/api/admin/abonnes?page=1&pageSize=10 \
  -H "X-API-Key: $ADMIN_API_KEY"
```

## 4. Déploiement

Le service est un simple serveur Express sans état (stateless) : il se
déploie tel quel sur Railway, Render, Fly.io, une VM, ou un conteneur Docker
derrière le reverse-proxy existant. Points d'attention :

- Toujours servir en **HTTPS** (les clés API circulent en clair dans les
  headers sinon).
- Définir les variables d'environnement du §2 dans la plateforme de
  déploiement (ne jamais committer `.env`).
- Le endpoint `/health` peut être utilisé comme *health check*.

## 5. Sécurité — résumé

- Deux clés API distinctes : une clé "lecture seule / accès" pour le front
  WordPress, une clé "admin / CRUD" pour le panneau d'administration.
  Cela permet de révoquer/tourner l'une sans casser l'autre.
- `helmet` + rate limiting activés par défaut.
- RLS activée côté Supabase sur toutes les tables sans policy : seule la
  clé `service_role` (donc ce backend) peut lire/écrire.
- Le CRUD générique (`adminCrud.js`) n'expose que les 7 tables listées
  explicitement dans `TABLES` — impossible d'accéder à une table
  arbitraire du projet Supabase via cette API.
