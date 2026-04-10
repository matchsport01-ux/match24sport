# 🤖 Setup Abbonamento Android - Google Play Console

## STEP 1: Crea l'Abbonamento

1. **Google Play Console** → https://play.google.com/console
2. Login: `matchsport01@gmail.com`
3. Seleziona app **Match Sport 24**
4. Menu sinistra → **Monetize** → **Subscriptions**
5. Clicca **"Create subscription"**

### Dati da inserire:

| Campo | Valore |
|-------|--------|
| **Product ID** | `com.matchsport24.subscription.monthly.v2` |
| **Name** | Abbonamento Mensile |
| **Description** | Accesso completo alla piattaforma Match Sport 24 per gestire il tuo circolo sportivo |
| **Billing period** | 1 month |
| **Grace period** | 7 days (consigliato) |
| **Resubscribe** | Enabled |

---

## STEP 2: Aggiungi Base Plan e Offer

1. Dopo aver creato la subscription, clicca su di essa
2. Clicca **"Add base plan"**
3. Configura:
   - **Base plan ID**: `monthly-base`
   - **Renewal type**: Auto-renewing
   - **Price**: €49,99 (seleziona Italia/EUR)
   - Clicca **"Set prices"** → Seleziona tutti i paesi → **"Update"**

4. Clicca **"Activate"** sul base plan

---

## STEP 3: Pubblica le Modifiche

1. Torna alla lista subscriptions
2. Verifica che lo stato sia **"Active"**
3. Se è in "Draft", clicca **"Activate"**

---

## STEP 4: Configura Licensing Testing

Per testare SENZA pagare:

1. **Google Play Console** → **Setup** → **License testing**
2. Aggiungi le email dei tester (es: `matchsport01@gmail.com`)
3. **License response**: Set to "RESPOND_NORMALLY" for testing

---

## STEP 5: Backend Validation (Opzionale ma Consigliato)

Per validare gli acquisti lato server, serve una **Service Account**:

1. **Google Cloud Console** → https://console.cloud.google.com
2. Crea progetto o seleziona esistente
3. **IAM & Admin** → **Service Accounts** → **Create**
4. Nome: `play-billing-validator`
5. Ruolo: **Pub/Sub Admin** (per notifiche)
6. Scarica JSON key

7. **Google Play Console** → **Setup** → **API access**
8. Link il progetto Google Cloud
9. Aggiungi la Service Account con permesso **"View financial data"**

---

## ⚠️ IMPORTANTE

- Il **Product ID** DEVE essere identico a quello iOS: `com.matchsport24.subscription.monthly.v2`
- L'abbonamento deve essere **"Active"** prima di pubblicare l'app
- Per testare, l'email deve essere in **License testing**

---

## 🔍 Verifica nel Codice

Il Product ID è già configurato in `/app/frontend/src/hooks/useSubscription.ts`:

```typescript
export const PRODUCT_IDS = {
  MONTHLY: 'com.matchsport24.subscription.monthly.v2',
};
```

Il codice `expo-iap` gestisce automaticamente sia iOS (StoreKit) che Android (Google Play Billing).
