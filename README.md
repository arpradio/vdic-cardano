# VDIC-Cardano 🧩
**Verifiable Decentralized IPFS Clusters for Cardano — SDKs, Tools & Docs**

[![status](https://img.shields.io/badge/status-draft--v1.0.0-64748b.svg)](#)
[![license](https://img.shields.io/badge/license-Apache--2.0-22c55e.svg)](LICENSE)
[![ci](https://img.shields.io/badge/ci-gh--actions-3b82f6.svg)](#)

This repository hosts the **developer toolkit** for the VDIC specification:
- **SDKs** (TypeScript/JavaScript, Python)
- **Gateway & verification libraries**
- **CLI utilities**
- **Documentation & examples**

VDIC enables **trustless, verifiable off-chain storage** for Cardano dApps backed by **IPFS clusters**, **DIDs/VCs**, and **asset-based access control**.

---

## 🔗 Quick Links
- **Spec**: `docs/spec.md` (VDIC General Specification)
- **API**: `docs/api.md` (endpoints, request/response, auth)
- **Integration Guide**: `docs/integration.md` (end-to-end flows)
- **Security**: `docs/security.md` (keys, proofs, revocation)
- **Examples**: `examples/` (web + node demos)

> If you’re here to build: jump to **[Quick Start](#-quick-start)** or **[Usage Examples](#-usage-examples)**.

---

## ✨ What is VDIC?
**VDIC (Verifiable Decentralized IPFS Clusters)** defines a standard for connecting Cardano dApps to decentralized storage with **cryptographic verification** and **configurable access**.

**Core ideas**
- **Verifiable Data Integrity** — CIDs + proofs (CAR/blocks/Merkle/zk options)
- **Decentralized Storage** — IPFS cluster replication & region-aware distribution
- **Access Control** — token-gated, VC-based, or custom app logic
- **Cardano-native** — DIDs, VCs, and smart-contract hooks for policy
- **Trustless Access** — light clients can verify without trusting gateways

---

## 📦 Monorepo Layout
