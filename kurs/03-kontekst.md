# Kontekst
Når du får dårlige resultat fra KI-modellen er det ofte fordi den mangler informasjonen den trenger for å svare deg i treningssettet sitt, at den ikke klarer selv å finne det i kodebasen du står i eller at det finnes mange måter å svare på. Da kan vi med hjelpe og styre modellen inn i riktig spor, ved å gi ekstra instruksjoner om hvor modellen kan finne informasjonen.

## Oppgave: Legge til kontekst fra fil
Du så kanskje at KI-modellen leste README.md-filen til tidtaker når du ba om introduksjon? For noen instrukser, vil den starte å lete etter filer selv. Dersom du allerede vet hva den trenger, kan en like godt sende med den aktuelle filen som kontekst.

1. Åpne filen [timing_item.html](../tidtaker/templates/timer/timing_item.html)
2. Start en ny chat.
3. I chaten, trykk på filen slik at den legges med i kontekst. Når filen er med, skal den være i vanlig tekst, kursiv _timing_item.html_ er kun navnet og ikke innholdet med.
4. Gi denne instruksen

> Hva slags templating er dette? Gi meg en konsis instruks for de vanligste tingene en kan gjøre med templatingen. Skriv svaret her og samtidig til tidtaker/templating.md.

## Oppgave: Legg til deler av fil
1. Merk linje 8 i filen [timing_item.html](../tidtaker/templates/timer/timing_item.html): `{{if .Timing.GetBool "isActive"}}`
2. Legg merke til at linjen allerede er lag til som kontekst, som `timing_item.html:8`.
3. Gi denne instruksen:

> Hvor kommer verdien i fra? Skriv svaret her og samtidig utvid tidtaker/templating.md med eksempelet.

Merking av bestemte områder som er interessant hjelper modellen å holde fokus på det du lurer på og kan spare deg for en del kopiering, men ofte fungerer det å legge med hele filen også så lenge en klarer å beskrive hva en ønsker svar på. Mindre vedlegg gir også bedre ytelse og mindre kostnad, mer om det senere.

## Oppgave: Legg til kontekst fra internett
En vanlig feil KI-modellen gjør er å bruke gammel informasjon. Her har typisk modellen en cutoff for informasjonen sin, altså tidspunktet for data modellen var trent på.

Prøv disse to og se om du får ulike resultat:

> Gi meg URL til dokumentasjonen for pakken html/template, inklusive versjonsnummeret. Skriv svaret her og samtidig utvid tidtaker/templating.md med lenken.

> Gi meg URL til dokumentasjonen for pakken html/template, inklusive versjonsnummeret. Finn siste versjon via internett. Skriv svaret her og samtidig utvid tidtaker/templating.md med lenken.

Legg merke til tre ting:
1. Første spørsmål henter selv versjonsnummer lokalt fra go.mod-filen.
2. Vi trenger ikke trenger å spesifisere hvordan modellen skal hente versjonen fra internett.
3. Vi må godta at KI-modellen bruker internett for å hente ekstra informasjon. Hvorfor er det slik?

## Oppgave: Lagre resultatene dine for scoreboard
```shell
git add tidtaker/templating.md
git commit -m "legge til kontekst"
git push
```

Neste steg er [04-agenter.md](04-agenter.md).

