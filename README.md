# Multisig Wallet

## Overview

A minimal T-of-N multisig wallet deployed on Sepolia. The system allows a group of owners to collectively approve and execute transactions once a configurable approval threshold is reached.

[Demo Video](https://youtu.be/NqUBLLoDvv0)

## Features

- Fully tested Solidity contract  
- Next.js frontend  
- Event-driven UI  
- ETH transfer support  
- Optional arbitrary contract call support  

## Architecture

```text
[ User Wallet ] 
      │
      ▼
[ Next.js Frontend ] ── (wagmi + viem) ──┐
      │                                  │
      ▼                                  ▼
[ Smart Contract ] ◄──── [ Alchemy RPC Node ]
      │
      ▼
[ Sepolia Testnet ]
```

## Repository Structure

```text
multisig-wallet/
├── contracts/          # Foundry smart contract workspace
│   ├── src/            # Solidity smart contracts
│   ├── test/           # Automated security & logic tests
│   └── script/         # Deployment scripts for Sepolia Testnet
├── frontend/           # Next.js + Tailwind CSS web application
│   ├── components/     # UI elements
│   └── hooks/          # Wagmi/Viem logic for blockchain calls
└── README.md           # Documentation
```


## Tech Stack

### Smart Contract

- Solidity ^0.8.x  
- Foundry  
- OpenZeppelin (security utilities)  

### Frontend

- Next.js  
- TypeScript  
- ethers.js  
- wagmi  
- RainbowKit  

### Network

- Anvil (local development)  
- Sepolia (public testnet)  

## Requirements

### 1. Contract

#### Initialization

- `owners[]` (unique addresses)  
- `threshold` (T ≤ N)  

#### Core Features

- Submit transaction proposal  
- Approve transaction  
- Execute transaction once approvals ≥ threshold  
- Prevent double approval  
- Prevent double execution  
- Emit events for all state transitions  
- Accept ETH via `receive()`  

#### Transaction Structure

- `to`
- `value`
- `data`
- `executed`
- `numApprovals`  


### 2. Frontend

- Connect wallet  
- Display owners and threshold  
- Display contract ETH balance  
- Create transaction form (`to`, `value`, optional `calldata`)  
- List transactions with:
  - Approval count  
  - Approve button  
  - Execute button (enabled when threshold met)  
  - Execution status  

## Security Model Scope

### Covered

- Owner-only approvals  
- Threshold enforcement  
- Execution replay prevention  
- Call success verification  

### Out of Scope

- Upgradeability  
- Owner management  
- Signature-based off-chain approvals  
- Formal verification  
## Quickstart

### Prerequisites

- Node.js (v18+ recommended)
- Foundry (forge/cast/anvil)
- MetaMask (for Sepolia testing)
- A Sepolia RPC endpoint (e.g., Alchemy)

### Install

Clone and install dependencies for both workspaces:

```bash
git clone <your-repo-url>
cd multisig-wallet
```

**Contracts:**

```bash
cd contracts
forge install
forge build
```

**Frontend:**

```bash
cd ../frontend
npm install
```

## Local Development (Anvil)

### 1) Start a local chain

```bash
cd contracts
anvil
```

### 2) Deploy locally

In a second terminal:

```bash
cd contracts
forge script script/Deploy.s.sol:DeployScript --broadcast --rpc-url [http://127.0.0.1:8545](http://127.0.0.1:8545)
```

### 3) Run the frontend against local chain

Set your contract address in `frontend/.env.local` and start the dev server:

```bash
cd ../frontend
npm run dev
```

---

## Sepolia Deployment

### 1) Configure environment variables (contracts)

Create `contracts/.env` (do not commit):

```bash
cd contracts
touch .env
```

**Example:**

```text
SEPOLIA_RPC_URL=[https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY](https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY)
PRIVATE_KEY=0xYOUR_PRIVATE_KEY
OWNERS=0xOwnerA,0xOwnerB
THRESHOLD=2
```

Make sure `.env` is gitignored.

Load env vars into your shell:

```bash
cd contracts
set -a
source .env
set +a
```

### 2) Deploy to Sepolia

```bash
forge script script/Deploy.s.sol:DeployScript --broadcast --rpc-url "$SEPOLIA_RPC_URL" --verify
```

Copy the deployed contract address from the output.

## Frontend Configuration

Create `frontend/.env.local` (also add this to your `.gitignore`):

```text
NEXT_PUBLIC_SEPOLIA_RPC_URL=[https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY](https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY)
NEXT_PUBLIC_MULTISIG_ADDRESS=0xYOUR_DEPLOYED_CONTRACT_ADDRESS
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=YOUR_REOWN_PROJECT_ID
```

Then run:

```bash
cd frontend
npm run dev
```

Open `http://localhost:3000` and connect MetaMask on Sepolia.

## Testing

**Contracts:**

```bash
cd contracts
forge test -vvv
```

**Frontend:**

```bash
cd frontend
npm run dev
```