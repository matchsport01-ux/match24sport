# 🔴 PROBLEMI APPLE REVIEW - SOLUZIONI

## Problema 1: IAP Non Funziona (Guideline 2.1(b))

### CAUSA:
Lo stato dell'abbonamento su App Store Connect è **"Richiesto intervento dello sviluppatore"**.
Questo significa che l'IAP NON è attivo nel sandbox di Apple.

### SOLUZIONE (App Store Connect):

1. **Vai su App Store Connect** → **Match Sport 24** → **Abbonamenti**

2. **Clicca sull'abbonamento "Mensile"** (com.matchsport24.subscription.monthly.v2)

3. **Verifica che TUTTI questi campi siano compilati:**
   - ✅ Nome di riferimento: "Mensile"
   - ✅ ID prodotto: "com.matchsport24.subscription.monthly.v2"
   - ✅ Durata: 1 mese
   - ✅ Prezzo: €49,99 (o equivalente)
   - ✅ Localizzazioni (ITALIANO + INGLESE):
     - Nome visualizzato: "Abbonamento Mensile" / "Monthly Subscription"
     - Descrizione: "Accesso completo alla piattaforma per 1 mese" / "Full platform access for 1 month"
   - ✅ Screenshot per la verifica (OBBLIGATORIO)
   - ✅ Note di verifica

4. **IMPORTANTE**: Clicca **"Invia per la verifica"** sull'abbonamento

5. **Quando invii una nuova build**, seleziona l'IAP nella sezione "Acquisti in-app e abbonamenti" della versione

---

## Problema 2: EULA in English (Guideline 3.1.2(c))

### CAUSA:
Manca il link EULA nella descrizione INGLESE dell'app.

### SOLUZIONE (App Store Connect):

1. **Vai su App Store Connect** → **Match Sport 24** → **App Information**

2. **Cambia lingua a "English"** (in alto a destra)

3. **Nella Description (Descrizione) INGLESE, aggiungi alla fine:**

```
---
TERMS AND CONDITIONS:
• Privacy Policy: https://matchsport24.com/privacy
• Terms of Use (EULA): https://www.apple.com/legal/internet-services/itunes/dev/stdeula/

The monthly subscription costs €49.99/month and renews automatically. You can cancel anytime from your App Store account settings.
```

4. **Salva**

---

## Problema 3: Paid Apps Agreement

### VERIFICA:
1. Vai su **App Store Connect** → **Business** (in basso a sinistra)
2. Verifica che il **"Paid Apps Agreement"** sia **ATTIVO** (non scaduto)
3. Se non è attivo, firma il contratto

---

## CHECKLIST FINALE PRIMA DI RE-SUBMIT:

- [ ] IAP "Mensile" ha stato "Pronto per l'invio" o "In attesa di verifica"
- [ ] IAP ha localizzazioni in ITALIANO e INGLESE
- [ ] IAP ha screenshot allegato
- [ ] Descrizione app INGLESE contiene link EULA
- [ ] Descrizione app ITALIANA contiene link EULA
- [ ] Paid Apps Agreement è attivo
- [ ] Quando crei la nuova build, seleziona l'IAP da includere

---

## RISPOSTA DA INVIARE AD APPLE:

```
Dear App Review Team,

Thank you for your feedback. I have addressed all issues:

1. IAP Issue (2.1(b)): 
   - The In-App Purchase "Abbonamento Mensile" (com.matchsport24.subscription.monthly.v2) has been fully configured
   - Added all required localizations (Italian + English)
   - Added review screenshot
   - Submitted the IAP for review with the new app build
   - Verified the Paid Apps Agreement is active

2. EULA Issue (3.1.2(c)):
   - Added Terms of Use (Apple Standard EULA) link to the English app description
   - Link: https://www.apple.com/legal/internet-services/itunes/dev/stdeula/

How to find the subscription:
1. Login as a club (Email: matchsport01@gmail.com / Password: AppleReview2024!)
2. Go to "Impostazioni" tab
3. Tap "Abbonamento"
4. Tap "Abbonati ora"

Thank you for your patience.
Best regards
```
