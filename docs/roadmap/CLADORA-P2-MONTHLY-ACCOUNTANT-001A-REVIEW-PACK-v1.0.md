# CLADORA-P2-MONTHLY-ACCOUNTANT-001A — Pachet de revizuire contabilă v1.0

**Scop:** revizuirea independentă a ciclului lunar canonic CLADORA pentru o asociație de proprietari din România  
**Date:** exclusiv date sintetice  
**Statut:** model pregătit pentru revizuire; nu reprezintă acceptare, certificare, audit sau consultanță juridică/fiscală  
**Bază tehnică:** `ontripai/cladora-website@615e6bd8e23e89031524ae02d71e4634ad01421d`

## 1. Mandatul expertului contabil

Expertul independent este rugat să evalueze dacă pachetul lunar sintetic este inteligibil, trasabil și utilizabil operațional de o asociație de proprietari din România. Revizuirea trebuie să identifice explicit orice abatere, ambiguitate, tratament dependent de politica asociației sau concluzie care necesită verificare juridică ori fiscală separată.

Acceptarea nu transformă CLADORA într-un auditor, contabil, prestator de plăți sau autoritate fiscală și nu autorizează folosirea datelor reale.

## 2. Referințe oficiale de verificat de expert

- [Legea nr. 196/2018 — forma consolidată, Portal Legislativ](https://legislatie.just.ro/Public/DetaliiDocument/305357), inclusiv regulile aplicabile asociațiilor de proprietari, listelor de plată, fondurilor, organelor de conducere și controlului financiar.
- [Ordinul MFP nr. 3.103/2017 — forma consolidată, Portal Legislativ](https://legislatie.just.ro/Public/DetaliiDocument/206477), în special reglementările pentru persoanele juridice fără scop patrimonial și contabilitatea asociațiilor de proprietari.
- [Legea contabilității nr. 82/1991 — Portal Legislativ](https://legislatie.just.ro/Public/DetaliiDocument/1496), pentru documente justificative, registre, răspundere și păstrarea evidențelor.

Referințele au fost consultate la 14 septembrie 2026. Expertul trebuie să confirme forma legală și aplicabilitatea efectivă la data semnării; simpla includere a unui act normativ în acest pachet nu constituie opinie juridică.

## 3. Pachetul sintetic solicitat

| Cod | Element | Criteriu minim |
| --- | --- | --- |
| `A01` | Fișa asociației, imobilului și perioadei | identificatori sintetici, RON, perioadă deschisă inițial |
| `A02` | Documente-sursă | furnizori, facturi, citiri și hash-uri de proveniență |
| `A03` | Reguli și execuție de repartizare | bază, metodă, cantități, rotunjiri și totaluri |
| `A04` | Lista lunară pe unități | obligații individuale și total agregat, fără expunere inter-unită neautorizată |
| `A05` | Creanțe și încasări | sold inițial, debit, plată/alocare și sold final |
| `A06` | Jurnal și balanță de verificare | debit = credit; solduri explicabile și trasabile |
| `A07` | Paritate GL/subledger | creanțe și plăți nealocate comparate cu conturile canonice |
| `A08` | Revizuire președinte/cenzor | autori independenți, AAL2 și ordine temporală verificabilă |
| `A09` | Publicare | snapshot și SHA-256 imuabile, legate de versiunea aprobată |
| `A10` | Închidere perioadă | diferență zero, excepții rezolvate și blocarea modificărilor retroactive |
| `A11` | Exporturi românești | balanță, listă lunară și probe suport în PDF/XLSX/CSV |
| `A12` | Jurnal de audit | cine, ce, când, motiv și rezultat, fără secrete sau date inutile |

Exporturile pot fi livrate expertului numai printr-un canal autorizat. Până la activarea unui scanner aprobat, artefactele din vault rămân `scanning_pending` și descărcarea autoritativă rămâne blocată. Pentru această revizuire poate fi folosit un set sintetic generat într-un mediu controlat, marcat clar `NON-PRODUCTION / SYNTHETIC`.

## 4. Procedura de revizuire

1. Confirmați identitatea, independența și limitele mandatului expertului.
2. Confirmați regimul contabil aplicabil asociației-model și politicile contabile presupuse.
3. Urmăriți cel puțin două cheltuieli și o citire de contor de la documentul-sursă până la lista pe unitate și balanță.
4. Recalculați independent o repartizare și toate rotunjirile aferente.
5. Reconciliați totalul listei, creanțele, plățile/alocările, jurnalul și balanța.
6. Verificați separarea fondurilor și tratamentul soldurilor reportate.
7. Verificați rolurile și succesiunea creare → revizuire → publicare → închidere.
8. Examinați lizibilitatea denumirilor, datelor, monedei, semnelor debit/credit și explicațiilor în limba română.
9. Înregistrați fiecare constatare în registrul din matrice; nu acceptați excepții tacite.
10. Completați formularul de decizie fără a modifica probele evaluate.

## 5. Regula deciziei

- `ACCEPTAT`: toate criteriile obligatorii sunt satisfăcute și nu există constatări Critical/High sau corecții contabile nerezolvate.
- `ACCEPTAT CU OBSERVAȚII`: numai observații non-blocante, fiecare cu proprietar și termen; acest verdict nu închide automat Stage 2 fără aprobarea Product Governance.
- `CORECȚII NECESARE`: una sau mai multe deficiențe contabile, de prezentare ori trasabilitate trebuie remediate și reevaluate.
- `BLOCAT`: probe insuficiente, regim contabil neclar, diferență nereconciliată, problemă de integritate/confidențialitate sau imposibilitatea unei concluzii independente.

## 6. Limite obligatorii

- Nicio casetă de acceptare nu este precompletată.
- Nicio semnătură, calitate profesională sau concluzie a expertului nu este simulată.
- Pachetul nu afirmă conformitate SAF-T/D406, depunere fiscală, audit statutar ori conformitate legală completă.
- Orice defect de produs identificat intră într-un task separat; o migrare este permisă numai după discovery și autorizare distinctă.
- Datele reale, aplicarea în Supabase, activarea furnizorilor și închiderea Stage 2 necesită aprobări separate.

## 7. Verdict de pregătire

`READY-FOR-INDEPENDENT-ROMANIAN-ACCOUNTANT-REVIEW`

