

let getterCache={}
let promiseCache={}

export async function getUrl(image){
  const {name,s3key}=image
  if (!(name in promiseCache)){
    if (name in getterCache){
      promiseCache[name]=getterCache[name]()
    }
    else{
      if (s3key){
        promiseCache[name]=Storage.get(s3key,{expires:3600})
      }
      else{
        alert(`Could not find a local or remote source for the image ${image.name}`)
      }
    }
  }
  return promiseCache[name]
}

export function addLocal(entry){
  getterCache[entry.name] = async () => entry.getFile().then(file=>URL.createObjectURL(file))
}

