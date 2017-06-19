import ApolloClient, { createNetworkInterface } from 'apollo-client'

export const getGraphCli = () => {
  return new ApolloClient({networkInterface: createNetworkInterface({uri: process.env.GRAPHQL_URL})})
}

export const storeQuery = `
    store(name: $store) {
      name
      timezone
      deputy {
        url
        api_key
      }
    }`

export const pagedPromise = (action, resource, filter, sort, data, limit = 500) => {
  let entries = []
  let lastCount = limit + 1

  function loop () {
    if (limit >= lastCount) {
      return Promise.resolve(entries)
    }
    const start = entries.length === 0 ? 0 : entries.length + 1
    return Promise.resolve(action(resource, filter, sort, data, start, limit))
      .then(results => {
        for (let r of results) {
          entries.push(r)
        }
        lastCount = results.length
        return Promise.resolve().then(loop)
      })
      .catch(err => Promise.reject(err))
  }

  return Promise.resolve().then(loop)
}

export const TimedMutation = (mutation, desc) => {
  let now = Date.now()
  return new Promise((resolve, reject) => {
    mutation
      .then(() => {
        console.log('Processed', desc, 'mutations in', (Date.now() - now) / 1000, ' seconds')
        resolve()
      })
      .catch(err => {
        console.log('error updating clients', err)
        reject(err)
      })
  })
}

export const createGroupedArray = (arr, chunkSize) => {
  let groups = []
  let i
  for (i = 0; i < arr.length; i += chunkSize) {
    groups.push(arr.slice(i, i + chunkSize))
  }
  return groups
}

export const toCurrency = (o) => {
  return Number(o.toFixed(2))
}

export const divide = (d1, d2) => {
  if (d1 === 0 || d2 === 0) {
    return 0
  }
  return toCurrency(d1 / d2)
}