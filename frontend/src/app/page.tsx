"use client";

import multisigArtifact from "@/abi/Multisig.json";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  formatEther,
  isAddress,
  isHex,
  parseEther,
  type Abi,
  type Address,
  type Hex,
} from "viem";
import {
  useAccount,
  useBalance,
  usePublicClient,
  useReadContract,
  useReadContracts,
  useWriteContract,
} from "wagmi";
import { sepolia } from "wagmi/chains";

type TransactionRow = {
  txId: number;
  to: Address;
  value: bigint;
  data: Hex;
  executed: boolean;
  numApprovals: bigint;
};

const multisigAbi = multisigArtifact.abi as Abi;
const MAX_OWNER_SCAN = 50;
const ACCOUNT_NAME_STORAGE_PREFIX = "multisig.accountName";

function toErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return "Something went wrong.";
}

function shortenHex(value: string, length = 6): string {
  if (value.length <= length * 2 + 2) return value;
  return `${value.slice(0, length + 2)}...${value.slice(-length)}`;
}

function getAccountStorageKey(address: Address): string {
  return `${ACCOUNT_NAME_STORAGE_PREFIX}.${address.toLowerCase()}`;
}

export default function HomePage() {
  const { address, isConnected, chainId, connector } = useAccount();
  const publicClient = usePublicClient({ chainId: sepolia.id });
  const { writeContractAsync, isPending: isWritePending } = useWriteContract();
  const configuredMultisigAddress = process.env.NEXT_PUBLIC_MULTISIG_ADDRESS;
  const multisigAddress = useMemo(
    () =>
      configuredMultisigAddress && isAddress(configuredMultisigAddress)
        ? (configuredMultisigAddress as Address)
        : undefined,
    [configuredMultisigAddress]
  );

  const [to, setTo] = useState("");
  const [valueEth, setValueEth] = useState("0");
  const [dataHex, setDataHex] = useState("0x");
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [actionStatus, setActionStatus] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [ownerCount, setOwnerCount] = useState<number | null>(null);
  const [isOwnerCountLoading, setIsOwnerCountLoading] = useState(false);
  const [ownerCountError, setOwnerCountError] = useState<string | null>(null);
  const [accountName, setAccountName] = useState("");
  const [accountNameInput, setAccountNameInput] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadOwnerCount() {
      if (!multisigAddress || !publicClient) {
        if (!cancelled) {
          setOwnerCount(null);
          setIsOwnerCountLoading(false);
          setOwnerCountError(null);
        }
        return;
      }

      setIsOwnerCountLoading(true);
      setOwnerCountError(null);

      try {
        let count = 0;
        for (let index = 0; index < MAX_OWNER_SCAN; index += 1) {
          try {
            await publicClient.readContract({
              abi: multisigAbi,
              address: multisigAddress,
              functionName: "owners",
              args: [BigInt(index)],
            });
            count += 1;
          } catch {
            break;
          }
        }

        if (!cancelled) {
          setOwnerCount(count);
        }
      } catch (error) {
        if (!cancelled) {
          setOwnerCount(null);
          setOwnerCountError(toErrorMessage(error));
        }
      } finally {
        if (!cancelled) {
          setIsOwnerCountLoading(false);
        }
      }
    }

    void loadOwnerCount();

    return () => {
      cancelled = true;
    };
  }, [multisigAddress, publicClient]);

  useEffect(() => {
    if (!address) {
      setAccountName("");
      setAccountNameInput("");
      return;
    }

    const storageKey = getAccountStorageKey(address);
    const stored = window.localStorage.getItem(storageKey) ?? "";
    setAccountName(stored);
    setAccountNameInput(stored);
  }, [address]);

  const {
    data: threshold,
    isLoading: isThresholdLoading,
    error: thresholdError,
    refetch: refetchThreshold,
  } = useReadContract({
    abi: multisigAbi,
    address: multisigAddress,
    functionName: "threshold",
    chainId: sepolia.id,
    query: { enabled: Boolean(multisigAddress) },
  });

  const {
    data: txCount,
    isLoading: isTxCountLoading,
    error: txCountError,
    refetch: refetchTxCount,
  } = useReadContract({
    abi: multisigAbi,
    address: multisigAddress,
    functionName: "getTransactionCount",
    chainId: sepolia.id,
    query: { enabled: Boolean(multisigAddress) },
  });

  const {
    data: multisigBalance,
    isLoading: isMultisigBalanceLoading,
    error: multisigBalanceError,
    refetch: refetchMultisigBalance,
  } = useBalance({
    address: multisigAddress,
    chainId: sepolia.id,
    query: { enabled: Boolean(multisigAddress) },
  });

  const txCountNumber = Number(txCount ?? 0n);
  const txIds = useMemo(
    () => Array.from({ length: txCountNumber }, (_, i) => BigInt(i)),
    [txCountNumber]
  );

  const {
    data: transactionResults,
    isLoading: isTransactionsLoading,
    error: transactionsError,
    refetch: refetchTransactions,
  } = useReadContracts({
    contracts: multisigAddress
      ? txIds.map((txId) => ({
          abi: multisigAbi,
          address: multisigAddress,
          functionName: "transactions",
          args: [txId],
          chainId: sepolia.id,
        }))
      : [],
    allowFailure: false,
    query: {
      enabled: Boolean(multisigAddress && txIds.length > 0),
    },
  });

  const {
    data: approvalResults,
    refetch: refetchApprovals,
  } = useReadContracts({
    contracts: multisigAddress && address
      ? txIds.map((txId) => ({
          abi: multisigAbi,
          address: multisigAddress,
          functionName: "approved",
          args: [txId, address],
          chainId: sepolia.id,
        }))
      : [],
    allowFailure: false,
    query: {
      enabled: Boolean(multisigAddress && address && txIds.length > 0),
    },
  });

  const transactions = useMemo<TransactionRow[]>(() => {
    if (!transactionResults) return [];

    return transactionResults.map((result, index) => {
      const [resultTo, resultValue, resultData, resultExecuted, resultApprovals] =
        result as readonly [Address, bigint, Hex, boolean, bigint];

      return {
        txId: index,
        to: resultTo,
        value: resultValue,
        data: resultData,
        executed: resultExecuted,
        numApprovals: resultApprovals,
      };
    });
  }, [transactionResults]);

  const approvedByTxId = useMemo<Record<number, boolean>>(() => {
    if (!approvalResults) return {};
    return approvalResults.reduce<Record<number, boolean>>((acc, result, index) => {
      acc[index] = Boolean(result);
      return acc;
    }, {});
  }, [approvalResults]);

  const writesDisabled =
    !isConnected ||
    !multisigAddress ||
    chainId !== sepolia.id ||
    isWritePending ||
    Boolean(pendingAction);

  useEffect(() => {
    const m = threshold?.toString() ?? "-";
    const n = ownerCount !== null ? ownerCount.toString() : "-";
    document.title = `${m} of ${n} Multisig Wallet`;
  }, [threshold, ownerCount]);

  async function refreshReads() {
    await refetchThreshold();
    await refetchTxCount();
    await refetchMultisigBalance();
    await refetchTransactions();
    await refetchApprovals();
  }

  function assertCanWrite() {
    if (!isConnected || !address) throw new Error("Connect wallet first.");
    if (!multisigAddress) throw new Error("Invalid NEXT_PUBLIC_MULTISIG_ADDRESS.");
    if (chainId !== sepolia.id) throw new Error("Switch wallet network to Sepolia.");
    if (!publicClient) throw new Error("Sepolia RPC client is not available.");
  }

  function saveAccountName() {
    if (!address) return;

    const normalized = accountNameInput.trim();
    const storageKey = getAccountStorageKey(address);
    if (normalized) {
      window.localStorage.setItem(storageKey, normalized);
    } else {
      window.localStorage.removeItem(storageKey);
    }

    setAccountName(normalized);
  }

  async function handleApprove(txId: number) {
    try {
      assertCanWrite();
      setActionError(null);
      setPendingAction(`approve-${txId}`);
      setActionStatus("Approve: waiting for wallet confirmation...");

      const hash = await writeContractAsync({
        abi: multisigAbi,
        address: multisigAddress!,
        functionName: "approve",
        args: [BigInt(txId)],
        chainId: sepolia.id,
      });

      setActionStatus(`Approve: pending ${shortenHex(hash)}...`);
      await publicClient!.waitForTransactionReceipt({ hash });

      setActionStatus(`Approve successful for tx ${txId}.`);
      await refreshReads();
    } catch (error) {
      setActionError(toErrorMessage(error));
    } finally {
      setPendingAction(null);
    }
  }

  async function handleExecute(txId: number) {
    try {
      assertCanWrite();
      setActionError(null);
      setPendingAction(`execute-${txId}`);
      setActionStatus("Execute: waiting for wallet confirmation...");

      const hash = await writeContractAsync({
        abi: multisigAbi,
        address: multisigAddress!,
        functionName: "execute",
        args: [BigInt(txId)],
        chainId: sepolia.id,
      });

      setActionStatus(`Execute: pending ${shortenHex(hash)}...`);
      await publicClient!.waitForTransactionReceipt({ hash });

      setActionStatus(`Execute successful for tx ${txId}.`);
      await refreshReads();
    } catch (error) {
      setActionError(toErrorMessage(error));
    } finally {
      setPendingAction(null);
    }
  }

  async function handleSubmitTx(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      assertCanWrite();
      setActionError(null);
      setPendingAction("submit");
      setActionStatus("Submit: waiting for wallet confirmation...");

      if (!isAddress(to)) {
        throw new Error("Recipient address is invalid.");
      }

      const parsedValue = parseEther(valueEth || "0");
      const normalizedData = dataHex.trim() === "" ? "0x" : dataHex.trim();
      if (!normalizedData.startsWith("0x") || !isHex(normalizedData)) {
        throw new Error("dataHex must be valid hex starting with 0x.");
      }

      const hash = await writeContractAsync({
        abi: multisigAbi,
        address: multisigAddress!,
        functionName: "submit",
        args: [to as Address, parsedValue, normalizedData as Hex],
        chainId: sepolia.id,
      });

      setActionStatus(`Submit: pending ${shortenHex(hash)}...`);
      await publicClient!.waitForTransactionReceipt({ hash });

      setActionStatus("Transaction submitted successfully.");
      setTo("");
      setValueEth("0");
      setDataHex("0x");
      await refreshReads();
    } catch (error) {
      setActionError(toErrorMessage(error));
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 p-6 text-slate-900">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <header className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4">
          <div>
            <h1 className="text-2xl font-semibold">
              {(threshold ?? "-").toString()} of{" "}
              {ownerCount !== null ? ownerCount : "-"} Multisig Wallet
            </h1>
            <p className="text-sm text-slate-600">Sepolia</p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <ConnectButton />
            {isConnected && connector?.name ? (
              <div className="flex flex-col items-end gap-1 text-xs text-slate-600">
                <p>Wallet: {connector.name}</p>
                {address ? (
                  <p>Account: {accountName || shortenHex(address)}</p>
                ) : null}
                {address ? (
                  <input
                    type="text"
                    value={accountNameInput}
                    onChange={(event) => setAccountNameInput(event.target.value)}
                    onBlur={saveAccountName}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        saveAccountName();
                        (event.currentTarget as HTMLInputElement).blur();
                      }
                    }}
                    placeholder="Set account name"
                    className="w-44 rounded-md border border-slate-300 px-2 py-1 text-xs"
                  />
                ) : null}
              </div>
            ) : null}
          </div>
        </header>

        {!multisigAddress ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            NEXT_PUBLIC_MULTISIG_ADDRESS is missing or invalid.
          </div>
        ) : null}

        {chainId && chainId !== sepolia.id ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">
            Connected to chain ID {chainId}. Switch to Sepolia ({sepolia.id}) to
            write transactions.
          </div>
        ) : null}

        <section className="grid gap-4 md:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-sm text-slate-600">Threshold</p>
            <p className="mt-2 text-xl font-semibold">
              {isThresholdLoading ? "Loading..." : (threshold ?? 0n).toString()}
            </p>
            {thresholdError ? (
              <p className="mt-2 text-sm text-red-600">
                {toErrorMessage(thresholdError)}
              </p>
            ) : null}
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-sm text-slate-600">Transaction Count</p>
            <p className="mt-2 text-xl font-semibold">
              {isTxCountLoading ? "Loading..." : txCountNumber}
            </p>
            {txCountError ? (
              <p className="mt-2 text-sm text-red-600">{toErrorMessage(txCountError)}</p>
            ) : null}
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-sm text-slate-600">Multisig Balance</p>
            <p className="mt-2 text-xl font-semibold">
              {isMultisigBalanceLoading
                ? "Loading..."
                : multisigBalance
                  ? `${formatEther(multisigBalance.value)} ${multisigBalance.symbol}`
                  : "-"}
            </p>
            {multisigBalanceError ? (
              <p className="mt-2 text-sm text-red-600">
                {toErrorMessage(multisigBalanceError)}
              </p>
            ) : null}
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-sm text-slate-600">Owners</p>
            <p className="mt-2 text-xl font-semibold">
              {isOwnerCountLoading
                ? "Loading..."
                : ownerCount !== null
                  ? ownerCount
                  : "-"}
            </p>
            {ownerCountError ? (
              <p className="mt-2 text-sm text-red-600">{ownerCountError}</p>
            ) : null}
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="text-lg font-semibold">Create Transaction</h2>
          <form className="mt-4 grid gap-3" onSubmit={handleSubmitTx}>
            <input
              type="text"
              placeholder="to (0x...)"
              value={to}
              onChange={(event) => setTo(event.target.value.trim())}
              className="rounded-md border border-slate-300 px-3 py-2"
            />
            <input
              type="text"
              placeholder="value in ETH"
              value={valueEth}
              onChange={(event) => setValueEth(event.target.value)}
              className="rounded-md border border-slate-300 px-3 py-2"
            />
            <input
              type="text"
              placeholder="data hex (default 0x)"
              value={dataHex}
              onChange={(event) => setDataHex(event.target.value)}
              className="rounded-md border border-slate-300 px-3 py-2"
            />
            <button
              type="submit"
              disabled={writesDisabled}
              className="w-fit rounded-md bg-slate-900 px-4 py-2 text-white disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              {pendingAction === "submit" ? "Submitting..." : "Submit"}
            </button>
          </form>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="text-lg font-semibold">Transactions</h2>

          {isTransactionsLoading ? (
            <p className="mt-4 text-sm text-slate-600">Loading transactions...</p>
          ) : null}

          {transactionsError ? (
            <p className="mt-4 text-sm text-red-600">{toErrorMessage(transactionsError)}</p>
          ) : null}

          {!isTransactionsLoading && transactions.length === 0 ? (
            <p className="mt-4 text-sm text-slate-600">No transactions yet.</p>
          ) : null}

          {transactions.length > 0 ? (
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left">
                    <th className="px-3 py-2">txId</th>
                    <th className="px-3 py-2">to</th>
                    <th className="px-3 py-2">value (ETH)</th>
                    <th className="px-3 py-2">approvals</th>
                    <th className="px-3 py-2">executed</th>
                    <th className="px-3 py-2">actions</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((tx) => {
                    const hasApproved = Boolean(approvedByTxId[tx.txId]);
                    const canApprove = !tx.executed && !hasApproved;
                    const hasEnoughBalance = multisigBalance
                      ? tx.value <= multisigBalance.value
                      : true;
                    const canExecute =
                      !tx.executed &&
                      threshold !== undefined &&
                      tx.numApprovals >= threshold &&
                      hasEnoughBalance;

                    return (
                      <tr key={tx.txId} className="border-b border-slate-100">
                        <td className="px-3 py-2">{tx.txId}</td>
                        <td className="px-3 py-2" title={tx.to}>
                          {shortenHex(tx.to)}
                        </td>
                        <td className="px-3 py-2">{formatEther(tx.value)}</td>
                        <td className="px-3 py-2">{tx.numApprovals.toString()}</td>
                        <td className="px-3 py-2">{tx.executed ? "Yes" : "No"}</td>
                        <td className="px-3 py-2">
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => handleApprove(tx.txId)}
                              disabled={writesDisabled || !canApprove}
                              className="rounded-md border border-slate-300 px-3 py-1 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {pendingAction === `approve-${tx.txId}`
                                ? "Approving..."
                                : "Approve"}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleExecute(tx.txId)}
                              disabled={writesDisabled || !canExecute}
                              className="rounded-md bg-emerald-600 px-3 py-1 text-white disabled:cursor-not-allowed disabled:bg-emerald-300"
                            >
                              {pendingAction === `execute-${tx.txId}`
                                ? "Executing..."
                                : "Execute"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : null}
        </section>

        {actionStatus ? (
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-700">
            {actionStatus}
          </div>
        ) : null}

        {actionError ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {actionError}
          </div>
        ) : null}
      </div>
    </main>
  );
}
