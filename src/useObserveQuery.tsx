import { Schema } from './amplify/client-schema'
import { useContext,useEffect, useState } from 'react'
import { GlobalContext } from './Context'
import { V6Client } from '@aws-amplify/api-graphql' 

type ClientType = V6Client<Schema>;
type ModelType= keyof ClientType['models'];

export function useObserveQuery<T extends ModelType>(modelName: T,
                filter?: Parameters<ClientType['models'][T]['observeQuery']>[0] ) {
    const {client} = useContext(GlobalContext)!;
    const model = client.models[modelName];  
    type ResultType = {
        items: Schema[T]['type'][];
        isSynced: boolean;
    };
    const [result, setResult] = useState<ResultType>({items:[],isSynced:false});
    
    useEffect(() => {
        console.log("useObserveQuery",modelName,filter);
        const sub = model.observeQuery(filter).subscribe({
            next: (data) => { setResult(data)},
        });
        return () => sub.unsubscribe();
    }, [modelName]);
    return {...result };
}

// export function useObserveCategories() {
//     const {client} = useContext(GlobalContext)!;
//     const model = client.models.Category;  
//     type ResultType = {
//         items: Schema['Category']['type'][];
//         isSynced: boolean;
//     };
//     const [result, setResult] = useState<ResultType>({items:[],isSynced:false});
//     model.observeQuery({});
//     useEffect(() => {
//         const sub = model.observeQuery().subscribe({
//             next: (data) => { setResult(data)},
//         });
//         return () => sub.unsubscribe();
//     }, [model]);
//     return result;
// }
