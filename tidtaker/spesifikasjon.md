# Tidtaker - Implementeringsplan

## Oversikt

En tidtaker-applikasjon implementert i PocketBase med HTMX frontend. Applikasjonen gjør det mulig å registrere seg, logge inn, og spore tidsbruk med beskrivelser, tagger og mulighet for å søke og filtrere.

## Stack

**Backend:** PocketBase (auth, database, API)
**Frontend:** HTMX + HTML + Tailwind CSS
**Styling:** Tailwind CSS
**Søk:** Server-side søk implementert i PocketBase

## 1. Database Schema (PocketBase Collections)

### users (auto-generated av PocketBase)
- id
- email
- password
- created
- updated

### timings
- id
- userId (relation to users)
- description (string)
- tags (liste av strings)
- startTime (datetime)
- stopTime (datetime, nullable)
- isActive (boolean)
- created
- updated

## 2. Frontend Arkitektur

```
templates/
├── base.html              (layout og HTMX setup)
├── auth/
│   ├── register.html
│   └── login.html
├── timer/
│   ├── timer_page.html
│   ├── timer_form.html
│   ├── timings_list.html
│   ├── timing_item.html
│   └── timer_controls.html
├── search/
│   ├── search_bar.html
│   └── filter_bar.html
static/
├── css/
│   └── tailwind.css
└── js/
    └── htmx.min.js
```

## 3. Feature List

### Fase 1: Grunnleggende autentisering
- [ ] PocketBase setup og konfigurering
- [ ] Registreringsside
  - Innput: email, password, password confirm
  - Validering
  - Feilmeldinger
- [ ] Innloggingsside
  - Innput: email, password
  - Sesjonsadministrasjon
  - Redirect til timer-side ved suksess

### Fase 2: Grunnleggende timer
- [ ] Timer-side layout
- [ ] Start/stopp timer
  - Button for å starte
  - Button for å stoppe
  - Automatisk start-tid ved klikk
- [ ] Legge til beskrivelse
  - Tekstfelt for beskrivelse
  - Lagres ved stopp
- [ ] Legge til tags
  - Input-felt med auto-complete
  - Lagres som array
- [ ] Rediger start- og stopptid
  - Modal/form for å endre tider

### Fase 3: Visning og navigasjon
- [ ] Timings-liste
  - Vis siste 10
  - Hver timing: tid spent, beskrivelse, tags, start/stopp-tid
- [ ] Uendelig scroll
  - Load neste 10 når bruker scrolles nær bunnen
  - Pagination via API

### Fase 4: Søk, filter og sortering
- [ ] Søkebar i toppen
  - Fuzzy search på:
    - Beskrivelse
    - Tags
    - Dato (dag, måned, år)
    - Formatterte tall fra tid
  - Mellomrom betyr "og" (AND-operasjon)
  - Dato-eksempler:
    - "10.03" → 10. mars
    - "mandag mars" → alle mandag i mars
    - "2026" → hele året
- [ ] Filter på tags
  - Checkboxes eller dropdown
  - Multi-select
- [ ] Sortering
  - Sortér på navn (beskrivelse)
  - Sortér på tid

### Fase 5: Dokumentasjon
- [ ] Getting Started guide
  - Installasjon
  - PocketBase setup
  - Running dev server
- [ ] Development guide
  - Struktur på koden
  - Hvordan legge til features
  - PocketBase integrering
  - Søk-implementering
- [ ] Deployment guide
  - Deploy til Hetzner med hcloud-cli
  - Versjonert binær og systemd-rullering
  - Environment varibler
  - Hosting alternativer
- [ ] Troubleshooting guide
  - Vanlige problemer
  - Debug tips
  - Logging setup

## 4. Implementation Details

### Search Logic

Søk er implementert server-side i PocketBase og basert på mellomrom-separerte ord:
```
Input: "10.03"
Match: Alle entries hvor dag=10 OG måned=3

Input: "mandag mars"
Match: Alle entries hvor dayOfWeek=mandag OG måned=mars

Input: "arbeid sprint"
Match: Alle entries med både "arbeid" OG "sprint" i description eller tags
```

