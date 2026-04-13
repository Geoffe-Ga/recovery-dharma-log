# rd-log

A free, open-source meeting log and sangha companion for
[Recovery Dharma](https://recoverydharma.org/) groups.

> _"Recovery Dharma is a peer-led movement and community that is unified by
> our trust in the potential of each of us to recover and find freedom from
> the suffering of addiction."_
> — [Recovery Dharma](https://recoverydharma.org/about/)

## About

**rd-log** helps Recovery Dharma sanghas track the simple, practical things
that keep a meeting healthy: attendance, rotating speakers and topics, where
the group is in the Recovery Dharma book, meeting activity, and group
settings. It is designed to be used by the person opening the meeting, shared
by the whole sangha, and easy enough that it stays out of the way of the
practice itself.

> **Not affiliated with Recovery Dharma Global.** This project is not
> operated, endorsed, sponsored, reviewed, or maintained by Recovery Dharma
> Global (RDG), its Board of Directors, or any local sangha. It is an
> independent, community-built tool offered by a single practitioner in the
> spirit of Dana to any sangha that finds it useful. "Recovery Dharma" is
> referenced here only to describe the tradition this tool is built to
> serve; no official relationship is claimed or implied.

## Dana — An Offering in Gratitude

The hosted instance of rd-log is maintained and paid for by
**Geoff Gallinger** as his personal **Dana** (generosity) to the Recovery
Dharma community, in gratitude for the merit he has received from the
practice and the sangha. Using the hosted instance is and will remain free.

Dana — the first of the paramitas — is the practice of giving freely without
expectation of return. In Recovery Dharma, the tradition of passing the dana
basket at meetings sustains the sangha; this project is offered in that same
spirit. If you wish to practice dana in return, the most meaningful way is to
[support Recovery Dharma Global](https://recoverydharma.org/) or your local
sangha directly — not this project.

## Free and Open Source

rd-log is released under the [MIT License](./LICENSE). You are free to:

- Use the hosted instance at no cost
- Self-host your own instance for your sangha
- Fork, modify, and adapt the code for your community's needs
- Contribute improvements back so other sanghas benefit

Openness suits Recovery Dharma's values. The Dharma is freely shared; so is
this code.

## Features

- **Meeting logs** — record attendance, speakers, topics, and notes
- **Book tracking** — keep track of where your group is in the Recovery
  Dharma book across cycles and chapters
- **Speaker and topic rotation** — simple rotation helpers so no one gets
  overlooked and no topic gets repeated too soon
- **Group setup and settings** — configure the meeting format, invite
  members with a short code, and override rotations when needed
- **Activity view** — a read-only feed of what the sangha has been up to
- **Data export** — your sangha's data belongs to your sangha; export it any
  time

## Tech Stack

- **Frontend**: React 19 + TypeScript + Vite
  ([`frontend/`](./frontend/README.md))
- **Backend**: FastAPI + SQLAlchemy (Python)
  ([`backend/`](./backend/README.md))
- **Database**: SQLite by default; PostgreSQL supported
- **Hosting**: Railway (for the maintained instance); anywhere Docker runs
  otherwise

## Getting Started

### Using the Hosted Instance

If your sangha just wants to use rd-log, you do not need to install anything.
Ask Geoff or an existing group admin for an invite code, or set up a new
group from the landing page.

### Running Locally

You will need Python 3.11+, Node.js 20+, and `pre-commit`.

```bash
# Clone
git clone https://github.com/geoffe-ga/recovery-dharma-log.git
cd recovery-dharma-log

# Configure
cp .env.example .env
# then edit .env — at minimum set RD_LOG_SECRET_KEY

# Backend
./run-backend.sh

# Frontend (in another terminal)
./run-frontend.sh
```

The frontend will be served at <http://localhost:5173> and the API at
<http://localhost:8000>. See the subproject READMEs for details:

- [`frontend/README.md`](./frontend/README.md)
- [`backend/README.md`](./backend/README.md)

### Self-Hosting for Your Sangha

rd-log ships with a `Dockerfile` and a `railway.json` so any sangha that
wants its own instance can stand one up. Set the environment variables
described in [`.env.example`](./.env.example) — especially a strong
`RD_LOG_SECRET_KEY` — and deploy.

## Contributing

Contributions are welcome from anyone, sangha member or not. See
[CONTRIBUTING.md](./CONTRIBUTING.md) for how to get involved, how we work
together, and the quality expectations for the codebase.

All participants are expected to follow our
[Code of Conduct](./CODE_OF_CONDUCT.md), which is grounded in the Recovery
Dharma values of mindfulness, compassion, forgiveness, and generosity.

## Project Status

rd-log is actively maintained by Geoff Gallinger with contributions from the
community. It is offered as-is under the terms of the MIT License; there is
no warranty and no guaranteed support. That said, issues and pull requests
are read and appreciated.

## License

[MIT](./LICENSE). Copyright © 2026 Geoff Gallinger and rd-log contributors.

## Acknowledgements

- The **Recovery Dharma** community, whose book, meetings, and sangha made
  this project possible and worthwhile.
- Every sangha member, past and present, whose practice is the merit this
  Dana is offered in gratitude for.

_May all beings be free from suffering. May all beings find peace._
