# ISTRUZIONI APP STORE CONNECT - Match Sport 24

## ⚠️ TUTTI I PROBLEMI SONO SU APP STORE CONNECT, NON NEL CODICE!

---

## 🔴 PROBLEMA 1: EULA nella Descrizione App (Guideline 3.1.2(c))

### PASSI DA SEGUIRE:
1. Vai su **App Store Connect** → **Match Sport 24** → **App Information**
2. Scorri fino a **App Store** → **Description** (Descrizione)
3. **AGGIUNGI alla FINE della descrizione:**

```
---
TERMINI E CONDIZIONI:
• Privacy Policy: https://matchsport24.com/privacy
• Termini di Utilizzo (EULA): https://www.apple.com/legal/internet-services/itunes/dev/stdeula/

L'abbonamento mensile costa €49.99/mese e si rinnova automaticamente. Puoi annullare in qualsiasi momento dalle impostazioni del tuo account App Store.
```

---

## 🔴 PROBLEMA 2: IAP Non Trovato (Guideline 2.1(b))

### PASSI DA SEGUIRE:
1. Vai su **App Store Connect** → **Match Sport 24** → La build in review
2. Scorri fino a **App Review Information**
3. Nel campo **Notes** (Note per i Reviewer), SCRIVI:

```
COME TROVARE L'ABBONAMENTO IN-APP:

1. Aprire l'app Match Sport 24
2. Effettuare il login con le credenziali fornite (o creare un nuovo account club)
3. Dalla schermata principale, toccare l'icona del profilo (in basso a destra nella tab bar)
4. Toccare "Il mio circolo" 
5. Toccare "Abbonamento Premium" 
6. La schermata di abbonamento mostra il piano "Abbonamento Mensile" a €49.99/mese
7. Toccare "Abbonati ora" per avviare l'acquisto StoreKit

CREDENZIALI TEST CIRCOLO:
Email: test@club.com
Password: Test123!

L'In-App Purchase "Abbonamento Mensile" (com.matchsport24.subscription.monthly.v2) è configurato correttamente nel sandbox di App Store Connect.
```

---

## 🔴 PROBLEMA 3: Immagine Promozionale IAP Vuota (Guideline 2.3.2)

### PASSI DA SEGUIRE:
1. Vai su **App Store Connect** → **Monetization** → **In-App Purchases**
2. Seleziona **Abbonamento Mensile** (com.matchsport24.subscription.monthly.v2)
3. Scorri fino a **Promotional Image**
4. **CARICA un'immagine** 1024x1024 pixel che mostri:
   - Il logo di Match Sport 24
   - Il testo "Premium €49.99/mese"
   - Colori app (verde #10B981 su sfondo scuro #0F172A)

### ESEMPIO DI COSA DEVE MOSTRARE L'IMMAGINE:
- NON deve essere vuota
- NON deve essere solo il logo
- DEVE rappresentare l'abbonamento (es: "Premium Mensile", icone features, prezzo)

---

## 🔴 PROBLEMA 4: App Duplicata/Spam (Guideline 4.3(a))

### PROBLEMA:
Apple dice che hai un'altra app identica disponibile negli stessi paesi.

### PASSI DA SEGUIRE:
1. Vai su **App Store Connect** → **My Apps** 
2. Trova L'ALTRA APP (quella vecchia/duplicata)
3. Vai su **Pricing and Availability**
4. Sotto **Country or Region Availability**, seleziona **"None"**
5. Poi seleziona SOLO i paesi dove vuoi quella vecchia app (DIVERSI da Match Sport 24)

### OPPURE (se vuoi mantenere solo Match Sport 24):
1. Rimuovi completamente l'altra app dalla vendita
2. Vai su **App Store Connect** → **L'altra app** → **Remove from Sale**

---

## ✅ DOPO AVER FATTO TUTTO:

1. **Salva** tutte le modifiche in App Store Connect
2. **Rispondi** al messaggio di Apple in App Store Connect con:

```
Gentile Team di Review,

Ho corretto tutti i problemi segnalati:

1. EULA (3.1.2(c)): Ho aggiunto i link a Privacy Policy e Termini di Utilizzo (Apple Standard EULA) nella descrizione dell'app su App Store.

2. IAP Non Trovato (2.1(b)): L'abbonamento si trova seguendo questo percorso:
   - Profilo → Il mio circolo → Abbonamento Premium
   - Ho fornito credenziali test nelle Note per i Reviewer

3. Immagine Promozionale (2.3.2): Ho caricato una nuova immagine promozionale per l'In-App Purchase che rappresenta correttamente l'abbonamento mensile.

4. App Duplicata (4.3(a)): Ho limitato la disponibilità geografica per evitare sovrapposizione con altre app.

Grazie per la vostra pazienza.
```

3. **Re-submit** la build per review

---

## 📞 SE HAI BISOGNO DI AIUTO

Questi sono tutti problemi di CONFIGURAZIONE su App Store Connect, non problemi di codice.
Il codice dell'app è già compliant con tutte le guideline Apple.
