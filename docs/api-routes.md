# PACTYRA UI API Routes

Reference for every HTTP route exposed by the PACTYRA web UI, including method, path, and a short description of what each route returns.

### API Routes (15)

| Route | Method | Description |
|---|---|---|
| `/api/agent?id=<hex>` | GET | Fetch live agent state from devnet |
| `/api/deployment` | GET | Check all 4 program deployment status |
| `/api/register-agent` | POST | Register a new agent on devnet |
| `/api/lock-bond` | POST | Lock a bond for an agent |
| `/api/record-outcome` | POST | State-machine test harness (bypasses verifier path) |
| `/api/request-capability` | POST | Request a capability |
| `/api/transaction-history?id=<hex>` | GET | Fetch recent transactions for an agent |
| `/api/verifiers` | GET | Verifier abstraction catalog (live + planned verifiers, record_outcome contract, on-chain VerifierRegistry) |
| `/api/verifier/service?resource=<url>&payment_sig=<sig>` | GET | Run Service Outcome Verifier |
| `/api/verifier/demo` | GET | Verifier-agnostic demo (assert → pay → verify → record) |
| `/api/x402/demo` | GET | x402 V2 demo (assert → real USDC payment → resource delivery) |
| `/api/proof` | GET | Machine-verifiable proof trail (agent state + transactions + claims) |
| `/api/business-model` | GET | Three-tier business model (open-source core, hosted, enterprise) |
| `/api/demo-narrative` | GET | 8-scene demo narrative with live agent state |
| `/api/authority-proof?id=<hex>` | GET | Compressed authority proof — agent state, latest evidence, registered verifiers, and 3 recent proof transactions with explorer links |
