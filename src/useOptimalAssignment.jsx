import computeMunkres from 'munkres-js'
import {useState, useEffect} from 'react';
import {square, sqrt} from 'mathjs'

export function useOptimalAssignment({annotationsHooks,getMatchStatus,transforms,images}){
const [matches,setMatches]=useState([])
const [localAnnotations,setLocalAnnotations] = useState([[],[]]) 
const [proposedAnnotations,setProposedAnnotations] = useState([[],[]]) 

function createNewAnnotation(anno,tf,image){
  let projected = tf([anno.x, anno.y]);
  const obscured = projected.x<0 || projected.y<0 || projected.x>image.width || projected.y>image.height
  return {categoryId: anno.categoryId, x:Math.round(projected.x),y:Math.round(projected.y),obscured,imageKey:image.key,annotationSetId:anno.annotationSetId}
}

function dist(a,b){
    return sqrt(square(a.x-b.x)+square(a.y-b.y));
  }

useEffect (()=>{
  if (transforms){
    console.log('calcCostMatrix triggered')
    const N = localAnnotations[0]?.length + localAnnotations[1]?.length
    if (N){
      //Create an NxN matrix filled with 400
      let distMatrix = Array(N).fill(0).map(() => Array(N).fill(400));
      for (const [i,annoI] of localAnnotations[0].entries()) {
        let projected = transforms[0]([annoI.x, annoI.y]);
        for (const [j,annoJ] of localAnnotations[1].entries()){
          if (annoI.objectId && annoJ.objectId){
            if (annoI.objectId==annoJ.objectId){
              distMatrix[i][j] = -100000
            }else{
              distMatrix[i][j] = +100000 
            }
          }else{
            switch (getMatchStatus([annoI,annoJ])){
                case -1: distMatrix[i][j] = 10000;
                         break
                case 1:  distMatrix[i][j]= -10000
                         break
                default:if (annoI.categoryId==annoJ.categoryId){
                            distMatrix[i][j] = dist(projected, annoJ);
                        }else{
                            distMatrix[i][j]=10000
                        }
                         break
            }
          }
        }
      }
    const proposed=[[],[]]
    const matches=computeMunkres(distMatrix).map(
        ([matchI,matchJ])=>[localAnnotations[0]?.[matchI],localAnnotations[1]?.[matchJ]]).map(([a,b]) => {
          if (a && b) {return [a,b]}
          if (a && !a.obscured) {
            const temp=createNewAnnotation(a,transforms[0],images[1])
            proposed[1].push(temp)
            return [a,temp]
          }
          if (b && !b.obscured){
            const temp=createNewAnnotation(b,transforms[1],images[0])
            proposed[0].push(temp)
            return [temp,b]
          }
          else{
            return [null,null]
          }
        }).filter(([a,b])=> a && b ) // Drop any entries that correspond dummy point matched to other dummy points.
          .filter(([a,b])=> !(a.objectId && b.objectId)) // No need to confirm a match if it has allready been confirmed
          .map(([entryA,entryB])=>{ //Add proposedIds
            const id = entryA?.objectId || entryB?.objectId || crypto.randomUUID();
            if (!(entryA?.objectId) && entryA) entryA.proposedObjectId=id
            if (!(entryB?.objectId) && entryB) entryB.proposedObjectId=id
            return [entryA,entryB]
          }).filter(([a,b])=>!(a.obscured || b.obscured)) // No need to confirm a match if either end of the match is obscured
    matches.sort((a,b)=>(a[0].x+a[0].y>b[0].x+b[0].y) ? 1 : -1)
    setProposedAnnotations(proposed)
    setMatches(matches)
    }  
  }
  },[localAnnotations,getMatchStatus])//localAnnotations,transforms,getMatchStatus

  
  useEffect(() => {
    //Make a deep copy of annotations every time it changes
    setProposedAnnotations([[],[]])
    setLocalAnnotations(annotationsHooks.map(({ annotations }) => annotations?.map(annotation => { return { ...annotation }; })));
  }, [annotationsHooks[0]?.annotations, annotationsHooks[1]?.annotations]);


  function getAugmentedHook(i){
    return {...annotationsHooks[i],annotations: localAnnotations[i]?.concat(proposedAnnotations[i])}
  }

  return {getAugmentedHook,matches}
}