Implementert via PocketBase filter på backend. HTMX sender søket via GET-request og mottar oppdatert HTML-liste.

### Infinite Scroll

- Hent 10 timings ved load
- Observer ved bunnen av liste som trigger neste hent
- Håndter loading state
- Håndter "ingen flere resultater"

### API Endpoints (PocketBase REST)

**Auth:**
```
POST   /api/collections/users/records              (registrer bruker)
POST   /api/collections/users/auth-with-password   (logg inn)
```

**Timings - Custom domenespesifikke endepunkter:**
```
POST   /api/timings/start                          (start ny timing, returnerer timing-id)
POST   /api/timings/:id/stop                       (stopp timing, beregner duration)
POST   /api/timings/:id/add-tag                    (legg til tag(s) til timing)
POST   /api/timings/:id/remove-tag                 (fjern tag fra timing)
PATCH  /api/timings/:id/edit-time                  (endre start- eller stopptid)
PATCH  /api/timings/:id/edit-description          (endre beskrivelse)
GET    /api/timings/search                         (søk med query params: q, tags, sort, page)
GET    /api/timings/list                           (hent liste, pagination: page, perPage)
DELETE /api/timings/:id                            (slett timing)
```

**Merknad:** Standard CRUD-endepunkter på collections skal deaktiveres i PocketBase-konfigurasjonen.

## 5. Custom Routes i PocketBase

De domenespesifikke endepunktene implementeres via PocketBase hooks i en custom `main.go`:

```go
// pb_hooks/routes.go
e.POST("/api/timings/start", timingsStart)
e.POST("/api/timings/:id/stop", timingsStop)
e.POST("/api/timings/:id/add-tag", timingsAddTag)
e.GET("/api/timings/search", timingsSearch)
// osv...
```

Hver handler:
- Autentiserer bruker via auth token
- Validerer input
- Utfører operasjoner på timings-collection
- Returnerer JSON eller HTML (for HTMX)


## 6. Database Queries

PocketBase query eksempler:
```
// Hent alle timings for en bruker, sortert på startTime descending
GET /api/collections/timings/records?filter=(userId='abc123')&sort=-startTime&perPage=10&page=1

// Med filter på tags (avhengig av schema)
GET /api/collections/timings/records?filter=(userId='abc123' && tags~'work')
```

## 7. File Structure for Deployment

```
.
├── pb_public/          (HTMX HTML templates og static files)
├── templates/          (HTML templates for HTMX)
├── static/             (CSS, JS)
├── pb_migrations/      (PocketBase migrations, hvis aktuelt)
├── Dockerfile          (for containerisering)
├── docker-compose.yml
├── pocketbase.exe      (eller pocketbase på Unix)
└── README.md
```

## 8. Dependencies

Frontend:
- HTMX (for interaktivitet)
- Tailwind CSS (for styling)
- @playwright/test (for e2e testing)

Backend:
- PocketBase (self-contained, inneholder auth, database og API)

## 9. E2E testing med @playwright/test

### Mål
- Verifisere hele brukerflyten fra registrering til søk og redigering av tidsregistreringer.
- Sikre at HTMX-interaksjoner fungerer korrekt uten full side-reload.

### Oppsett
- Installer Playwright test-runner og browser binaries.
- Tester skal støtte `BASE_URL` via miljøvariabel, med default `http://localhost:8090`.
- Hvis `BASE_URL` peker til localhost og tjenesten ikke kjører, skal testoppsettet starte applikasjonen automatisk før testene kjører.
- Opprett egne testbrukere og testdata per kjøring for isolerte tester.

### Foreslått struktur
```
tests/e2e/
├── auth.spec.ts
├── timings.spec.ts
├── search-filter.spec.ts
└── infinite-scroll.spec.ts
playwright.config.ts
```

