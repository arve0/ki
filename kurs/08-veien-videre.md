# Gode AFK resultat
Nå "koker" agenten vår med den nye funksjonaliteten, og vi kan ta en kaffe, jobbe med noe annet eller gå hjem. Det vi ønsker å optimalisere i dette steget er at når agenten er ferdig, så skal resulatet være bra. Vi har allerede gjort noen grep her, ved å lage [AGENTS.md](../AGENTS.md).

Her er noen ting jeg bruker å tenke på:

1. Bruker jeg en agent som for lov å jobbe lenge, uten å bli avbrutt? Chat: nei, CLI: ja.
2. Kan agenten kjøre kommandoer uten å be om lov? `--yolo` i en sandboks.
3. Vet agenten hvordan det skal verifiseres? Har en instruks om hvordan det verifiseres.
4. Kunne jeg gitt ytterligere instrukser, slik at agenten gjør mest mulig arbeid? Kan den også kjøre sikkerhetsvurdering, benchmark, forberede en commit-melding, foreslå arbeid videre, osv.

For denne planen, tipper jeg at det ikke fungerer ut av boksen. Det er fordi vi har ikke laget noe oppsett for at agenten kan sjekke selv om det fungerer. Du kan nå velge om du chatter videre, for å korrigere:

> når jeg gjør x, så skjer det ingenting, kan du finne feilen og korrigere?

...eller starte på en ny chat for å utforske hvordan det kan testes:

> er det mulig å teste chrome plugins med playwright?

Akkurat her er det vanskelig på grunn av at jeg ikke ønsker å dele innloggingen med AI, men en kan kanskje gjøre noe som dette?

> kan du lage meg et playwright-script jeg kan kjøre for å holde sesjonen i auth.json aktivt, slik at jeg ikke blir logget ut?

Dette er hva jeg bruker mest hjernekapasitet på nå, hvordan kan jeg hjelpe agenten til å verifisere sitt eget arbeid.

# Problemer med kontekst

# Kostnad og ytelse

# Kjøre modeller lokalt
