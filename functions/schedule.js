import aws from 'aws-sdk'
import gql from 'graphql-tag'
import _ from 'lodash'
import {
  getGraphCli
} from '../utils'

const lambda = new aws.Lambda({
  region: process.env.AWS_DEFAULT_REGION || 'ap-southeast-2'
})

function executeLambda (fn, data) {
  return new Promise((resolve, reject) => {
    lambda.invoke({
      FunctionName: fn,
      Payload: JSON.stringify(data, null, 2),
      InvocationType: 'Event'
    }, function (error) {
      if (error) {
        console.log(`Executing fn ${fn} for store ${data.store} due to ${error}`)
      } else {
        console.log(`Executed fn ${fn} for store ${data.store}`)
      }
      resolve()
    })
  })
}

export default (event, context, callback) => {
  if (!event.function) return callback(new Error('Missing function parameter'))
  console.log(`Schedule function ${event.function}`)

  if (!event.data) return callback(new Error('Missing data parameter'))
  const api = getGraphCli()
  const query = gql`
    query {
      stores {
        name
      }
    }`

  api.query({query: query, variables: {store: event.store}})
    .then((rsp) => {
      return Promise.all(rsp.data.stores.map(store => {
        let data = _.cloneDeep(event.data)
        data.store = store.name
        return executeLambda(event.function, data)
      }))
    })
    .then(() => callback())
    .catch(err => {
      console.trace(err)
      callback(err)
    })
}
