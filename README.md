# Multisig Wallet

## Overview

A minimal T-of-N multisig wallet deployed on Sepolia. The system allows a group of owners to collectively approve and execute transactions once a configurable approval threshold is reached.

## Features

- Fully tested Solidity contract  
- Next.js frontend  
- Event-driven UI  
- ETH transfer support  
- Optional arbitrary contract call support  

This project demonstrates smart contract architecture, secure state management, and frontend integration with on-chain logic.


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
├── contracts/          # Solidity smart contracts 
│   ├── MultiSig.sol    # Main wallet logic
│   └── AccessControl.sol
├── frontend/           # Next.js + Tailwind CSS web application
│   ├── components/     # UI elements
│   └── hooks/          # Wagmi/Viem logic for blockchain calls
├── tests/              # Automated security & logic tests
├── scripts/            # Deployment scripts for Sepolia Testnet
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
