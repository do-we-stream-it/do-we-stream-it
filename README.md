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

## API

Alle Endpunkte sind ohne Login nutzbar. Fehler haben die Form
`{ "error": { "code", "message", "jobId"? } }`; interne Details werden nur geloggt.

Der Scraper, die Queue und die Datenbank sind aktuell **gemockt**
(`apps/backend/src/mock/`): Jobs werden im Speicher gehalten und nach ca. 0,5 s
von einem Fake-Scraper im selben Prozess abgeschlossen. Die Schnittstellen
`Repository` und `Queue` stehen in `src/contracts.ts` und werden in `buildApp`
injiziert.

### Job starten

`POST /api/scraper/jobs` mit optionalem Body `{ "date": "YYYY-MM-DD", "country": "DE" }`
(Standard: heutiger UTC-Tag und `DE`). Antwort `202` nach bestätigtem Enqueue,
`503 ENQUEUE_FAILED` (mit `jobId`, Job ist dann `failed`) sonst.

```sh
curl -X POST http://127.0.0.1:3000/api/scraper/jobs \
  -H 'content-type: application/json' -d '{"date":"2026-05-01","country":"DE"}'
# {"job":{"id":"<uuid>","status":"queued",...}}
```

### Releases lesen und Job pollen

`GET /api/releases?date=YYYY-MM-DD&country=DE&jobId=<UUID>` liefert
`{ date, country, job, releases }`. `jobId` ist optional (sonst `job: null`);
unbekannte ID → `404 JOB_NOT_FOUND`, abweichendes Datum/Region → `400`.
Der Endpunkt startet nie einen Scraper.

```sh
curl 'http://127.0.0.1:3000/api/releases?date=2026-05-01&country=DE'
# Polling, bis job.status "succeeded" oder "failed" ist:
curl 'http://127.0.0.1:3000/api/releases?date=2026-05-01&country=DE&jobId=<uuid>'
```

Backend-Tests: `npm test --workspace @do-we-stream-it/backend`.

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

Das Backend liest `HOST` und `PORT` (weitere Variablen für MongoDB/Queue folgen mit den Tickets #1/#2) aus seiner `.env`. `API_PROXY_TARGET` in
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
