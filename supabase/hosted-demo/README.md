# Hosted customer demo

The current contract is version **2** in `public-demo-contract-v1.json`.
Customers register, sign in and browse their own sample workspace, menus and
initial forms. Internal **Save** and **Continue** actions are disabled. Only
initial registration and sample-workspace creation write data.

Install the SQL assets in their recorded order:

1. `public-demo-workspaces-v1.sql`
2. `public-demo-version-conflict-v1.sql`
3. `public-demo-preview-only-v1.sql`
4. `public-demo-registration-idempotency-v1.sql`

The earlier files are historical installation steps. Never replay one over the
final preview-only restrictions: it would restore superseded interactive code.
These files are separate hosted-demo assets, not changes to native migrations.

`verification.preview-only.staging.json` records the current hosted proof:
63 actual HTTP/Auth/RPC preview and denial checks, followed by six targeted
registration-retry checks after the narrow idempotency amendment. Both fixtures
and their sample data were removed. All fourteen final demo function bodies,
fixed search paths and effective ACLs matched the source; native API definitions
were unchanged. Email delivery and frontend/browser acceptance are still open.

`verification.staging.json` is historical evidence for the superseded interactive
scope at `b412182`; its successful item writes are not the current contract.

The test driver requires explicit hosted-test opt-in and dedicated
`CLADORA_STAGING_*` variables. Use only the isolated staging project; never fall
back to general database variables. It creates synthetic admin-confirmed Auth
fixtures, which do not establish delivery of a verification email.

```sh
CLADORA_PUBLIC_DEMO_HOSTED_TEST=1 \
CLADORA_DEMO_TEST_ARTIFACT_DIR=<private-temporary-directory> \
python supabase/hosted-demo/tests/public-demo-rpc.test.py
```

After independent owner readback, run the same command with `cleanup`. The
temporary session file is private and must never be committed or attached.
Existing successful proof need not be repeated without a relevant change.

Frontend execution remains separate: show the actual server descriptor and
database reads, disable internal save/continue controls, and never use native
Operations, financial or messaging endpoints for the preview. Signup/callback
integration and the user-facing acceptance flow still require implementation.
