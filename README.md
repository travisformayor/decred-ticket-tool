# Decred Ticket Tool

Get stats and information on your Decred ticket staking history

<https://travisformayor.github.io/decred-ticket-tool/>

## Decred Tickets Overview

The cryptocurrency Decred uses a ticket buying system for public voting on proposals and consensus changes, as part of its decentralized governance. Tickets resolve into votes overtime, refunding the original cost. Participants (or stakeholders/stakers) who don't want to leave their wallets online need to know when it's time to re-buy any tickets. Additionally, there is a small reward for locking up (or staking) decred into these tickets. An active stakeholder who is re-buying tickets frequently can earn a higher return and participate in more votes.

## Decred Ticket Tool Overview

![Screenshot](/img/tickettoolscreen.png)

Decred Ticket Tool is a javascript application that parses Decred Block Explorer ticket address information. It can pull a user's ticket activity, show the current staking status, and perform current and annualized ROI estimates. It works using public information, so the user can follow their tickets without needing to log into their wallet application.

## Additional Notes

- You can find your ticket address in the Decrediton wallet in the tickets tab, by the pool info. Example:

![Screenshot](/img/decrediton-example.png)

- Decred Ticket Tool doesn't work for any ticket addresses with over 8,000 transactions
- ROI is an estimate that only works for accounts that fit a certain assumption: that the funds being staked have not changed substantially over time (unless that change was from staking rewards, which is taken into account). Outside of that, there is no easy way to tell if a ticket was bought with new money or refunded money.
