import type {
  API,
  FinalizedEvent,
  IncomingEvent,
  NewBlockEvent,
  NewTransactionEvent,
  OutputAPI,
  Settled,
} from "../types"

export default function yourGhHandle(api: API, outputApi: OutputAPI) {
    // Requirements:
    //
    // 1) When a transaction becomes "settled"-which always occurs upon receiving a "newBlock" event-
    //    you must call `outputApi.onTxSettled`.
    //
    //    - Multiple transactions may settle in the same block, so `onTxSettled` could be called
    //      multiple times per "newBlock" event.
    //    - Ensure callbacks are invoked in the same order as the transactions originally arrived.
    //
    // 2) When a transaction becomes "done"-meaning the block it was settled in gets finalized-
    //    you must call `outputApi.onTxDone`.
    //
    //    - Multiple transactions may complete upon a single "finalized" event.
    //    - As above, maintain the original arrival order when invoking `onTxDone`.
    //    - Keep in mind that the "finalized" event is not emitted for all finalized blocks.
    //
    // Notes:
    // - It is **not** ok to make redundant calls to either `onTxSettled` or `onTxDone`.
    // - It is ok to make redundant calls to `getBody`, `isTxValid` and `isTxSuccessful`
    //
    // Bonus 1:
    // - Avoid making redundant calls to `getBody`, `isTxValid` and `isTxSuccessful`.
    //
    // Bonus 2:
    // - Upon receiving a "finalized" event, call `api.unpin` to unpin blocks that are either:
    //     a) pruned, or
    //     b) older than the currently finalized block.




  const incomingTx: string[] = []


  const settledTransactions: Map<string, Map<string, Settled>> = new Map()


  const completedTransactions: Set<string> = new Set()


  const onNewTx = ({ value: transaction }: NewTransactionEvent) => {
    incomingTx.push(transaction)
  }


  const onNewBlock = ({ blockHash, parent }: NewBlockEvent) => {
    const blockTransactions = api.getBody(blockHash)


    let blockSettlements = settledTransactions.get(blockHash)
    if (!blockSettlements) {
      blockSettlements = new Map<string, Settled>()
      settledTransactions.set(blockHash, blockSettlements)
    }

const txReadyForSettlement: string[] = []

for (const tx of incomingTx) {
  if (blockSettlements!.has(tx)) continue

  const isValid = api.isTxValid(blockHash, tx)
  const isIncluded = blockTransactions.includes(tx)

  if (!isValid || isIncluded) {
    txReadyForSettlement.push(tx)
  }
}


  for (const tx of txReadyForSettlement) {
  const valid = api.isTxValid(blockHash, tx)

  const state: Settled = valid
    ? { blockHash, type: "valid", successful: api.isTxSuccessful(blockHash, tx) }
    : { blockHash, type: "invalid" }

  blockSettlements!.set(tx, state)
  outputApi.onTxSettled(tx, state)
}

    if (parent) {
      api.unpin([parent])
    }
  }


  const onFinalized = ({ blockHash }: FinalizedEvent) => {
    const blockSettlements = settledTransactions.get(blockHash)
    if (!blockSettlements) return


    for (const [tx, state] of blockSettlements) {
      if (!completedTransactions.has(tx)) {
        outputApi.onTxDone(tx, state)
        completedTransactions.add(tx)
      }
    }


    settledTransactions.delete(blockHash)
    api.unpin([blockHash])
  }

  return (event: IncomingEvent) => {
    switch (event.type) {
      case "newTransaction":
        onNewTx(event)
        break
      case "newBlock":
        onNewBlock(event)
        break
      case "finalized":
        onFinalized(event)
        break
    }
  }
}
