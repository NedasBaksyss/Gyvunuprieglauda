# Gyvūnų prieglauda

React ir Express internetinė programa pagal pateiktus viešosios bei administravimo dalių maketus. Duomenys saugomi SQLite faile.

## Dabartinis etapas

**1 etapas – projekto pagrindas.** Paruošta React programa, Express serveris, SQLite lentelės, kūrimo ir surinkimo komandos, API bei duomenų vientisumo testai. Pradinis puslapis yra laikinas vizualinis pagrindas; gyvūnų katalogas, prisijungimas, administravimas ir įkėlimas bus įgyvendinti kitais etapais.

Po kiekvieno etapo darbas sustabdomas ir pateikiama penkių žodžių commit žinutė. Tęsiama tik vartotojui padarius commit. Automatiniai commit neatliekami.

## Paleidimas

Reikia **Node.js 24 arba naujesnio** ir npm. Komandas vykdykite projekto šakniniame aplanke. Windows PowerShell naudokite `npm.cmd`, jeigu vykdymo politika blokuoja `npm.ps1`.

```powershell
npm.cmd install
npm.cmd run dev
```

- React: http://127.0.0.1:5173
- Express būsenos API: http://127.0.0.1:3001/api/health
- Vite persiunčia `/api` ir `/uploads` užklausas Express serveriui.
- Sustabdymas: `Ctrl+C`.

Nustatymus galima pakeisti nukopijavus `.env.example` į `.env`. Šis žingsnis neprivalomas. Pakeitus nustatymus reikia perkrauti kūrimo procesus. SQLite failas automatiškai sukuriamas `server/data/shelter.sqlite`; jis neįtraukiamas į Git.

Patikrinimas ir surinkta programa:

```powershell
npm.cmd test
npm.cmd run build
npm.cmd start
```

Po surinkimo Express pateikia React programą adresu http://127.0.0.1:3001. Atnaujinus frontend kodą reikia pakartoti `build` ir paleisti serverį iš naujo. Atskiro SQLite serverio diegti nereikia.

## Struktūra

```text
client/
  src/              React komponentai ir stiliai
  public/           Statiniai ištekliai
server/
  src/database/     SQLite atidarymas ir lentelių schema
  src/app.js        Express programa
  src/index.js      Serverio paleidimas
  data/             Vietinė duomenų bazė (ignoruojama Git)
  uploads/          Būsimų įkeliamų nuotraukų vieta (ignoruojama Git)
  test/             API ir duomenų bazės testai
```

## Duomenų modelis ir numatytos teisės

Trys pagrindiniai CRUD objektai: **gyvūnai**, **gyvūnų rūšys**, **priglaudimo užklausos**. Papildoma `users` lentelė skirta sistemos naudotojams.

| Objektas | Ryšiai ir paskirtis |
| --- | --- |
| `species` | Rūšies pavadinimas; viena rūšis turi daug gyvūnų. |
| `animals` | Rūšis, vardas, amžius mėnesiais, dydis, aprašymas, būsena, nuotraukos kelias. |
| `inquiries` | Gyvūnas, besikreipiančiojo vardas, el. paštas, žinutė, būsena. |
| `users` | Vardas, el. paštas, slaptažodžio maiša, vaidmuo, aktyvumas. |

Susijusius įrašus saugo išoriniai raktai: naudojamos rūšies negalima ištrinti, o gyvūno negalima ištrinti, kol yra su juo susietų užklausų. Amžius saugomas mėnesiais, kad būtų galima tiksliai nurodyti ir jauniklių amžių. Datos saugomos UTC.

| Vaidmuo | Planuojamos teisės |
| --- | --- |
| Lankytojas | Peržiūrėti gyvūnus ir pateikti priglaudimo užklausą. |
| Darbuotojas | Tvarkyti gyvūnus, nuotraukas ir užklausas. |
| Administratorius | Darbuotojo teisės ir rūšių bei naudotojų valdymas. |

Teisių tikrinimas bus įgyvendintas serveryje; šiuo etapu valdymo API dar nėra.

## Įgyvendinimo etapai

1. Projekto struktūra, React, Express, SQLite ir paleidimas.
2. Duomenų pavyzdžiai, viešas katalogas, filtrai ir gyvūno puslapis pagal maketus.
3. Prisijungimas, sesijos, vaidmenys ir administravimo karkasas.
4. Gyvūnų CRUD, validacija ir saugus nuotraukų įkėlimas.
5. Rūšių CRUD ir administratoriaus naudotojų valdymas.
6. Vieša užklausos forma ir užklausų CRUD administravime.
7. Apžvalgos statistika, galutinė dizaino patikra, teisių ir visos eigos testavimas.

Technologijų dokumentacija: [Vite](https://vite.dev/guide/), [Express](https://expressjs.com/), [Node.js SQLite](https://nodejs.org/api/sqlite.html).
