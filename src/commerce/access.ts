export function isShopBrowsePath(path: string) {
  const normalized = path.replace(/^\/app\/shop(?=\/|$)/, '/shop').replace(/\/$/, '')
  return ['/shop', '/shop/catalog', '/shop/help'].includes(normalized) || /^\/shop\/products\/[^/]+$/.test(normalized)
}
