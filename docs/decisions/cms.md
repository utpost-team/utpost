# Beslutsdokument: CMS

*Ett av teamets beslutsdokument. Skrivs i M9. Högst en sida. Ni ska inte utvärdera marknaden, ni ska kunna försvara valet: varför det här räcker för Utpost, vad ni valde bort, och vad som hade fått er att byta.*

**Datum:**
**Beslut:** *(en eller två meningar: vilket innehåll bor i CMS:et, vilket CMS, och vad ligger kvar i databasen?)*

## Bakgrund
*Skuld 10: redaktionens innehåll låg som `body_html` i Postgres och sattes in med `v-html`. Redaktörerna mejlade ändringar till utvecklarna. Två meningar om vad det kostade, med ett exempel ur er egen kod.*

## Innehållsmodellen
*Era innehållstyper och fält. Fälten ska säga vad innehållet är, inte hur det ser ut.*

| Innehållstyp | Fält | Typ | Varför ett eget fält |
|---|---|---|---|
| | | | |

*Vad är innehåll och vad är data? Vilka fält ligger kvar i Postgres (till exempel längd och svårighetsgrad), och hur hittar API:et rätt post i CMS:et?*

## Alternativ
*Kursens val och ett alternativ ni valde bort. Det bortvalda ska vara ett riktigt alternativ: ett annat headless CMS, ett som ni driftar själva, eller Markdown i repot.*

| | Det vi valde | Det vi valde bort |
|---|---|---|
| Vad det är | | |
| Vem kan redigera, och hur | | |
| Utkast och förhandsgranskning | | |
| Vad det kostar oss (pengar, drift, inlåsning) | | |

## Motivering
*Varför räcker valet för Utpost just nu? Knyt till vem som redigerar och hur ofta.*

## Vad som hade fått oss att byta
*En eller två konkreta saker: en gräns i gratisnivån, ett krav från redaktionen, en lansering i ett land till.*

## Konsekvenser
*Vad händer när CMS:et är nere? Hur länge dröjer en publicering innan den syns, och varför? Vad i koden måste skrivas om den dag ni byter CMS?*
