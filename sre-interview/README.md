# sre-interview

A small system that takes customer and order records in over a webhook and puts them on a page. It runs on a local Kubernetes cluster and consists of a typescript frontend, API and worker. Postgres is used as the datastore and Kafka is a simple message queue. The observability tooling and setup is incomplete. The services are instrumented with OpenTelemetry and emit logs, traces and a handful of metrics, which land in ClickStack.

## Prerequisites

[git](https://git-scm.com/downloads)
[Docker](https://docs.docker.com/get-started/get-docker/)
[mise](https://mise.jdx.dev/getting-started.html)

## Running it

```sh
mise trust
mise install
mise run up
```

`mise run up` takes a couple of minutes, and longer the first time while it builds the application images and pulls ClickStack. It finishes by printing every pod in the cluster. When it is done:

| URL                     | Description                              |
| ----------------------- | ---------------------------------------- |
| <http://localhost:3000> | the app - customers and orders.          |
| <http://localhost:8080> | ClickStack: logs, traces and dashboards. |

## Additional commands

| Command            | Description                                           |
| ------------------ | ----------------------------------------------------- |
| `mise run psql`    | a psql shell inside the Postgres pod                  |
| `mise run images`  | build the app images and load them into the kind node |
| `mise run deploy`  | `helmfile sync` every release                         |
| `mise run cluster` | create the kind cluster with Terraform                |
| `mise run down`    | destroy the cluster, and everything on it with it     |

## Layout

| Path         | What it is                                                                            |
| ------------ | ------------------------------------------------------------------------------------- |
| `app/`       | The application: a TypeScript monorepo with a frontend, backend, worker and simulator |
| `terraform/` | Creates the local Kubernetes cluster, and the host ports it publishes                 |
| `deploy/`    | Helm charts, their values, and the helmfile that deploys them                         |

## Architecture

Records arrive over a webhook and are written asynchronously; the page reads what the worker has managed to write.

```text
ingest path

  webhook ──POST /ingest──▶ backend ──publish──▶  ingest  ──▶ worker ──▶ Postgres
                                                 (Kafka)        │
                                                                └──▶ ingest-dlq
                                                                     (unwritable)

read path

  browser ──▶ frontend ──/api──▶ backend ──▶ Postgres
```
