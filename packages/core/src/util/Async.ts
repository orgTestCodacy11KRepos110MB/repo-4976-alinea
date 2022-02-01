export async function accumulate<T>(gen: AsyncGenerator<T>): Promise<Array<T>> {
  const acc = []
  for await (const item of gen) acc.push(item)
  return acc
}