### Testscenarier
- Registrering: ny bruker kan opprettes og videresendes til riktig side.
- Innlogging: gyldig innlogging lykkes, ugyldig innlogging viser feilmelding.
- Start/stop timing: bruker kan starte, stoppe og se oppdatert varighet.
- Redigering: bruker kan endre starttid/stopptid og beskrivelse i etterkant.
- Tagger: bruker kan legge til og fjerne tagger på eksisterende timing.
- Søk: fuzzy-søk på beskrivelse, tags og dato gir forventede treff.
- Filter/sortering: filtrering på tag og sortering på navn/tid virker korrekt.
- Infinite scroll: neste side med registreringer lastes automatisk ved scroll.

### CI-kjøring
- Kjør e2e-tester i pipeline ved pull requests og før deploy.
- Publiser testresultater og screenshots/trace ved feil for rask feilsøking.

## 10. Deployment til Hetzner (hcloud-cli + systemd)

Deployment skal kjøre PocketBase-tjenesten på en Hetzner-server og utføres i denne rekkefølgen:

1. Opprette server med hcloud-cli og skrive server-IP til `server.txt`
```
hcloud server create --name tidtaker-prod --type cpx11 --image ubuntu-24.04 --ssh-key default
hcloud server ip tidtaker-prod > server.txt
```

2. Initielt serveroppsett (engangsoppsett)
```
SERVER_IP=$(cat server.txt)
ssh root@"${SERVER_IP}" "apt update && apt install -y ca-certificates curl && \
useradd --system --home /opt/tidtaker --shell /usr/sbin/nologin tidtaker || true && \
mkdir -p /opt/tidtaker/releases /opt/tidtaker/data && \
chown -R tidtaker:tidtaker /opt/tidtaker"
```

3. Kompilere applikasjonen lokalt med versjon i binærnavnet
```
VERSION="1.2.3"
GOOS=linux GOARCH=amd64 go build -o "dist/tidtaker-${VERSION}" .
```

4. Kopiere over applikasjonen kun hvis versjonen ikke finnes fra før
```
SERVER_IP=$(cat server.txt)
VERSION="1.2.3"
ssh root@"${SERVER_IP}" "test -f /opt/tidtaker/releases/tidtaker-${VERSION}" || \
scp "dist/tidtaker-${VERSION}" root@"${SERVER_IP}":/opt/tidtaker/releases/
```

5. Legge til systemd-konfigurasjon for aktuell versjon
```
# /etc/systemd/system/tidtaker-1.2.3.service
[Unit]
Description=Tidtaker PocketBase 1.2.3
After=network.target

[Service]
Type=simple
WorkingDirectory=/opt/tidtaker
ExecStart=/opt/tidtaker/releases/tidtaker-1.2.3 serve --http=0.0.0.0:8090
Restart=always
RestartSec=3
User=tidtaker

[Install]
WantedBy=multi-user.target
```

6. Stoppe forrige versjoner av applikasjonen
```
systemctl list-units --type=service --all 'tidtaker-*.service'
systemctl stop tidtaker-OLD_VERSION.service
systemctl disable tidtaker-OLD_VERSION.service
```

7. Starte nåværende versjon av applikasjonen
```
systemctl daemon-reload
systemctl enable tidtaker-1.2.3.service
systemctl start tidtaker-1.2.3.service
systemctl status tidtaker-1.2.3.service
```

Anbefalt katalogstruktur på server:
```
/opt/tidtaker/
├── releases/
│   ├── tidtaker-1.2.2
│   └── tidtaker-1.2.3
└── data/
```

## 11. Implementerings-rekkefølge

1. [x] Setup - PocketBase og HTMX prosjekt
2. [x] Database schema - lag collections
3. [x] Register-side
4. [x] Login-side
5. [x] Timer-side med start/stopp
6. [x] Beskrivelse og tags
7. [x] Edit tider
8. [x] List og infinite scroll
9. [x] Søk-funksjonalitet
10. [x] Filter og sortering
11. [ ] Dokumentasjon

---

**Status:** Implementering ferdig, dokumentasjon gjenstår
