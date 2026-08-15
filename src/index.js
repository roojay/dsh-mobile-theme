/**
 * Node half of dsh-mobile-theme.
 *
 * The whole feature lives in the browser bundle (`./client`). This node
 * half exists for one assembly reason: the client-modules web plugin scan
 * only composes a `dsh.client` package into the boot graph while its host
 * config entry has a fiber, so the entry must load and activate here.
 *
 * There is deliberately nothing to do in Node: the mobile theme layer is
 * applied through the browser-side theme registry (`ctx.theme.overrideTokens`)
 * and the layout work is pure CSS injected by the client bundle. A no-op
 * apply keeps the entry out of `assertEntriesActivated` failures without
 * pinning any host-plane service.
 */

export const inject = [];

/**
 * No-op host plugin body (see module doc).
 * @param {object} ctx - host cordis context.
 */
export function apply(ctx) {
  // Node half intentionally empty: presence is the feature.
}
