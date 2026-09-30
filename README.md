# Sleppy Esports WhatsApp Bot — Node.js

Node.js/Express + PostgreSQL WhatsApp Cloud API backend for Sleppy Esports.

## Included
- WhatsApp Cloud API webhook verification + HMAC validation
- Player registration/profile
- IDP creation and WhatsApp JOINED button
- Attendance: JOINED / ON LEAVE / NO RESPONSE / MISSED
- Leave: pending/approved/rejected/revoked
- Mandatory replacement player
- Substitute activation/suspension and notifications
- Automatic/manual leave approval setting
- Match result entry + exact placement/finish scoring
- Official PT storage/current PT endpoint
- Match history and player stats
- Scrim/tournament records
- Broadcast API
- Audit logs
- Reminder scheduler
- Basic responsive admin dashboard
- Docker/DockHosting-ready startup

## Run locally
1. Copy `.env.example` to `.env`.
2. Set PostgreSQL and Meta credentials.
3. Run `npm install`.
4. Run `npm run db:init`.
5. Run `npm start`.

## WhatsApp webhook
Set Meta callback URL to:
`https://YOUR-DOMAIN/webhook/whatsapp`

Verify token must equal `WEBHOOK_VERIFY_TOKEN`.

Do not put the Meta access token in source code or send it to anyone.

## Important
The app is designed for the official WhatsApp Cloud API. It does not automate WhatsApp Web or use unofficial WhatsApp clients.

Production deployment still requires testing with your actual Meta phone number, WABA, PostgreSQL database, webhook URL and credentials.
