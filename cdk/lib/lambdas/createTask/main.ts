// addToDb from './add-to-db'
import fetch,{Request} from 'node-fetch'
import { PostConfirmationConfirmSignUpTriggerEvent } from 'aws-lambda'
import {
    CognitoIdentityProviderClient,
    AdminAddUserToGroupCommand,
  } from '@aws-sdk/client-cognito-identity-provider'
import pLimit



export async function getResults(query, inputs) {
  let allItems = [];
  let nextToken = undefined;
  do {
    let items;
    ({ data: { result1: { result2: { items, nextToken } } } } = await API.graphql(graphqlOperation(query, { ...inputs, nextToken })));
    allItems = allItems.concat(items);
  } while (nextToken);
  return allItems;
}


const GRAPHQL_ENDPOINT = process.env.API_DETWEB_GRAPHQLAPIENDPOINTOUTPUT;
const GRAPHQL_API_KEY = process.env.API_DETWEB_GRAPHQLAPIKEYOUTPUT;

exports.handler = async (event:PostConfirmationConfirmSignUpTriggerEvent) => {
    const limitConnections=pLimit(12)
    const images = await getResults(getImagesInSet,{name:selectedSet})
    const {data:{createLocationSet:{id: locationSetId}}} = await API.graphql(graphqlOperation(createLocationSet,{input:{name,projectName:currentProject}}));    
    for (const {image} of images){
      const xSteps=Math.ceil((image.width-width)/(width-sidelap))
      const ySteps=Math.ceil((image.height-height)/(height-overlap))
      const xStepSize=(image.width-width)/xSteps
      const yStepSize=(image.height-height)/ySteps
      for (var xStep=0;xStep<xSteps+1;xStep++){
        for (var yStep=0;yStep<ySteps+1;yStep++){
          const x=Math.round(xStep*xStepSize+width/2)
          const y=Math.round(yStep*yStepSize+height/2)
          limitConnections(()=> 
              API.graphql({query:createLocation,variables:{input:{x,y,width,height,imageKey:image.key,setId:locationSetId}}}))
          }
        }
      }
    }
    await addToGroup(event)
    console.log(await addToDb(event))
    return event
};
