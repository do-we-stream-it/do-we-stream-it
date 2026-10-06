# Do we stream it?

Monorepo mit einem Fastify-Backend und einem React-Frontend, beide mit TypeScript.
Die Anwendungen werden über npm Workspaces verwaltet.

## Voraussetzungen

- Node.js 24 oder neuer (`nvm use` nutzt die beiliegende `.nvmrc`)
- npm 11 oder neuer

## Starten

```sh
npm install
npm run dev
```

- Frontend: http://localhost:5173
- Backend: http://127.0.0.1:3000
- Health-Endpunkt: http://127.0.0.1:3000/api/health

Die Startseite zeigt den Backend-Status an. Vite leitet `/api`-Anfragen an
das Backend weiter. Beide Anwendungen laden Änderungen automatisch neu.
Mit `Ctrl+C` werden beide Entwicklungsprozesse beendet.

## Struktur

```text
apps/
  backend/
    src/app.ts       # Fastify-Anwendung und Routen
    src/server.ts    # Serverstart und Shutdown
  frontend/
    src/App.tsx      # React-Startseite mit Backend-Status
    src/main.tsx     # React-Einstiegspunkt
    vite.config.ts  # Vite und API-Proxy
tsconfig.base.json  # Gemeinsame TypeScript-Einstellungen
```

## Befehle

| Befehl | Funktion |
| --- | --- |
| `npm run dev` | Beide Anwendungen parallel starten |
| `npm run dev:backend` | Nur das Backend starten |
| `npm run dev:frontend` | Nur das Frontend starten |
| `npm run typecheck` | TypeScript in beiden Workspaces prüfen |
| `npm run build` | Beide Anwendungen bauen |
| `npm start` | Das gebaute Backend starten |
| `npm run preview --workspace @do-we-stream-it/frontend` | Den Frontend-Build lokal auf Port 4173 ansehen |

## Konfiguration

Optional die `.env.example` im jeweiligen Workspace als `.env` kopieren:

```sh
cp apps/backend/.env.example apps/backend/.env
cp apps/frontend/.env.example apps/frontend/.env
```

Das Backend liest `HOST` und `PORT` aus seiner `.env`. `API_PROXY_TARGET` in
der Frontend-`.env` legt das Ziel des Vite-Proxys fest. Falls sich der Backend-Port
ändert, das Proxy-Ziel entsprechend anpassen. Ohne `.env` gelten die oben genannten
Standardadressen.

## Produktion

```sh
npm ci
npm run build
npm start
```

Das Backend wird nach `apps/backend/dist` kompiliert. Das Frontend liegt als
statische Website in `apps/frontend/dist` und benötigt einen Webserver, der
`/api` an das Backend weiterleitet. Der Vite-Proxy gilt für Entwicklung und
lokale Vorschau; `vite preview` dient zur lokalen Kontrolle des Builds.

## Dokumentation

Der Entwicklungs-Runner verwendet per npm-Override `shell-quote` ab Version
1.12.0, da seine mitgelieferte Version von einer bekannten Schwachstelle
betroffen ist. Das Lockfile enthält die korrigierte Auflösung.

- [Fastify mit TypeScript](https://fastify.dev/docs/latest/Reference/TypeScript/)
- [React-App mit einem Build-Tool aufsetzen](https://react.dev/learn/build-a-react-app-from-scratch)
- [Vite](https://vite.dev/guide/)
- [npm Workspaces](https://docs.npmjs.com/cli/v11/using-npm/workspaces/)
