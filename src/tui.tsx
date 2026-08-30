/** @jsxImportSource @opentui/solid */
import type { TuiPlugin, TuiPluginApi, TuiPluginModule } from "@opencode-ai/plugin/tui"
import { createMemo, Show } from "solid-js"

// Provider pricing from models.dev is expressed in USD per 1M tokens.
const PER_TOKEN_DIVISOR = 1_000_000

// Where the panel sits among the other sidebar sections. Built-in sections use
// 100 (session), 200 (mcp), 300 (lsp), 500 (files).
const SIDEBAR_ORDER = 400

function formatTokens(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}m`
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}k`
  return String(count)
}

function formatCost(usd: number): string {
  // 4 decimals: a single turn usually costs a fraction of a cent.
  return `$${usd.toFixed(4)}`
}

function UsagePanel(props: { api: TuiPluginApi; sessionID: string }) {
  const theme = () => props.api.theme.current

  // Accumulates tokens and cost per category across every assistant message of
  // the session (not just the last turn).
  //
  // Providers don't return a dollar amount, so cost is computed locally from
  // each message's model pricing. This is an approximation: it ignores the
  // long-context tiers some providers apply (`cost.experimentalOver200K`), so
  // on very large sessions the total can drift slightly from the real bill.
  const stats = createMemo(() => {
    let input = 0
    let output = 0
    let cacheRead = 0
    let cacheWrite = 0
    let costInput = 0
    let costOutput = 0
    let costCacheRead = 0
    let costCacheWrite = 0

    for (const message of props.api.state.session.messages(props.sessionID)) {
      if (message.role !== "assistant") continue
      const tokens = message.tokens
      // Streaming messages can show up before token accounting exists.
      if (!tokens) continue

      input += tokens.input
      output += tokens.output
      cacheRead += tokens.cache.read
      cacheWrite += tokens.cache.write

      const price = props.api.state.provider.find((provider) => provider.id === message.providerID)
        ?.models[message.modelID]?.cost
      if (!price) continue

      costInput += (tokens.input * price.input) / PER_TOKEN_DIVISOR
      costOutput += (tokens.output * price.output) / PER_TOKEN_DIVISOR
      costCacheRead += (tokens.cache.read * price.cache.read) / PER_TOKEN_DIVISOR
      costCacheWrite += (tokens.cache.write * price.cache.write) / PER_TOKEN_DIVISOR
    }

    // Every input token the model had to process, cached or not. Output is not
    // context, so it stays out of the hit rate.
    const context = cacheRead + cacheWrite + input

    return {
      // Stay hidden until the session proves it actually uses caching.
      active: cacheRead > 0 || cacheWrite > 0,
      hitRate: context > 0 ? Math.round((cacheRead / context) * 100) : 0,
      input,
      output,
      cacheRead,
      cacheWrite,
      costInput,
      costOutput,
      costCacheRead,
      costCacheWrite,
      total: costInput + costOutput + costCacheRead + costCacheWrite,
    }
  })

  return (
    <Show when={stats().active}>
      <box>
        <text fg={theme().text}>
          <b>Usage</b>
        </text>
        <text fg={theme().textMuted}>hit rate: {stats().hitRate}%</text>
        <text fg={theme().textMuted}>
          cache read: {formatTokens(stats().cacheRead)} ({formatCost(stats().costCacheRead)})
        </text>
        <text fg={theme().textMuted}>
          cache write: {formatTokens(stats().cacheWrite)} ({formatCost(stats().costCacheWrite)})
        </text>
        <text fg={theme().textMuted}>
          input: {formatTokens(stats().input)} ({formatCost(stats().costInput)})
        </text>
        <text fg={theme().textMuted}>
          output: {formatTokens(stats().output)} ({formatCost(stats().costOutput)})
        </text>
        <text fg={theme().textMuted}>total: {formatCost(stats().total)}</text>
      </box>
    </Show>
  )
}

const tui: TuiPlugin = async (api) => {
  api.slots.register({
    order: SIDEBAR_ORDER,
    slots: {
      sidebar_content(_ctx, props) {
        return <UsagePanel api={api} sessionID={props.session_id} />
      },
    },
  })
}

const plugin: TuiPluginModule & { id: string } = {
  id: "@toninho09/opencode-cache-scope",
  tui,
}

export default plugin
