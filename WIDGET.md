# iOS home-screen widget (Scriptable)

iOS ondersteunt geen widgets vanuit een webapp/PWA. Deze opzet omzeilt dat: een
beveiligd data-eindpunt (`netlify/functions/widget`) levert je taken/routines +
agenda van vandaag als JSON, en de Scriptable-app tekent daarmee een echte
home-screen widget.

## 1. Netlify env-var instellen
Site settings → Environment variables → toevoegen:

| Naam | Waarde |
|------|--------|
| `WIDGET_TOKEN` | een lange willekeurige string (bv. via een wachtwoordgenerator) |
| `WIDGET_USER_EMAIL` | *(optioneel)* je inlog-mail; default is de admin-mail |

`SUPABASE_URL` en `SUPABASE_SERVICE_KEY` bestaan al voor de andere functions.
Daarna één keer opnieuw deployen (push of "Trigger deploy").

## 2. Eindpunt testen
Open in de browser:
```
https://JOUW-SITE.netlify.app/.netlify/functions/widget?token=JE_TOKEN
```
Je hoort JSON te zien met `date`, `items`, `overdue`, enz. (401 = verkeerde token.)

## 3. Scriptable instellen
1. Installeer **Scriptable** (gratis, App Store).
2. Nieuw script → plak de inhoud van [`widget-scriptable.js`](widget-scriptable.js).
3. Vul bovenin `BASE`, `TOKEN` en `APP_URL` in.
4. Beginscherm → widget toevoegen → **Scriptable** (medium) → kies dit script.

## Wat de widget toont
Agenda-events, routines (met streak-voortgang) en taken van vandaag, plus een
"te laat"-teller. Tikken opent de webapp.

## Beperkingen
- iOS ververst widgets op eigen ritme (paar keer per uur), geen live-updates.
- Magister/SOMtoday-lessen zitten niet in Supabase en staan dus niet in de widget
  (alleen agenda-events die je in de app zelf hebt gemaakt).
- Afvinken kan niet vanuit de widget; tik erop om de app te openen.
