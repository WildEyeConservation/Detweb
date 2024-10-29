import { SignatureV4 } from '@smithy/signature-v4'
import { HttpRequest } from '@smithy/protocol-http'
import { Sha256 } from '@aws-crypto/sha256-js'
import pLimit from 'p-limit'
const limitConnections=pLimit(10)

const AWS_ACCESS_KEY_ID = "FILLME"
const AWS_SECRET_ACCESS_KEY = FILLME"
const AWS_SESSION_TOKEN="FILLME"

const API_URL = "https://gyzipildmjay5m4ryv7rw6iujq.appsync-api.eu-west-2.amazonaws.com/graphql"

const apiUrl = new URL(API_URL)

const signer = new SignatureV4({
  service: 'appsync',
  region: 'eu-west-2',
  credentials: {
    accessKeyId: AWS_ACCESS_KEY_ID,
      secretAccessKey: AWS_SECRET_ACCESS_KEY,
    sessionToken: AWS_SESSION_TOKEN
  },
  sha256: Sha256,
})

export const signedFetch = async (graphqlObject) => {

  if (!graphqlObject) return

  // set up the HTTP request
  const request = new HttpRequest({
    hostname: apiUrl.host,
    path: apiUrl.pathname,
    body: JSON.stringify(graphqlObject),
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      host: apiUrl.hostname
    },
  })

const signedRequest = await signer.sign(request)

const { headers, body, method } = await signedRequest

const awsSignedRequest = await fetch(API_URL, {
    headers,
    body,
    method
  }).then((res) => res.json())

  return awsSignedRequest
}




let nextNextToken
do {
    const MyGraphqlQuery =  {
        query: `
    query MyQuery ($nextToken: String){
      imageSetMembershipsByImageSetId(imageSetId: "1bde583b-e276-45c5-be0d-3d0839abc640", nextToken: $nextToken) {
        items {
          imageId
        }
        nextToken
      }
    }`, variables: { nextToken: nextNextToken}
    }
    const result = await signedFetch(MyGraphqlQuery)
    console.log(result)
    const { data: { imageSetMembershipsByImageSetId: { items, nextToken } } } = result
    nextNextToken = nextToken
    items.forEach(({imageId}) => {
        limitConnections(async () => {
            const { data: { getImage: { width, height } } } = await signedFetch({
            query:`
                    query MyQuery($id: ID = "") {
                    getImage(id: $id) {
                        width
                        height
                    }
                    }`, variables: { id: imageId }
            })
            // const result = await signedFetch({
            //     query: `mutation MyMutation($height: Int!, $id: ID!, $width: Int!) {
            //             updateImage(input: {width: $width, id: $id, height: $height}) {
            //                 id
            //             }
            //             }`, variables: { id: imageId, width:height, height:width }
            // })
            console.log(width,height)
        })
    });
} while (nextNextToken)


