# Tagged production deployments

Production deploys automatically after a semantic version tag is pushed to
GitHub. The workflow in `.github/workflows/deploy-tag.yml` runs `make check`
first and calls the same `deploy.sh` used for local deployments only after the
verification job succeeds.

Accepted tags begin with `v` and use semantic versioning, for example `v1.4.0`
or `v1.4.0-rc.1`. Other `v*` tags start the workflow but fail validation before
authentication or deployment.

## One-time Google Cloud setup

The workflow uses GitHub's OIDC token and Google Workload Identity Federation.
Do not create or store a service-account JSON key in GitHub.

Set the shell variables used below:

```bash
export PROJECT_ID=aperiodos
export GITHUB_REPOSITORY=trainvent/aperiodos
export WORKLOAD_IDENTITY_POOL=github
export WORKLOAD_IDENTITY_PROVIDER=aperiodos
export DEPLOY_SERVICE_ACCOUNT=github-deployer
```

Enable the required APIs and create the deployer service account:

```bash
gcloud services enable \
  iamcredentials.googleapis.com \
  sts.googleapis.com \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  secretmanager.googleapis.com \
  --project="$PROJECT_ID"

gcloud iam service-accounts create "$DEPLOY_SERVICE_ACCOUNT" \
  --project="$PROJECT_ID" \
  --display-name="GitHub tagged-release deployer"
```

Create a pool and a provider restricted to this GitHub repository:

```bash
gcloud iam workload-identity-pools create "$WORKLOAD_IDENTITY_POOL" \
  --project="$PROJECT_ID" \
  --location=global \
  --display-name="GitHub Actions"

gcloud iam workload-identity-pools providers create-oidc "$WORKLOAD_IDENTITY_PROVIDER" \
  --project="$PROJECT_ID" \
  --location=global \
  --workload-identity-pool="$WORKLOAD_IDENTITY_POOL" \
  --display-name="Aperiodos GitHub releases" \
  --issuer-uri="https://token.actions.githubusercontent.com" \
  --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository,attribute.repository_owner=assertion.repository_owner" \
  --attribute-condition="assertion.repository == 'trainvent/aperiodos'"
```

Allow only workflows from this repository to impersonate the deployer:

```bash
PROJECT_NUMBER="$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')"
DEPLOY_SERVICE_ACCOUNT_EMAIL="$DEPLOY_SERVICE_ACCOUNT@$PROJECT_ID.iam.gserviceaccount.com"
WORKLOAD_IDENTITY_PROVIDER_NAME="$(gcloud iam workload-identity-pools providers describe "$WORKLOAD_IDENTITY_PROVIDER" \
  --project="$PROJECT_ID" \
  --location=global \
  --workload-identity-pool="$WORKLOAD_IDENTITY_POOL" \
  --format='value(name)')"

gcloud iam service-accounts add-iam-policy-binding "$DEPLOY_SERVICE_ACCOUNT_EMAIL" \
  --project="$PROJECT_ID" \
  --role=roles/iam.workloadIdentityUser \
  --member="principalSet://iam.googleapis.com/projects/$PROJECT_NUMBER/locations/global/workloadIdentityPools/$WORKLOAD_IDENTITY_POOL/attribute.repository/$GITHUB_REPOSITORY"
```

Grant the deployer the roles required by `gcloud run deploy --source` and the
secret-version preflight in `deploy.sh`:

```bash
for role in \
  roles/run.sourceDeveloper \
  roles/serviceusage.serviceUsageConsumer \
  roles/secretmanager.viewer
do
  gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member="serviceAccount:$DEPLOY_SERVICE_ACCOUNT_EMAIL" \
    --role="$role"
done
```

Allow the deployer to act as the Cloud Run runtime identity and ensure the
default source-build identity can build the container:

```bash
RUNTIME_SERVICE_ACCOUNT="$(gcloud run services describe aperiodic-monotiles-generator \
  --project="$PROJECT_ID" \
  --region=europe-west1 \
  --format='value(spec.template.spec.serviceAccountName)')"

if [[ -z "$RUNTIME_SERVICE_ACCOUNT" ]]; then
  RUNTIME_SERVICE_ACCOUNT="$PROJECT_NUMBER-compute@developer.gserviceaccount.com"
fi

gcloud iam service-accounts add-iam-policy-binding "$RUNTIME_SERVICE_ACCOUNT" \
  --project="$PROJECT_ID" \
  --member="serviceAccount:$DEPLOY_SERVICE_ACCOUNT_EMAIL" \
  --role=roles/iam.serviceAccountUser

gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:$PROJECT_NUMBER-compute@developer.gserviceaccount.com" \
  --role=roles/run.builder
```

The tagged workflow sets `SKIP_PUBLIC_IAM_UPDATE=1`, so it preserves the
existing service access policy and does not need the broader Cloud Run Admin
role. Confirm once that the service is already public:

```bash
gcloud run services get-iam-policy aperiodic-monotiles-generator \
  --project="$PROJECT_ID" \
  --region=europe-west1
```

## GitHub production environment

Create a GitHub Actions environment named `production`. Add these environment
variables (they are resource identifiers, not secrets):

| Variable | Value |
| --- | --- |
| `GCP_WORKLOAD_IDENTITY_PROVIDER` | The value printed by `echo "$WORKLOAD_IDENTITY_PROVIDER_NAME"` |
| `GCP_DEPLOY_SERVICE_ACCOUNT` | The value printed by `echo "$DEPLOY_SERVICE_ACCOUNT_EMAIL"` |

Optional environment protection rules can require approval before the deploy
job begins. The verification job always completes before that approval gate.

## Release

Create and push a tag only after its commit is ready for production:

```bash
git tag -a v1.0.0 -m "Release v1.0.0"
git push origin v1.0.0
```

The workflow serializes production deployments, so two tags cannot update the
Cloud Run service concurrently. Follow the run under the repository's Actions
tab; the completed deploy job includes the Cloud Run revision and service URL.
The release tag is also exposed to the running service as `APP_VERSION` and is
shown on the About page.
